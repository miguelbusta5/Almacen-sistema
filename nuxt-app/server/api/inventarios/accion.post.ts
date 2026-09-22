import { createError, defineEventHandler, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { actorInventario, auditarInventario, filasInventario, lockInventario, productoInventario } from '../../utils/inventarioCiclico'
import { consolidarInventario, estadoInventario, fisicoInventario } from '../../utils/inventarioCiclicoCalc'

export default defineEventHandler(async event => {
  const actor = await requireAuth(event), p = await actorInventario(actor), b = await readBody(event)
  if (!b || typeof b.accion !== 'string' || typeof b.cicloId !== 'string') throw createError({ statusCode: 400, statusMessage: 'Acción inválida' })
  function fallo(s: string): never { throw createError({ statusCode: 409, statusMessage: s }) }
  return prisma.$transaction(async tx => {
    await lockInventario(tx)
    const c = await tx.inventarioCiclico.findUnique({ where: { id: b.cicloId }, include: { tareas: { include: { registros: true } }, casos: true } })
    if (!c || c.estado === 'CERRADO') fallo('Cíclico cerrado o inexistente')
    const filas = filasInventario(c.filas), gestion = () => { if (!p.gestionar) throw createError({ statusCode: 403, statusMessage: 'Acción exclusiva de Carlos' }) }
    const operarioValido = async (id: string) => {
      const [permiso, user] = await Promise.all([tx.inventarioAcceso.findUnique({ where: { userId: id } }), tx.user.findUnique({ where: { id }, select: { active: true } })])
      if (!permiso?.contar || !user?.active) fallo('Operario no autorizado o inactivo')
    }
    if (b.accion === 'asignar') {
      gestion(); if (c.estado !== 'BORRADOR') fallo('El conteo ya fue lanzado')
      if (typeof b.usuarioId !== 'string' || !Array.isArray(b.tareas) || !b.tareas.length || b.tareas.some((id: unknown) => !c.tareas.some(t => t.id === id && t.tipo === 'INICIAL'))) fallo('Selecciona las ubicaciones y el operario')
      await operarioValido(b.usuarioId)
      await tx.inventarioTarea.updateMany({ where: { id: { in: b.tareas }, cicloId: c.id }, data: { usuarioId: b.usuarioId } })
    } else if (b.accion === 'lanzar') {
      gestion(); if (c.estado !== 'BORRADOR' || c.tareas.some(t => !t.usuarioId)) fallo('Asigna todas las ubicaciones antes de lanzar')
      for (const id of new Set(c.tareas.map(t => t.usuarioId!))) {
        await operarioValido(id)
        await tx.notificacion.create({ data: { userId: id, titulo: 'Nuevo conteo cíclico', descripcion: c.nombre, tipo: 'INVENTARIO', enlace: '/dashboard/inventarios' } })
      }
      await tx.inventarioCiclico.update({ where: { id: c.id }, data: { estado: 'EN_CONTEO' } })
    } else if (b.accion === 'reconteo') {
      gestion(); if (c.estado !== 'REVISION') fallo('Termina el conteo inicial antes de reasignar novedades')
      const caso = c.casos.find(x => x.id === b.casoId && x.estado === 'ABIERTO')
      if (!caso || !Array.isArray(b.usuarios) || !b.usuarios.length || b.usuarios.length > 2 || b.usuarios.some((id: unknown) => typeof id !== 'string')) fallo('Selecciona el caso y uno o dos operarios')
      for (const id of new Set<string>(b.usuarios)) {
        await operarioValido(id)
        if (c.tareas.some(t => t.casoId === caso.id && t.usuarioId === id && t.estado !== 'COMPLETADA')) fallo('Este operario ya tiene un reconteo pendiente del caso')
        await tx.inventarioTarea.create({ data: { cicloId: c.id, ubicacion: caso.ubicacion, tipo: 'RECONTEO', casoId: caso.id, usuarioId: id } })
        await tx.notificacion.create({ data: { userId: id, titulo: 'Verificación de diferencias', descripcion: `${caso.plu} · ${caso.ubicacion}`, tipo: 'INVENTARIO', enlace: '/dashboard/inventarios' } })
      }
    } else if (b.accion === 'resolver') {
      gestion(); const caso = c.casos.find(x => x.id === b.casoId && x.estado === 'ABIERTO')
      if (!caso || c.estado !== 'REVISION') fallo('Caso no disponible')
      const tareas = c.tareas.filter(t => t.casoId === caso.id)
      if (!tareas.length || tareas.some(t => t.estado !== 'COMPLETADA')) fallo('Deben terminar todos los reconteos asignados')
      const elegido = tareas.flatMap(t => t.registros).find(r => r.id === b.resultadoId)
      if (!elegido) fallo('Selecciona el reconteo que Carlos valida')
      await tx.inventarioCaso.update({ where: { id: caso.id }, data: { estado: 'CERRADO', resultadoId: elegido.id, cerradoAt: new Date(), cerradoPorId: actor.id, observacion: String(b.observacion ?? '').slice(0,2000) } })
    } else if (b.accion === 'cerrar') {
      gestion(); if (c.estado !== 'REVISION' || c.casos.some(x => x.estado !== 'CERRADO')) fallo('Termina el conteo y cierra todas las novedades')
      const version = await tx.inventarioMaestroVersion.findFirst({ where: { cronogramaId: c.cronogramaId }, orderBy: { numero: 'desc' } })
      if (!version) fallo('Falta el maestro PVP')
      const consolidado = consolidarInventario(filas, c.teorico as Record<string,number>, c.tareas.filter(t => t.tipo === 'INICIAL').flatMap(t => t.registros.map(r => ({ ubicacion: t.ubicacion, plu: r.plu, fisico: r.fisico }))))
      const productos = await tx.inventarioProductoPvp.findMany({ where: { versionId: version.id, plu: { in: consolidado.map(r => r.plu) } } })
      const falta = consolidado.filter(r => !productos.some(p => p.plu === r.plu && p.precio !== null))
      if (falta.length) fallo(`Actualiza el PVP: faltan productos o precios para ${falta.slice(0,10).map(r => r.plu).join(', ')}`)
      const cierre = consolidado.map(r => { const m = productos.find(p => p.plu === r.plu)!; return { ...r, upc: m.upc, descripcion: m.descripcion, precio: Number(m.precio), linea: m.linea, proveedor: m.proveedor, observacion: c.casos.filter(x => x.plu === r.plu).map(x => x.observacion).filter(Boolean).join('; ') } })
      await tx.inventarioCiclico.update({ where: { id: c.id }, data: { estado: 'CERRADO', cerradoAt: new Date(), versionCierreId: version.id, cierre } })
    } else {
      const t = c.tareas.find(t => t.id === b.tareaId)
      if (!t || t.usuarioId !== actor.id || !p.contar) throw createError({ statusCode: 403, statusMessage: 'Esta tarea no está asignada a tu usuario' })
      if (c.estado === 'BORRADOR' || t.estado === 'COMPLETADA') fallo('Tarea no disponible para captura')
      if (t.revision !== b.revision) fallo('La tarea cambió. Actualiza antes de continuar')
      const now = new Date()
      const otroActivo = async () => {
        if (await tx.inventarioTarea.findFirst({ where: { usuarioId: actor.id, estado: 'EN_CURSO', pausaInicio: null, id: { not: t.id } } })) fallo('Pausa o termina la otra ubicación antes de continuar')
      }
      if (b.accion === 'iniciar') {
        if (t.estado !== 'PENDIENTE' || String(b.ubicacion ?? '').trim().toUpperCase() !== t.ubicacion) fallo('Escanea la ubicación correcta')
        await otroActivo()
        await tx.inventarioTarea.update({ where: { id: t.id }, data: { estado: 'EN_CURSO', inicio: now } })
      } else if (b.accion === 'reanudar') {
        if (!t.pausaInicio) fallo('La tarea no está pausada')
        await otroActivo()
        await tx.inventarioTarea.update({ where: { id: t.id }, data: { pausaInicio: null, pausaMotivo: null, pausaSegundos: { increment: (now.getTime() - t.pausaInicio.getTime()) / 1000 }, pausas: [...t.pausas as object[], { motivo: t.pausaMotivo, inicio: t.pausaInicio.toISOString(), fin: now.toISOString() }] } })
      } else {
        if (t.estado !== 'EN_CURSO' || t.pausaInicio) fallo('Escanea la ubicación o reanuda para continuar')
        if (b.accion === 'pausar') {
          if (!['ALIMENTACION','FIN_TURNO'].includes(b.motivo)) fallo('Motivo de pausa inválido')
          await tx.inventarioTarea.update({ where: { id: t.id }, data: { pausaInicio: now, pausaMotivo: b.motivo } })
        } else if (b.accion === 'guardar' || b.accion === 'ausente') {
          const codigo = String(b.codigo ?? '').trim().toUpperCase().slice(0,100)
          const esperados = filas.filter(f => f.concepto === 'RETIRO' && f.ubicacion === t.ubicacion)
          const producto = await productoInventario(tx, c.cronogramaId, codigo)
          const plu = producto?.plu ?? (b.accion === 'ausente' && esperados.some(f => f.plu === codigo) ? codigo : null)
          if (!plu) fallo('Código sin PLU en el maestro; solicita su actualización a Carlos')
          const caso = c.casos.find(x => x.id === t.casoId)
          if (t.tipo === 'RECONTEO' && caso?.plu !== plu) fallo('Escanea el PLU de este reconteo')
          const cajas = b.accion === 'ausente' ? 0 : b.cajas, empaque = b.accion === 'ausente' ? 1 : b.empaque, reguero = b.accion === 'ausente' ? 0 : b.reguero
          let fisico: number
          try { fisico = fisicoInventario(cajas, empaque, reguero) } catch (e) { fallo((e as Error).message) }
          if (t.tipo === 'RECONTEO' && (!Number.isSafeInteger(b.teoricoActual) || Math.abs(b.teoricoActual) > 2147483647)) fallo('Digita el teórico actualizado de la ubicación en NetSuite')
          const esperado = esperados.filter(f => f.plu === plu).reduce((sum,f) => sum + f.disponible, 0)
          const data = { cajas, empaque, reguero, fisico, teoricoActual: t.tipo === 'RECONTEO' ? b.teoricoActual : null, estado: estadoInventario(fisico, t.tipo === 'RECONTEO' ? b.teoricoActual : esperado), inesperado: !esperados.some(f => f.plu === plu) }
          if (b.accion === 'ausente' && !esperados.some(f => f.plu === plu)) fallo('Solo se marca ausente un producto esperado')
          await tx.inventarioConteo.upsert({ where: { tareaId_plu: { tareaId: t.id, plu } }, create: { tareaId: t.id, plu, ...data }, update: data })
          await auditarInventario(tx, actor, c.id, JSON.stringify({ accion: 'captura', tareaId: t.id, plu, anterior: t.registros.find(r => r.plu === plu) ?? null, nuevo: data }))
        } else if (b.accion === 'terminar') {
          const esperados = t.tipo === 'RECONTEO' ? [c.casos.find(x => x.id === t.casoId)!.plu] : filas.filter(f => f.ubicacion === t.ubicacion && f.concepto === 'RETIRO').map(f => f.plu)
          if (esperados.some(plu => !t.registros.some(r => r.plu === plu))) fallo('Registra todos los PLU esperados; marca cero los ausentes')
          await tx.inventarioTarea.update({ where: { id: t.id }, data: { estado: 'COMPLETADA', fin: now } })
          if (t.tipo === 'INICIAL') {
            for (const r of t.registros.filter(r => r.estado !== 'OK' || r.inesperado)) await tx.inventarioCaso.create({ data: { cicloId: c.id, ubicacion: t.ubicacion, plu: r.plu } })
            if (c.tareas.filter(x => x.tipo === 'INICIAL' && x.id !== t.id).every(x => x.estado === 'COMPLETADA')) {
              await tx.inventarioCiclico.update({ where: { id: c.id }, data: { estado: 'REVISION' } })
              await tx.notificacion.create({ data: { userId: c.autorId, titulo: 'Conteo inicial terminado', descripcion: `Revisa las diferencias de ${c.nombre}`, tipo: 'INVENTARIO', enlace: '/dashboard/inventarios' } })
            }
          }
        } else fallo('Acción desconocida')
      }
      await tx.inventarioTarea.update({ where: { id: t.id }, data: { revision: { increment: 1 } } })
    }
    await auditarInventario(tx, actor, c.id, `${b.accion}${b.tareaId ? ` · tarea ${b.tareaId}` : ''}${b.casoId ? ` · caso ${b.casoId}` : ''}`)
    return { ok: true }
  }, { timeout: 30000 })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// Ejecuta el código real de Nitro sin depender de .nuxt (no existe en CI Next).
function cargar(file: string, dependencies: Record<string, unknown> = {}) {
  const source = readFileSync(path.resolve(__dirname, '../../nuxt-app', file), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, any> = {}
  new Function('require', 'exports', js)((key: string) => {
    if (!(key in dependencies)) throw new Error(`Dependencia no simulada: ${key}`)
    return dependencies[key]
  }, exports)
  return exports
}
const h3 = { createError: (data: object) => Object.assign(new Error(), data) }
const inicio = new Date('2026-09-14T17:00:00Z')
const fin = new Date('2026-09-14T17:30:00Z')

function escenario() {
  let activa: any = null
  const rows = {
    movimientoMontacargas: [{ id: 'm1', responsableId: 'u1', estado: 'EN_CURSO', deletedAt: null, pausaId: null, pausaSegundos: 0 }],
    tareaResurtido: [{ id: 't1', responsableId: null, montaje: { operarioId: 'u1', deletedAt: null }, estado: 'EN_CURSO', pausaId: null, pausaSegundos: 0 }],
    pendienteGourmet: [{ id: 'p1', operarioId: 'u1', estado: 'EN_CURSO', deletedAt: null, pausaId: null, pausaSegundos: 0 }],
    recepcionContenedor: [{ id: 'r1', creadoPorId: 'u1', estado: 'EN_CURSO', deletedAt: null, pausaId: null, pausaSegundos: 0 }],
    // Picking de Muebles: la orden abierta y el PLU que lleva en la mano.
    ordenMuebles: [{ id: 'o1', estado: 'EN_PICKING', deletedAt: null, pausaId: null, pausaSegundos: 0 }],
    lineaMuebles: [{ id: 'l1', operarioId: 'u1', estado: 'EN_PICKING', pausaId: null, pausaSegundos: 0 }],
  }
  const prisma: any = {
    pausaOperativa: {
      findUnique: vi.fn(async ({ where }) => activa?.activaUsuarioId === where.activaUsuarioId ? activa : null),
      create: vi.fn(async ({ data }) => { activa = { id: 'pausa1', ...data }; return activa }),
      update: vi.fn(async ({ data }) => { Object.assign(activa, data); return activa }),
    },
    activityLog: { create: vi.fn(async () => ({})) },
    tramoMontacargas: { findFirst: vi.fn(async () => ({ orden: 3 })) },
  }
  for (const [key, values] of Object.entries(rows)) {
    prisma[key] = {
      findMany: vi.fn(async () => values),
      findUnique: vi.fn(async ({ where }) => values.find(r => r.id === where.id)),
      updateMany: vi.fn(async ({ where, data }) => {
        for (const r of values as any[]) {
          if (where.pausaId && r.pausaId !== where.pausaId) continue
          if (where.id && !where.id.in.includes(r.id)) continue
          for (const [k, v] of Object.entries(data)) r[k] = typeof v === 'object' && v && 'increment' in v ? r[k] + v.increment : v
        }
      }),
    }
  }
  const abrir = vi.fn(async () => {}), cerrar = vi.fn(async () => 3)
  const service = cargar('server/utils/pausasOperativas.ts', {
    h3, './prisma': { prisma },
    './montacargas': { abrirTramo: abrir, cerrarTramoAbierto: cerrar },
    './resurtido': { abrirTramoTarea: abrir, abrirTramoPendiente: abrir, cerrarTramoTarea: cerrar, cerrarTramoPendiente: cerrar },
    './montacargasCalc': { puedeUsarMontacargas: (role: string) => ['MONTACARGAS', 'OPERARIO_ALMACENAMIENTO', 'ADMIN'].includes(role) },
    './mueblesCalc': { puedePickear: (role: string) => ['PICKING_MUEBLES', 'ADMIN'].includes(role) },
  })
  return { service, prisma, rows, abrir, cerrar, activa: () => activa }
}
afterEach(() => vi.useRealTimers())

describe('pausas operativas persistentes', () => {
  it.each(['ALIMENTACION', 'CAMBIO_BATERIAS'])('pausa los cuatro flujos y reanuda sin cambiar estado ni responsable: %s', async motivo => {
    vi.useFakeTimers(); vi.setSystemTime(inicio)
    const e = escenario()
    const pausa = await e.service.iniciarPausa('u1', motivo)
    expect(pausa.movimientos).toEqual(['m1'])
    expect(pausa.tareas).toEqual(['t1'])
    expect(pausa.pendientes).toEqual(['p1'])
    expect(pausa.recepciones).toEqual(['r1'])
    expect(pausa.ordenesMuebles).toEqual(['o1'])
    expect(pausa.lineasMuebles).toEqual(['l1'])
    expect(e.cerrar).toHaveBeenCalledTimes(3)
    for (const rows of Object.values(e.rows)) expect(rows[0].pausaId).toBe('pausa1')
    vi.setSystemTime(fin)
    await e.service.finalizarPausa('u1', pausa.id)
    for (const [key, rows] of Object.entries(e.rows)) {
      // Muebles no cambia de estado al pausar: sigue EN_PICKING.
      const estado = key.endsWith('Muebles') ? 'EN_PICKING' : 'EN_CURSO'
      expect(rows[0]).toMatchObject({ pausaId: null, pausaSegundos: 1800, estado })
    }
    expect(e.abrir).toHaveBeenCalledTimes(3)
    expect(e.abrir).toHaveBeenCalledWith(e.prisma, 'm1', 'u1', fin, 4)
    expect(e.activa()).toMatchObject({ fin, activaUsuarioId: null, motivo })
  })
  it('rechaza otra pausa simultánea y no cierra tramos dos veces', async () => {
    const e = escenario()
    await e.service.iniciarPausa('u1', 'ALIMENTACION')
    await expect(e.service.iniciarPausa('u1', 'CAMBIO_BATERIAS')).rejects.toMatchObject({ statusCode: 409 })
    expect(e.cerrar).toHaveBeenCalledTimes(3)
  })
  it('no permite que otro usuario ni un reintento antiguo finalicen la pausa', async () => {
    const e = escenario()
    await e.service.iniciarPausa('u1', 'ALIMENTACION')
    await expect(e.service.finalizarPausa('u2', 'pausa1')).rejects.toMatchObject({ statusCode: 409 })
    await expect(e.service.finalizarPausa('u1', 'pausa-anterior')).rejects.toMatchObject({ statusCode: 409 })
    expect(e.abrir).not.toHaveBeenCalled()
  })
  it('no revive registros cerrados, eliminados o transferidos', async () => {
    const e = escenario()
    await e.service.iniciarPausa('u1', 'ALIMENTACION')
    e.rows.movimientoMontacargas[0].estado = 'CERRADO'
    e.rows.tareaResurtido[0].montaje.deletedAt = new Date() as any
    e.rows.pendienteGourmet[0].operarioId = 'u2'
    await e.service.finalizarPausa('u1', 'pausa1')
    expect(e.abrir).not.toHaveBeenCalled()
  })
  it('selecciona solo trabajo activo propio y excluye novedades y pendientes integrados', async () => {
    const e = escenario()
    await e.service.iniciarPausa('u1', 'ALIMENTACION')
    expect(e.prisma.movimientoMontacargas.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { responsableId: 'u1', estado: 'EN_CURSO', deletedAt: null, horaInicio: { gte: expect.any(Date) } } }))
    expect(e.prisma.pendienteGourmet.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { operarioId: 'u1', estado: 'EN_CURSO', deletedAt: null, tareaResurtidoId: null, horaInicio: { gte: expect.any(Date) } } }))
    expect(e.prisma.recepcionContenedor.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { creadoPorId: 'u1', estado: 'EN_CURSO', deletedAt: null, horaInicio: { gte: expect.any(Date) } } }))
    // La orden es de quien participa en ella, no solo de quien la creo.
    expect(e.prisma.ordenMuebles.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { estado: 'EN_PICKING', deletedAt: null, horaInicio: { gte: expect.any(Date) }, participantes: { some: { usuarioId: 'u1' } } } }))
    expect(e.prisma.lineaMuebles.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { operarioId: 'u1', estado: 'EN_PICKING', horaInicio: { gte: expect.any(Date) }, orden: { deletedAt: null } } }))
  })
  it('rechaza roles sin acceso a los módulos', () => {
    const e = escenario()
    expect(() => e.service.assertPuedePausar('TIENDA')).toThrow()
    expect(() => e.service.assertPuedePausar('MONTACARGAS')).not.toThrow()
    // El almuerzo tambien esta en Picking de Muebles.
    expect(() => e.service.assertPuedePausar('PICKING_MUEBLES')).not.toThrow()
  })
})

describe('tiempo efectivo y cronómetros', () => {
  const { intervalosSinPausas } = cargar('server/utils/pausasCalc.ts')
  const d = (min: number) => new Date(inicio.getTime() + min * 60000)
  it('recorta pausas solapadas, abiertas y exteriores sin descontar dos veces', () => {
    const result = intervalosSinPausas(d(0), d(60), [
      { inicio: d(-10), fin: d(5) }, { inicio: d(20), fin: d(30) },
      { inicio: d(25), fin: d(40) }, { inicio: d(50), fin: null },
    ])
    expect(result).toEqual([{ inicio: d(5), fin: d(20) }, { inicio: d(40), fin: d(50) }])
  })
  it('congela la tarea y retoma lo trabajado antes de alimentación', () => {
    const { cronometroTarea } = cargar('app/utils/resurtidoTareas.ts', { './montacargas': cargar('app/utils/montacargas.ts') })
    const t = { horaInicio: d(0).toISOString(), pausaInicio: d(10).toISOString(), pausaSegundos: 120 }
    expect(cronometroTarea(t, d(40).getTime())).toBe('8:00')
    expect(cronometroTarea({ ...t, pausaInicio: null, pausaSegundos: 1920 }, d(45).getTime())).toBe('13:00')
  })
  // Al pasar el PLU al ayudante, su reloj arranca en cero: antes contaba desde
  // que la tarea empezo y le llegaba con el tiempo del primero.
  it('el reloj de una tarea pasada al ayudante es solo el del ayudante', () => {
    const { cronometroTarea } = cargar('app/utils/resurtidoTareas.ts', { './montacargas': cargar('app/utils/montacargas.ts') })
    const t = {
      horaInicio: d(0).toISOString(), pausaSegundos: 0,
      tramos: [
        { usuarioId: 'u1', orden: 1, inicio: d(0).toISOString(), fin: d(20).toISOString() },
        { usuarioId: 'u2', orden: 2, inicio: d(20).toISOString(), fin: null },
      ],
    }
    expect(cronometroTarea(t, d(23).getTime())).toBe('3:00')
    // Con pausa: el tramo se cierra y se reabre; la pausa no cuenta.
    const conPausa = { ...t, tramos: [...t.tramos.slice(0, 1), { usuarioId: 'u2', orden: 2, inicio: d(20).toISOString(), fin: d(25).toISOString() }, { usuarioId: 'u2', orden: 3, inicio: d(55).toISOString(), fin: null }] }
    expect(cronometroTarea(conPausa, d(57).getTime())).toBe('7:00')
  })

  it('suma los tramos de montacargas separados por la pausa', () => {
    const { cronometroTramo } = cargar('app/utils/montacargas.ts')
    const m = { responsableId: 'u1', pausaId: 'p', tramos: [{ orden: 1, usuarioId: 'u1', inicio: d(0).toISOString(), fin: d(10).toISOString() }] }
    expect(cronometroTramo(m, d(30).getTime())).toBe('10:00')
    expect(cronometroTramo({ ...m, pausaId: null, tramos: [...m.tramos, { orden: 2, usuarioId: 'u1', inicio: d(30).toISOString(), fin: null }] }, d(35).getTime())).toBe('15:00')
  })
})

describe('guardas del servidor dentro de la transacción', () => {
  function guardas(activa: boolean, registroPausado = false) {
    const order: string[] = []
    const tx = { $executeRaw: vi.fn(async () => { order.push('lock') }) }
    const prisma = {
      pausaOperativa: { findUnique: vi.fn(async () => { order.push('guard'); return activa ? { id: 'p1' } : null }) },
      movimientoMontacargas: { findUnique: vi.fn(async () => ({ pausaId: registroPausado ? 'p1' : null })) },
    }
    const transaction = vi.fn(async (fn: any) => fn(tx))
    const service = cargar('server/utils/operacionAlmacen.ts', {
      h3: { ...h3, defineEventHandler: (fn: any) => fn, getRouterParam: () => 'm1', readBody: async () => ({}) },
      './auth': { requireAuth: async () => ({ id: 'u1' }) },
      './prisma': { prisma, prismaBase: { $transaction: transaction } },
      './operacionContext': { operacionContext: { run: (_: any, fn: any) => fn() } },
    })
    return { service, order, transaction }
  }
  it('toma el bloqueo antes de comprobar pausas y ejecutar cualquier mutación', async () => {
    const e = guardas(false)
    const handler = e.service.defineOperacionAlmacenHandler(async () => { e.order.push('write'); return 'ok' })
    expect(await handler({ path: '/api/montacargas/m1/cantidades' })).toBe('ok')
    expect(e.order).toEqual(['lock', 'guard', 'write'])
    expect(e.transaction).toHaveBeenCalledTimes(1)
  })
  it.each([[true, false], [false, true]])('bloquea al actor en pausa o un registro pausado, incluso para gestión', async (actor, record) => {
    const e = guardas(actor, record), write = vi.fn()
    const handler = e.service.defineOperacionAlmacenHandler(write)
    await expect(handler({ path: '/api/montacargas/m1/cantidades' })).rejects.toMatchObject({ statusCode: 409 })
    expect(write).not.toHaveBeenCalled()
  })
  it('permite finalizar una pausa bajo el mismo bloqueo', async () => {
    const e = guardas(true), write = vi.fn(async () => 'resumed')
    const handler = e.service.defineOperacionAlmacenHandler(write, true)
    expect(await handler({ path: '/api/pausas-operativas/finalizar' })).toBe('resumed')
    expect(e.order).toEqual(['lock'])
  })
  it('propaga el fallo de la escritura para que Prisma revierta la transacción', async () => {
    const e = guardas(false)
    const handler = e.service.defineOperacionAlmacenHandler(async () => { throw new Error('fallo al abrir tramo') })
    await expect(handler({ path: '/api/montacargas/m1/cantidades' })).rejects.toThrow('fallo al abrir tramo')
  })
})

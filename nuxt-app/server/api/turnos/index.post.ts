import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorMontacargas } from '../../utils/montacargas'
import { readWorkbook, worksheetRows } from '../../utils/excel'
import { emparejarUsuario, mapCuadroTurnos, TURNOS_SHEET_NAMES } from '../../utils/turnosCalc'

const MAX_SIZE = 5 * 1024 * 1024
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/
// A quien se le mide el turno. Los supervisores salen en el cuadro, pero no se
// les cronometra: no bajan mercancia.
const MEDIDOS = ['MONTACARGAS', 'OPERARIO_ALMACENAMIENTO'] as const

/**
 * POST /api/turnos - sube el cuadro de turnos en Excel.
 *
 * El archivo es el que arma operacion: un bloque por turno, con una fila
 * "OPERARIO | LUNES | …" y debajo una fila por persona con "6am-3:30pm" o
 * "DESCANSO". De ahi salen las jornadas contra las que se mide la efectividad.
 *
 * El cuadro vale para un rango de fechas (el que dice el propio archivo en su
 * titulo, que aqui se confirma a mano) y NO pisa a los anteriores: se guardan
 * todos y cada dia usa el mas reciente que lo cubra.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Solo supervision puede subir el cuadro de turnos')

  const parts = await readMultipartFormData(event)
  const archivo = parts?.find((p) => p.name === 'archivo')
  const campo = (nombre: string) => parts?.find((p) => p.name === nombre)?.data.toString('utf8').trim() ?? ''
  const desde = campo('desde')
  const hasta = campo('hasta')

  if (!archivo) throw createError({ statusCode: 400, statusMessage: 'Falta el archivo' })
  if (archivo.data.length > MAX_SIZE) throw createError({ statusCode: 400, statusMessage: 'Maximo 5 MB' })
  if (!RE_DIA.test(desde) || !RE_DIA.test(hasta) || desde > hasta) {
    throw createError({ statusCode: 400, statusMessage: 'Indica desde que dia y hasta que dia rige el cuadro' })
  }

  let filas
  try {
    const wb = await readWorkbook(archivo.data)
    const hoja = TURNOS_SHEET_NAMES.map((n) => wb.getWorksheet(n)).find(Boolean) ?? wb.worksheets[0]
    if (!hoja) throw new Error('sin hojas')
    filas = mapCuadroTurnos(worksheetRows(hoja))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'No se pudo leer el archivo: debe ser un Excel (.xlsx)' })
  }
  if (filas.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No se encontro ningun turno. El cuadro necesita una fila "OPERARIO" con los dias.',
    })
  }

  // Se empareja contra TODOS los usuarios activos —el cuadro trae tambien a los
  // supervisores— y despues se guarda solo el turno de quien se mide.
  const usuarios = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
  })
  const emparejables = usuarios.map((u) => ({ id: u.id, nombre: u.name }))
  const rol = new Map(usuarios.map((u) => [u.id, u.role]))

  const sinIdentificar: string[] = []
  const noMedidos: string[] = []
  const datos: { usuarioId: string; diaSemana: number; inicioMin: number; finMin: number }[] = []
  const personas = new Set<string>()

  for (const fila of filas) {
    const u = emparejarUsuario(fila.nombre, emparejables)
    if (!u) { sinIdentificar.push(fila.nombre); continue }
    if (!(MEDIDOS as readonly string[]).includes(rol.get(u.id) ?? '')) {
      noMedidos.push(`${fila.nombre} → ${u.nombre}`)
      continue
    }
    personas.add(u.id)
    for (const d of fila.dias) {
      datos.push({ usuarioId: u.id, diaSemana: d.diaSemana, inicioMin: d.inicioMin, finMin: d.finMin })
    }
  }

  if (datos.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ninguna persona del cuadro es montacarguista u operario de almacenamiento',
    })
  }

  const cuadro = await prisma.$transaction(async (tx) => {
    const creado = await tx.cuadroTurnos.create({
      data: {
        nombreArchivo: archivo.filename?.slice(0, 255) ?? 'cuadro.xlsx',
        desde: new Date(`${desde}T00:00:00.000Z`),
        hasta: new Date(`${hasta}T00:00:00.000Z`),
        subidoPorId: actor.id,
      },
      select: { id: true },
    })
    await tx.turnoOperario.createMany({ data: datos.map((d) => ({ ...d, cuadroId: creado.id })) })
    return creado
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'CREATE', module: 'indicadores', recordId: cuadro.id,
      details: `Cuadro de turnos ${desde} a ${hasta}: ${personas.size} personas, ${datos.length} turnos`,
    },
  }).catch(() => {})

  return {
    success: true,
    data: {
      id: cuadro.id,
      personas: personas.size,
      turnos: datos.length,
      // Para que quien lo sube vea a quien NO se le cargo y por que.
      sinIdentificar,
      noMedidos,
    },
  }
})

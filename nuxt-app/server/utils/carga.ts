// Medidas del maestro para calcular peso y volumen. La logica pura vive en
// cargaCalc.ts (copia de src/lib/carga.ts).
//
// Se lee SIEMPRE del maestro vigente, no se sella en el trabajo: corregir una
// medida mal cargada arregla tambien lo que ya paso. Es la misma decision que
// en la descripcion de los PLU.
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { cargaDeUnidades, sumarCargas, type Carga, type CargaTotal, type MedidaPlu } from './cargaCalc'

type Db = Pick<Prisma.TransactionClient, 'medidaCajaMaster' | 'productoMaestro'>

export type MedidasPlu = Map<string, MedidaPlu>

/**
 * Caja master (suma de sus partes) y unidades por caja de cada PLU.
 *
 * Un PLU sin medidas NO entra en el mapa: asi `cargaDeUnidades` devuelve null y
 * la pantalla puede decir que falta medirlo, en vez de contar un cero.
 */
export async function medidasDePlus(plus: readonly string[], db: Db = prisma): Promise<MedidasPlu> {
  const unicos = [...new Set(plus.filter(Boolean))]
  if (!unicos.length) return new Map()

  const [cajas, productos] = await Promise.all([
    db.medidaCajaMaster.findMany({
      where: { plu: { in: unicos } },
      select: { plu: true, pesoBrutoKg: true, volumenM3: true },
    }),
    db.productoMaestro.findMany({
      where: { plu: { in: unicos } },
      select: { plu: true, unidadesPorCaja: true },
    }),
  ])

  const porCaja = new Map(productos.map((p) => [p.plu, p.unidadesPorCaja ?? 1]))
  const medidas: MedidasPlu = new Map()
  for (const c of cajas) {
    const acum = medidas.get(c.plu) ?? {
      unidadesPorCaja: porCaja.get(c.plu) ?? 1,
      cajaKg: null as number | null,
      cajaM3: null as number | null,
    }
    const kg = c.pesoBrutoKg == null ? null : Number(c.pesoBrutoKg)
    const m3 = c.volumenM3 == null ? null : Number(c.volumenM3)
    if (kg != null && Number.isFinite(kg)) acum.cajaKg = (acum.cajaKg ?? 0) + kg
    if (m3 != null && Number.isFinite(m3)) acum.cajaM3 = (acum.cajaM3 ?? 0) + m3
    medidas.set(c.plu, acum)
  }
  return medidas
}

/** Peso y volumen de N unidades de un PLU, con el mapa ya cargado. */
export function cargaPlu(medidas: MedidasPlu, plu: string, unidades: number): Carga {
  return cargaDeUnidades(unidades, medidas.get(plu))
}

/** Total de una lista de {plu, unidades}. */
export function cargaDeLista(
  medidas: MedidasPlu,
  items: readonly { plu: string; unidades: number }[],
): CargaTotal {
  return sumarCargas(items.map((i) => cargaPlu(medidas, i.plu, i.unidades)))
}

// ── Envoltorios por modulo ──
// Cada uno recibe lo ya mapeado y le agrega `carga` (peso y m3). Van aqui y no
// en los mapRow porque necesitan consultar el maestro: un mapeo puro no puede.

type ConPlu = { plu: string }

/** Unidades de una tarea de resurtido: las del archivo mas las del pendiente. */
function unidadesTarea(t: { unidadesSolicitadas?: number; unidadesPendientes?: number; unidadesBajadas?: number | null }): number {
  if (t.unidadesBajadas != null) return t.unidadesBajadas
  return (t.unidadesSolicitadas ?? 0) + (t.unidadesPendientes ?? 0)
}

export async function conCargaTareas<T extends ConPlu>(tareas: T[]): Promise<(T & { carga: Carga })[]> {
  const medidas = await medidasDePlus(tareas.map((t) => t.plu))
  return tareas.map((t) => ({ ...t, carga: cargaPlu(medidas, t.plu, unidadesTarea(t as never)) }))
}

export async function conCargaMontajes<T extends { tareas: ConPlu[] }>(
  montajes: T[],
): Promise<(T & { carga: CargaTotal })[]> {
  const medidas = await medidasDePlus(montajes.flatMap((m) => m.tareas.map((t) => t.plu)))
  return montajes.map((m) => {
    const tareas = m.tareas.map((t) => ({ ...t, carga: cargaPlu(medidas, t.plu, unidadesTarea(t as never)) }))
    return { ...m, tareas, carga: sumarCargas(tareas.map((t) => t.carga)) }
  })
}

export async function conCargaPendientes<T extends ConPlu>(pendientes: T[]): Promise<(T & { carga: Carga })[]> {
  const medidas = await medidasDePlus(pendientes.map((p) => p.plu))
  return pendientes.map((p) => {
    const x = p as unknown as { unidadesSolicitadas?: number; unidadesBajadas?: number | null }
    const unidades = x.unidadesBajadas ?? x.unidadesSolicitadas ?? 0
    return { ...p, carga: cargaPlu(medidas, p.plu, unidades) }
  })
}

/**
 * Montacargas ya trae su propio "unidades por caja" (a veces lo escribe el
 * operario porque el maestro no lo tiene) y su cantidad total incluye el
 * reguero. Se usa esa cantidad, con la medida por unidad del maestro.
 */
export async function conCargaMovimientos<T extends ConPlu & { cantidadTotal?: number }>(
  movimientos: T[],
): Promise<(T & { carga: Carga })[]> {
  const medidas = await medidasDePlus(movimientos.map((m) => m.plu))
  return movimientos.map((m) => ({ ...m, carga: cargaPlu(medidas, m.plu, m.cantidadTotal ?? 0) }))
}

// Tipo de mercancia por PLU: lo deduce la app y lo corrige una persona.
import { prisma } from './prisma'
import { clasificarPorDescripcion, type TipoMercanciaMueble } from './mueblesCalc'

/**
 * Devuelve el tipo del PLU, clasificandolo la primera vez que se ve.
 *
 * Un PLU marcado MANUAL no se vuelve a tocar: la heuristica no puede pisar una
 * correccion humana, o el ADMIN estaria arreglando lo mismo cada semana.
 *
 * Nunca bloqueante: si esto falla, el operario tiene que poder seguir pickeando.
 * Un PLU sin clasificar cae en OTRO en el informe, que es recuperable; un
 * escaneo perdido no.
 */
export async function tipoDePlu(plu: string, descripcion: string | null): Promise<TipoMercanciaMueble> {
  const derivado = clasificarPorDescripcion(descripcion)
  try {
    const existente = await prisma.tipoMueblePlu.findUnique({ where: { plu } })
    if (existente) return existente.tipo as TipoMercanciaMueble
    await prisma.tipoMueblePlu.create({ data: { plu, tipo: derivado, origen: 'DERIVADO' } })
  } catch {
    // Carrera con otro escaneo del mismo PLU, o la DB caida: da igual, el tipo
    // derivado sirve igual y la fila se creara en el siguiente escaneo.
  }
  return derivado
}

/** Tipos de un lote de PLUs, para el informe. Los que falten cuentan como OTRO. */
export async function tiposDePlus(plus: readonly string[]): Promise<Map<string, TipoMercanciaMueble>> {
  if (plus.length === 0) return new Map()
  const filas = await prisma.tipoMueblePlu.findMany({
    where: { plu: { in: [...new Set(plus)] } },
    select: { plu: true, tipo: true },
  })
  return new Map(filas.map((f) => [f.plu, f.tipo as TipoMercanciaMueble]))
}

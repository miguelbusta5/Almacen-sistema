// Lectura del maestro para Picking Muebles: peso, volumen y partes de un PLU.
//
// No hay tabla nueva: `medidas_caja_master` y `medidas_producto` ya existian en
// el schema (una fila por PARTE, con el volumen ya sellado al importar) pero
// ningun modulo las leia todavia. Aqui se agregan por PLU.
//
// Sin FK contra productos_maestro a proposito, igual que las propias tablas de
// medidas: el maestro se recarga entero cada tanto y una FK convertiria cada
// recarga en un problema de orden. El PLU es la clave de negocio.
import { prisma } from './prisma'
import { resolverPluMaestro } from './codigoProducto'

export interface DatosPlu {
  plu: string
  descripcion: string | null
  /** Cuantas cajas componen el mueble. */
  partes: number | null
  /** Suma de las partes. Null si el PLU no esta medido todavia. */
  pesoUnitarioKg: number | null
  volumenUnitarioM3: number | null
  /** true cuando el PLU no tiene medidas: la UI avisa que la capacidad va corta. */
  sinMedidas: boolean
}

function aNumero(valor: unknown): number | null {
  if (valor == null) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function sumar(valores: Array<number | null>): number | null {
  const presentes = valores.filter((v): v is number => v != null)
  if (presentes.length === 0) return null
  return presentes.reduce((a, b) => a + b, 0)
}

/**
 * Datos del PLU para sellar en la linea de picking.
 *
 * `partes` sale de contar las filas de medidas reales, no del campo declarado en
 * medidas_producto: el propio schema advierte que no siempre coinciden, y lo que
 * el operario tiene delante son las cajas que existen.
 */
export async function datosPlu(plu: string): Promise<DatosPlu> {
  const [cajas, medida, producto] = await Promise.all([
    prisma.medidaCajaMaster.findMany({
      where: { plu },
      select: { pesoBrutoKg: true, volumenM3: true },
      orderBy: { parte: 'asc' },
    }),
    prisma.medidaProducto.findUnique({ where: { plu }, select: { partes: true } }),
    prisma.productoMaestro.findUnique({ where: { plu }, select: { descripcion: true } }),
  ])

  const pesoUnitarioKg = sumar(cajas.map((c) => aNumero(c.pesoBrutoKg)))
  const volumenUnitarioM3 = sumar(cajas.map((c) => aNumero(c.volumenM3)))
  const partes = cajas.length > 0 ? cajas.length : (medida?.partes ?? null)

  return {
    plu,
    descripcion: producto?.descripcion ?? null,
    partes,
    pesoUnitarioKg,
    volumenUnitarioM3,
    sinMedidas: volumenUnitarioM3 == null,
  }
}

/**
 * Existencia en el maestro de productos. Se comprueba aparte de las medidas: un
 * PLU puede existir y no estar medido todavia (es el caso de la mayoria hasta
 * que se cargue el archivo de medicion), y eso no debe impedir el picking.
 */
export async function existePlu(plu: string): Promise<boolean> {
  const row = await prisma.productoMaestro.findUnique({ where: { plu }, select: { plu: true } })
  return row != null
}

/** El PLU real de lo que leyo la pistola (ver resolverPluMaestro). */
export function resolverPlu(codigo: string): Promise<string> {
  return resolverPluMaestro(codigo)
}

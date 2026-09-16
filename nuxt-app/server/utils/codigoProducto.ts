// Traductor unico de lo que lee la pistola al PLU del maestro.
//
// Las etiquetas traen el codigo de barras (EAN), no el PLU. Cada modulo buscaba
// por su cuenta: unos solo por PLU (y la linea quedaba sin descripcion, o el
// escaneo se rechazaba con "ese no es el PLU"), otros por EAN pero sin respaldo
// para los productos nuevos que aun no tienen el EAN cargado. Todos pasan ahora
// por aqui.
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from './prisma'
import { pluDesdeEanAmbiente } from './mueblesCalc'

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * El PLU real de un codigo capturado. Orden:
 * 1) si ya es un PLU del maestro, ese;
 * 2) si es un EAN registrado en el maestro, su PLU;
 * 3) si es un EAN de Ambiente (7703596 + PLU + control) cuyo PLU existe, ese PLU.
 * Si nada coincide se devuelve normalizado tal cual: cada modulo decide si un
 * PLU fuera del maestro se acepta o se rechaza.
 */
export async function resolverPluMaestro(codigoCrudo: unknown, tx: Tx = prisma): Promise<string> {
  const codigo = String(codigoCrudo ?? '').trim().toUpperCase()
  if (!codigo) return codigo
  const existe = (plu: string) => tx.productoMaestro.findUnique({ where: { plu }, select: { plu: true } })
  if (await existe(codigo)) return codigo
  if (!/^\d{8,14}$/.test(codigo)) return codigo
  // findFirst: el EAN no es unico en el maestro (variantes que lo comparten).
  const porEan = await tx.productoMaestro.findFirst({ where: { ean: codigo }, select: { plu: true } })
  if (porEan) return porEan.plu
  const derivado = pluDesdeEanAmbiente(codigo)
  if (derivado && (await existe(derivado))) return derivado
  return codigo
}

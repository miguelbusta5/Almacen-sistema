// Escritura del maestro en base.
//
// Extraido de la ruta de importacion para que una carga manual a produccion use
// EXACTAMENTE el mismo SQL que una subida por la UI. Si divergieran, lo cargado
// a mano dejaria de parecerse a lo que cargaria el administrador — y este es el
// upsert que una vez vacio fabricante/precio/marca en 19k productos.
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { getErrorMessage } from "./errors";
import type { ProductoMaestroDTO } from "./productosMaestro";

const BATCH_SIZE = 500;

export interface ResultadoMaestro {
  importados: number;
  actualizados: number;
  errores: string[];
}

type Cliente = Pick<PrismaClient, "$executeRaw" | "$queryRaw">;

/**
 * UPSERT masivo del maestro.
 *
 * `columnas` sale de columnasPresentes(): se sobrescriben SOLO las columnas que
 * el archivo trae. Asi el roundtrip export -> editar -> import sigue pudiendo
 * VACIAR un campo (el export las trae todas), pero un archivo parcial no arrasa
 * lo que no menciona.
 */
export async function guardarProductosMaestro(
  prisma: Cliente,
  productos: ProductoMaestroDTO[],
  columnas: string[]
): Promise<ResultadoMaestro> {
  // Un solo query para saber cuales PLUs ya existian (para el conteo de
  // importados vs actualizados), en vez de un findUnique por fila.
  const existentes = productos.length
    ? await prisma.$queryRaw<{ plu: string }[]>(
        Prisma.sql`SELECT plu FROM productos_maestro WHERE plu = ANY(${productos.map((p) => p.plu)}::text[])`
      )
    : [];
  const existentesSet = new Set(existentes.map((p) => p.plu));

  let importados = 0;
  let actualizados = 0;
  const errores: string[] = [];

  const setClause = Prisma.join(
    columnas.map((col) => Prisma.raw(`${col} = EXCLUDED.${col}`)),
    ", "
  );

  // Por lotes en vez de una fila a la vez: con ~19k productos, fila por fila
  // tardaba varios minutos.
  for (let i = 0; i < productos.length; i += BATCH_SIZE) {
    const lote = productos.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      lote.map(
        (p) =>
          Prisma.sql`(${randomUUID()}, ${p.plu}, ${p.descripcion}, ${p.fabricante}, ${p.precio}, ${p.marca}, ${p.ean}, ${p.unidadesPorCaja}, now(), now())`
      )
    );
    try {
      await prisma.$executeRaw`
        INSERT INTO productos_maestro (id, plu, descripcion, fabricante, precio, marca, ean, unidades_por_caja, created_at, updated_at)
        VALUES ${values}
        ON CONFLICT (plu) DO UPDATE SET
          ${setClause},
          updated_at = now()
      `;
      for (const p of lote) {
        if (existentesSet.has(p.plu)) actualizados += 1;
        else importados += 1;
      }
    } catch (error) {
      errores.push(`Filas ${i + 1}-${i + lote.length}: ${getErrorMessage(error, "error al importar")}`);
    }
  }

  return { importados, actualizados, errores };
}

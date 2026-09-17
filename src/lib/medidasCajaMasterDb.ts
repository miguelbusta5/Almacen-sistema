// Escritura de las mediciones en base.
//
// Vive aparte de la ruta HTTP para que la carga manual a produccion use
// EXACTAMENTE el mismo SQL que una subida por la UI: si divergieran, lo cargado
// a mano dejaria de parecerse a lo que cargaria el administrador.
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { MedicionProducto } from "./medidasCajaMaster";

const BATCH_SIZE = 500;

export interface ResultadoMediciones {
  productos: number;
  cajas: number;
  errores: string[];
}

type Cliente = Pick<PrismaClient, "$executeRaw">;

/**
 * Upsert de las fichas de producto y de las cajas.
 *
 * Por lotes y con ON CONFLICT, igual que el importador del maestro: fila a fila
 * son ~6.700 ida y vuelta y tarda minutos.
 */
export async function guardarMediciones(
  prisma: Cliente,
  productos: MedicionProducto[]
): Promise<ResultadoMediciones> {
  const errores: string[] = [];
  let cajasGuardadas = 0;

  for (let i = 0; i < productos.length; i += BATCH_SIZE) {
    const lote = productos.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      lote.map(
        (p) => Prisma.sql`(${randomUUID()}, ${p.plu}, ${p.zona}, ${p.partes}, ${p.unidadesSet},
          ${p.subEmpaque}, ${p.empaque.altoCm}, ${p.empaque.anchoCm}, ${p.empaque.profCm},
          ${p.pieza.altoCm}, ${p.pieza.anchoCm}, ${p.pieza.profCm}, now(), now())`
      )
    );
    try {
      await prisma.$executeRaw`
        INSERT INTO medidas_producto (
          id, plu, zona, partes, unidades_set, sub_empaque,
          empaque_alto_cm, empaque_ancho_cm, empaque_prof_cm,
          pieza_alto_cm, pieza_ancho_cm, pieza_prof_cm, created_at, updated_at
        )
        VALUES ${values}
        ON CONFLICT (plu) DO UPDATE SET
          zona = EXCLUDED.zona,
          partes = EXCLUDED.partes,
          unidades_set = EXCLUDED.unidades_set,
          sub_empaque = EXCLUDED.sub_empaque,
          empaque_alto_cm = EXCLUDED.empaque_alto_cm,
          empaque_ancho_cm = EXCLUDED.empaque_ancho_cm,
          empaque_prof_cm = EXCLUDED.empaque_prof_cm,
          pieza_alto_cm = EXCLUDED.pieza_alto_cm,
          pieza_ancho_cm = EXCLUDED.pieza_ancho_cm,
          pieza_prof_cm = EXCLUDED.pieza_prof_cm,
          updated_at = now()
      `;
    } catch (error) {
      errores.push(`medidas_producto ${i + 1}-${i + lote.length}: ${String(error)}`);
    }
  }

  // Las cajas se aplanan: son 1..5 por producto y en lotes de producto el
  // tamaño real del INSERT variaria demasiado.
  const cajas = productos.flatMap((p) => p.cajas.map((c) => ({ plu: p.plu, ...c })));
  for (let i = 0; i < cajas.length; i += BATCH_SIZE) {
    const lote = cajas.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      lote.map(
        (c) => Prisma.sql`(${randomUUID()}, ${c.plu}, ${c.parte}, ${c.pesoBrutoKg}, ${c.pesoNetoKg},
          ${c.altoCm}, ${c.anchoCm}, ${c.profCm}, ${c.volumenM3}, now(), now())`
      )
    );
    try {
      await prisma.$executeRaw`
        INSERT INTO medidas_caja_master (
          id, plu, parte, peso_bruto_kg, peso_neto_kg,
          alto_cm, ancho_cm, prof_cm, volumen_m3, created_at, updated_at
        )
        VALUES ${values}
        ON CONFLICT (plu, parte) DO UPDATE SET
          peso_bruto_kg = EXCLUDED.peso_bruto_kg,
          peso_neto_kg = EXCLUDED.peso_neto_kg,
          alto_cm = EXCLUDED.alto_cm,
          ancho_cm = EXCLUDED.ancho_cm,
          prof_cm = EXCLUDED.prof_cm,
          volumen_m3 = EXCLUDED.volumen_m3,
          updated_at = now()
      `;
      cajasGuardadas += lote.length;
    } catch (error) {
      errores.push(`medidas_caja_master ${i + 1}-${i + lote.length}: ${String(error)}`);
    }
  }

  // Una parte que desaparece del archivo (se remidio y ahora son 2 cajas en vez
  // de 3) tiene que irse: si no, quedaria una caja fantasma sumando volumen.
  const sobrantes = productos
    .filter((p) => p.cajas.length > 0)
    .map((p) => ({ plu: p.plu, max: Math.max(...p.cajas.map((c) => c.parte)) }));
  for (let i = 0; i < sobrantes.length; i += BATCH_SIZE) {
    const lote = sobrantes.slice(i, i + BATCH_SIZE);
    try {
      await prisma.$executeRaw`
        DELETE FROM medidas_caja_master m
        USING (VALUES ${Prisma.join(
          // Los tipos van explicitos: en un VALUES los parametros llegan sin
          // tipo y Postgres los toma por text, asi que "parte > max_parte"
          // reventaba con "operator does not exist: integer > text".
          lote.map((s) => Prisma.sql`(${s.plu}::text, ${s.max}::int)`)
        )})
          AS v(plu, max_parte)
        WHERE m.plu = v.plu AND m.parte > v.max_parte
      `;
    } catch (error) {
      errores.push(`limpieza de partes ${i + 1}-${i + lote.length}: ${String(error)}`);
    }
  }

  return { productos: productos.length, cajas: cajasGuardadas, errores };
}

/**
 * Vuelve a calcular el peso y el m3 de las lineas de muebles ya registradas.
 *
 * Las medidas no se congelan: si se corrige el maestro, lo que ya paso tambien
 * queda bien (decision del 17-09; antes una medida mal cargada quedaba para
 * siempre en esa orden). Una linea abierta no tiene totales todavia: solo se
 * actualiza su medida por unidad.
 *
 * La medida del maestro es de la CAJA MASTER, que puede traer varias unidades
 * ("Und Emp"): una unidad es la caja entre lo que trae.
 */
export async function recalcularLineasMuebles(
  prisma: Pick<PrismaClient, "$executeRaw">,
  plus: readonly string[]
): Promise<number> {
  const unicos = [...new Set(plus)].filter(Boolean);
  if (!unicos.length) return 0;
  return prisma.$executeRaw`
    WITH cajas AS (
      SELECT plu, SUM(volumen_m3) AS m3, SUM(peso_bruto_kg) AS kg
      FROM medidas_caja_master
      WHERE plu IN (${Prisma.join(unicos)})
      GROUP BY plu
    ), medidas AS (
      SELECT c.plu,
        c.m3 / GREATEST(COALESCE(pm.unidades_por_caja, 1), 1) AS m3_unidad,
        c.kg / GREATEST(COALESCE(pm.unidades_por_caja, 1), 1) AS kg_unidad
      FROM cajas c
      LEFT JOIN productos_maestro pm ON pm.plu = c.plu
    )
    UPDATE lineas_muebles l SET
      volumen_unitario_m3 = ROUND(m.m3_unidad::numeric, 6),
      peso_unitario_kg    = ROUND(m.kg_unidad::numeric, 3),
      volumen_total_m3 = CASE WHEN l.hora_fin IS NULL THEN l.volumen_total_m3
                              ELSE ROUND((m.m3_unidad * l.unidades)::numeric, 6) END,
      peso_total_kg    = CASE WHEN l.hora_fin IS NULL THEN l.peso_total_kg
                              ELSE ROUND((m.kg_unidad * l.unidades)::numeric, 3) END,
      updated_at = now()
    FROM medidas m
    WHERE l.plu = m.plu
  `;
}

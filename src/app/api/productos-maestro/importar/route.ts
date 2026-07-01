import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { mapExcelProductoRow, ProductoMaestroDTO } from "@/lib/productosMaestro";
import { readWorkbook, worksheetObjects } from "@/lib/excel";
import { validateImportFile, validateRowLimit } from "@/lib/fileSecurity";
import { getErrorMessage } from "@/lib/errors";

const SHEET_NAME = "ResultadosMaestrodeproductosPV";
const MAX_MAESTRO_ROWS = 25000;
const BATCH_SIZE = 500;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const actor = await requireRole(["ADMIN"]);
  if (actor instanceof NextResponse) return actor;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo .xlsx requerido" }, { status: 400 });
  }
  const fileError = validateImportFile(file, { allowedExtensions: [".xlsx"] });
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = await readWorkbook(buffer);
  const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) return NextResponse.json({ error: "No se encontro hoja en el archivo" }, { status: 400 });

  const rows = worksheetObjects(sheet);
  const rowLimitError = validateRowLimit(rows.length, MAX_MAESTRO_ROWS);
  if (rowLimitError) return NextResponse.json({ error: rowLimitError }, { status: 400 });

  let ignorados = 0;
  // Mapa por PLU: si el archivo trae PLUs repetidos, gana la ultima fila (mismo
  // comportamiento que el upsert secuencial anterior).
  const productosPorPlu = new Map<string, ProductoMaestroDTO>();
  rows.forEach((row) => {
    const producto = mapExcelProductoRow(row);
    if (!producto) {
      ignorados += 1;
      return;
    }
    productosPorPlu.set(producto.plu, producto);
  });
  const productos = [...productosPorPlu.values()];

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

  // UPSERT masivo por lotes (INSERT ... ON CONFLICT) en vez de una fila a la
  // vez: con ~19k productos, hacerlo fila por fila tardaba varios minutos.
  for (let i = 0; i < productos.length; i += BATCH_SIZE) {
    const lote = productos.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      lote.map(
        (p) =>
          Prisma.sql`(${randomUUID()}, ${p.plu}, ${p.descripcion}, ${p.fabricante}, ${p.precio}, ${p.marca}, now(), now())`
      )
    );
    try {
      await prisma.$executeRaw`
        INSERT INTO productos_maestro (id, plu, descripcion, fabricante, precio, marca, created_at, updated_at)
        VALUES ${values}
        ON CONFLICT (plu) DO UPDATE SET
          descripcion = EXCLUDED.descripcion,
          fabricante = EXCLUDED.fabricante,
          precio = EXCLUDED.precio,
          marca = EXCLUDED.marca,
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

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "IMPORT",
      module: "productos-maestro",
      recordId: file.name,
      details: `${importados} importados, ${actualizados} actualizados, ${ignorados} ignorados`,
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    data: { importados, actualizados, ignorados, errores },
  });
}

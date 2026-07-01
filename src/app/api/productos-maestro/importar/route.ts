import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { mapExcelProductoRow } from "@/lib/productosMaestro";
import { readWorkbook, worksheetObjects } from "@/lib/excel";
import { validateImportFile, validateRowLimit } from "@/lib/fileSecurity";
import { getErrorMessage } from "@/lib/errors";

const SHEET_NAME = "ResultadosMaestrodeproductosPV";
const MAX_MAESTRO_ROWS = 25000;

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
  let importados = 0;
  let actualizados = 0;
  let ignorados = 0;
  const errores: string[] = [];

  for (const [index, row] of rows.entries()) {
    const producto = mapExcelProductoRow(row);
    if (!producto) {
      ignorados += 1;
      continue;
    }

    try {
      const existing = await prisma.productoMaestro.findUnique({
        where: { plu: producto.plu },
        select: { id: true },
      });
      await prisma.productoMaestro.upsert({
        where: { plu: producto.plu },
        create: {
          plu: producto.plu,
          descripcion: producto.descripcion,
          fabricante: producto.fabricante,
          precio: producto.precio,
          marca: producto.marca,
        },
        update: {
          descripcion: producto.descripcion,
          fabricante: producto.fabricante,
          precio: producto.precio,
          marca: producto.marca,
        },
      });
      if (existing) actualizados += 1;
      else importados += 1;
    } catch (error) {
      errores.push(`Fila ${index + 2}: ${getErrorMessage(error, "error al importar")}`);
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

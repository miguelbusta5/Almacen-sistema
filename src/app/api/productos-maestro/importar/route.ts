import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { mapExcelProductoRow } from "@/lib/productosMaestro";

const SHEET_NAME = "ResultadosMaestrodeproductosPV";

export async function POST(req: NextRequest) {
  const actor = await requireRole(["ADMIN"]);
  if (actor instanceof NextResponse) return actor;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo .xlsx requerido" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Solo se acepta archivo .xlsx" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[SHEET_NAME] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return NextResponse.json({ error: "No se encontro hoja en el archivo" }, { status: 400 });

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
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
    } catch (error: any) {
      errores.push(`Fila ${index + 2}: ${error?.message ?? "error al importar"}`);
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

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { workbookBuffer } from "@/lib/excel";
import { MAESTRO_SHEET_NAME } from "@/lib/productosMaestro";

export const maxDuration = 30;

// GET /api/productos-maestro/export — descarga el maestro completo en el mismo
// formato (hoja + encabezados) que espera POST /api/productos-maestro/importar,
// para que el archivo descargado sirva de plantilla/ejemplo de reimportación.
export async function GET() {
  const actor = await requireRole(["ADMIN"]);
  if (actor instanceof NextResponse) return actor;

  const productos = await prisma.productoMaestro.findMany({ orderBy: { plu: "asc" } });

  const headers = ["PLU", "DESCRIPCION", "Fabricante", "PRECIO", "MARCAS"];
  const rows: (string | number)[][] = productos.map((p) => [
    p.plu,
    p.descripcion ?? "",
    p.fabricante ?? "",
    p.precio == null ? "" : Number(p.precio),
    p.marca ?? "",
  ]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(MAESTRO_SHEET_NAME);
  ws.addRows([headers, ...rows]);
  ws.columns = [16, 44, 24, 12, 20].map((width) => ({ width }));

  const buf = await workbookBuffer(wb);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="maestro-productos-${today}.xlsx"`,
    },
  });
}

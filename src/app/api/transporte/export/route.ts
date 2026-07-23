import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { workbookBuffer } from "@/lib/excel";
import { calcAlmacenaje } from "@/lib/almacenaje";
import type { Prisma } from "@prisma/client";

// Roles que pueden exportar, más el acceso puntual (no general) para
// auxiliar-transporte@gmail.com — ver docs/cerebro/pendientes.md sobre el
// retiro de un permiso por email equivalente en Cargue Gourmet: acá se
// reintroduce acotado solo a esta exportación, a pedido explícito.
const ALLOWED_ROLES = ["ADMIN", "GERENTE", "TRANSPORTE", "SUPERVISOR_TRANSPORTE"] as const;
const ALLOWED_EMAILS = ["auxiliar-transporte@gmail.com"];

// GET /api/transporte/export — mismos filtros que GET /api/transporte.
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!ALLOWED_ROLES.includes(actor.role as (typeof ALLOWED_ROLES)[number]) && !ALLOWED_EMAILS.includes(actor.email ?? "")) {
    return NextResponse.json({ error: "No tienes permisos para exportar" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const estado = sp.get("estado") ?? undefined;
  const tipo = sp.get("tipo") ?? undefined;

  const where: Prisma.TransporteGuardadoWhereInput = {};
  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;
  if (q) where.OR = [
    { documento: { contains: q, mode: "insensitive" } },
    { ubicacion: { contains: q, mode: "insensitive" } },
  ];

  const rows = await prisma.transporteGuardado.findMany({
    where,
    orderBy: [{ fecha: "desc" }, { created_at: "desc" }],
    take: 5000,
  });

  const headers = [
    "Documento", "Tipo", "Código tienda", "Nombre tienda", "Ciudad", "Ubicación",
    "Estado", "Fecha ingreso", "Fecha despacho", "Días transcurridos",
    "Costo almacenaje acumulado", "Nota",
  ];

  const dataRows: (string | number)[][] = rows.map((r) => {
    const fecha = r.fecha.toISOString().slice(0, 10);
    const fechaDespacho = r.fecha_despacho ? r.fecha_despacho.toISOString().slice(0, 10) : null;
    const alm = calcAlmacenaje(fecha, fechaDespacho);
    return [
      r.documento,
      r.tipo ?? "COMUN",
      r.codigoTienda ?? "",
      r.nombreTienda ?? "",
      r.ciudad ?? "",
      r.ubicacion,
      r.estado,
      fecha,
      fechaDespacho ?? "",
      alm.diasTranscurridos,
      alm.costoAcumulado,
      r.nota ?? "",
    ];
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Guardados Transporte");
  ws.addRows([headers, ...dataRows]);
  ws.columns = [18, 12, 14, 26, 16, 24, 18, 14, 14, 10, 16, 30].map((width) => ({ width }));

  const buf = await workbookBuffer(wb);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="guardados-transporte-${today}.xlsx"`,
    },
  });
}

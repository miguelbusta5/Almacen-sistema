import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { workbookBuffer } from "@/lib/excel";
import { puedeGestionarExportaciones, formatDateOnly, calcularDuracionMinutos } from "@/lib/exportaciones";
import type { Prisma } from "@prisma/client";

// Datetime corto en hora local de Bogotá para las columnas de hora.
const fmtHora = (d: Date): string =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }).format(d);

// GET /api/exportaciones/export — descarga XLSX (solo gestores). Respeta los
// mismos filtros que el listado: q, fecha, estado (en-curso/finalizado), usuarioId.
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeGestionarExportaciones(actor.role)) {
    return NextResponse.json({ error: "Sin permiso para exportar" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const fecha = url.searchParams.get("fecha")?.trim();
  const usuarioId = url.searchParams.get("usuarioId")?.trim();
  const estado = url.searchParams.get("estado")?.trim();

  const where: Prisma.EtiquetadoExportacionWhereInput = {
    deletedAt: null,
    ...(usuarioId ? { creadoPorId: usuarioId } : {}),
    ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
    ...(estado === "en-curso" ? { horaFinalizacion: null } : {}),
    ...(estado === "finalizado" ? { horaFinalizacion: { not: null } } : {}),
    ...(q ? {
      OR: [
        { numeroCaja: { contains: q, mode: "insensitive" } },
        { plu: { contains: q, mode: "insensitive" } },
        { descripcion: { contains: q, mode: "insensitive" } },
      ],
    } : {}),
  };

  const registros = await prisma.etiquetadoExportacion.findMany({
    where,
    include: {
      creadoPor: { select: { name: true } },
      actualizadoPor: { select: { name: true } },
    },
    orderBy: [{ horaInicio: "desc" }],
    take: 5000,
  });

  const headers = [
    "Fecha", "N° Caja", "PLU", "Descripción", "Unidad empaque",
    "Hora inicio", "Hora finalización", "Duración (min)", "Estado",
    "Reguero", "Cantidad reguero", "Motivo corrección", "Creado por", "Actualizado por",
  ];

  const rows: (string | number | null)[][] = registros.map((r) => [
    formatDateOnly(r.fecha) ?? "",
    r.numeroCaja,
    r.plu,
    r.descripcion,
    r.unidadEmpaque,
    fmtHora(r.horaInicio),
    r.horaFinalizacion ? fmtHora(r.horaFinalizacion) : "",
    calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion) ?? "",
    r.horaFinalizacion ? "Finalizado" : "En curso",
    r.hayReguero ? "Sí" : "No",
    r.cantidadReguero ?? "",
    r.motivoCorreccion ?? "",
    r.creadoPor?.name ?? "",
    r.actualizadoPor?.name ?? "",
  ]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Exportaciones");
  ws.addRows([headers, ...rows]);
  ws.columns = [12, 14, 12, 32, 14, 18, 18, 14, 12, 9, 14, 28, 22, 22].map((width) => ({ width }));

  const buf = await workbookBuffer(wb);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="exportaciones-${today}.xlsx"`,
    },
  });
}

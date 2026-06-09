import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const ALLOWED = ["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"];

const ESTADO_LABEL: Record<string, string> = {
  APROBADA:                   "Aprobada",
  APROBADA_CON_OBSERVACIONES: "Con observaciones",
  BLOQUEADA:                  "Bloqueada",
};

export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!ALLOWED.includes(actor.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const fechaDesde  = params.get("fechaDesde");
  const fechaHasta  = params.get("fechaHasta");
  const conductorId = params.get("conductorId") || undefined;
  const estado      = params.get("estado") || undefined;

  const where: any = { vigente: true };
  if (fechaDesde) where.fecha = { ...where.fecha, gte: new Date(fechaDesde) };
  if (fechaHasta) where.fecha = { ...where.fecha, lte: new Date(fechaHasta + "T23:59:59Z") };
  if (conductorId) where.conductorId = conductorId;
  if (estado) where.estado = estado;

  const inspecciones = await prisma.inspeccionPreoperacional.findMany({
    where,
    select: {
      fecha: true,
      kilometraje: true,
      observaciones: true,
      estado: true,
      conductor: { select: { nombre: true } },
      vehiculo:  { select: { placa: true, tipo: true } },
      items: {
        select: {
          categoria: true,
          item: true,
          resultado: true,
          esCritico: true,
          observacion: true,
          fotoUrl: true,
        },
        orderBy: { categoria: "asc" },
      },
    },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 5000,
  });

  const headers = [
    "Fecha", "Conductor", "Vehículo", "Tipo", "Km", "Estado general",
    "Categoría", "Ítem", "Resultado", "Es Crítico",
    "Observación ítem", "Foto URL", "Observaciones generales",
  ];

  const rows: (string | number | null)[][] = [];
  for (const ins of inspecciones) {
    const fechaStr = ins.fecha instanceof Date ? ins.fecha.toISOString().slice(0, 10) : ins.fecha;
    const conductor = ins.conductor?.nombre ?? "";
    const placa     = ins.vehiculo?.placa ?? "";
    const tipo      = ins.vehiculo?.tipo ?? "";
    const km        = ins.kilometraje ?? "";
    const estadoLabel = ESTADO_LABEL[ins.estado] ?? ins.estado;
    const obsGeneral  = ins.observaciones ?? "";

    for (const item of ins.items) {
      rows.push([
        fechaStr,
        conductor,
        placa,
        tipo,
        km,
        estadoLabel,
        item.categoria,
        item.item,
        item.resultado === "CONFORME" ? "Conforme" : item.resultado === "NO_CONFORME" ? "No conforme" : "No aplica",
        item.esCritico ? "Sí" : "No",
        item.observacion ?? "",
        item.fotoUrl ?? "",
        obsGeneral,
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [12, 22, 12, 10, 8, 22, 14, 32, 14, 10, 28, 30, 28].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Preoperacionales");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="preoperacionales-${today}.xlsx"`,
    },
  });
}

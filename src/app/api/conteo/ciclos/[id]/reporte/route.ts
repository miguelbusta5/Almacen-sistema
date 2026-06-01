import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types";
import * as XLSX from "xlsx";

// GET /api/conteo/ciclos/[id]/reporte — descarga Excel final
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  // Solo GERENTE y ADMIN pueden descargar
  if (!can(actor.role as UserRole, "edit")) {
    return NextResponse.json({ error: "Sin permiso para descargar el reporte" }, { status: 403 });
  }

  const { id } = await params;
  const ciclo = await prisma.cicloConteo.findUnique({ where: { id } });
  if (!ciclo) return NextResponse.json({ error: "Ciclo no encontrado" }, { status: 404 });

  // Traer todas las líneas: novedades primero, luego OK, resto al final
  const lineas = await prisma.lineaConteo.findMany({
    where: { cicloId: id },
    orderBy: [
      // NOVEDAD primero, OK después, el resto al final
      { estado: "asc" },
      { ubicacion: "asc" },
    ],
  });

  // Ordenar manualmente: NOVEDAD → OK → resto
  const orden = (e: string) => e === "NOVEDAD" ? 0 : e === "OK" ? 1 : 2;
  lineas.sort((a, b) => orden(a.estado) - orden(b.estado) || a.ubicacion.localeCompare(b.ubicacion));

  // Construir filas del Excel
  const headers = [
    "PLU", "Depósito (Ubicación)", "Descripción", "Marca", "Código Barras",
    "Teórico", "Cant. Contada", "Cant. Recontada", "Diferencia",
    "Precio Base", "Último Precio Compra", "Estado",
  ];

  const rows = lineas.map((l) => [
    l.plu,
    l.ubicacion,
    l.descripcion,
    l.marca ?? "",
    l.codigoBarras ?? "",
    Number(l.teorico),
    l.cantidadContada ? Number(l.cantidadContada) : "",
    l.cantidadRecontada ? Number(l.cantidadRecontada) : "",
    l.diferenciaFinal != null ? Number(l.diferenciaFinal) : "",
    l.precioBase ? Number(l.precioBase) : "",
    l.ultimoPrecio ? Number(l.ultimoPrecio) : "",
    l.estado,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Ancho de columnas
  ws["!cols"] = [8, 18, 40, 20, 15, 10, 12, 14, 12, 14, 18, 12].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Informe Conteo");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fecha = ciclo.fechaInicio.toISOString().slice(0, 10);
  const filename = `conteo-${ciclo.nombre.replace(/\s+/g, "-")}-${fecha}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

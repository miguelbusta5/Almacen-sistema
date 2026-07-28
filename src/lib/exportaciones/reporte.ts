// SERVER-ONLY. Reporte consolidado de Exportaciones: lee los tres países y devuelve
// el .xlsx de 5 hojas con gráficas. A diferencia de `/export` (volcado plano del país
// en el que estás, con los filtros de la pantalla), esto es un único informe de todo
// el histórico de los tres módulos — de ahí que viva en un solo endpoint y no en la
// factory por país.
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { puedeGestionarExportaciones } from "@/lib/exportaciones";
import { getExportDelegate } from "@/lib/exportaciones/delegate";
import { PAISES_EXPORT_LIST } from "@/lib/exportaciones/paises";
import { construirReporte } from "@/lib/exportaciones/reporteWorkbook";
import type { RegistroReporte } from "@/lib/exportaciones/reporteCalc";

// Tope por país. El reporte es de todo el histórico a propósito (las hojas de
// tendencia y promedios mensuales lo necesitan), pero sin límite una tabla que
// crezca sin control tumbaría la función. Con el volumen actual sobra de largo.
const MAX_POR_PAIS = 100_000;

const SELECT = {
  fecha: true,
  numeroCaja: true,
  plu: true,
  descripcion: true,
  unidadEmpaque: true,
  horaInicio: true,
  horaFinalizacion: true,
  hayReguero: true,
  cantidadReguero: true,
  motivoCorreccion: true,
  creadoPorId: true,
  creadoPor: { select: { name: true } },
  actualizadoPor: { select: { name: true } },
} as const;

export async function cargarRegistrosReporte(): Promise<RegistroReporte[]> {
  const porPais = await Promise.all(
    PAISES_EXPORT_LIST.map(async (cfg) => {
      const filas = await getExportDelegate(cfg.pais).findMany({
        where: { deletedAt: null },
        select: SELECT,
        orderBy: [{ fecha: "desc" }, { horaInicio: "desc" }],
        take: MAX_POR_PAIS,
      });
      return filas.map((r): RegistroReporte => ({
        pais: cfg.pais,
        paisLabel: cfg.paisLabel,
        fecha: r.fecha,
        numeroCaja: r.numeroCaja,
        plu: r.plu,
        descripcion: r.descripcion,
        unidadEmpaque: r.unidadEmpaque,
        horaInicio: r.horaInicio,
        horaFinalizacion: r.horaFinalizacion,
        hayReguero: r.hayReguero,
        cantidadReguero: r.cantidadReguero,
        motivoCorreccion: r.motivoCorreccion,
        creadoPorId: r.creadoPorId,
        creadoPorNombre: r.creadoPor?.name ?? "Usuario",
        actualizadoPorNombre: r.actualizadoPor?.name ?? null,
      }));
    }),
  );

  return porPais
    .flat()
    .sort(
      (a, b) =>
        new Date(b.horaInicio).getTime() - new Date(a.horaInicio).getTime(),
    );
}

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeGestionarExportaciones(actor.role)) {
    return NextResponse.json({ error: "Sin permiso para exportar" }, { status: 403 });
  }

  const registros = await cargarRegistrosReporte();
  const buffer = await construirReporte(registros);
  const hoy = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-exportaciones-${hoy}.xlsx"`,
    },
  });
}

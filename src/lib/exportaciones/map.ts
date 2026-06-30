// Mapeo fila DB → DTO de API. Agnóstico del país (los 3 modelos comparten forma).
import type { Prisma } from "@prisma/client";
import { calcularDuracionMinutos, formatDateOnly } from "@/lib/exportaciones";

export type ExportacionRow = Prisma.EtiquetadoExportacionGetPayload<{
  include: {
    creadoPor: { select: { name: true } };
    actualizadoPor: { select: { name: true } };
  };
}>;

export function mapExportacion(row: ExportacionRow) {
  return {
    id: row.id,
    numeroCaja: row.numeroCaja,
    plu: row.plu,
    descripcion: row.descripcion,
    unidadEmpaque: row.unidadEmpaque,
    fecha: formatDateOnly(row.fecha),
    horaInicio: row.horaInicio.toISOString(),
    horaFinalizacion: row.horaFinalizacion ? row.horaFinalizacion.toISOString() : null,
    duracionMinutos: calcularDuracionMinutos(row.horaInicio, row.horaFinalizacion),
    motivoCorreccion: row.motivoCorreccion ?? null,
    creadoPorId: row.creadoPorId,
    creadoPorNombre: row.creadoPor?.name ?? null,
    actualizadoPorId: row.actualizadoPorId ?? null,
    actualizadoPorNombre: row.actualizadoPor?.name ?? null,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

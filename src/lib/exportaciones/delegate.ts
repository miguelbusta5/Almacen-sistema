// SERVER-ONLY. Resuelve el delegate de Prisma para cada país de exportación.
// Los 3 modelos (EtiquetadoExportacion / ...Mexico / ...Eeuu) tienen forma
// idéntica de campos y de relaciones (creadoPor/actualizadoPor), por lo que sus
// delegates son estructuralmente compatibles. El cast es seguro porque cualquier
// `include`/`select`/`where` válido para uno compila para los tres.
import { prisma } from "@/lib/prisma";
import type { PaisExport } from "@/lib/exportaciones/paises";

export type ExportDelegate = Pick<
  typeof prisma.etiquetadoExportacion,
  "findMany" | "count" | "create" | "update" | "updateMany" | "findUnique"
>;

export function getExportDelegate(pais: PaisExport): ExportDelegate {
  switch (pais) {
    case "ecuador":
      return prisma.etiquetadoExportacion as unknown as ExportDelegate;
    case "mexico":
      return prisma.etiquetadoExportacionMexico as unknown as ExportDelegate;
    case "eeuu":
      return prisma.etiquetadoExportacionEeuu as unknown as ExportDelegate;
  }
}

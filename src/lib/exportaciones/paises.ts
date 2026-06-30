// Config de los módulos de exportación por país. CLIENT-SAFE: no importa Prisma
// ni nada de servidor, porque el frontend (ExportacionesModule) lo consume.
import type { ModuleKey } from "@/lib/modulePermissions";

export type PaisExport = "ecuador" | "mexico" | "eeuu";

export interface PaisConfig {
  pais: PaisExport;
  /** Label completo del módulo, p.ej. "Exportaciones Ecuador". */
  label: string;
  /** Etiqueta del país para Excel y mapa, p.ej. "Ecuador" | "México" | "EE.UU". */
  paisLabel: string;
  moduleKey: ModuleKey;
  basePath: string;
  apiBase: string;
  /** Punto de destino en el mapa. `ciudad` debe existir en cityCoordinates. */
  destino: { ciudad: string; lat: number; lng: number };
}

export const PAISES_EXPORT: Record<PaisExport, PaisConfig> = {
  ecuador: {
    pais: "ecuador",
    label: "Exportaciones Ecuador",
    paisLabel: "Ecuador",
    moduleKey: "exportaciones",
    basePath: "/dashboard/exportaciones",
    apiBase: "/api/exportaciones",
    destino: { ciudad: "Ecuador", lat: -0.1807, lng: -78.4678 }, // Quito
  },
  mexico: {
    pais: "mexico",
    label: "Exportaciones México",
    paisLabel: "México",
    moduleKey: "exportaciones-mexico",
    basePath: "/dashboard/exportaciones-mexico",
    apiBase: "/api/exportaciones-mexico",
    destino: { ciudad: "Mexico", lat: 19.4326, lng: -99.1332 }, // CDMX
  },
  eeuu: {
    pais: "eeuu",
    label: "Exportaciones EE.UU",
    paisLabel: "EE.UU",
    moduleKey: "exportaciones-eeuu",
    basePath: "/dashboard/exportaciones-eeuu",
    apiBase: "/api/exportaciones-eeuu",
    destino: { ciudad: "Estados Unidos", lat: 38.9072, lng: -77.0369 }, // Washington
  },
};

export const PAISES_EXPORT_LIST: PaisConfig[] = Object.values(PAISES_EXPORT);

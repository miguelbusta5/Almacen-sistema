export type ResultadoInspeccion = "CONFORME" | "NO_CONFORME" | "NO_APLICA";

export interface ChecklistItem {
  categoria: string;
  item: string;
  esCritico: boolean;
}

export const CHECKLIST_PREOPERACIONAL: ChecklistItem[] = [
  { categoria: "documentos", item: "Licencia de conduccion vigente", esCritico: true },
  { categoria: "documentos", item: "SOAT y revision tecnico-mecanica vigentes", esCritico: true },
  { categoria: "seguridad", item: "Frenos de servicio y emergencia", esCritico: true },
  { categoria: "seguridad", item: "Luces delanteras, traseras y direccionales", esCritico: true },
  { categoria: "seguridad", item: "Llantas en buen estado", esCritico: true },
  { categoria: "seguridad", item: "Cinturon de seguridad", esCritico: true },
  { categoria: "equipo", item: "Extintor vigente", esCritico: true },
  { categoria: "equipo", item: "Botiquin, conos y kit de carretera", esCritico: false },
  { categoria: "operacion", item: "Nivel de combustible suficiente", esCritico: false },
  { categoria: "operacion", item: "Sin fugas visibles de aceite o fluidos", esCritico: true },
  { categoria: "operacion", item: "Carroceria y compartimiento de carga limpios", esCritico: false },
  { categoria: "operacion", item: "Espejos, pito y limpiabrisas funcionales", esCritico: false },
];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function estadoDesdeItems(items: Array<{ resultado: ResultadoInspeccion; esCritico: boolean }>) {
  const critico = items.some((i) => i.esCritico && i.resultado === "NO_CONFORME");
  if (critico) return "BLOQUEADA" as const;
  const observacion = items.some((i) => i.resultado === "NO_CONFORME");
  if (observacion) return "APROBADA_CON_OBSERVACIONES" as const;
  return "APROBADA" as const;
}

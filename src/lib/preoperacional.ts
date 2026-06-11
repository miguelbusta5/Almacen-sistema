export type ResultadoInspeccion = "CONFORME" | "NO_CONFORME" | "NO_APLICA";

export interface ChecklistItem {
  categoria: string;
  item: string;
  esCritico: boolean;
}

export const CHECKLIST_PREOPERACIONAL: ChecklistItem[] = [
  // ── LLANTAS ──────────────────────────────────────────────────
  { categoria: "LLANTAS",                        item: "Delanteras",                                                                    esCritico: true  },
  { categoria: "LLANTAS",                        item: "Traseras",                                                                      esCritico: true  },
  { categoria: "LLANTAS",                        item: "Repuesto",                                                                      esCritico: false },

  // ── FRENOS ───────────────────────────────────────────────────
  { categoria: "FRENOS",                         item: "Frenos de servicio",                                                            esCritico: true  },
  { categoria: "FRENOS",                         item: "Freno de emergencia",                                                           esCritico: true  },

  // ── LUCES ────────────────────────────────────────────────────
  { categoria: "LUCES",                          item: "Altas",                                                                         esCritico: false },
  { categoria: "LUCES",                          item: "Bajas",                                                                         esCritico: true  },
  { categoria: "LUCES",                          item: "Direccionales delanteros derecho",                                              esCritico: false },
  { categoria: "LUCES",                          item: "Direccionales delanteros izquierdo",                                            esCritico: false },
  { categoria: "LUCES",                          item: "Direccionales traseros derecho",                                                esCritico: false },
  { categoria: "LUCES",                          item: "Direccionales traseros izquierdo",                                              esCritico: false },
  { categoria: "LUCES",                          item: "De parqueo delanteras",                                                         esCritico: false },
  { categoria: "LUCES",                          item: "De parqueo traseras",                                                           esCritico: false },
  { categoria: "LUCES",                          item: "Reversa",                                                                       esCritico: false },
  { categoria: "LUCES",                          item: "Stop",                                                                          esCritico: true  },

  // ── ESPEJOS ──────────────────────────────────────────────────
  { categoria: "ESPEJOS",                        item: "Retrovisor",                                                                    esCritico: true  },
  { categoria: "ESPEJOS",                        item: "Lateral izquierdo",                                                             esCritico: true  },
  { categoria: "ESPEJOS",                        item: "Lateral derecho",                                                               esCritico: true  },

  // ── CONDICIONES TECNICAS ─────────────────────────────────────
  { categoria: "CONDICIONES TECNICAS",           item: "Nivel de aceite",                                                               esCritico: false },
  { categoria: "CONDICIONES TECNICAS",           item: "Nivel de liquidos de frenos",                                                   esCritico: true  },
  { categoria: "CONDICIONES TECNICAS",           item: "Nivel de refrigerante",                                                         esCritico: false },
  { categoria: "CONDICIONES TECNICAS",           item: "Elementos hidraulicos",                                                         esCritico: false },
  { categoria: "CONDICIONES TECNICAS",           item: "Fugas",                                                                         esCritico: true  },
  { categoria: "CONDICIONES TECNICAS",           item: "Manigueta y calapies",                                                          esCritico: false },
  { categoria: "CONDICIONES TECNICAS",           item: "Kit de arrastre (estado del pinon y lubricacion de cadena)",                   esCritico: false },
  { categoria: "CONDICIONES TECNICAS",           item: "Gato",                                                                          esCritico: false },

  // ── APOYA CABEZA ─────────────────────────────────────────────
  { categoria: "APOYA CABEZA",                   item: "Delanteros",                                                                    esCritico: false },
  { categoria: "APOYA CABEZA",                   item: "Traseros",                                                                      esCritico: false },

  // ── CINTURONES DE SEGURIDAD ──────────────────────────────────
  { categoria: "CINTURONES DE SEGURIDAD",        item: "Delanteros",                                                                    esCritico: true  },
  { categoria: "CINTURONES DE SEGURIDAD",        item: "Traseros",                                                                      esCritico: true  },

  // ── PLUMILLAS ────────────────────────────────────────────────
  { categoria: "PLUMILLAS",                      item: "Plumillas en funcionamiento",                                                   esCritico: false },

  // ── PITO ─────────────────────────────────────────────────────
  { categoria: "PITO",                           item: "Pito en funcionamiento",                                                        esCritico: false },

  // ── LOGO ─────────────────────────────────────────────────────
  { categoria: "LOGO",                           item: "Logo visible y en buen estado",                                                 esCritico: false },

  // ── CARPA Y CABINA ───────────────────────────────────────────
  { categoria: "CARPA Y CABINA",                 item: "Tiene carpa",                                                                   esCritico: false },
  { categoria: "CARPA Y CABINA",                 item: "Tiene cabina",                                                                  esCritico: false },

  // ── PORTA ESCALERA ───────────────────────────────────────────
  { categoria: "PORTA ESCALERA",                 item: "Porta escalera con rodillos y soporte",                                         esCritico: false },

  // ── EQUIPO DE CARRETERA ──────────────────────────────────────
  { categoria: "EQUIPO DE CARRETERA",            item: "Maletin de herramientas",                                                       esCritico: false },
  { categoria: "EQUIPO DE CARRETERA",            item: "Botiquin de primeros auxilios",                                                 esCritico: true  },
  { categoria: "EQUIPO DE CARRETERA",            item: "Triangulos de parqueo",                                                         esCritico: false },
  { categoria: "EQUIPO DE CARRETERA",            item: "Tacos de bloqueo de vehiculo",                                                  esCritico: false },
  { categoria: "EQUIPO DE CARRETERA",            item: "Linterna",                                                                      esCritico: false },
  { categoria: "EQUIPO DE CARRETERA",            item: "Chaleco Reflectivo (Recomendable)",                                             esCritico: false },

  // ── EXTINTOR ─────────────────────────────────────────────────
  { categoria: "EXTINTOR",                       item: "Tipo de extintor correcto",                                                     esCritico: true  },
  { categoria: "EXTINTOR",                       item: "Libras del extintor",                                                           esCritico: true  },
  { categoria: "EXTINTOR",                       item: "Agente extintor",                                                               esCritico: true  },
  { categoria: "EXTINTOR",                       item: "Fecha de recarga vigente",                                                      esCritico: true  },

  // ── DOCUMENTACION ────────────────────────────────────────────
  { categoria: "DOCUMENTACION",                  item: "N de SOAT",                                                                     esCritico: true  },
  { categoria: "DOCUMENTACION",                  item: "Licencia de Conduccion",                                                        esCritico: true  },
  { categoria: "DOCUMENTACION",                  item: "Extracto del contrato (Si Aplica)",                                             esCritico: false },
  { categoria: "DOCUMENTACION",                  item: "Poliza de danos contra terceros",                                               esCritico: true  },
  { categoria: "DOCUMENTACION",                  item: "Tarjeta de Operacion",                                                          esCritico: true  },
  { categoria: "DOCUMENTACION",                  item: "Certificado de emision de gases",                                               esCritico: false },
  { categoria: "DOCUMENTACION",                  item: "Revision Tecnico Mecanica",                                                     esCritico: false },
  { categoria: "DOCUMENTACION",                  item: "Aviso como conduzco parte trasera e interna Res 572 de 2013",                  esCritico: false },

  // ── ULTIMA FECHA DE MANTENIMIENTO ────────────────────────────
  { categoria: "ULTIMA FECHA DE MANTENIMIENTO",  item: "Cambio de Aceite",                                                              esCritico: false },
  { categoria: "ULTIMA FECHA DE MANTENIMIENTO",  item: "Sincronizacion",                                                                esCritico: false },
  { categoria: "ULTIMA FECHA DE MANTENIMIENTO",  item: "Alineacion y Balanceo",                                                         esCritico: false },
  { categoria: "ULTIMA FECHA DE MANTENIMIENTO",  item: "Cambio de llantas",                                                             esCritico: false },

  // ── ALMACENAMIENTO Y TRANSPORTE ──────────────────────────────
  { categoria: "ALMACENAMIENTO Y TRANSPORTE",    item: "Capacidad de carga: materiales y equipos no superan la capacidad del vehiculo", esCritico: true  },
  { categoria: "ALMACENAMIENTO Y TRANSPORTE",    item: "Almacenamiento: materiales y equipos debidamente almacenados y asegurados",    esCritico: true  },
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

// ═══════════════════════════════════════════════════════════
// CENTRO DE INTELIGENCIA OPERACIONAL
// Computa insights proactivos desde datos ya cargados.
// Sin llamadas API adicionales — puro análisis en memoria.
// ═══════════════════════════════════════════════════════════

import type { Novedad } from "@/lib/muebles";
import type { Guardado } from "@/lib/transporte";
import type { Ruta } from "@/lib/logistica";
import { urgencia, parseEntrega } from "@/lib/transporte";
import { calcAlmacenaje } from "@/lib/almacenaje";

export type InsightLevel = "critical" | "warning" | "info";

export interface IntelInsight {
  id: string;
  level: InsightLevel;
  module: "muebles" | "transporte" | "logistica" | "global";
  message: string;
  context?: string;         // dato de soporte (número, nombre, etc.)
  recordId?: string | number; // para hacer click-to-detail
  action?: string;          // texto del CTA
}

// ── Umbrales configurables ────────────────────────────────
const UMBRAL_PLU_PCT     = 25;  // % de novedades de un solo PLU → alerta
const UMBRAL_FAB_PCT     = 40;  // % de impacto de un fabricante → alerta
const UMBRAL_DIAS_PEND   = 30;  // días sin resolver → alerta crítica
const UMBRAL_ALM_MONTO   = 300_000; // costo almacenaje en $ → alerta
const UMBRAL_RUTA_HORA   = 14;  // hora del día para evaluar retraso de ruta
const UMBRAL_RUTA_PROG   = 0.45; // progreso < 45% a las 14h → riesgo
const UMBRAL_FAIL_COUNT  = 2;   // entregas fallidas mínimas para alertar

// ── Helpers ───────────────────────────────────────────────
function fmtCOP(n: number) {
  return "$" + n.toLocaleString("es-CO");
}
function diasDesde(fechaISO: string): number {
  return Math.floor((Date.now() - new Date(fechaISO + "T00:00:00").getTime()) / 86_400_000);
}

// ═══════════════════════════════════════════════════════════
// INSIGHTS DE NOVEDADES (MUEBLES)
// ═══════════════════════════════════════════════════════════
export function insightsNovedades(items: Novedad[]): IntelInsight[] {
  const out: IntelInsight[] = [];
  const pendientes = items.filter((n) => n.estado === "PENDIENTE");
  if (items.length === 0) return out;

  // 1. PLU que concentra demasiadas novedades pendientes
  const byPlu: Record<string, Novedad[]> = {};
  for (const n of pendientes) {
    byPlu[n.plu] = [...(byPlu[n.plu] ?? []), n];
  }
  const topPlu = Object.entries(byPlu).sort((a, b) => b[1].length - a[1].length)[0];
  if (topPlu && pendientes.length > 3) {
    const pct = Math.round(topPlu[1].length / pendientes.length * 100);
    if (pct >= UMBRAL_PLU_PCT) {
      out.push({
        id: `plu-concentrado-${topPlu[0]}`,
        level: "warning",
        module: "muebles",
        message: `PLU ${topPlu[0]} genera el ${pct}% de las novedades pendientes`,
        context: `${topPlu[1].length} registros sin resolver`,
        action: "Ver PLU",
      });
    }
  }

  // 2. Fabricante que concentra el impacto económico
  const byFab: Record<string, number> = {};
  const totalImpacto = items.reduce((s, n) => s + Math.abs(n.costoIncidencia ?? 0), 0);
  for (const n of items) {
    if (!n.fabricante) continue;
    byFab[n.fabricante] = (byFab[n.fabricante] ?? 0) + Math.abs(n.costoIncidencia ?? 0);
  }
  const topFab = Object.entries(byFab).sort((a, b) => b[1] - a[1])[0];
  if (topFab && totalImpacto > 0) {
    const pct = Math.round(topFab[1] / totalImpacto * 100);
    if (pct >= UMBRAL_FAB_PCT) {
      out.push({
        id: `fab-impacto-${topFab[0]}`,
        level: "warning",
        module: "muebles",
        message: `${topFab[0]} concentra el ${pct}% del impacto económico`,
        context: fmtCOP(topFab[1]),
        action: "Filtrar fabricante",
      });
    }
  }

  // 3. Novedades sin resolver hace demasiado tiempo
  const antiguas = pendientes.filter((n) => diasDesde(n.fecha) > UMBRAL_DIAS_PEND);
  if (antiguas.length > 0) {
    out.push({
      id: "novedades-antiguas",
      level: "critical",
      module: "muebles",
      message: `${antiguas.length} novedad${antiguas.length !== 1 ? "es" : ""} lleva${antiguas.length !== 1 ? "n" : ""} más de ${UMBRAL_DIAS_PEND} días sin resolver`,
      context: `La más antigua: ${diasDesde(antiguas.sort((a, b) => a.fecha.localeCompare(b.fecha))[0]!.fecha)} días`,
      action: "Ver pendientes",
    });
  }

  // 4. Posición con múltiples novedades (posible error sistemático)
  const byPos: Record<string, number> = {};
  for (const n of pendientes) byPos[n.posicion] = (byPos[n.posicion] ?? 0) + 1;
  const topPos = Object.entries(byPos).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1])[0];
  if (topPos) {
    out.push({
      id: `posicion-recurrente-${topPos[0]}`,
      level: "info",
      module: "muebles",
      message: `Posición ${topPos[0]} tiene ${topPos[1]} novedades activas`,
      context: "Posible error sistemático de conteo",
    });
  }

  return out;
}

// Insights de UN solo registro (para el panel de detalle)
export function insightsPorNovedad(novedad: Novedad, allItems: Novedad[]): IntelInsight[] {
  const out: IntelInsight[] = [];
  const mismosPlu = allItems.filter((n) => n.plu === novedad.plu && n.id !== novedad.id);
  const pendPlu = mismosPlu.filter((n) => n.estado === "PENDIENTE");

  if (pendPlu.length >= 2) {
    out.push({
      id: `mismo-plu-${novedad.plu}`,
      level: "warning",
      module: "muebles",
      message: `Este PLU tiene ${pendPlu.length} novedades pendientes adicionales`,
      context: `Total historial: ${mismosPlu.length} registros`,
    });
  }
  const dias = diasDesde(novedad.fecha);
  if (novedad.estado === "PENDIENTE" && dias > UMBRAL_DIAS_PEND) {
    out.push({
      id: `pendiente-antigua-${novedad.id}`,
      level: "critical",
      module: "muebles",
      message: `Pendiente hace ${dias} días sin resolver`,
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// INSIGHTS DE GUARDADOS (TRANSPORTE)
// ═══════════════════════════════════════════════════════════
export function insightsGuardados(items: Guardado[]): IntelInsight[] {
  const out: IntelInsight[] = [];
  const activos = items.filter((g) => g.estado === "PENDIENTE DESPACHO");

  // 1. Entregas vencidas (fecha en nota ya pasó)
  const vencidas = activos.filter((g) => {
    const u = urgencia(g);
    return u?.tipo === "vencida";
  });
  if (vencidas.length > 0) {
    out.push({
      id: "entregas-vencidas",
      level: "critical",
      module: "transporte",
      message: `${vencidas.length} entrega${vencidas.length !== 1 ? "s" : ""} con fecha de entrega vencida`,
      context: vencidas.slice(0, 2).map((g) => g.documento).join(" · "),
      action: "Ver alertas",
    });
  }

  // 2. Documentos con alto costo de almacenaje
  const costosos = activos.filter((g) => {
    const alm = calcAlmacenaje(g.fecha, null);
    return alm.costo >= UMBRAL_ALM_MONTO;
  });
  if (costosos.length > 0) {
    const mayor = costosos.sort((a, b) => {
      const ca = calcAlmacenaje(a.fecha, null).costo;
      const cb = calcAlmacenaje(b.fecha, null).costo;
      return cb - ca;
    })[0]!;
    out.push({
      id: "alto-almacenaje",
      level: "warning",
      module: "transporte",
      message: `${costosos.length} guardado${costosos.length !== 1 ? "s" : ""} superan ${fmtCOP(UMBRAL_ALM_MONTO)} en almacenaje`,
      context: `Mayor: ${mayor.documento} — ${fmtCOP(calcAlmacenaje(mayor.fecha, null).costo)}`,
    });
  }

  // 3. Próximos a vencer (en los próximos 2 días)
  const proximos = activos.filter((g) => {
    const u = urgencia(g);
    return u?.tipo === "proxima" && u.dias <= 2;
  });
  if (proximos.length > 0) {
    out.push({
      id: "proximos-vencer",
      level: "warning",
      module: "transporte",
      message: `${proximos.length} entrega${proximos.length !== 1 ? "s" : ""} vence${proximos.length === 1 ? "" : "n"} en menos de 2 días`,
      context: proximos.map((g) => g.documento).slice(0, 2).join(" · "),
      action: "Ver alertas",
    });
  }

  return out;
}

// Insights de UN guardado específico
export function insightsPorGuardado(g: Guardado, allItems: Guardado[]): IntelInsight[] {
  const out: IntelInsight[] = [];

  const u = urgencia(g);
  if (u?.tipo === "vencida") {
    out.push({
      id: `vencida-${g.clientId}`,
      level: "critical",
      module: "transporte",
      message: `Fecha de entrega vencida hace ${u.dias} día${u.dias !== 1 ? "s" : ""}`,
      context: `Entrega: ${u.entrega}`,
    });
  } else if (u?.tipo === "proxima") {
    out.push({
      id: `proxima-${g.clientId}`,
      level: "warning",
      module: "transporte",
      message: `Entrega comprometida en ${u.dias} día${u.dias !== 1 ? "s" : ""}`,
      context: `Fecha: ${u.entrega}`,
    });
  }

  const alm = calcAlmacenaje(g.fecha, g.estado === "DESPACHADO" ? g.fechaDespacho : null);
  if (alm.fase === "cobro" && alm.costo >= UMBRAL_ALM_MONTO) {
    out.push({
      id: `alto-alm-${g.clientId}`,
      level: "warning",
      module: "transporte",
      message: `Alto costo de almacenaje acumulado`,
      context: fmtCOP(alm.costo),
    });
  }

  // Mismo documento repetido (cliente recurrente problemático)
  const mismoDoc = allItems.filter((x) =>
    x.clientId !== g.clientId && x.documento.split("-")[0] === g.documento.split("-")[0]
  );
  if (mismoDoc.length >= 2) {
    out.push({
      id: `doc-repetido-${g.clientId}`,
      level: "info",
      module: "transporte",
      message: `Este cliente tiene ${mismoDoc.length} guardados adicionales`,
      context: "Revisa el historial completo",
    });
  }

  return out;
}

// ═══════════════════════════════════════════════════════════
// INSIGHTS DE LOGÍSTICA (RUTAS)
// ═══════════════════════════════════════════════════════════
export function insightsRutas(rutas: Ruta[]): IntelInsight[] {
  const out: IntelInsight[] = [];
  const activas = rutas.filter((r) => r.estado === "EN_CURSO");

  for (const r of activas) {
    const total = r.paradas.length;
    if (total === 0) continue;

    const entregadas = r.paradas.filter((p) => p.estado === "ENTREGADO").length;
    const fallidas = r.paradas.filter((p) => p.estado === "NO_ENTREGADO").length;

    // Ruta con múltiples entregas fallidas
    if (fallidas >= UMBRAL_FAIL_COUNT) {
      out.push({
        id: `ruta-fallas-${r.id}`,
        level: "warning",
        module: "logistica",
        message: `Ruta "${r.nombre}" tiene ${fallidas} entrega${fallidas !== 1 ? "s" : ""} fallida${fallidas !== 1 ? "s" : ""}`,
        context: r.transportista?.nombre ?? undefined,
        recordId: r.id,
        action: "Ver ruta",
      });
    }

    // Ruta en riesgo de no terminar
    const hora = new Date().getHours();
    const progreso = entregadas / total;
    if (hora >= UMBRAL_RUTA_HORA && progreso < UMBRAL_RUTA_PROG) {
      out.push({
        id: `ruta-retraso-${r.id}`,
        level: "warning",
        module: "logistica",
        message: `Ruta "${r.nombre}" puede no finalizar hoy`,
        context: `${entregadas}/${total} entregas — ${r.transportista?.nombre ?? "sin conductor"}`,
        recordId: r.id,
        action: "Ver ruta",
      });
    }
  }

  return out;
}

// ═══════════════════════════════════════════════════════════
// NUEVAS REGLAS (Iniciativa estratégica)
// ═══════════════════════════════════════════════════════════

// Novedades sin clasificar (sin tipo ni causa)
export function insightsSinClasificar(items: Novedad[]): IntelInsight[] {
  const out: IntelInsight[] = [];
  const pendientes = items.filter((n) => n.estado !== "SOLUCIONADO");
  const sinClasif = pendientes.filter((n) => !(n as any).tipoNovedad || !(n as any).causaRaiz);
  if (sinClasif.length > 0) {
    const pct = Math.round(sinClasif.length / Math.max(pendientes.length, 1) * 100);
    if (pct >= 40) {
      out.push({
        id: "sin-clasificar",
        level: "info",
        module: "muebles",
        message: `${sinClasif.length} novedades sin tipo ni causa raíz (${pct}%)`,
        context: "Clasifícalas para habilitar el análisis operativo",
        action: "Clasificar",
      });
    }
  }
  // Novedades sin asignar hace más de 2 días
  const sinAsignarOld = pendientes.filter((n) => {
    if ((n as any).asignadoA) return false;
    const dias = Math.floor((Date.now() - new Date(n.fecha + "T00:00:00").getTime()) / 86_400_000);
    return dias >= 2;
  });
  if (sinAsignarOld.length > 0) {
    out.push({
      id: "sin-asignar-antiguas",
      level: "warning",
      module: "muebles",
      message: `${sinAsignarOld.length} novedad${sinAsignarOld.length !== 1 ? "es" : ""} sin responsable asignado (≥2 días)`,
      context: "Sin asignación, no hay accountability",
      action: "Asignar",
    });
  }
  return out;
}

// Guardados sin ningún contacto registrado con más de 30 días
export function insightsSinContacto(guardados: Guardado[]): IntelInsight[] {
  const out: IntelInsight[] = [];
  const criticos = guardados.filter((g) => {
    if (g.estado === "DESPACHADO") return false;
    const dias = Math.floor((Date.now() - new Date(g.fecha + "T00:00:00").getTime()) / 86_400_000);
    return dias >= 30;
  });
  if (criticos.length > 0) {
    out.push({
      id: "guardados-sin-contacto-30d",
      level: "warning",
      module: "transporte",
      message: `${criticos.length} guardado${criticos.length !== 1 ? "s" : ""} con ≥30 días sin gestionar`,
      context: "Registra el contacto con el cliente para evidencia",
      action: "Ver guardados",
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// CONSOLIDADO — todos los módulos
// ═══════════════════════════════════════════════════════════
export function consolidarInsights(
  novedades: Novedad[],
  guardados: Guardado[],
  rutas: Ruta[]
): IntelInsight[] {
  return [
    ...insightsNovedades(novedades),
    ...insightsSinClasificar(novedades),
    ...insightsGuardados(guardados),
    ...insightsSinContacto(guardados),
    ...insightsRutas(rutas),
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.level] - order[b.level];
  });
}

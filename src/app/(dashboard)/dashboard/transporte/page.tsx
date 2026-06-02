"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { Truck, Plus, X, CheckCircle2, Calendar, Search, BarChart3, List, Clock, Pencil, Trash2, Phone, MessageCircle } from "lucide-react";
import {
  Guardado, TipoGuardado, fmtCOP, fmtFecha, todayISO, urgencia, tieneAlerta, parseEntrega,
  scoreGuardado, alertaTier, ALERTA_TIER_COLOR, ALERTA_TIER_LABEL,
  TipoContacto, ResultadoContacto, TIPO_CONTACTO_LABEL, RESULTADO_CONTACTO_LABEL, ContactoGuardado,
} from "@/lib/transporte";
import { calcAlmacenaje, TARIFA_ALM } from "@/lib/almacenaje";
import { insightsGuardados, insightsPorGuardado } from "@/lib/inteligencia";
import { Stat, SkeletonStat, Badge, EmptyState, SkeletonTable } from "@/components/ui";
import { SlidePanel, IntelBanner, DetailSection, DetailGrid, MiniHistory } from "@/components/ui/SlidePanel";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const CHART_BASE = { maintainAspectRatio: false };

function TipoBadge({ tipo }: { tipo: TipoGuardado }) {
  return <Badge label={tipo === "ECOMMERCE" ? "Ecommerce" : "Común"} variant={tipo === "ECOMMERCE" ? "info" : "default"} dot={false} />;
}
function EstadoBadge({ estado }: { estado: string }) {
  return <Badge label={estado === "DESPACHADO" ? "Despachado" : "Pendiente"} variant={estado === "DESPACHADO" ? "success" : "warning"} />;
}

const inp: React.CSSProperties = { width: "100%", height: 36, padding: "0 12px", background: "var(--surface2)", border: "1px solid transparent", borderRadius: 8, fontSize: 14, fontFamily: "var(--sans)", color: "var(--text)", outline: "none", transition: "border-color .15s, box-shadow .15s, background .15s" };
const focusProps = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "var(--ring)"; e.target.style.background = "var(--surface)"; },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; },
};

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function TransportePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit = can(role, "edit");
  const canDelete = can(role, "delete");

  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"lista" | "graficos">("lista");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const [fq, setFq] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fAlerta, setFAlerta] = useState(false);
  const [sortCol, setSortCol] = useState("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [panelItem, setPanelItem] = useState<Guardado | null>(null);
  const [contactos, setContactos] = useState<ContactoGuardado[]>([]);
  const [loadingContactos, setLoadingContactos] = useState(false);
  const [mostrarFormContacto, setMostrarFormContacto] = useState(false);
  const [editing, setEditing] = useState<Guardado | null>(null);
  const [deleting, setDeleting] = useState<Guardado | null>(null);
  const [creando, setCreando] = useState(false);
  const [fechaModal, setFechaModal] = useState<Guardado | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/transporte?pageSize=500");
      const json = await res.json();
      if (json.success) setGuardados(json.data);
    } catch { showToast("Error al cargar datos", true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3000); }

  async function abrirPanel(g: Guardado) {
    setPanelItem(g);
    setContactos([]);
    setMostrarFormContacto(false);
    setLoadingContactos(true);
    try {
      const res = await fetch(`/api/transporte/${encodeURIComponent(g.clientId)}/contactos`);
      const json = await res.json();
      if (json.success) setContactos(json.data);
    } catch { /* noop */ }
    finally { setLoadingContactos(false); }
  }

  async function despachar(g: Guardado) {
    const res = await fetch(`/api/transporte/${encodeURIComponent(g.clientId)}/acciones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "despachar" }) });
    const json = await res.json();
    if (json.success) {
      const updated = { ...g, estado: "DESPACHADO" as const, fechaDespacho: new Date().toISOString().slice(0, 10) };
      setGuardados((prev) => prev.map((x) => x.clientId === g.clientId ? updated : x));
      if (panelItem?.clientId === g.clientId) setPanelItem(updated);
      showToast("Marcado como enviado ✓");
    } else showToast(json.error || "Error", true);
  }

  // Insights operacionales
  const globalInsights = useMemo(() => insightsGuardados(guardados), [guardados]);
  const panelInsights = useMemo(() => panelItem ? insightsPorGuardado(panelItem, guardados) : [], [panelItem, guardados]);

  // Docs con alerta (para indicador en tabla)
  const clientsConAlerta = useMemo(() => new Set(guardados.filter((g) => tieneAlerta(g)).map((g) => g.clientId)), [guardados]);

  const kpis = useMemo(() => {
    const activos = guardados.filter((g) => g.estado === "PENDIENTE DESPACHO");
    const pend = activos.length;
    const desp = guardados.filter((g) => g.estado === "DESPACHADO").length;
    const alertas = guardados.filter((g) => tieneAlerta(g)).length;
    const costoTotal = activos.reduce((s, g) => s + calcAlmacenaje(g.fecha, null).costo, 0);
    return { total: guardados.length, pend, desp, alertas, costoTotal };
  }, [guardados]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const q = fq.toLowerCase();
    return [...guardados].filter((g) => {
      if (q && !g.documento.toLowerCase().includes(q) && !g.ubicacion.toLowerCase().includes(q)) return false;
      if (fEstado && g.estado !== fEstado) return false;
      if (fTipo && g.tipo !== fTipo) return false;
      if (fAlerta && !tieneAlerta(g)) return false;
      return true;
    }).sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "fecha": return dir * a.fecha.localeCompare(b.fecha);
        case "documento": return dir * a.documento.localeCompare(b.documento);
        case "ubicacion": return dir * a.ubicacion.localeCompare(b.ubicacion);
        case "estado": return dir * a.estado.localeCompare(b.estado);
        case "tipo": return dir * a.tipo.localeCompare(b.tipo);
        case "almacenaje": {
          const ca = calcAlmacenaje(a.fecha, a.estado === "DESPACHADO" ? a.fechaDespacho : null).costo;
          const cb = calcAlmacenaje(b.fecha, b.estado === "DESPACHADO" ? b.fechaDespacho : null).costo;
          return dir * (ca - cb);
        }
        default: return 0;
      }
    });
  }, [guardados, fq, fEstado, fTipo, fAlerta, sortCol, sortDir]);

  const Th = ({ col, label, right }: { col: string; label: string; right?: boolean }) => {
    const active = sortCol === col;
    return <th className="sortable" onClick={() => toggleSort(col)} style={{ textAlign: right ? "right" : "left", color: active ? "#0e7490" : undefined }}>{label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}</th>;
  };

  // Gráficos
  const donutData = useMemo(() => ({ labels: ["Pendiente", "Despachado"], datasets: [{ data: [kpis.pend, kpis.desp], backgroundColor: ["#f59e0b", "#10b981"], borderWidth: 0 }] }), [kpis]);
  const barData = useMemo(() => {
    const meses: Record<string, number> = {};
    for (const g of guardados) { const mes = g.fecha.slice(0, 7); meses[mes] = (meses[mes] || 0) + 1; }
    const keys = Object.keys(meses).sort().slice(-6);
    const M = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return { labels: keys.map((k) => { const [y, m] = k.split("-"); return M[+m - 1] + " " + y.slice(2); }), datasets: [{ data: keys.map((k) => meses[k]), backgroundColor: "#0e7490", borderRadius: 4 }] };
  }, [guardados]);

  // Panel: detalle de almacenaje
  const panelAlm = useMemo(() => {
    if (!panelItem) return null;
    const esDesp = panelItem.estado === "DESPACHADO";
    return calcAlmacenaje(panelItem.fecha, esDesp ? panelItem.fechaDespacho : null);
  }, [panelItem]);

  const panelEntrega = useMemo(() => panelItem ? parseEntrega(panelItem.nota) : null, [panelItem]);

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(14,116,144,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Truck size={16} color="#0e7490" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", margin: 0 }}>Guardados Transporte</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            {loading ? "Cargando…" : `${guardados.length} registros · ${kpis.pend} pendientes`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`ds-btn ${view === "graficos" ? "ds-btn-secondary" : "ds-btn-ghost"}`} onClick={() => setView(view === "graficos" ? "lista" : "graficos")}>
            {view === "graficos" ? <><List size={14} />Lista</> : <><BarChart3 size={14} />Gráficos</>}
          </button>
          <button className="ds-btn ds-btn-primary" style={{ background: "#0e7490", boxShadow: "0 2px 12px rgba(14,116,144,0.28)" }} onClick={() => setCreando(true)}>
            <Plus size={14} />Nuevo guardado
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 28, marginBottom: 28, padding: "0 2px" }}>
        {loading ? <><SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat /></> : (
          <>
            <Stat value={guardados.length} label="Total registros" />
            <Stat value={kpis.pend} label="Pendientes despacho" color="#f59e0b" onClick={() => setFEstado("PENDIENTE DESPACHO")} />
            <Stat value={kpis.desp} label="Despachados" color="var(--success)" onClick={() => setFEstado("DESPACHADO")} />
            <Stat value={kpis.alertas} label="Con alerta" color={kpis.alertas > 0 ? "var(--error)" : "var(--success)"} onClick={() => setFAlerta(true)} />
            <Stat value={fmtCOP(kpis.costoTotal)} label="Almacenaje activo" color="#0e7490" />
          </>
        )}
      </div>

      {/* ── Inteligencia ── */}
      {!loading && globalInsights.length > 0 && (
        <IntelBanner insights={globalInsights} title="Inteligencia operacional" />
      )}

      {/* ── Gráficos ── */}
      {view === "graficos" && (
        <div className="animate-fade-in">
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="ds-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Estados</div>
              <div style={{ height: 220 }}><Doughnut data={donutData} options={{ ...CHART_BASE, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => { const t = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0); return ` ${ctx.parsed} (${Math.round(ctx.parsed / t * 100)}%)`; } } } } }} /></div>
            </div>
            <div className="ds-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Guardados por mes</div>
              <div style={{ height: 220 }}><Bar data={barData} options={{ ...CHART_BASE, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} guardado${ctx.parsed.y !== 1 ? "s" : ""}` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "var(--border)" } }, x: { grid: { display: false } } } }} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lista ── */}
      {view === "lista" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
              <input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Buscar documento o ubicación…" style={{ ...inp, paddingLeft: 32 }} {...focusProps} />
            </div>
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={{ ...inp, width: "auto", minWidth: 160 }} {...focusProps}>
              <option value="">Todos los estados</option><option value="PENDIENTE DESPACHO">Pendiente despacho</option><option value="DESPACHADO">Despachado</option>
            </select>
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={{ ...inp, width: "auto", minWidth: 130 }} {...focusProps}>
              <option value="">Todos los tipos</option><option value="COMUN">Común</option><option value="ECOMMERCE">Ecommerce</option>
            </select>
            <button className={`ds-btn ds-btn-sm ${fAlerta ? "ds-btn-secondary" : "ds-btn-ghost"}`} onClick={() => setFAlerta(!fAlerta)} style={{ color: fAlerta ? "var(--error)" : undefined }}>
              ⚠ Solo alertas
            </button>
            {(fq || fEstado || fTipo || fAlerta) && (
              <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => { setFq(""); setFEstado(""); setFTipo(""); setFAlerta(false); }}>
                <X size={12} />Limpiar
              </button>
            )}
            <span style={{ alignSelf: "center", fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>{filtered.length} de {guardados.length}</span>
          </div>

          <div className="ds-panel" style={{ border: "1px solid var(--border)" }}>
            {loading ? <SkeletonTable rows={8} cols={7} /> : filtered.length === 0 ? (
              <EmptyState
                icon={<Truck size={22} />}
                title="Sin guardados"
                description={(fq || fEstado || fTipo || fAlerta) ? "No hay resultados para estos filtros." : "Los guardados de transporte aparecerán aquí."}
                action={(fq || fEstado || fTipo || fAlerta) ? { label: "Limpiar filtros", onClick: () => { setFq(""); setFEstado(""); setFTipo(""); setFAlerta(false); } } : { label: "Nuevo guardado", onClick: () => setCreando(true) }}
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th style={{ width: 20 }} />
                      <Th col="fecha" label="Fecha" />
                      <Th col="documento" label="Documento" />
                      <Th col="ubicacion" label="Ubicación" />
                      <Th col="tipo" label="Tipo" />
                      <Th col="estado" label="Estado" />
                      <Th col="almacenaje" label="Almacenaje" right />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((g) => {
                      const esDesp = g.estado === "DESPACHADO";
                      const alm = calcAlmacenaje(g.fecha, esDesp ? g.fechaDespacho : null);
                      const u = urgencia(g);
                      const hasAlert = clientsConAlerta.has(g.clientId);
                      return (
                        <tr key={g.clientId} className="ds-row" onClick={() => abrirPanel(g)} style={{ background: panelItem?.clientId === g.clientId ? "var(--surface2)" : undefined }}>
                          <td style={{ padding: "0 4px 0 12px" }}>
                            {(() => {
                              const score = scoreGuardado(g);
                              const tier = alertaTier(g);
                              if (tier === "ok") return null;
                              const color = ALERTA_TIER_COLOR[tier];
                              return (
                                <span title={`Urgencia: ${score}/100 · ${ALERTA_TIER_LABEL[tier]}`}
                                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: color + "20", fontSize: 10, fontWeight: 800, color, fontFamily: "var(--mono)", cursor: "help" }}>
                                  {score}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtFecha(g.fecha)}</td>
                          <td style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13 }}>{g.documento}</td>
                          <td style={{ fontSize: 13, color: "var(--muted)" }}>{g.ubicacion}</td>
                          <td><TipoBadge tipo={g.tipo} /></td>
                          <td><EstadoBadge estado={g.estado} /></td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                            {alm.fase === "gracia"
                              ? <span style={{ color: "var(--success)", fontWeight: 600, fontSize: 11 }}>En gracia</span>
                              : alm.meses === 0
                                ? <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: 11 }}>Día {alm.diasEnPeriodo}/30</span>
                                : <span style={{ color: "#0e7490", fontWeight: 700 }}>{fmtCOP(alm.costo)}</span>}
                          </td>
                          {/* Acciones on-hover */}
                          <td style={{ padding: "0 12px" }}>
                            <div className="ds-row-actions">
                              {!esDesp && (
                                <button
                                  className="ds-btn ds-btn-sm"
                                  style={{ background: "var(--success-tint)", color: "var(--success)", height: 26, fontSize: 11 }}
                                  onClick={(e) => { e.stopPropagation(); despachar(g); }}
                                  title="Marcar como enviado"
                                >
                                  <CheckCircle2 size={12} />Enviado
                                </button>
                              )}
                              <button
                                className="ds-btn ds-btn-sm ds-btn-ghost"
                                onClick={(e) => { e.stopPropagation(); setFechaModal(g); }}
                                title="Editar fecha de entrega"
                                style={{ height: 26 }}
                              >
                                <Calendar size={12} />
                              </button>
                              {canEdit && (
                                <button className="ds-btn ds-btn-sm ds-btn-ghost" style={{ height: 26 }} onClick={(e) => { e.stopPropagation(); setEditing(g); }} title="Editar">
                                  <Pencil size={12} />
                                </button>
                              )}
                              {canDelete && (
                                <button className="ds-btn ds-btn-sm ds-btn-ghost" style={{ height: 26, color: "var(--error)" }} onClick={(e) => { e.stopPropagation(); setDeleting(g); }} title="Eliminar">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Panel lateral de detalle ── */}
      <SlidePanel
        open={!!panelItem}
        onClose={() => setPanelItem(null)}
        title={panelItem?.documento ?? ""}
        subtitle={panelItem?.ubicacion}
        insights={panelInsights}
        badge={panelItem && <EstadoBadge estado={panelItem.estado} />}
        primaryAction={panelItem && panelItem.estado !== "DESPACHADO" ? (
          <button className="ds-btn ds-btn-primary" style={{ width: "100%", background: "var(--success)", boxShadow: "none" }} onClick={() => despachar(panelItem)}>
            <CheckCircle2 size={13} />Marcar como enviado
          </button>
        ) : undefined}
        secondaryActions={
          <div style={{ display: "flex", gap: 8 }}>
            {panelItem && panelItem.estado !== "DESPACHADO" && (
              <button className="ds-btn ds-btn-secondary ds-btn-sm" onClick={() => setFechaModal(panelItem)}>
                <Calendar size={13} />Fecha
              </button>
            )}
            {canEdit && panelItem && (
              <button className="ds-btn ds-btn-secondary ds-btn-sm" onClick={() => setEditing(panelItem)}>
                <Pencil size={13} />
              </button>
            )}
            {canDelete && panelItem && (
              <button className="ds-btn ds-btn-ghost ds-btn-sm" style={{ color: "var(--error)" }} onClick={() => { setDeleting(panelItem); setPanelItem(null); }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        }
      >
        {panelItem && panelAlm && (
          <>
            {/* Almacenaje destacado */}
            <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
                💰 Cobro de almacenaje
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 4, color: panelAlm.fase === "gracia" ? "var(--success)" : panelAlm.meses === 0 ? "#f59e0b" : "#0e7490" }}>
                {panelAlm.fase === "gracia" ? "En gracia" : panelAlm.meses === 0 ? `Día ${panelAlm.diasEnPeriodo}/30` : fmtCOP(panelAlm.costo)}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {panelAlm.fase === "gracia"
                  ? `Gracia vence el ${fmtFecha(panelAlm.finGracia)} · faltan ${panelAlm.diasRestantes}d`
                  : panelAlm.meses === 0
                    ? `1er cobro ${fmtCOP(TARIFA_ALM)} en ${panelAlm.diasHastaProxima}d`
                    : `Mes ${panelAlm.meses} · próx. ${fmtCOP(panelAlm.costoProximo!)} en ${panelAlm.diasHastaProxima}d`}
              </div>
            </div>

            {/* Detalles */}
            <DetailSection title="Detalle">
              <DetailGrid items={[
                { label: "Fecha ingreso", value: fmtFecha(panelItem.fecha) },
                { label: "Tipo", value: <TipoBadge tipo={panelItem.tipo} /> },
                { label: "Ubicación", value: panelItem.ubicacion },
                { label: "Entrega comprometida", value: panelEntrega ? fmtFecha(panelEntrega) : undefined },
                { label: "Fecha despacho", value: panelItem.fechaDespacho ? fmtFecha(panelItem.fechaDespacho) : undefined },
              ]} />
            </DetailSection>

            {/* Nota */}
            {panelItem.nota && (
              <DetailSection title="Nota">
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>{panelItem.nota}</p>
              </DetailSection>
            )}

            {/* Log de contacto con cliente */}
            <DetailSection title={`Gestión de cliente (${contactos.length})`}>
              {loadingContactos ? (
                <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
              ) : (
                <>
                  {contactos.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {contactos.slice(0, 4).map((c) => (
                        <div key={c.id} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                              {TIPO_CONTACTO_LABEL[c.tipo as TipoContacto]} · {RESULTADO_CONTACTO_LABEL[c.resultado as ResultadoContacto]}
                            </div>
                            {c.fechaCompromiso && <div style={{ fontSize: 11, color: "var(--success)" }}>Comprometido: {fmtFecha(c.fechaCompromiso)}</div>}
                            {c.nota && <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.nota}</div>}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--faint)", fontFamily: "var(--mono)", whiteSpace: "nowrap", marginTop: 2 }}>
                            {new Date(c.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {mostrarFormContacto ? (
                    <FormContacto
                      clientId={panelItem.clientId}
                      onGuardado={(c) => { setContactos(prev => [c, ...prev]); setMostrarFormContacto(false); showToast("Contacto registrado ✓"); }}
                      onCancel={() => setMostrarFormContacto(false)}
                    />
                  ) : (
                    <button className="ds-btn ds-btn-secondary ds-btn-sm" onClick={() => setMostrarFormContacto(true)} style={{ width: "100%" }}>
                      <Phone size={12} />Registrar contacto
                    </button>
                  )}
                </>
              )}
            </DetailSection>

            {/* Acción: editar fecha */}
            {panelItem.estado !== "DESPACHADO" && (
              <button className="ds-btn ds-btn-secondary" style={{ width: "100%", marginTop: 4 }} onClick={() => setFechaModal(panelItem)}>
                <Calendar size={13} />Actualizar fecha de entrega
              </button>
            )}
          </>
        )}
      </SlidePanel>

      {/* ── Modales ── */}
      {(creando || editing) && (
        <ModalGuardado
          guardado={editing ?? undefined}
          onClose={() => { setCreando(false); setEditing(null); }}
          onSaved={() => { setCreando(false); setEditing(null); load(); showToast(editing ? "Guardado actualizado ✓" : "Guardado registrado ✓"); }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {fechaModal && (
        <ModalFechaEntrega
          g={fechaModal}
          onClose={() => setFechaModal(null)}
          onSaved={(clientId, nota) => {
            setGuardados((prev) => prev.map((x) => x.clientId === clientId ? { ...x, nota } : x));
            if (panelItem?.clientId === clientId) setPanelItem((p) => p ? { ...p, nota } : p);
            setFechaModal(null);
            showToast("Fecha de entrega actualizada ✓");
          }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {deleting && (
        <ConfirmDeleteModal
          title="Eliminar guardado"
          sub={`${deleting.documento} · ${deleting.ubicacion}`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const res = await fetch(`/api/transporte/${encodeURIComponent(deleting.clientId)}`, { method: "DELETE" });
            const json = await res.json().catch(() => ({}));
            if (res.ok && json.success) { setDeleting(null); load(); showToast("Eliminado"); }
            else showToast(json.error || res.status === 403 ? "Solo un administrador puede eliminar" : "Error", true);
          }}
        />
      )}

      {toast && (
        <div className="animate-fade-up" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, background: toast.err ? "var(--error)" : "#0F0F10", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: "var(--shadow-xl)", display: "flex", alignItems: "center", gap: 8 }}>
          {!toast.err && <CheckCircle2 size={14} />}{toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Componentes de Modal (centrados, para acciones destructivas
// y formularios que interrumpen intencionalmente el flujo)
// ─────────────────────────────────────────────────────────
function FormContacto({ clientId, onGuardado, onCancel }: {
  clientId: string; onGuardado: (c: ContactoGuardado) => void; onCancel: () => void;
}) {
  const [tipo, setTipo] = useState<TipoContacto>("LLAMADA");
  const [resultado, setResultado] = useState<ResultadoContacto>("NO_CONTESTA");
  const [fechaComp, setFechaComp] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/transporte/${encodeURIComponent(clientId)}/contactos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, resultado, fechaCompromiso: fechaComp || null, nota: nota.trim() || null }),
      });
      const json = await res.json();
      if (json.success) onGuardado(json.data);
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <form onSubmit={guardar} style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoContacto)} style={{ ...inp, height: 32, fontSize: 12 }}>
            {(Object.keys(TIPO_CONTACTO_LABEL) as TipoContacto[]).map((t) => <option key={t} value={t}>{TIPO_CONTACTO_LABEL[t]}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Resultado</label>
          <select value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoContacto)} style={{ ...inp, height: 32, fontSize: 12 }}>
            {(Object.keys(RESULTADO_CONTACTO_LABEL) as ResultadoContacto[]).map((r) => <option key={r} value={r}>{RESULTADO_CONTACTO_LABEL[r]}</option>)}
          </select>
        </div>
      </div>
      {resultado === "CONFIRMO_FECHA" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Fecha comprometida</label>
          <input type="date" value={fechaComp} onChange={(e) => setFechaComp(e.target.value)} style={{ ...inp, height: 32, fontSize: 12 }} />
        </div>
      )}
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Observaciones (opcional)…" style={{ ...inp, height: 32, fontSize: 12 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={onCancel} style={{ flex: 1 }}>Cancelar</button>
        <button type="submit" className="ds-btn ds-btn-primary ds-btn-sm" disabled={saving} style={{ flex: 2, background: "#0e7490" }}>
          {saving ? "…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}

function ModalBase({ title, sub, children, onClose }: { title: string; sub?: string; children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-scale-in"
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>
            {sub && <p style={{ fontSize: 12, color: "var(--muted)", margin: "3px 0 0" }}>{sub}</p>}
          </div>
          <button onClick={onClose} style={{ background: "var(--surface2)", border: "none", borderRadius: 7, padding: 7, cursor: "pointer", color: "var(--muted)", display: "flex" }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function ConfirmDeleteModal({ title, sub, onClose, onConfirm }: { title: string; sub?: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  return (
    <ModalBase title={title} sub={sub} onClose={onClose}>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 20 }}>Esta acción es permanente y no se puede deshacer.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="ds-btn ds-btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button className="ds-btn ds-btn-danger" style={{ flex: 1 }} disabled={loading} onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); }}>
          {loading ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </ModalBase>
  );
}

function ModalFechaEntrega({ g, onClose, onSaved, onError }: { g: Guardado; onClose: () => void; onSaved: (clientId: string, nota: string) => void; onError: (m: string) => void }) {
  const fechaActual = parseEntrega(g.nota);
  const [fecha, setFecha] = useState(fechaActual ?? todayISO());
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/transporte/${encodeURIComponent(g.clientId)}/acciones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "fecha_entrega", fecha }) });
      const json = await res.json();
      if (json.success) onSaved(g.clientId, json.nota); else onError(json.error || "Error");
    } catch { onError("Error"); } finally { setSaving(false); }
  }
  return (
    <ModalBase title="Fecha de entrega" sub={`${g.documento} · ${g.ubicacion}`} onClose={onClose}>
      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Fecha comprometida</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} {...focusProps} />
          {g.nota && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>Nota actual: {g.nota}</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="ds-btn ds-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="ds-btn ds-btn-primary" disabled={saving} style={{ flex: 2, background: "#0e7490" }}>
            <Calendar size={13} />{saving ? "Guardando…" : "Guardar fecha"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

function ModalGuardado({ guardado, onClose, onSaved, onError }: { guardado?: Guardado; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const isEdit = !!guardado;
  const [fecha, setFecha] = useState(guardado?.fecha ?? todayISO());
  const [documento, setDoc] = useState(guardado?.documento ?? "");
  const [ubicacion, setUbic] = useState(guardado?.ubicacion ?? "");
  const [estado, setEstado] = useState<"PENDIENTE DESPACHO" | "DESPACHADO">(guardado?.estado ?? "PENDIENTE DESPACHO");
  const [tipo, setTipo] = useState<"COMUN" | "ECOMMERCE">(guardado?.tipo ?? "COMUN");
  const [fechaDespacho, setFDesp] = useState(guardado?.fechaDespacho ?? "");
  const [nota, setNota] = useState(guardado?.nota ?? "");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha || !documento.trim() || !ubicacion.trim()) { onError("Completa los campos obligatorios"); return; }
    setSaving(true);
    try {
      const url = isEdit ? `/api/transporte/${encodeURIComponent(guardado!.clientId)}` : "/api/transporte";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fecha, documento: documento.trim(), ubicacion: ubicacion.trim(), estado, tipo, fechaDespacho: estado === "DESPACHADO" ? (fechaDespacho || todayISO()) : null, nota: nota.trim() || null }) });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }
  return (
    <ModalBase title={isEdit ? "Editar guardado" : "Nuevo guardado"} sub={isEdit ? `${guardado!.documento} · ${guardado!.ubicacion}` : undefined} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Fecha *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} {...focusProps} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "COMUN" | "ECOMMERCE")} style={{ ...inp, paddingRight: 28 }} {...focusProps}>
              <option value="COMUN">Común</option><option value="ECOMMERCE">Ecommerce</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>N° Documento *</label>
          <input value={documento} onChange={(e) => setDoc(e.target.value)} placeholder="Factura / remisión" style={inp} {...focusProps} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Ubicación *</label>
          <input value={ubicacion} onChange={(e) => setUbic(e.target.value)} placeholder="Bodega, estante…" style={inp} {...focusProps} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value as "PENDIENTE DESPACHO" | "DESPACHADO")} style={{ ...inp, paddingRight: 28 }} {...focusProps}>
              <option value="PENDIENTE DESPACHO">Pendiente despacho</option><option value="DESPACHADO">Despachado</option>
            </select>
          </div>
          {estado === "DESPACHADO" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Fecha despacho</label>
              <input type="date" value={fechaDespacho} onChange={(e) => setFDesp(e.target.value)} style={inp} {...focusProps} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Nota</label>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Incluye fecha de entrega ej. 15/06/2026" style={{ ...inp, height: "auto", padding: "10px 12px", resize: "vertical" }} {...focusProps} />
        </div>
        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <button type="button" className="ds-btn ds-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="ds-btn ds-btn-primary" disabled={saving} style={{ flex: 2, background: "#0e7490" }}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Registrar guardado"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

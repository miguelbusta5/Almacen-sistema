"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import {
  Store, Plus, Search, X, CheckCircle2, Truck, AlertTriangle,
  Pencil, Trash2, Package, Minus, PackageCheck, MapPin, Navigation,
} from "lucide-react";
import {
  DespachoTienda, PlinDespacho, EstadoDespacho, ESTADOS_DESPACHO, ESTADO_DESPACHO_LABEL,
  ESTADO_DESPACHO_COLOR, COLOR_TIENDA, estadoDespachoVariant,
  fmtFechaTienda, todayISO, horasDesde, FLUJO_ESTADOS, ESTADOS_ACTIVOS,
} from "@/lib/tienda";
import { Stat, SkeletonStat, Badge, EmptyState, SkeletonTable, TimelineItem } from "@/components/ui";
import { SlidePanel, IntelBanner, DetailSection, DetailGrid, MiniHistory } from "@/components/ui/SlidePanel";
import { insightsTienda, insightsPorDespacho } from "@/lib/inteligencia";

const inp: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 12px",
  background: "var(--surface2)", border: "1px solid transparent",
  borderRadius: 8, fontSize: 14, fontFamily: "var(--sans)",
  color: "var(--text)", outline: "none",
  transition: "border-color .15s, box-shadow .15s, background .15s",
};
const focusProps = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = COLOR_TIENDA; e.target.style.boxShadow = `0 0 0 2.5px ${COLOR_TIENDA}30`; e.target.style.background = "var(--surface)"; },
  onBlur:  (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; },
};

// ── Modal base para crear/editar ──────────────────────────
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
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h2>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>{label}</label>{children}</div>;
}

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function TiendaPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit   = can(role, "edit");
  const canDelete = can(role, "delete");

  const [items, setItems] = useState<DespachoTienda[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const [fq, setFq] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fCC, setFCC] = useState("");
  const [sortCol, setSortCol] = useState("fechaCreacion");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [panelItem, setPanelItem] = useState<DespachoTienda | null>(null);
  const [panelHistorial, setPanelHistorial] = useState<any[]>([]);
  const [creando, setCreando] = useState(false);
  const [editing, setEditing] = useState<DespachoTienda | null>(null);
  const [deleting, setDeleting] = useState<DespachoTienda | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/tienda?pageSize=500");
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch { showToast("Error al cargar", true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3000); }

  async function abrirPanel(d: DespachoTienda) {
    setPanelItem(d); setPanelHistorial([]);
    const res = await fetch(`/api/tienda/${d.id}`);
    const json = await res.json();
    if (json.success) { setPanelItem(json.data); setPanelHistorial(json.historial ?? []); }
  }

  async function cambiarEstado(d: DespachoTienda, estado: EstadoDespacho, novedad?: string) {
    const body: any = { estado };
    if (novedad !== undefined) body.novedad = novedad;
    const res = await fetch(`/api/tienda/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.success) {
      setItems((prev) => prev.map((x) => x.id === d.id ? json.data : x));
      if (panelItem?.id === d.id) { setPanelItem(json.data); abrirPanel(json.data); }
      showToast(`Estado actualizado: ${ESTADO_DESPACHO_LABEL[estado]} ✓`);
    } else showToast(json.error || "Error", true);
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const globalInsights = useMemo(() => insightsTienda(items), [items]);
  const panelInsights  = useMemo(() => panelItem ? insightsPorDespacho(panelItem, items) : [], [panelItem, items]);

  const kpis = useMemo(() => ({
    total:       items.length,
    creadosTienda: items.filter((d) => d.estado === "CREADO_TIENDA").length,
    recogidaPend:  items.filter((d) => d.estado === "RECOGIDA_PENDIENTE").length,
    recogidos:     items.filter((d) => d.estado === "RECOGIDO").length,
    enRuta:        items.filter((d) => d.estado === "EN_RUTA").length,
    entregados:    items.filter((d) => d.estado === "ENTREGADO").length,
    novedades:     items.filter((d) => d.estado === "CON_NOVEDAD").length,
    pendientesRecogida: items.filter((d) => d.estado === "CREADO_TIENDA" || d.estado === "RECOGIDA_PENDIENTE").length,
  }), [items]);

  const centrosCostos = useMemo(() => [...new Set(items.map((d) => d.centroCostos))].sort(), [items]);

  const filtered = useMemo(() => {
    const q = fq.toLowerCase();
    return [...items].filter((d) => {
      if (fEstado && d.estado !== fEstado) return false;
      if (fCC && d.centroCostos !== fCC) return false;
      if (q && !d.numeroDocumento.toLowerCase().includes(q) && !d.clienteNombre.toLowerCase().includes(q) && !d.consecutivo.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortCol) {
        case "fechaCreacion": return dir * a.fechaCreacion.localeCompare(b.fechaCreacion);
        case "centroCostos":  return dir * a.centroCostos.localeCompare(b.centroCostos);
        case "clienteNombre": return dir * a.clienteNombre.localeCompare(b.clienteNombre);
        case "estado":        return dir * a.estado.localeCompare(b.estado);
        default: return 0;
      }
    });
  }, [items, fq, fEstado, fCC, sortCol, sortDir]);

  const Th = ({ col, label }: { col: string; label: string }) => {
    const active = sortCol === col;
    return <th className="sortable" onClick={() => toggleSort(col)} style={{ color: active ? COLOR_TIENDA : undefined }}>{label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}</th>;
  };

  // ── Historial timeline del panel ─────────────────────────
  const historialItems = panelHistorial.map((h: any) => ({
    label: h.details ?? h.action,
    meta: h.userName ?? "Sistema",
    time: h.createdAt ? new Date(h.createdAt).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "",
    color: h.action === "CREATE" ? "#3b82f6" : h.action === "DELETE" ? "#ef4444" : "#10b981",
  }));

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: COLOR_TIENDA + "14", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Store size={16} color={COLOR_TIENDA} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", margin: 0 }}>Despachos Tienda</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            {loading ? "Cargando…" : `${items.length} registros · ${kpis.pendientesRecogida} pendientes de recogida`}
          </p>
        </div>
        <button className="ds-btn ds-btn-primary" style={{ background: COLOR_TIENDA, boxShadow: `0 2px 12px ${COLOR_TIENDA}28` }} onClick={() => setCreando(true)}>
          <Plus size={14} />Nuevo despacho
        </button>
      </div>

      {/* ── KPIs flotantes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 28, padding: "0 2px" }}>
        {loading ? <><SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat /></> : (
          <>
            <Stat value={kpis.pendientesRecogida} label="Pendientes de recogida"
              color={kpis.pendientesRecogida > 0 ? "var(--warning)" : "var(--success)"}
              onClick={() => setFEstado("CREADO_TIENDA")} />
            <Stat value={kpis.recogidos + kpis.enRuta} label="En tránsito"
              color="var(--info)"
              onClick={() => setFEstado("RECOGIDO")} />
            <Stat value={kpis.entregados} label="Entregados al cliente"
              color="var(--success)"
              onClick={() => setFEstado("ENTREGADO")} />
            <Stat value={kpis.novedades} label="Con novedad"
              color={kpis.novedades > 0 ? "var(--error)" : "var(--muted)"}
              onClick={() => setFEstado("CON_NOVEDAD")} />
          </>
        )}
      </div>

      {/* ── Pipeline visual de estados ── */}
      {!loading && (
        <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", padding: "4px 2px" }}>
          {FLUJO_ESTADOS.map((estado, i) => {
            const count = items.filter((d) => d.estado === estado).length;
            const color = ESTADO_DESPACHO_COLOR[estado];
            const active = fEstado === estado;
            return (
              <button
                key={estado}
                onClick={() => setFEstado(active ? "" : estado)}
                style={{
                  flex: 1, minWidth: 100, display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 4, padding: "8px 6px", background: active ? color + "18" : "var(--surface2)",
                  border: `1px solid ${active ? color + "55" : "var(--border)"}`, borderRadius: 10,
                  cursor: "pointer", transition: "all .15s", position: "relative",
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 700, color: count > 0 ? color : "var(--faint)", fontFamily: "var(--mono)" }}>{count}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: count > 0 ? color : "var(--faint)", textAlign: "center", lineHeight: 1.2 }}>{ESTADO_DESPACHO_LABEL[estado]}</span>
                {i < FLUJO_ESTADOS.length - 1 && (
                  <span style={{ position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", color: "var(--faint)", fontSize: 12, zIndex: 1 }}>›</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Inteligencia ── */}
      {!loading && globalInsights.length > 0 && (
        <IntelBanner insights={globalInsights} title="Inteligencia operacional" />
      )}

      {/* ── Filtros ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
          <input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Buscar doc, cliente, consecutivo…" style={{ ...inp, paddingLeft: 32 }} {...focusProps} />
        </div>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={{ ...inp, width: "auto", minWidth: 170 }} {...focusProps}>
          <option value="">Todos los estados</option>
          {ESTADOS_DESPACHO.map((e) => <option key={e} value={e}>{ESTADO_DESPACHO_LABEL[e]}</option>)}
        </select>
        <select value={fCC} onChange={(e) => setFCC(e.target.value)} style={{ ...inp, width: "auto", minWidth: 160 }} {...focusProps}>
          <option value="">Todos los centros</option>
          {centrosCostos.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
        </select>
        {(fq || fEstado || fCC) && <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => { setFq(""); setFEstado(""); setFCC(""); }}><X size={12} />Limpiar</button>}
        <span style={{ alignSelf: "center", fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>{filtered.length} de {items.length}</span>
      </div>

      {/* ── Tabla ── */}
      <div className="ds-panel" style={{ border: "1px solid var(--border)" }}>
        {loading ? <SkeletonTable rows={8} cols={7} /> : filtered.length === 0 ? (
          <EmptyState
            icon={<Store size={22} />}
            title="Sin despachos"
            description={(fq || fEstado || fCC) ? "No hay resultados para estos filtros." : "Los despachos de tienda aparecerán aquí."}
            action={(fq || fEstado || fCC) ? { label: "Limpiar filtros", onClick: () => { setFq(""); setFEstado(""); setFCC(""); } } : { label: "Nuevo despacho", onClick: () => setCreando(true) }}
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="ds-table">
              <thead>
                <tr>
                  <th style={{ width: 20 }} />
                  <Th col="fechaCreacion" label="Fecha" />
                  <Th col="centroCostos"  label="Centro Costos" />
                  <th>Doc. / Consecutivo</th>
                  <Th col="clienteNombre" label="Cliente" />
                  <Th col="estado"        label="Estado" />
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const horas = (d.estado === "CREADO_TIENDA" || d.estado === "RECOGIDA_PENDIENTE") ? horasDesde(d.createdAt) : 0;
                  const critico = horas >= 24;
                  return (
                    <tr key={d.id} className="ds-row" onClick={() => abrirPanel(d)} style={{ background: panelItem?.id === d.id ? "var(--surface2)" : undefined }}>
                      <td style={{ padding: "0 4px 0 12px" }}>
                        {critico && <span title="Creado hace >24h sin recogida" style={{ fontSize: 12, color: "var(--error)" }}>⚠</span>}
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtFechaTienda(d.fechaCreacion)}</td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{d.centroCostos}</td>
                      <td>
                        <div style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13 }}>{d.numeroDocumento}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>#{d.consecutivo}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{d.clienteNombre}</div>
                        {d.clienteTelefono && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{d.clienteTelefono}</div>}
                      </td>
                      <td><Badge label={ESTADO_DESPACHO_LABEL[d.estado]} variant={estadoDespachoVariant(d.estado)} /></td>
                      <td>
                        <div className="ds-row-actions">
                          {(d.estado === "CREADO_TIENDA" || d.estado === "RECOGIDA_PENDIENTE") &&
                            <button className="ds-btn ds-btn-sm" style={{ background: "var(--info-tint)", color: "var(--info)", height: 26, fontSize: 11 }}
                              onClick={(e) => { e.stopPropagation(); cambiarEstado(d, "RECOGIDO"); }} title="Marcar recogido">
                              <Truck size={12} />Recogido
                            </button>}
                          {d.estado === "RECOGIDO" &&
                            <button className="ds-btn ds-btn-sm" style={{ background: "#8b5cf614", color: "#8b5cf6", height: 26, fontSize: 11 }}
                              onClick={(e) => { e.stopPropagation(); cambiarEstado(d, "EN_RUTA"); }} title="Poner en ruta">
                              <Navigation size={12} />En ruta
                            </button>}
                          {d.estado === "EN_RUTA" &&
                            <button className="ds-btn ds-btn-sm" style={{ background: "var(--success-tint)", color: "var(--success)", height: 26, fontSize: 11 }}
                              onClick={(e) => { e.stopPropagation(); cambiarEstado(d, "ENTREGADO"); }} title="Confirmar entrega">
                              <CheckCircle2 size={12} />Entregado
                            </button>}
                          {canEdit && <button className="ds-btn ds-btn-sm ds-btn-ghost" style={{ height: 26 }} onClick={(e) => { e.stopPropagation(); setEditing(d); }} title="Editar"><Pencil size={12} /></button>}
                          {canDelete && <button className="ds-btn ds-btn-sm ds-btn-ghost" style={{ height: 26, color: "var(--error)" }} onClick={(e) => { e.stopPropagation(); setDeleting(d); }} title="Eliminar"><Trash2 size={12} /></button>}
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

      {/* ── SlidePanel detalle ── */}
      <SlidePanel
        open={!!panelItem}
        onClose={() => setPanelItem(null)}
        title={panelItem?.numeroDocumento ?? ""}
        subtitle={`${panelItem?.centroCostos} · #${panelItem?.consecutivo}`}
        insights={panelInsights}
        badge={panelItem && <Badge label={ESTADO_DESPACHO_LABEL[panelItem.estado]} variant={estadoDespachoVariant(panelItem.estado)} />}
        primaryAction={
          panelItem && (panelItem.estado === "CREADO_TIENDA" || panelItem.estado === "RECOGIDA_PENDIENTE") ? (
            <button className="ds-btn ds-btn-primary" style={{ width: "100%", background: "var(--info)" }} onClick={() => cambiarEstado(panelItem, "RECOGIDO")}>
              <Truck size={13} />Marcar como Recogido
            </button>
          ) : panelItem && panelItem.estado === "RECOGIDO" ? (
            <button className="ds-btn ds-btn-primary" style={{ width: "100%", background: "#8b5cf6" }} onClick={() => cambiarEstado(panelItem, "EN_RUTA")}>
              <Navigation size={13} />Poner en ruta
            </button>
          ) : panelItem && panelItem.estado === "EN_RUTA" ? (
            <button className="ds-btn ds-btn-primary" style={{ width: "100%", background: "var(--success)" }} onClick={() => cambiarEstado(panelItem, "ENTREGADO")}>
              <CheckCircle2 size={13} />Confirmar entrega
            </button>
          ) : undefined
        }
        secondaryActions={
          <div style={{ display: "flex", gap: 8 }}>
            {panelItem && panelItem.estado === "CREADO_TIENDA" && (
              <button className="ds-btn ds-btn-sm ds-btn-secondary"
                style={{ color: "#f97316", borderColor: "#f9731633" }}
                onClick={() => cambiarEstado(panelItem, "RECOGIDA_PENDIENTE")}>
                <PackageCheck size={13} />Lista para recogida
              </button>
            )}
            {panelItem && ESTADOS_ACTIVOS.includes(panelItem.estado) && (
              <button className="ds-btn ds-btn-sm ds-btn-secondary" style={{ color: "var(--error)" }}
                onClick={() => {
                  const novedad = prompt("Describe la novedad:");
                  if (novedad !== null) cambiarEstado(panelItem, "CON_NOVEDAD", novedad);
                }}>
                <AlertTriangle size={13} />Novedad
              </button>
            )}
            {canEdit && panelItem && <button className="ds-btn ds-btn-sm ds-btn-secondary" onClick={() => setEditing(panelItem)}><Pencil size={13} /></button>}
          </div>
        }
      >
        {panelItem && (
          <>
            {/* ── Timeline de flujo logístico ── */}
            <DetailSection title="Flujo logístico">
              <div style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
                {FLUJO_ESTADOS.map((estado, i) => {
                  const color = ESTADO_DESPACHO_COLOR[estado];
                  const isPast = FLUJO_ESTADOS.indexOf(panelItem.estado) > i;
                  const isCurrent = panelItem.estado === estado;
                  const isNovedad = panelItem.estado === "CON_NOVEDAD";
                  const active = isPast || isCurrent;
                  return (
                    <div key={estado} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          background: isNovedad && isCurrent ? "#ef4444" : active ? color : "var(--surface2)",
                          border: `2px solid ${active ? color : "var(--border)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all .2s",
                        }}>
                          {isPast && <CheckCircle2 size={13} color="#fff" />}
                          {isCurrent && !isNovedad && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                        </div>
                        <span style={{ fontSize: 9, color: active ? color : "var(--faint)", fontWeight: 600, textAlign: "center", marginTop: 4, lineHeight: 1.2, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ESTADO_DESPACHO_LABEL[estado].split(" ")[0]}
                        </span>
                      </div>
                      {i < FLUJO_ESTADOS.length - 1 && (
                        <div style={{ flex: "0 0 16px", height: 2, background: isPast ? color : "var(--border)", transition: "background .2s" }} />
                      )}
                    </div>
                  );
                })}
              </div>
              {panelItem.estado === "CON_NOVEDAD" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, padding: "6px 10px", background: "var(--error-tint)", borderRadius: 8, fontSize: 12, color: "var(--error)", fontWeight: 600 }}>
                  <AlertTriangle size={13} />Flujo interrumpido por novedad
                </div>
              )}
            </DetailSection>

            <DetailSection title="Datos del despacho">
              <DetailGrid items={[
                { label: "Centro de costos",         value: <span style={{ fontWeight: 700 }}>{panelItem.centroCostos}</span> },
                { label: "Fecha creación",           value: fmtFechaTienda(panelItem.fechaCreacion) },
                { label: "N° Documento",             value: <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{panelItem.numeroDocumento}</span> },
                { label: "Consecutivo",              value: <span style={{ fontFamily: "var(--mono)" }}>#{panelItem.consecutivo}</span> },
                { label: "Entrega comprometida",     value: panelItem.fechaEntregaComprometida ? fmtFechaTienda(panelItem.fechaEntregaComprometida) : undefined },
                { label: "Número de cajas",          value: panelItem.numeroCajas != null ? String(panelItem.numeroCajas) : undefined },
                { label: "Recogido",                 value: panelItem.recibidoAt  ? new Date(panelItem.recibidoAt).toLocaleString("es-CO",  { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined },
                { label: "En ruta desde",            value: panelItem.enRutaAt    ? new Date(panelItem.enRutaAt).toLocaleString("es-CO",     { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined },
                { label: "Entregado",                value: panelItem.despachadoAt ? new Date(panelItem.despachadoAt).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined },
                { label: "ID NetSuite",
                  value: (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {panelItem.netsuiteId
                        ? <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "#2563EB", background: "#2563EB0d", padding: "2px 8px", borderRadius: 6, border: "1px solid #2563EB25" }}>NS:{panelItem.netsuiteId}</span>
                        : <span style={{ fontSize: 12, color: "var(--faint)" }}>Sin vincular</span>
                      }
                      {canEdit && (
                        <button className="ds-btn ds-btn-ghost ds-btn-sm" style={{ fontSize: 11, height: 22, color: "var(--muted)" }}
                          onClick={async () => {
                            const id = prompt("ID interno de NetSuite:", panelItem.netsuiteId ?? "");
                            if (id === null) return;
                            const val = id.trim() || null;
                            const r = await fetch(`/api/tienda/${panelItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ netsuiteId: val }) });
                            const j = await r.json();
                            if (j.success) { setPanelItem(p => p ? { ...p, netsuiteId: val } : p); setItems(prev => prev.map(d => d.id === panelItem.id ? { ...d, netsuiteId: val } : d)); showToast(val ? "ID NetSuite vinculado ✓" : "ID eliminado"); }
                          }}>
                          {panelItem.netsuiteId ? "Cambiar" : "Vincular"}
                        </button>
                      )}
                    </div>
                  )
                },
              ]} />
            </DetailSection>

            {/* PLUs del despacho */}
            {panelItem.plines && panelItem.plines.length > 0 && (
              <DetailSection title={`PLUs del despacho (${panelItem.plines.length})`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {panelItem.plines.map((p: PlinDespacho) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "var(--surface2)", borderRadius: 8 }}>
                      <Package size={13} color="var(--muted)" style={{ flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12 }}>{p.plu}</span>
                      {p.descripcion && <span style={{ fontSize: 12, color: "var(--muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.descripcion}</span>}
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: COLOR_TIENDA, flexShrink: 0 }}>{p.unidades} u.</span>
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}

            <DetailSection title="Cliente">
              <DetailGrid items={[
                { label: "Nombre",    value: panelItem.clienteNombre },
                { label: "Documento", value: panelItem.clienteDocumento ?? undefined },
                { label: "Teléfono",  value: panelItem.clienteTelefono ?? undefined },
              ]} />
            </DetailSection>

            {panelItem.novedad && (
              <DetailSection title="Novedad registrada">
                <div style={{ background: "var(--error-tint)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--error)", display: "flex", gap: 8 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  {panelItem.novedad}
                </div>
              </DetailSection>
            )}

            {historialItems.length > 0 && (
              <DetailSection title="Timeline de cambios">
                <MiniHistory items={historialItems} />
              </DetailSection>
            )}
          </>
        )}
      </SlidePanel>

      {/* ── Modales ── */}
      {(creando || editing) && (
        <ModalDespacho
          despacho={editing ?? undefined}
          onClose={() => { setCreando(false); setEditing(null); }}
          onSaved={() => { setCreando(false); setEditing(null); load(); showToast(editing ? "Actualizado ✓" : "Despacho registrado ✓"); }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {deleting && (
        <ModalBase title="Eliminar despacho" sub={`${deleting.numeroDocumento} · ${deleting.clienteNombre}`} onClose={() => setDeleting(null)}>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>Esta acción es permanente.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ds-btn ds-btn-secondary" style={{ flex: 1 }} onClick={() => setDeleting(null)}>Cancelar</button>
            <button className="ds-btn ds-btn-danger" style={{ flex: 1 }} onClick={async () => {
              const res = await fetch(`/api/tienda/${deleting.id}`, { method: "DELETE" });
              if (res.ok) { setDeleting(null); load(); showToast("Eliminado"); }
              else showToast("Error", true);
            }}>Eliminar</button>
          </div>
        </ModalBase>
      )}

      {toast && (
        <div className="animate-fade-up" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, background: toast.err ? "var(--error)" : "#0F0F10", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: "var(--shadow-xl)", display: "flex", alignItems: "center", gap: 8 }}>
          {!toast.err && <CheckCircle2 size={14} />}{toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Modal crear/editar ────────────────────────────────────
function ModalDespacho({ despacho, onClose, onSaved, onError }: {
  despacho?: DespachoTienda; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const isEdit = !!despacho;
  const [centroCostos,            setCC]     = useState(despacho?.centroCostos ?? "");
  const [numeroDocumento,         setDoc]    = useState(despacho?.numeroDocumento ?? "");
  const [consecutivo,             setCons]   = useState(despacho?.consecutivo ?? "");
  const [clienteNombre,           setCN]     = useState(despacho?.clienteNombre ?? "");
  const [clienteDocumento,        setCD]     = useState(despacho?.clienteDocumento ?? "");
  const [clienteTelefono,         setCT]     = useState(despacho?.clienteTelefono ?? "");
  const [fechaCreacion,           setFecha]  = useState(despacho?.fechaCreacion ?? todayISO());
  const [fechaEntrega,            setFEntrega]=useState(despacho?.fechaEntregaComprometida ?? "");
  const [numeroCajas,             setNCajas] = useState(despacho?.numeroCajas != null ? String(despacho.numeroCajas) : "");
  const [plines, setPlines] = useState<Array<{ plu: string; descripcion: string; unidades: string }>>(
    despacho?.plines?.map((p) => ({ plu: p.plu, descripcion: p.descripcion ?? "", unidades: String(p.unidades) })) ?? []
  );
  const [saving, setSaving] = useState(false);

  function addPlin() { setPlines((prev) => [...prev, { plu: "", descripcion: "", unidades: "1" }]); }
  function removePlin(i: number) { setPlines((prev) => prev.filter((_, j) => j !== i)); }
  function updatePlin(i: number, key: string, val: string) { setPlines((prev) => prev.map((p, j) => j === i ? { ...p, [key]: val } : p)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!centroCostos.trim() || !numeroDocumento.trim() || !consecutivo.trim() || !clienteNombre.trim()) {
      onError("Completa los campos obligatorios"); return;
    }
    const plinesValidos = plines.filter((p) => p.plu.trim() && parseInt(p.unidades) > 0);
    setSaving(true);
    try {
      const url = isEdit ? `/api/tienda/${despacho!.id}` : "/api/tienda";
      const method = isEdit ? "PUT" : "POST";
      const body: any = {
        centroCostos: centroCostos.trim(), numeroDocumento: numeroDocumento.trim(),
        consecutivo: consecutivo.trim(), clienteNombre: clienteNombre.trim(),
        clienteDocumento: clienteDocumento.trim() || null,
        clienteTelefono: clienteTelefono.trim() || null,
        fechaCreacion,
        fechaEntregaComprometida: fechaEntrega || null,
        numeroCajas: numeroCajas ? parseInt(numeroCajas) : null,
      };
      if (!isEdit && plinesValidos.length > 0) {
        body.plines = plinesValidos.map((p) => ({ plu: p.plu.trim(), descripcion: p.descripcion.trim() || null, unidades: parseInt(p.unidades) }));
      }
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }

  return (
    <ModalBase title={isEdit ? "Editar despacho" : "Nuevo despacho"} sub={isEdit ? `${despacho!.numeroDocumento}` : undefined} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "70vh", overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Centro de costos *"><input value={centroCostos} onChange={(e) => setCC(e.target.value)} placeholder="CC-001" style={inp} {...focusProps} /></Field>
          <Field label="Fecha creación *"><input type="date" value={fechaCreacion} onChange={(e) => setFecha(e.target.value)} style={inp} {...focusProps} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <Field label="N° Documento *"><input value={numeroDocumento} onChange={(e) => setDoc(e.target.value)} placeholder="FAC-0001" style={inp} {...focusProps} /></Field>
          <Field label="Consecutivo *"><input value={consecutivo} onChange={(e) => setCons(e.target.value)} placeholder="001" style={inp} {...focusProps} /></Field>
        </div>
        <Field label="Nombre del cliente *"><input value={clienteNombre} onChange={(e) => setCN(e.target.value)} style={inp} {...focusProps} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Documento cliente"><input value={clienteDocumento} onChange={(e) => setCD(e.target.value)} style={inp} {...focusProps} /></Field>
          <Field label="Teléfono cliente"><input value={clienteTelefono} onChange={(e) => setCT(e.target.value)} placeholder="300..." style={inp} {...focusProps} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Entrega comprometida"><input type="date" value={fechaEntrega} onChange={(e) => setFEntrega(e.target.value)} style={inp} {...focusProps} /></Field>
          <Field label="Número de cajas"><input type="number" value={numeroCajas} onChange={(e) => setNCajas(e.target.value)} min="1" placeholder="0" style={inp} {...focusProps} /></Field>
        </div>

        {/* PLUs del despacho */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>PLUs del despacho ({plines.length})</span>
            <button type="button" className="ds-btn ds-btn-sm" style={{ background: COLOR_TIENDA + "14", color: COLOR_TIENDA, height: 28, fontSize: 11 }} onClick={addPlin}>
              <Plus size={12} />Agregar PLU
            </button>
          </div>
          {plines.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 70px 28px", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <input value={p.plu} onChange={(e) => updatePlin(i, "plu", e.target.value)} placeholder="PLU" style={{ ...inp, height: 32, fontSize: 12 }} {...focusProps} />
              <input value={p.descripcion} onChange={(e) => updatePlin(i, "descripcion", e.target.value)} placeholder="Descripción (opc.)" style={{ ...inp, height: 32, fontSize: 12 }} {...focusProps} />
              <input type="number" value={p.unidades} onChange={(e) => updatePlin(i, "unidades", e.target.value)} min="1" placeholder="Uds." style={{ ...inp, height: 32, fontSize: 12 }} {...focusProps} />
              <button type="button" onClick={() => removePlin(i)} style={{ width: 28, height: 32, background: "var(--error-tint)", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--error)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus size={12} />
              </button>
            </div>
          ))}
          {plines.length === 0 && <p style={{ fontSize: 11, color: "var(--faint)", textAlign: "center" }}>Sin PLUs — opcional</p>}
        </div>

        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <button type="button" className="ds-btn ds-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="ds-btn ds-btn-primary" disabled={saving} style={{ flex: 2, background: COLOR_TIENDA }}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Registrar despacho"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

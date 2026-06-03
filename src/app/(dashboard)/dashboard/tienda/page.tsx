"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import {
  Store, Plus, Search, X, CheckCircle2, Truck, AlertTriangle,
  Phone, FileText, Pencil, Trash2, Clock,
} from "lucide-react";
import {
  DespachoTienda, EstadoDespacho, ESTADOS_DESPACHO, ESTADO_DESPACHO_LABEL,
  ESTADO_DESPACHO_COLOR, COLOR_TIENDA, estadoDespachoVariant,
  fmtFechaTienda, todayISO, horasDesde,
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
    total:      items.length,
    pendientes: items.filter((d) => d.estado === "PENDIENTE").length,
    recibidos:  items.filter((d) => d.estado === "RECIBIDO").length,
    despachados:items.filter((d) => d.estado === "DESPACHADO").length,
    novedades:  items.filter((d) => d.estado === "CON_NOVEDAD").length,
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
            {loading ? "Cargando…" : `${items.length} registros · ${kpis.pendientes} pendientes`}
          </p>
        </div>
        <button className="ds-btn ds-btn-primary" style={{ background: COLOR_TIENDA, boxShadow: `0 2px 12px ${COLOR_TIENDA}28` }} onClick={() => setCreando(true)}>
          <Plus size={14} />Nuevo despacho
        </button>
      </div>

      {/* ── KPIs flotantes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 24, marginBottom: 28, padding: "0 2px" }}>
        {loading ? <><SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat /></> : (
          <>
            <Stat value={kpis.total}       label="Total despachos" />
            <Stat value={kpis.pendientes}  label="Pendientes" color={kpis.pendientes > 0 ? "var(--warning)" : "var(--success)"} onClick={() => setFEstado("PENDIENTE")} />
            <Stat value={kpis.recibidos}   label="Recibidos por transporte" color="var(--info)" onClick={() => setFEstado("RECIBIDO")} />
            <Stat value={kpis.despachados} label="Despachados al cliente" color="var(--success)" onClick={() => setFEstado("DESPACHADO")} />
            <Stat value={kpis.novedades}   label="Con novedad" color={kpis.novedades > 0 ? "var(--error)" : "var(--muted)"} onClick={() => setFEstado("CON_NOVEDAD")} />
          </>
        )}
      </div>

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
                  const horas = d.estado === "PENDIENTE" ? horasDesde(d.createdAt) : 0;
                  const critico = horas >= 24;
                  return (
                    <tr key={d.id} className="ds-row" onClick={() => abrirPanel(d)} style={{ background: panelItem?.id === d.id ? "var(--surface2)" : undefined }}>
                      <td style={{ padding: "0 4px 0 12px" }}>
                        {critico && <span title="Pendiente >24h" style={{ fontSize: 12, color: "var(--error)" }}>⚠</span>}
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
                          {d.estado === "PENDIENTE"  && <button className="ds-btn ds-btn-sm" style={{ background: "var(--info-tint)", color: "var(--info)", height: 26, fontSize: 11 }} onClick={(e) => { e.stopPropagation(); cambiarEstado(d, "RECIBIDO"); }} title="Marcar recibido"><Truck size={12} />Recibido</button>}
                          {d.estado === "RECIBIDO"   && <button className="ds-btn ds-btn-sm" style={{ background: "var(--success-tint)", color: "var(--success)", height: 26, fontSize: 11 }} onClick={(e) => { e.stopPropagation(); cambiarEstado(d, "DESPACHADO"); }} title="Marcar despachado"><CheckCircle2 size={12} />Despachado</button>}
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
        primaryAction={panelItem && panelItem.estado === "PENDIENTE" ? (
          <button className="ds-btn ds-btn-primary" style={{ width: "100%", background: "var(--info)" }} onClick={() => cambiarEstado(panelItem, "RECIBIDO")}>
            <Truck size={13} />Marcar como Recibido
          </button>
        ) : panelItem && panelItem.estado === "RECIBIDO" ? (
          <button className="ds-btn ds-btn-primary" style={{ width: "100%", background: "var(--success)" }} onClick={() => cambiarEstado(panelItem, "DESPACHADO")}>
            <CheckCircle2 size={13} />Marcar como Despachado
          </button>
        ) : undefined}
        secondaryActions={
          <div style={{ display: "flex", gap: 8 }}>
            {panelItem && panelItem.estado !== "DESPACHADO" && (
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
            <DetailSection title="Datos del despacho">
              <DetailGrid items={[
                { label: "Centro de costos",  value: <span style={{ fontWeight: 700 }}>{panelItem.centroCostos}</span> },
                { label: "Fecha creación",    value: fmtFechaTienda(panelItem.fechaCreacion) },
                { label: "N° Documento",      value: <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{panelItem.numeroDocumento}</span> },
                { label: "Consecutivo",       value: <span style={{ fontFamily: "var(--mono)" }}>#{panelItem.consecutivo}</span> },
                { label: "Recibido",          value: panelItem.recibidoAt ? new Date(panelItem.recibidoAt).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined },
                { label: "Despachado",        value: panelItem.despachadoAt ? new Date(panelItem.despachadoAt).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined },
              ]} />
            </DetailSection>

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
  const [centroCostos,     setCC]   = useState(despacho?.centroCostos ?? "");
  const [numeroDocumento,  setDoc]  = useState(despacho?.numeroDocumento ?? "");
  const [consecutivo,      setCons] = useState(despacho?.consecutivo ?? "");
  const [clienteNombre,    setCN]   = useState(despacho?.clienteNombre ?? "");
  const [clienteDocumento, setCD]   = useState(despacho?.clienteDocumento ?? "");
  const [clienteTelefono,  setCT]   = useState(despacho?.clienteTelefono ?? "");
  const [fechaCreacion,    setFecha]= useState(despacho?.fechaCreacion ?? todayISO());
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!centroCostos.trim() || !numeroDocumento.trim() || !consecutivo.trim() || !clienteNombre.trim()) {
      onError("Completa los campos obligatorios"); return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/tienda/${despacho!.id}` : "/api/tienda";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ centroCostos: centroCostos.trim(), numeroDocumento: numeroDocumento.trim(), consecutivo: consecutivo.trim(), clienteNombre: clienteNombre.trim(), clienteDocumento: clienteDocumento.trim() || null, clienteTelefono: clienteTelefono.trim() || null, fechaCreacion }) });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }

  return (
    <ModalBase title={isEdit ? "Editar despacho" : "Nuevo despacho"} sub={isEdit ? `${despacho!.numeroDocumento}` : undefined} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Centro de costos *"><input value={centroCostos} onChange={(e) => setCC(e.target.value)} placeholder="CC-001" style={inp} {...focusProps} /></Field>
          <Field label="Fecha *"><input type="date" value={fechaCreacion} onChange={(e) => setFecha(e.target.value)} style={inp} {...focusProps} /></Field>
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

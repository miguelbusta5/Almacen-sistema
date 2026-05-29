"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import {
  Package, Plus, LayoutDashboard, List, AlertTriangle, Pencil, Trash2, X, CheckCircle2,
} from "lucide-react";
import {
  Novedad, EstadoNovedad, ESTADOS, ESTADO_COLOR, estadoLabel, fmtFecha, fmtCOP, todayISO,
} from "@/lib/muebles";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const DELETE_PIN = "0000";
type View = "dashboard" | "lista" | "nuevo";

export default function MueblesPage() {
  const [items, setItems] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [fq, setFq] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fFab, setFFab] = useState("");
  const [editing, setEditing] = useState<Novedad | null>(null);
  const [detail, setDetail] = useState<Novedad | null>(null);
  const [deleting, setDeleting] = useState<Novedad | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/novedades");
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch { showToast("Error al cargar datos", true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3000); }
  function goFilter(estado: string) { setFEstado(estado); setFFab(""); setView("lista"); }

  const kpis = useMemo(() => {
    const total = items.length;
    const pend = items.filter(n => n.estado === "PENDIENTE").length;
    const proc = items.filter(n => n.estado === "EN PROCESO").length;
    const sol = items.filter(n => n.estado === "SOLUCIONADO").length;
    const plus = new Set(items.map(n => n.plu)).size;
    const fabricantes = new Set(items.filter(n => n.fabricante).map(n => n.fabricante)).size;
    const impacto = items.reduce((s, n) => s + Math.abs(n.costoIncidencia || 0), 0);
    return { total, pend, proc, sol, plus, fabricantes, impacto };
  }, [items]);

  const donutData = useMemo(() => ({
    labels: ESTADOS.map(estadoLabel),
    datasets: [{ data: ESTADOS.map(e => items.filter(n => n.estado === e).length), backgroundColor: ESTADOS.map(e => ESTADO_COLOR[e]), borderWidth: 0 }],
  }), [items]);

  const fabData = useMemo(() => {
    const byFab: Record<string, number> = {};
    for (const n of items) {
      if (!n.fabricante) continue;
      byFab[n.fabricante] = (byFab[n.fabricante] || 0) + Math.abs(n.costoIncidencia || 0);
    }
    const top = Object.entries(byFab).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: top.map(([f]) => f),
      datasets: [{ label: "Impacto", data: top.map(([, v]) => v), backgroundColor: "#0ea5e9", borderRadius: 5 }],
    };
  }, [items]);

  const lineData = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const n of items) byDate[n.fecha] = (byDate[n.fecha] || 0) + 1;
    const keys = Object.keys(byDate).sort().slice(-14);
    return {
      labels: keys.map(k => fmtFecha(k).slice(0, 5)),
      datasets: [{ label: "Novedades", data: keys.map(k => byDate[k]), borderColor: "#6366f1", backgroundColor: "#6366f130", fill: true, tension: 0.3, pointRadius: 3 }],
    };
  }, [items]);

  const fabricantesList = useMemo(() => [...new Set(items.filter(n => n.fabricante).map(n => n.fabricante as string))].sort(), [items]);

  const filtered = useMemo(() => {
    const q = fq.toLowerCase();
    return items.filter(n => {
      if (q && !n.plu.toLowerCase().includes(q) && !n.posicion.toLowerCase().includes(q) && !(n.descripcion || "").toLowerCase().includes(q) && !(n.fabricante || "").toLowerCase().includes(q)) return false;
      if (fEstado && n.estado !== fEstado) return false;
      if (fFab && n.fabricante !== fFab) return false;
      return true;
    });
  }, [items, fq, fEstado, fFab]);

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#0ea5e915", display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={20} color="#0ea5e9" /></div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Novedades Muebles</h1>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>{kpis.total} novedades · {kpis.pend + kpis.proc} sin resolver</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <TabBtn icon={<LayoutDashboard size={15} />} label="Dashboard" active={view === "dashboard"} onClick={() => setView("dashboard")} />
          <TabBtn icon={<List size={15} />} label="Lista" active={view === "lista"} onClick={() => setView("lista")} />
          <TabBtn icon={<Plus size={15} />} label="Nueva" active={view === "nuevo"} onClick={() => setView("nuevo")} accent />
        </div>
      </div>

      {loading ? <Loading /> : (
        <>
          {view === "dashboard" && <Dashboard kpis={kpis} donutData={donutData} fabData={fabData} lineData={lineData} onFilter={goFilter} />}
          {view === "lista" && <Lista data={filtered} total={items.length} fq={fq} setFq={setFq} fEstado={fEstado} setFEstado={setFEstado} fFab={fFab} setFFab={setFFab} fabricantes={fabricantesList} onDetail={setDetail} onEdit={setEditing} onDelete={setDeleting} />}
          {view === "nuevo" && <FormNuevo onSaved={() => { load(); setView("lista"); showToast("Novedad registrada ✓"); }} onError={m => showToast(m, true)} />}
        </>
      )}

      {detail && <ModalDetalle n={detail} onClose={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); }} />}
      {editing && <ModalEditar n={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); showToast("Novedad actualizada ✓"); }} onError={m => showToast(m, true)} />}
      {deleting && <ModalBorrar n={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); load(); showToast("Novedad eliminada"); }} onError={m => showToast(m, true)} />}

      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, background: toast.err ? "#ef4444" : "#0f172a", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px #0f172a40" }}>{toast.msg}</div>}
    </div>
  );
}

function TabBtn({ icon, label, active, onClick, accent }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; accent?: boolean }) {
  return <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid " + (active ? "#0ea5e9" : "var(--border)"), background: active ? "#0ea5e9" : (accent ? "#0ea5e915" : "var(--surface)"), color: active ? "#fff" : (accent ? "#0ea5e9" : "var(--muted2)"), transition: "all .15s" }}>{icon}{label}</button>;
}
function Loading() { return <div style={{ padding: "4rem", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Cargando…</div>; }

function Dashboard({ kpis, donutData, fabData, lineData, onFilter }: {
  kpis: { total: number; pend: number; proc: number; sol: number; plus: number; fabricantes: number; impacto: number };
  donutData: any; fabData: any; lineData: any; onFilter: (e: string) => void;
}) {
  const sinResolver = kpis.pend + kpis.proc;
  return (
    <div>
      {sinResolver > 0 && (
        <div onClick={() => onFilter("PENDIENTE")} style={{ background: "#eff6ff", border: "2px solid #0ea5e9", borderRadius: 14, padding: "1.1rem 1.4rem", marginBottom: "1.25rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
          <AlertTriangle size={32} color="#0ea5e9" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0ea5e9" }}>{sinResolver} novedad{sinResolver !== 1 ? "es" : ""} sin resolver</div>
            <div style={{ fontSize: 12, color: "#1e40af" }}>{kpis.pend} pendiente{kpis.pend !== 1 ? "s" : ""} · {kpis.proc} en proceso. Click para ver la lista.</div>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <Kpi label="Total" val={kpis.total} color="#0ea5e9" onClick={() => onFilter("")} />
        <Kpi label="Pendientes" val={kpis.pend} color="#ef4444" onClick={() => onFilter("PENDIENTE")} />
        <Kpi label="En proceso" val={kpis.proc} color="#f59e0b" onClick={() => onFilter("EN PROCESO")} />
        <Kpi label="Solucionadas" val={kpis.sol} color="#10b981" onClick={() => onFilter("SOLUCIONADO")} />
        <Kpi label="PLUs únicos" val={kpis.plus} color="#8b5cf6" />
        <Kpi label="Fabricantes" val={kpis.fabricantes} color="#0ea5e9" />
        <Kpi label="Impacto total" val={fmtCOP(kpis.impacto)} color="#6366f1" small />
      </div>
      <div className="grid-2">
        <ChartCard title="Tasa de resolución"><div style={{ height: 240 }}><Doughnut data={donutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} /></div></ChartCard>
        <ChartCard title="Evolución diaria de novedades"><div style={{ height: 240 }}><Line data={lineData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div></ChartCard>
      </div>
      <ChartCard title="Impacto de novedades por fabricante">
        <div style={{ height: 280 }}><Bar data={fabData} options={{ maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { callback: (v: any) => "$" + (v / 1e6).toFixed(0) + "M" } } } }} /></div>
      </ChartCard>
    </div>
  );
}

function Kpi({ label, val, color, small, onClick }: { label: string; val: string | number; color: string; small?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}`, borderRadius: 12, padding: "1rem 1.2rem", cursor: onClick ? "pointer" : "default", transition: "transform .12s" }} className={onClick ? "hover:-translate-y-0.5" : ""}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: small ? 18 : 24, fontWeight: 800, fontFamily: "var(--mono)", color }}>{val}</div>
    </div>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem 1.4rem", marginBottom: "1rem" }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: "1rem" }}>{title}</div>{children}</div>;
}
function EstadoBadge({ estado }: { estado: EstadoNovedad }) { const c = ESTADO_COLOR[estado]; return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: c + "18", color: c }}>{estadoLabel(estado)}</span>; }
function Cantidad({ n }: { n: number }) { if (n === 0) return <span style={{ color: "var(--muted)" }}>0</span>; const pos = n > 0; return <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: pos ? "#10b981" : "#ef4444" }}>{pos ? "+" : ""}{n}</span>; }

function Lista({ data, total, fq, setFq, fEstado, setFEstado, fFab, setFFab, fabricantes, onDetail, onEdit, onDelete }: {
  data: Novedad[]; total: number; fq: string; setFq: (v: string) => void; fEstado: string; setFEstado: (v: string) => void;
  fFab: string; setFFab: (v: string) => void; fabricantes: string[];
  onDetail: (n: Novedad) => void; onEdit: (n: Novedad) => void; onDelete: (n: Novedad) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
        <input value={fq} onChange={e => setFq(e.target.value)} placeholder="Buscar PLU, posición, descripción, fabricante…" style={{ flex: 1, minWidth: 200, border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.85rem", fontSize: 12, fontFamily: "var(--mono)", outline: "none" }} />
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={selStyle}><option value="">Todos los estados</option>{ESTADOS.map(e => <option key={e} value={e}>{estadoLabel(e)}</option>)}</select>
        <select value={fFab} onChange={e => setFFab(e.target.value)} style={selStyle}><option value="">Todos los fabricantes</option>{fabricantes.map(f => <option key={f} value={f}>{f}</option>)}</select>
        <span style={{ alignSelf: "center", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{data.length} de {total}</span>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              {["Fecha", "PLU", "Descripción", "Fabricante", "Posición", "Cant.", "Impacto", "Estado", ""].map(h => <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.length === 0 && <tr><td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Sin resultados</td></tr>}
              {data.map(n => (
                <tr key={n.id} onClick={() => onDetail(n)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} className="hover-row">
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{fmtFecha(n.fecha)}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "var(--mono)", fontWeight: 600 }}>{n.plu}</td>
                  <td style={{ padding: "0.6rem 0.75rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.descripcion || "—"}</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted2)", fontSize: 11 }}>{n.fabricante || "—"}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "var(--mono)", color: "var(--muted2)" }}>{n.posicion}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}><Cantidad n={n.cantidad} /></td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "var(--mono)", fontSize: 11, color: (n.costoIncidencia || 0) < 0 ? "#ef4444" : "var(--muted2)" }}>{n.costoIncidencia ? fmtCOP(n.costoIncidencia) : "—"}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}><EstadoBadge estado={n.estado} /></td>
                  <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => onEdit(n)} title="Editar" style={iconBtn}><Pencil size={14} /></button>
                    <button onClick={() => onDelete(n)} title="Borrar" style={{ ...iconBtn, color: "#ef4444" }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.85rem", fontSize: 12, fontFamily: "var(--mono)", outline: "none", maxWidth: 200 };
const iconBtn: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 7px", marginLeft: 4, cursor: "pointer", color: "var(--muted2)" };

function FormNuevo({ onSaved, onError }: { onSaved: () => void; onError: (m: string) => void }) {
  const [plu, setPlu] = useState(""); const [posicion, setPos] = useState(""); const [fecha, setFecha] = useState(todayISO());
  const [descripcion, setDesc] = useState(""); const [cantidad, setCant] = useState("0"); const [fabricante, setFab] = useState("");
  const [costoUnitario, setCu] = useState(""); const [estado, setEstado] = useState<EstadoNovedad>("PENDIENTE"); const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plu.trim() || !posicion.trim() || !fecha) { onError("Completa PLU, posición y fecha"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/novedades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plu: plu.trim(), posicion: posicion.trim(), fecha, descripcion: descripcion.trim() || null, cantidad: parseInt(cantidad) || 0, fabricante: fabricante.trim() || null, costoUnitario: costoUnitario ? parseInt(costoUnitario) : null, estado }) });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error al guardar");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.5rem", maxWidth: 640 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: "1.25rem", color: "var(--text)" }}>Nueva novedad</h2>
      <div className="grid-2">
        <Field label="PLU *"><input value={plu} onChange={e => setPlu(e.target.value)} placeholder="Código" style={inp} /></Field>
        <Field label="Posición *"><input value={posicion} onChange={e => setPos(e.target.value)} placeholder="05-H-14-04-02" style={inp} /></Field>
        <Field label="Descripción" full><input value={descripcion} onChange={e => setDesc(e.target.value)} placeholder="Nombre del producto" style={inp} /></Field>
        <Field label="Fabricante"><input value={fabricante} onChange={e => setFab(e.target.value)} placeholder="Proveedor" style={inp} /></Field>
        <Field label="Fecha *"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} /></Field>
        <Field label="Cantidad (+ sobrante / - faltante)"><input type="number" value={cantidad} onChange={e => setCant(e.target.value)} style={inp} /></Field>
        <Field label="Costo unitario (COP)"><input type="number" value={costoUnitario} onChange={e => setCu(e.target.value)} placeholder="0" style={inp} /></Field>
        <Field label="Estado" full><select value={estado} onChange={e => setEstado(e.target.value as EstadoNovedad)} style={inp}>{ESTADOS.map(e => <option key={e} value={e}>{estadoLabel(e)}</option>)}</select></Field>
      </div>
      <button type="submit" disabled={saving} style={{ marginTop: "1.25rem", padding: "0.7rem 1.5rem", background: saving ? "#94a3b8" : "#0ea5e9", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Guardando…" : "Registrar novedad"}</button>
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: full ? "1 / -1" : undefined }}><label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</label>{children}</div>;
}
const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.85rem", fontSize: 13, fontFamily: "var(--mono)", outline: "none", background: "var(--bg)", width: "100%", boxSizing: "border-box" };

// ── DETALLE (click en fila) ──
function ModalDetalle({ n, onClose, onEdit }: { n: Novedad; onClose: () => void; onEdit: () => void }) {
  return (
    <Modal onClose={onClose} title={`PLU ${n.plu}`} sub={n.descripcion || ""}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem", fontSize: 13 }}>
        <Info label="Estado"><EstadoBadge estado={n.estado} /></Info>
        <Info label="Fecha">{fmtFecha(n.fecha)}</Info>
        <Info label="Posición"><span style={{ fontFamily: "var(--mono)" }}>{n.posicion}</span></Info>
        <Info label="Cantidad"><Cantidad n={n.cantidad} /></Info>
        <Info label="Fabricante">{n.fabricante || "—"}</Info>
        <Info label="Costo unitario">{n.costoUnitario ? fmtCOP(n.costoUnitario) : "—"}</Info>
        <Info label="Impacto en inventario" full>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--mono)", color: (n.costoIncidencia || 0) < 0 ? "#ef4444" : "#10b981" }}>
            {n.costoIncidencia ? fmtCOP(n.costoIncidencia) : "—"}
          </span>
        </Info>
      </div>
      <button onClick={onEdit} style={{ marginTop: "1.25rem", width: "100%", padding: "0.65rem", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Pencil size={15} />Editar novedad</button>
    </Modal>
  );
}
function Info({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div style={{ gridColumn: full ? "1 / -1" : undefined }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>{label}</div><div style={{ color: "var(--text)" }}>{children}</div></div>;
}

function ModalEditar({ n, onClose, onSaved, onError }: { n: Novedad; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [posicion, setPos] = useState(n.posicion); const [descripcion, setDesc] = useState(n.descripcion || "");
  const [cantidad, setCant] = useState(String(n.cantidad)); const [fabricante, setFab] = useState(n.fabricante || "");
  const [costoUnitario, setCu] = useState(n.costoUnitario != null ? String(n.costoUnitario) : "");
  const [estado, setEstado] = useState<EstadoNovedad>(n.estado); const [saving, setSaving] = useState(false);

  async function save(forceEstado?: EstadoNovedad) {
    setSaving(true); const est = forceEstado || estado;
    try {
      const res = await fetch(`/api/novedades/${n.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ posicion: posicion.trim(), descripcion: descripcion.trim() || null, cantidad: parseInt(cantidad) || 0, fabricante: fabricante.trim() || null, costoUnitario: costoUnitario ? parseInt(costoUnitario) : null, estado: est }) });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error al actualizar");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }
  return (
    <Modal onClose={onClose} title="Editar novedad" sub={`PLU ${n.plu} · ${fmtFecha(n.fecha)}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Field label="Posición"><input value={posicion} onChange={e => setPos(e.target.value)} style={inp} /></Field>
        <Field label="Descripción"><input value={descripcion} onChange={e => setDesc(e.target.value)} style={inp} /></Field>
        <Field label="Fabricante"><input value={fabricante} onChange={e => setFab(e.target.value)} placeholder="Proveedor" style={inp} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
          <Field label="Cantidad"><input type="number" value={cantidad} onChange={e => setCant(e.target.value)} style={inp} /></Field>
          <Field label="Costo unitario (COP)"><input type="number" value={costoUnitario} onChange={e => setCu(e.target.value)} placeholder="0" style={inp} /></Field>
        </div>
        <Field label="Estado"><select value={estado} onChange={e => setEstado(e.target.value as EstadoNovedad)} style={inp}>{ESTADOS.map(e => <option key={e} value={e}>{estadoLabel(e)}</option>)}</select></Field>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "1.25rem" }}>
        <button onClick={() => save()} disabled={saving} style={{ flex: 1, padding: "0.65rem", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Guardar cambios</button>
        {estado !== "SOLUCIONADO" && <button onClick={() => save("SOLUCIONADO")} disabled={saving} style={{ padding: "0.65rem 1rem", background: "#ecfdf5", color: "#10b981", border: "1px solid #10b981", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} />Solucionar</button>}
      </div>
    </Modal>
  );
}

function ModalBorrar({ n, onClose, onDeleted, onError }: { n: Novedad; onClose: () => void; onDeleted: () => void; onError: (m: string) => void }) {
  const [pin, setPin] = useState(""); const [pinErr, setPinErr] = useState(false); const [deleting, setDeleting] = useState(false);
  async function confirm() {
    if (pin !== DELETE_PIN) { setPinErr(true); return; }
    setDeleting(true);
    try { const res = await fetch(`/api/novedades/${n.id}`, { method: "DELETE" }); const json = await res.json(); if (json.success) onDeleted(); else onError(json.error || "Error"); }
    catch { onError("Error de conexión"); } finally { setDeleting(false); }
  }
  return (
    <Modal onClose={onClose} title="Eliminar novedad" sub={`PLU ${n.plu} · ${n.posicion}`}>
      <p style={{ fontSize: 13, color: "var(--muted2)", marginBottom: "1rem" }}>Esta acción es permanente. Ingresa el PIN de seguridad.</p>
      <input type="password" value={pin} autoFocus onChange={e => { setPin(e.target.value); setPinErr(false); }} onKeyDown={e => e.key === "Enter" && confirm()} placeholder="PIN de 4 dígitos" style={{ ...inp, borderColor: pinErr ? "#ef4444" : "var(--border)" }} />
      {pinErr && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>PIN incorrecto</div>}
      <div style={{ display: "flex", gap: 8, marginTop: "1.25rem" }}>
        <button onClick={onClose} style={{ flex: 1, padding: "0.65rem", background: "var(--surface2)", color: "var(--muted2)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
        <button onClick={confirm} disabled={deleting} style={{ flex: 1, padding: "0.65rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{deleting ? "Borrando…" : "Eliminar"}</button>
      </div>
    </Modal>
  );
}

function Modal({ title, sub, children, onClose }: { title: string; sub?: string; children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0f172a80", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px #0f172a40" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "1.25rem 1.25rem 0.9rem", borderBottom: "1px solid var(--border)" }}>
          <div><h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{title}</h3>{sub && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub}</p>}</div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 6, cursor: "pointer", color: "var(--muted2)", flexShrink: 0, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "1.1rem 1.25rem 1.25rem" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

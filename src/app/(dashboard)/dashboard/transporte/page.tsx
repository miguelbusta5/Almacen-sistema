"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Truck, Plus, LayoutDashboard, List, AlertTriangle, Pencil, Trash2, X, CheckCircle2, Clock, Calendar, MapPin, FileText,
} from "lucide-react";
import { Guardado, fmtCOP, fmtFecha, todayISO, urgencia, tieneAlerta, parseEntrega } from "@/lib/transporte";
import { calcAlmacenaje, TARIFA_ALM } from "@/lib/almacenaje";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type View = "dashboard" | "lista" | "nuevo";

export default function TransportePage() {
  const { data: session } = useSession();
  const canDelete = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [fq, setFq] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fAlerta, setFAlerta] = useState(false);
  const [detail, setDetail] = useState<Guardado | null>(null);
  const [editing, setEditing] = useState<Guardado | null>(null);
  const [deleting, setDeleting] = useState<Guardado | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/transporte");
      const json = await res.json();
      if (json.success) setGuardados(json.data);
    } catch { showToast("Error al cargar datos", true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3000); }
  function goFilter(opts: { estado?: string; alerta?: boolean }) {
    setFEstado(opts.estado || ""); setFAlerta(!!opts.alerta); setFq(""); setView("lista");
  }

  const kpis = useMemo(() => {
    const total = guardados.length;
    const pend = guardados.filter(g => g.estado === "PENDIENTE DESPACHO").length;
    const desp = guardados.filter(g => g.estado === "DESPACHADO").length;
    let proximos = 0, vencidas = 0, costoTotal = 0;
    for (const g of guardados) {
      const u = urgencia(g);
      if (u?.tipo === "proxima") proximos++;
      if (u?.tipo === "vencida") vencidas++;
      if (g.estado !== "DESPACHADO") costoTotal += calcAlmacenaje(g.fecha).costo;
    }
    return { total, pend, desp, proximos, vencidas, costoTotal };
  }, [guardados]);

  const donutData = useMemo(() => ({
    labels: ["Pendiente despacho", "Despachado"],
    datasets: [{ data: [kpis.pend, kpis.desp], backgroundColor: ["#f59e0b", "#10b981"], borderWidth: 0 }],
  }), [kpis]);

  const barData = useMemo(() => {
    const meses: Record<string, number> = {};
    for (const g of guardados) { const mes = g.fecha.slice(0, 7); meses[mes] = (meses[mes] || 0) + 1; }
    const keys = Object.keys(meses).sort().slice(-6);
    const M = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return { labels: keys.map(k => { const [y, m] = k.split("-"); return M[+m - 1] + " " + y.slice(2); }), datasets: [{ label: "Guardados", data: keys.map(k => meses[k]), backgroundColor: "#f97316", borderRadius: 6 }] };
  }, [guardados]);

  const filtered = useMemo(() => {
    const q = fq.toLowerCase();
    return guardados.filter(g => {
      if (q && !g.documento.toLowerCase().includes(q) && !g.ubicacion.toLowerCase().includes(q)) return false;
      if (fEstado && g.estado !== fEstado) return false;
      if (fAlerta && !tieneAlerta(g)) return false;
      return true;
    });
  }, [guardados, fq, fEstado, fAlerta]);

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f9731615", display: "flex", alignItems: "center", justifyContent: "center" }}><Truck size={20} color="#f97316" /></div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Guardados Transporte</h1>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>{kpis.total} registros · {kpis.pend} pendientes</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <TabBtn icon={<LayoutDashboard size={15} />} label="Dashboard" active={view === "dashboard"} onClick={() => setView("dashboard")} />
          <TabBtn icon={<List size={15} />} label="Lista" active={view === "lista"} onClick={() => setView("lista")} />
          <TabBtn icon={<Plus size={15} />} label="Nuevo" active={view === "nuevo"} onClick={() => setView("nuevo")} accent />
        </div>
      </div>

      {loading ? <Loading /> : (
        <>
          {view === "dashboard" && <Dashboard kpis={kpis} donutData={donutData} barData={barData} guardados={guardados} onFilter={goFilter} onDetail={setDetail} />}
          {view === "lista" && <Lista data={filtered} total={guardados.length} fq={fq} setFq={setFq} fEstado={fEstado} setFEstado={setFEstado} fAlerta={fAlerta} setFAlerta={setFAlerta} onDetail={setDetail} onEdit={setEditing} onDelete={setDeleting} canDelete={canDelete} />}
          {view === "nuevo" && <FormNuevo onSaved={() => { load(); setView("lista"); showToast("Guardado registrado ✓"); }} onError={m => showToast(m, true)} />}
        </>
      )}

      {detail && <ModalDetalle g={detail} onClose={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); }} />}
      {editing && <ModalEditar g={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); showToast("Guardado actualizado ✓"); }} onError={m => showToast(m, true)} />}
      {deleting && <ModalBorrar g={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); load(); showToast("Registro eliminado"); }} onError={m => showToast(m, true)} />}

      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, background: toast.err ? "#ef4444" : "#0f172a", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px #0f172a40" }}>{toast.msg}</div>}
    </div>
  );
}

function TabBtn({ icon, label, active, onClick, accent }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; accent?: boolean }) {
  return <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid " + (active ? "#f97316" : "var(--border)"), background: active ? "#f97316" : (accent ? "#f9731615" : "var(--surface)"), color: active ? "#fff" : (accent ? "#f97316" : "var(--muted2)"), transition: "all .15s" }}>{icon}{label}</button>;
}
function Loading() { return <div style={{ padding: "4rem", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Cargando…</div>; }

function Dashboard({ kpis, donutData, barData, guardados, onFilter, onDetail }: {
  kpis: { total: number; pend: number; desp: number; proximos: number; vencidas: number; costoTotal: number };
  donutData: any; barData: any; guardados: Guardado[]; onFilter: (o: { estado?: string; alerta?: boolean }) => void; onDetail: (g: Guardado) => void;
}) {
  const alertCount = kpis.proximos + kpis.vencidas;
  // Panel de almacenaje: pendientes ordenados por costo desc
  const pendientes = guardados.filter(g => g.estado === "PENDIENTE DESPACHO")
    .map(g => ({ g, alm: calcAlmacenaje(g.fecha) }))
    .sort((a, b) => b.alm.costo - a.alm.costo || a.g.fecha.localeCompare(b.g.fecha));
  const totalActivo = pendientes.reduce((s, x) => s + x.alm.costo, 0);
  const totalProximo = pendientes.reduce((s, x) => s + (x.alm.fase === "cobro" ? x.alm.costoProximo : x.alm.costo + TARIFA_ALM), 0);

  return (
    <div>
      {alertCount > 0 && (
        <div onClick={() => onFilter({ alerta: true })} style={{ background: "#fef2f2", border: "2px solid #ef4444", borderRadius: 14, padding: "1.1rem 1.4rem", marginBottom: "1.25rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
          <AlertTriangle size={32} color="#ef4444" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>{alertCount} entrega{alertCount !== 1 ? "s" : ""} requiere{alertCount === 1 ? "" : "n"} atención</div>
            <div style={{ fontSize: 12, color: "#991b1b" }}>{kpis.vencidas} vencida{kpis.vencidas !== 1 ? "s" : ""} · {kpis.proximos} próxima{kpis.proximos !== 1 ? "s" : ""} (≤5 días). Click para ver.</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <Kpi label="Total guardados" val={kpis.total} color="#f97316" onClick={() => onFilter({})} />
        <Kpi label="Pendiente despacho" val={kpis.pend} color="#f59e0b" onClick={() => onFilter({ estado: "PENDIENTE DESPACHO" })} />
        <Kpi label="Despachados" val={kpis.desp} color="#10b981" onClick={() => onFilter({ estado: "DESPACHADO" })} />
        <Kpi label="Próximos 5 días" val={kpis.proximos} color="#f59e0b" icon="🔔" onClick={() => onFilter({ alerta: true })} />
        <Kpi label="Entregas vencidas" val={kpis.vencidas} color="#ef4444" onClick={() => onFilter({ alerta: true })} />
        <Kpi label="Costo almacenaje" val={fmtCOP(kpis.costoTotal)} color="#6366f1" icon="💰" small />
      </div>

      <div className="grid-2">
        <ChartCard title="Estados"><div style={{ height: 240 }}><Doughnut data={donutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} /></div></ChartCard>
        <ChartCard title="Guardados por mes"><div style={{ height: 240 }}><Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div></ChartCard>
      </div>

      {/* ── PANEL DE ALMACENAJE ── */}
      <ChartCard title="Cobros de almacenaje (pendientes)">
        {pendientes.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13, padding: "1rem 0" }}>Sin guardados pendientes</div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 320, overflowY: "auto" }}>
              {pendientes.map(({ g, alm }) => {
                let color = "#10b981", costo = "EN GRACIA", info = `Gracia vence ${fmtFecha(alm.finGracia)} · faltan ${(alm as any).diasRestantes}d`;
                if (alm.fase === "cobro" && alm.meses === 0) { color = "#f59e0b"; costo = `DÍA ${alm.diasEnPeriodo}/30`; info = `Primer cobro ${fmtCOP(TARIFA_ALM)} en ${alm.diasHastaProxima}d (${fmtFecha(alm.proximaCarga)})`; }
                else if (alm.fase === "cobro") { color = "#6366f1"; costo = fmtCOP(alm.costo); info = `Mes ${alm.meses} · próx. ${fmtCOP(alm.costoProximo)} en ${alm.diasHastaProxima}d`; }
                return (
                  <div key={g.clientId} onClick={() => onDetail(g)} className="hover-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.6rem", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 600, minWidth: 110 }}>{g.documento}</span>
                    <span style={{ color: "var(--muted2)", minWidth: 120, fontSize: 11 }}>{g.ubicacion}</span>
                    <span style={{ color: "var(--muted)", flex: 1, fontSize: 11 }}>{info}</span>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color }}>{costo}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)", fontSize: 12 }}>
              <span style={{ color: "var(--muted2)", fontWeight: 600 }}>Total acumulado activo</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "#6366f1", fontSize: 15 }}>{fmtCOP(totalActivo)}</span>
              <span style={{ color: "var(--muted)" }}>Próx. proyectado: <strong style={{ color: "var(--text)" }}>{fmtCOP(totalProximo)}</strong></span>
            </div>
          </>
        )}
      </ChartCard>
    </div>
  );
}

function Kpi({ label, val, color, icon, small, onClick }: { label: string; val: string | number; color: string; icon?: string; small?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={onClick ? "hover-row" : ""} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}`, borderRadius: 12, padding: "1rem 1.2rem", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>{icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}</div>
      <div style={{ fontSize: small ? 18 : 24, fontWeight: 800, fontFamily: "var(--mono)", color }}>{val}</div>
    </div>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem 1.4rem", marginBottom: "1rem" }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: "1rem" }}>{title}</div>{children}</div>;
}

function Lista({ data, total, fq, setFq, fEstado, setFEstado, fAlerta, setFAlerta, onDetail, onEdit, onDelete, canDelete }: {
  data: Guardado[]; total: number; fq: string; setFq: (v: string) => void; fEstado: string; setFEstado: (v: string) => void;
  fAlerta: boolean; setFAlerta: (v: boolean) => void; onDetail: (g: Guardado) => void; onEdit: (g: Guardado) => void; onDelete: (g: Guardado) => void; canDelete: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
        <input value={fq} onChange={e => setFq(e.target.value)} placeholder="Buscar documento o ubicación…" style={{ flex: 1, minWidth: 200, border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.85rem", fontSize: 12, fontFamily: "var(--mono)", outline: "none" }} />
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.85rem", fontSize: 12, fontFamily: "var(--mono)", outline: "none" }}>
          <option value="">Todos los estados</option><option value="PENDIENTE DESPACHO">Pendiente despacho</option><option value="DESPACHADO">Despachado</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted2)", cursor: "pointer" }}>
          <input type="checkbox" checked={fAlerta} onChange={e => setFAlerta(e.target.checked)} /> Solo con alerta
        </label>
        <span style={{ alignSelf: "center", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{data.length} de {total}</span>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              {["Fecha", "Documento", "Ubicación", "Estado", "Almacenaje", "Alerta", ""].map(h => <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.length === 0 && <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Sin resultados</td></tr>}
              {data.map(g => <Fila key={g.clientId} g={g} onDetail={onDetail} onEdit={onEdit} onDelete={onDelete} canDelete={canDelete} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Fila({ g, onDetail, onEdit, onDelete, canDelete }: { g: Guardado; onDetail: (g: Guardado) => void; onEdit: (g: Guardado) => void; onDelete: (g: Guardado) => void; canDelete: boolean }) {
  const esDesp = g.estado === "DESPACHADO";
  const alm = calcAlmacenaje(g.fecha, esDesp ? g.fechaDespacho : null);
  const u = urgencia(g);
  return (
    <tr onClick={() => onDetail(g)} className="hover-row" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
      <td style={{ padding: "0.6rem 0.75rem", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{fmtFecha(g.fecha)}</td>
      <td style={{ padding: "0.6rem 0.75rem", fontFamily: "var(--mono)", fontWeight: 600 }}>{g.documento}</td>
      <td style={{ padding: "0.6rem 0.75rem" }}>{g.ubicacion}</td>
      <td style={{ padding: "0.6rem 0.75rem" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: esDesp ? "#ecfdf5" : "#fffbeb", color: esDesp ? "#10b981" : "#f59e0b" }}>{esDesp ? "Despachado" : "Pendiente"}</span></td>
      <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
        {alm.fase === "gracia" ? <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>EN GRACIA</span>
          : alm.meses === 0 ? <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>Día {alm.diasEnPeriodo}/30</span>
          : <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "#6366f1" }}>{fmtCOP(alm.costo)}</span>}
      </td>
      <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
        {u && u.tipo !== "ok" ? <span style={{ fontSize: 11, fontWeight: 700, color: u.tipo === "vencida" ? "#ef4444" : "#f59e0b" }}>{u.tipo === "vencida" ? `⚠ -${u.dias}d` : `🔔 ${u.dias}d`}</span> : <span style={{ color: "var(--border)" }}>—</span>}
      </td>
      <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
        <button onClick={() => onEdit(g)} title="Editar" style={iconBtn}><Pencil size={14} /></button>
        {canDelete && <button onClick={() => onDelete(g)} title="Borrar" style={{ ...iconBtn, color: "#ef4444" }}><Trash2 size={14} /></button>}
      </td>
    </tr>
  );
}
const iconBtn: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 7px", marginLeft: 4, cursor: "pointer", color: "var(--muted2)" };

// ── DETALLE (click en fila) — tiempos + desglose de almacenaje ──
function ModalDetalle({ g, onClose, onEdit }: { g: Guardado; onClose: () => void; onEdit: () => void }) {
  const esDesp = g.estado === "DESPACHADO";
  const alm = calcAlmacenaje(g.fecha, esDesp ? g.fechaDespacho : null);
  const entrega = parseEntrega(g.nota);
  const u = urgencia(g);
  const diasGuardado = Math.floor((new Date(esDesp && g.fechaDespacho ? g.fechaDespacho : todayISO()).getTime() - new Date(g.fecha).getTime()) / 86400000);

  const almColor = alm.fase === "gracia" ? "#10b981" : alm.meses === 0 ? "#f59e0b" : "#6366f1";
  const almBig = alm.fase === "gracia" ? "EN GRACIA" : alm.meses === 0 ? `Día ${alm.diasEnPeriodo}/30` : fmtCOP(alm.costo);
  const almInfo = alm.fase === "gracia"
    ? <>Gracia vence el <b>{fmtFecha(alm.finGracia)}</b>{!esDesp && ` · faltan ${alm.diasRestantes}d`}</>
    : alm.meses === 0
      ? <>1er cobro {fmtCOP(TARIFA_ALM)} {esDesp ? "no aplicó" : `en ${alm.diasHastaProxima}d (${fmtFecha(alm.proximaCarga)})`}</>
      : <>{alm.meses} mes{alm.meses !== 1 ? "es" : ""}{!esDesp && <> · próx. <b>{fmtCOP(alm.costoProximo)}</b> en {alm.diasHastaProxima}d</>}</>;

  return (
    <Modal onClose={onClose} title={g.documento} sub={g.ubicacion}>
      {/* Info compacta 2x2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem 1rem", marginBottom: "0.9rem" }}>
        <MiniInfo icon={<Calendar size={12} />} label="Ingreso">{fmtFecha(g.fecha)}</MiniInfo>
        <MiniInfo icon={<Clock size={12} />} label="En custodia">{diasGuardado} días</MiniInfo>
        <MiniInfo icon={<MapPin size={12} />} label="Estado"><span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: esDesp ? "#ecfdf5" : "#fffbeb", color: esDesp ? "#10b981" : "#f59e0b" }}>{esDesp ? "Despachado" : "Pendiente"}</span></MiniInfo>
        <MiniInfo icon={<Calendar size={12} />} label={esDesp ? "Despacho" : "Entrega (nota)"}>{esDesp ? fmtFecha(g.fechaDespacho) : entrega ? fmtFecha(entrega) : "—"}</MiniInfo>
      </div>

      {/* Almacenaje + alerta integrados */}
      <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: g.nota ? "0.75rem" : "1rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>💰 Cobro almacenaje</span>
          {u && u.tipo !== "ok" && <span style={{ fontSize: 11, fontWeight: 700, color: u.tipo === "vencida" ? "#ef4444" : "#f59e0b" }}>{u.tipo === "vencida" ? `⚠ vencida -${u.dias}d` : `🔔 ${u.dias}d`}</span>}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: almColor, fontFamily: "var(--mono)", marginTop: 3 }}>{almBig}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted2)", marginTop: 3, lineHeight: 1.45 }}>{almInfo}</div>
      </div>

      {g.nota && (
        <div style={{ fontSize: 11.5, color: "var(--muted2)", marginBottom: "1rem", display: "flex", gap: 7, lineHeight: 1.4 }}>
          <FileText size={13} style={{ flexShrink: 0, marginTop: 1 }} /><span>{g.nota}</span>
        </div>
      )}

      <button onClick={onEdit} style={{ width: "100%", padding: "0.6rem", background: "#f97316", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Pencil size={15} />Editar guardado</button>
    </Modal>
  );
}
function MiniInfo({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>{icon}{label}</div><div style={{ color: "var(--text)", fontSize: 13, fontWeight: 600 }}>{children}</div></div>;
}

function FormNuevo({ onSaved, onError }: { onSaved: () => void; onError: (m: string) => void }) {
  const [fecha, setFecha] = useState(todayISO()); const [documento, setDoc] = useState(""); const [ubicacion, setUbic] = useState("");
  const [estado, setEstado] = useState<"PENDIENTE DESPACHO" | "DESPACHADO">("PENDIENTE DESPACHO"); const [fechaDespacho, setFDesp] = useState(""); const [nota, setNota] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha || !documento.trim() || !ubicacion.trim()) { onError("Completa los campos obligatorios (*)"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/transporte", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fecha, documento: documento.trim(), ubicacion: ubicacion.trim(), estado, fechaDespacho: estado === "DESPACHADO" ? (fechaDespacho || todayISO()) : null, nota: nota.trim() || null }) });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error al guardar");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.5rem", maxWidth: 600 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: "1.25rem", color: "var(--text)" }}>Nuevo guardado</h2>
      <div className="grid-2">
        <Field label="Fecha *"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} /></Field>
        <Field label="N° Documento *"><input value={documento} onChange={e => setDoc(e.target.value)} placeholder="Factura / remisión" style={inp} /></Field>
        <Field label="Ubicación *" full><input value={ubicacion} onChange={e => setUbic(e.target.value)} placeholder="Bodega, estante…" style={inp} /></Field>
        <Field label="Estado"><select value={estado} onChange={e => setEstado(e.target.value as any)} style={inp}><option value="PENDIENTE DESPACHO">Pendiente despacho</option><option value="DESPACHADO">Despachado</option></select></Field>
        {estado === "DESPACHADO" && <Field label="Fecha despacho"><input type="date" value={fechaDespacho} onChange={e => setFDesp(e.target.value)} style={inp} /></Field>}
        <Field label="Nota (incluye fecha de entrega ej. 15/06/2026)" full><textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} /></Field>
      </div>
      <button type="submit" disabled={saving} style={{ marginTop: "1.25rem", padding: "0.7rem 1.5rem", background: saving ? "#94a3b8" : "#f97316", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Guardando…" : "Registrar guardado"}</button>
    </form>
  );
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: full ? "1 / -1" : undefined }}><label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</label>{children}</div>;
}
const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.85rem", fontSize: 13, fontFamily: "var(--mono)", outline: "none", background: "var(--bg)", width: "100%", boxSizing: "border-box" };

function ModalEditar({ g, onClose, onSaved, onError }: { g: Guardado; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [ubicacion, setUbic] = useState(g.ubicacion); const [estado, setEstado] = useState(g.estado);
  const [fechaDespacho, setFDesp] = useState(g.fechaDespacho || ""); const [nota, setNota] = useState(g.nota || ""); const [saving, setSaving] = useState(false);
  async function save(forceDespacho?: boolean) {
    setSaving(true); const est = forceDespacho ? "DESPACHADO" : estado;
    try {
      const res = await fetch(`/api/transporte/${encodeURIComponent(g.clientId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ubicacion: ubicacion.trim(), estado: est, fechaDespacho: est === "DESPACHADO" ? (fechaDespacho || todayISO()) : null, nota: nota.trim() || null }) });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error al actualizar");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }
  return (
    <Modal onClose={onClose} title="Editar guardado" sub={`${g.documento} · ${g.ubicacion}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Field label="Ubicación"><input value={ubicacion} onChange={e => setUbic(e.target.value)} style={inp} /></Field>
        <Field label="Estado"><select value={estado} onChange={e => setEstado(e.target.value as any)} style={inp}><option value="PENDIENTE DESPACHO">Pendiente despacho</option><option value="DESPACHADO">Despachado</option></select></Field>
        {estado === "DESPACHADO" && <Field label="Fecha despacho"><input type="date" value={fechaDespacho} onChange={e => setFDesp(e.target.value)} style={inp} /></Field>}
        <Field label="Nota"><textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "1.25rem" }}>
        <button onClick={() => save()} disabled={saving} style={{ flex: 1, padding: "0.65rem", background: "#f97316", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Guardar cambios</button>
        {estado !== "DESPACHADO" && <button onClick={() => save(true)} disabled={saving} style={{ padding: "0.65rem 1rem", background: "#ecfdf5", color: "#10b981", border: "1px solid #10b981", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} />Despachar</button>}
      </div>
    </Modal>
  );
}

function ModalBorrar({ g, onClose, onDeleted, onError }: { g: Guardado; onClose: () => void; onDeleted: () => void; onError: (m: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  async function confirm() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/transporte/${encodeURIComponent(g.clientId)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) onDeleted();
      else onError(json.error || (res.status === 403 ? "Solo un administrador puede eliminar" : "Error"));
    }
    catch { onError("Error de conexión"); } finally { setDeleting(false); }
  }
  return (
    <Modal onClose={onClose} title="Eliminar guardado" sub={`${g.documento} · ${g.ubicacion}`}>
      <p style={{ fontSize: 13, color: "var(--muted2)", marginBottom: "1rem" }}>Esta acción es permanente y no se puede deshacer. ¿Eliminar este guardado?</p>
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

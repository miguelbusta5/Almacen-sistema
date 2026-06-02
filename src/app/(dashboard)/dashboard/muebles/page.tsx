"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import { Plus, Filter, X, Pencil, Trash2, Package, CheckCircle2, Search } from "lucide-react";
import { Novedad, EstadoNovedad, ESTADOS, ESTADO_COLOR, estadoLabel, fmtFecha, fmtCOP, todayISO } from "@/lib/muebles";
import { Stat, SkeletonStat, Badge, EmptyState, SkeletonTable } from "@/components/ui";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const CHART_OPTIONS_BASE = {
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
};

// ── Helpers de badge ──────────────────────────────────────
function estadoBadgeVariant(e: EstadoNovedad): "error" | "warning" | "success" {
  return e === "PENDIENTE" ? "error" : e === "EN PROCESO" ? "warning" : "success";
}

// ── Input base style ──────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", height: 36,
  padding: "0 12px",
  background: "var(--surface2)", border: "1px solid transparent",
  borderRadius: 8, fontSize: 14, fontFamily: "var(--sans)",
  color: "var(--text)", outline: "none",
  transition: "border-color .15s, box-shadow .15s, background .15s",
};

// ── Modal base ────────────────────────────────────────────
function Modal({ title, sub, children, onClose, wide }: {
  title: string; sub?: string; children: React.ReactNode;
  onClose: () => void; wide?: boolean;
}) {
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
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "var(--overlay)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in"
        style={{
          background: "var(--surface)",
          borderRadius: 16, width: "100%", maxWidth: wide ? 520 : 440,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ padding: "24px 24px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>{title}</h2>
            {sub && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{sub}</p>}
          </div>
          <button
            onClick={onClose}
            style={{ background: "var(--surface2)", border: "none", borderRadius: 7, padding: 7, cursor: "pointer", color: "var(--muted)", display: "flex", marginLeft: 12 }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", letterSpacing: "-0.01em" }}>{label}</label>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function MueblesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit = can(role, "edit");
  const canDelete = can(role, "delete");

  const [items, setItems] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"lista" | "graficos">("lista");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  // Filtros
  const [fq, setFq] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fFab, setFFab] = useState("");
  const [sortCol, setSortCol] = useState("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Modales
  const [editing, setEditing] = useState<Novedad | null>(null);
  const [detail, setDetail] = useState<Novedad | null>(null);
  const [deleting, setDeleting] = useState<Novedad | null>(null);
  const [creando, setCreando] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/novedades?pageSize=500");
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch { showToast("Error al cargar datos", true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const kpis = useMemo(() => {
    const pend = items.filter((n) => n.estado === "PENDIENTE").length;
    const proc = items.filter((n) => n.estado === "EN PROCESO").length;
    const sol = items.filter((n) => n.estado === "SOLUCIONADO").length;
    const impacto = items.reduce((s, n) => s + Math.abs(n.costoIncidencia || 0), 0);
    return { total: items.length, pend, proc, sol, impacto };
  }, [items]);

  const fabricantes = useMemo(() =>
    [...new Set(items.filter((n) => n.fabricante).map((n) => n.fabricante as string))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = fq.toLowerCase();
    return [...items]
      .filter((n) => {
        if (fEstado && n.estado !== fEstado) return false;
        if (fFab && n.fabricante !== fFab) return false;
        if (q && !n.plu.toLowerCase().includes(q) && !n.posicion.toLowerCase().includes(q) && !(n.descripcion || "").toLowerCase().includes(q) && !(n.fabricante || "").toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        switch (sortCol) {
          case "fecha": return dir * a.fecha.localeCompare(b.fecha);
          case "plu": return dir * a.plu.localeCompare(b.plu);
          case "descripcion": return dir * (a.descripcion || "").localeCompare(b.descripcion || "");
          case "fabricante": return dir * (a.fabricante || "").localeCompare(b.fabricante || "");
          case "posicion": return dir * a.posicion.localeCompare(b.posicion);
          case "cantidad": return dir * (a.cantidad - b.cantidad);
          case "impacto": return dir * (Math.abs(a.costoIncidencia || 0) - Math.abs(b.costoIncidencia || 0));
          case "estado": return dir * a.estado.localeCompare(b.estado);
          default: return 0;
        }
      });
  }, [items, fq, fEstado, fFab, sortCol, sortDir]);

  const Th = ({ col, label, right }: { col: string; label: string; right?: boolean }) => {
    const active = sortCol === col;
    return (
      <th
        className="sortable"
        onClick={() => toggleSort(col)}
        style={{
          textAlign: right ? "right" : "left",
          color: active ? "var(--brand)" : undefined,
        }}
      >
        {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
      </th>
    );
  };

  // Datos para gráficos
  const donutData = useMemo(() => ({
    labels: ESTADOS.map(estadoLabel),
    datasets: [{ data: ESTADOS.map((e) => items.filter((n) => n.estado === e).length), backgroundColor: ESTADOS.map((e) => ESTADO_COLOR[e]), borderWidth: 0 }],
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
      datasets: [{ label: "Impacto", data: top.map(([, v]) => v), backgroundColor: "#2563eb", borderRadius: 4 }],
    };
  }, [items]);

  const lineData = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const n of items) byDate[n.fecha] = (byDate[n.fecha] || 0) + 1;
    const keys = Object.keys(byDate).sort().slice(-14);
    return {
      labels: keys.map((k) => fmtFecha(k).slice(0, 5)),
      datasets: [{ label: "Novedades", data: keys.map((k) => byDate[k]), borderColor: "#2563eb", backgroundColor: "#2563eb18", fill: true, tension: 0.3, pointRadius: 3 }],
    };
  }, [items]);

  return (
    <div className="animate-fade-in">
      {/* ── Page header ────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(37,99,235,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={17} color="#2563EB" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em" }}>Novedades Muebles</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", letterSpacing: "-0.01em" }}>
            {items.length} registros · {kpis.pend + kpis.proc} sin resolver
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={`ds-btn ${view === "graficos" ? "ds-btn-secondary" : "ds-btn-ghost"}`}
            onClick={() => setView(view === "graficos" ? "lista" : "graficos")}
          >
            {view === "graficos" ? "← Lista" : "Gráficos"}
          </button>
          <button className="ds-btn ds-btn-primary" onClick={() => setCreando(true)}>
            <Plus size={14} />Nueva novedad
          </button>
        </div>
      </div>

      {/* ── KPIs flotantes ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 32, marginBottom: 36, padding: "0 2px" }}>
        {loading ? (
          <><SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat /></>
        ) : (
          <>
            <Stat value={kpis.total} label="Total novedades" onClick={() => { setFEstado(""); setFq(""); }} />
            <Stat value={kpis.pend} label="Pendientes" color={kpis.pend > 0 ? "var(--error)" : "var(--success)"} onClick={() => setFEstado("PENDIENTE")} />
            <Stat value={kpis.proc} label="En proceso" color="var(--warning)" onClick={() => setFEstado("EN PROCESO")} />
            <Stat value={kpis.sol} label="Solucionadas" color="var(--success)" onClick={() => setFEstado("SOLUCIONADO")} />
            <Stat value={fmtCOP(kpis.impacto)} label="Impacto total" color="var(--brand)" />
          </>
        )}
      </div>

      {/* ── Vista: Gráficos ─────────────────────────────── */}
      {view === "graficos" && (
        <div className="animate-fade-in">
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="ds-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Tasa de resolución</div>
              <div style={{ height: 220 }}>
                <Doughnut data={donutData} options={{ ...CHART_OPTIONS_BASE, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => { const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0); return ` ${ctx.parsed} (${Math.round(ctx.parsed / total * 100)}%)`; } } } } }} />
              </div>
            </div>
            <div className="ds-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Evolución diaria</div>
              <div style={{ height: 220 }}>
                <Line data={lineData} options={{ ...CHART_OPTIONS_BASE, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} novedad${ctx.parsed.y !== 1 ? "es" : ""}` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "var(--border)" } }, x: { grid: { display: false } } } }} />
              </div>
            </div>
          </div>
          <div className="ds-card" style={{ padding: "20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Impacto por fabricante</div>
            <div style={{ height: 260 }}>
              <Bar data={fabData} options={{ ...CHART_OPTIONS_BASE, indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => " " + fmtCOP(ctx.parsed.x ?? 0) } } }, scales: { x: { beginAtZero: true, ticks: { callback: (v: unknown) => "$" + (Number(v) / 1e6).toFixed(0) + "M" }, grid: { color: "var(--border)" } }, y: { grid: { display: false } } } }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Vista: Lista ────────────────────────────────── */}
      {view === "lista" && (
        <div className="animate-fade-in">
          {/* Barra de filtros */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
              <input
                value={fq} onChange={(e) => setFq(e.target.value)}
                placeholder="Buscar PLU, posición, descripción…"
                style={{ ...inp, paddingLeft: 32 }}
                onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "var(--ring)"; e.target.style.background = "var(--surface)"; }}
                onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }}
              />
            </div>
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={{ ...inp, width: "auto", minWidth: 140, paddingRight: 28 }}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{estadoLabel(e)}</option>)}
            </select>
            <select value={fFab} onChange={(e) => setFFab(e.target.value)} style={{ ...inp, width: "auto", minWidth: 160, paddingRight: 28 }}>
              <option value="">Todos los fabricantes</option>
              {fabricantes.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            {(fq || fEstado || fFab) && (
              <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => { setFq(""); setFEstado(""); setFFab(""); }}>
                <X size={12} />Limpiar
              </button>
            )}
            <span style={{ alignSelf: "center", fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)", marginLeft: 4 }}>
              {filtered.length} de {items.length}
            </span>
          </div>

          {/* Tabla */}
          <div className="ds-panel" style={{ border: "1px solid var(--border)" }}>
            {loading ? (
              <SkeletonTable rows={8} cols={8} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Package size={22} />}
                title="Sin novedades"
                description={fq || fEstado || fFab ? "No hay resultados para estos filtros." : "Cuando se registren novedades de inventario, aparecerán aquí."}
                action={fq || fEstado || fFab ? { label: "Limpiar filtros", onClick: () => { setFq(""); setFEstado(""); setFFab(""); } } : { label: "Registrar novedad", onClick: () => setCreando(true) }}
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ds-table">
                  <thead>
                    <tr>
                      <Th col="fecha" label="Fecha" />
                      <Th col="plu" label="PLU" />
                      <Th col="descripcion" label="Descripción" />
                      <Th col="fabricante" label="Fabricante" />
                      <Th col="posicion" label="Posición" />
                      <Th col="cantidad" label="Cant." right />
                      <Th col="impacto" label="Impacto" right />
                      <Th col="estado" label="Estado" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((n) => (
                      <tr key={n.id} className="ds-row" onClick={() => setDetail(n)}>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtFecha(n.fecha)}</td>
                        <td style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13 }}>{n.plu}</td>
                        <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{n.descripcion || <span style={{ color: "var(--faint)" }}>—</span>}</td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>{n.fabricante || <span style={{ color: "var(--faint)" }}>—</span>}</td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>{n.posicion}</td>
                        <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13, color: n.cantidad > 0 ? "var(--success)" : n.cantidad < 0 ? "var(--error)" : "var(--muted)" }}>
                          {n.cantidad > 0 ? `+${n.cantidad}` : n.cantidad}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, color: (n.costoIncidencia || 0) < 0 ? "var(--error)" : "var(--muted)" }}>
                          {n.costoIncidencia ? fmtCOP(n.costoIncidencia) : <span style={{ color: "var(--faint)" }}>—</span>}
                        </td>
                        <td>
                          <Badge
                            label={estadoLabel(n.estado)}
                            variant={estadoBadgeVariant(n.estado)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modales ─────────────────────────────────────── */}
      {detail && (
        <Modal onClose={() => setDetail(null)} title={`PLU ${detail.plu}`} sub={detail.descripcion || undefined}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {[
              ["Estado", <Badge key="s" label={estadoLabel(detail.estado)} variant={estadoBadgeVariant(detail.estado)} />],
              ["Fecha", fmtFecha(detail.fecha)],
              ["Posición", <span key="p" style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{detail.posicion}</span>],
              ["Cantidad", <span key="c" style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 16, color: detail.cantidad > 0 ? "var(--success)" : detail.cantidad < 0 ? "var(--error)" : "var(--muted)" }}>{detail.cantidad > 0 ? `+${detail.cantidad}` : detail.cantidad}</span>],
              ["Fabricante", detail.fabricante || "—"],
              ["Costo unitario", detail.costoUnitario ? fmtCOP(detail.costoUnitario) : "—"],
            ].map(([label, val]) => (
              <div key={String(label)}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, color: "var(--text)" }}>{val}</div>
              </div>
            ))}
          </div>
          {detail.costoIncidencia != null && (
            <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Impacto en inventario</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: detail.costoIncidencia < 0 ? "var(--error)" : "var(--success)" }}>
                {fmtCOP(detail.costoIncidencia)}
              </div>
            </div>
          )}
          {canEdit && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ds-btn ds-btn-secondary" style={{ flex: 1 }} onClick={() => { setDetail(null); }}>Cerrar</button>
              <button className="ds-btn ds-btn-primary" style={{ flex: 1 }} onClick={() => { setEditing(detail); setDetail(null); }}>
                <Pencil size={13} />Editar
              </button>
            </div>
          )}
        </Modal>
      )}

      {creando && (
        <ModalForm
          onClose={() => setCreando(false)}
          onSaved={() => { setCreando(false); load(); showToast("Novedad registrada ✓"); }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {editing && (
        <ModalForm
          novedad={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); showToast("Novedad actualizada ✓"); }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)} title="Eliminar novedad" sub={`PLU ${deleting.plu} · ${deleting.posicion}`}>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>Esta acción es permanente y no se puede deshacer.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ds-btn ds-btn-secondary" style={{ flex: 1 }} onClick={() => setDeleting(null)}>Cancelar</button>
            <button
              className="ds-btn ds-btn-danger" style={{ flex: 1 }}
              onClick={async () => {
                const res = await fetch(`/api/novedades/${deleting.id}`, { method: "DELETE" });
                const json = await res.json().catch(() => ({}));
                if (res.ok && json.success) { setDeleting(null); load(); showToast("Novedad eliminada"); }
                else showToast(json.error || "Error", true);
              }}
            >
              <Trash2 size={13} />Eliminar
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div
          className="animate-fade-up"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 10000,
            background: toast.err ? "var(--error)" : "#0F0F10",
            color: "#fff", padding: "10px 16px", borderRadius: 10,
            fontSize: 13, fontWeight: 500, boxShadow: "var(--shadow-xl)",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {!toast.err && <CheckCircle2 size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FORM MODAL — Crear / Editar novedad
// ═══════════════════════════════════════════════════════════
function ModalForm({ novedad, onClose, onSaved, onError }: {
  novedad?: Novedad; onClose: () => void;
  onSaved: () => void; onError: (m: string) => void;
}) {
  const isEdit = !!novedad;
  const [plu, setPlu] = useState(novedad?.plu ?? "");
  const [posicion, setPos] = useState(novedad?.posicion ?? "");
  const [fecha, setFecha] = useState(novedad?.fecha ?? todayISO());
  const [descripcion, setDesc] = useState(novedad?.descripcion ?? "");
  const [cantidad, setCant] = useState(String(novedad?.cantidad ?? 0));
  const [fabricante, setFab] = useState(novedad?.fabricante ?? "");
  const [costoUnitario, setCu] = useState(novedad?.costoUnitario != null ? String(novedad.costoUnitario) : "");
  const [estado, setEstado] = useState<EstadoNovedad>(novedad?.estado ?? "PENDIENTE");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plu.trim() || !posicion.trim()) { onError("PLU y posición son requeridos"); return; }
    setSaving(true);
    try {
      const url = isEdit ? `/api/novedades/${novedad!.id}` : "/api/novedades";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plu: plu.trim(), posicion: posicion.trim(), fecha, descripcion: descripcion.trim() || null, cantidad: parseInt(cantidad) || 0, fabricante: fabricante.trim() || null, costoUnitario: costoUnitario ? parseInt(costoUnitario) : null, estado }),
      });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }

  const inputStyle = { ...inp };
  const focusStyle = { borderColor: "var(--brand)", boxShadow: "var(--ring)", background: "var(--surface)" };

  return (
    <Modal onClose={onClose} title={isEdit ? "Editar novedad" : "Nueva novedad"} sub={isEdit ? `PLU ${novedad!.plu}` : undefined} wide>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="PLU *">
            <input value={plu} onChange={(e) => setPlu(e.target.value)} disabled={isEdit} style={inputStyle} onFocus={(e) => Object.assign(e.target.style, focusStyle)} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }} />
          </Field>
          <Field label="Fecha *">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} onFocus={(e) => Object.assign(e.target.style, focusStyle)} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }} />
          </Field>
        </div>
        <Field label="Posición *">
          <input value={posicion} onChange={(e) => setPos(e.target.value)} placeholder="05-H-14-04-02" style={inputStyle} onFocus={(e) => Object.assign(e.target.style, focusStyle)} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }} />
        </Field>
        <Field label="Descripción">
          <input value={descripcion} onChange={(e) => setDesc(e.target.value)} style={inputStyle} onFocus={(e) => Object.assign(e.target.style, focusStyle)} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Fabricante">
            <input value={fabricante} onChange={(e) => setFab(e.target.value)} style={inputStyle} onFocus={(e) => Object.assign(e.target.style, focusStyle)} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }} />
          </Field>
          <Field label="Cantidad (+/-)">
            <input type="number" value={cantidad} onChange={(e) => setCant(e.target.value)} style={inputStyle} onFocus={(e) => Object.assign(e.target.style, focusStyle)} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }} />
          </Field>
          <Field label="Costo unitario">
            <input type="number" value={costoUnitario} onChange={(e) => setCu(e.target.value)} style={inputStyle} onFocus={(e) => Object.assign(e.target.style, focusStyle)} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.boxShadow = "none"; e.target.style.background = "var(--surface2)"; }} />
          </Field>
        </div>
        <Field label="Estado">
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoNovedad)} style={{ ...inputStyle, paddingRight: 28 }}>
            {ESTADOS.map((e) => <option key={e} value={e}>{estadoLabel(e)}</option>)}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <button type="button" className="ds-btn ds-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="ds-btn ds-btn-primary" disabled={saving} style={{ flex: 2 }}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Registrar novedad"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

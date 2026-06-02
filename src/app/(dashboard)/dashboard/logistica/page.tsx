"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import {
  Route, LayoutDashboard, List, Truck, Plus, X, Pencil, Trash2,
  RefreshCw, Navigation, MapPin, Package, BarChart3, TrendingUp, TrendingDown,
} from "lucide-react";
import {
  Ruta, Transportista, Vehiculo, Parada, UbicacionActiva,
  RUTA_ESTADO_LABEL, RUTA_ESTADO_COLOR, PARADA_ESTADO_LABEL, PARADA_ESTADO_COLOR,
  VEHICULO_TIPO_LABEL, VEHICULO_ESTADO_LABEL, VEHICULO_ESTADO_COLOR,
  fmtFecha, canOptimize, navUrl,
} from "@/lib/logistica";
import { createPortal } from "react-dom";

const MapaRutas = dynamic(() => import("@/components/logistica/MapaRutas"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 380, borderRadius: 12 }} />,
});

const COLOR = "#7c3aed";
type View = "panel" | "rutas" | "flota";
type FlotaTab = "transportistas" | "vehiculos";

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: color + "18", color }}>{label}</span>;
}

// ── Loading skeleton ──────────────────────────────────────────
function Loading() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 12 }} />)}
      </div>
      <div className="skeleton" style={{ height: 380, borderRadius: 14, marginBottom: "1rem" }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
    </div>
  );
}

// ── Botón de vista/tab ────────────────────────────────────────
function TabBtn({ icon, label, active, onClick, accent }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; accent?: boolean }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid " + (active ? COLOR : "var(--border)"), background: active ? COLOR : (accent ? COLOR + "15" : "var(--surface)"), color: active ? "#fff" : (accent ? COLOR : "var(--muted2)"), transition: "all .15s" }}>
      {icon}{label}
    </button>
  );
}

// ── KPI card ─────────────────────────────────────────────────
function Kpi({ label, val, color, onClick }: { label: string; val: number | string; color: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}`, borderRadius: 12, padding: "1rem 1.2rem", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", color }}>{val}</div>
    </div>
  );
}

// ── Modal base ────────────────────────────────────────────────
function Modal({ title, sub, children, onClose, wide }: { title: string; sub?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0f172a80", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: wide ? 640 : 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #0f172a40" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "1.25rem 1.25rem 0.9rem", borderBottom: "1px solid var(--border)" }}>
          <div><h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{title}</h3>{sub && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub}</p>}</div>
          <button onClick={onClose} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 6, cursor: "pointer", color: "var(--muted2)", display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "1.1rem 1.25rem 1.25rem" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0.55rem 0.85rem", fontSize: 13, fontFamily: "var(--mono)", outline: "none", background: "var(--bg)", width: "100%", boxSizing: "border-box" };
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</label>{children}</div>;
}
const iconBtn: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 7px", marginLeft: 4, cursor: "pointer", color: "var(--muted2)" };

// ══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function LogisticaPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = can(role, "manageLogistica");
  const canDel = can(role, "delete");

  const [view, setView] = useState<View>("panel");
  const [kpisConductores, setKpisConductores] = useState<any[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [flotaTab, setFlotaTab] = useState<FlotaTab>("transportistas");
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [gpsActivos, setGpsActivos] = useState<UbicacionActiva[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [rutaDetalle, setRutaDetalle] = useState<Ruta | null>(null);
  const [creandoRuta, setCreandoRuta] = useState(false);
  const [editandoVehiculo, setEditandoVehiculo] = useState<Vehiculo | null>(null);
  const [editandoTransportista, setEditandoTransportista] = useState<Transportista | null>(null);

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3500); }

  async function loadAll() {
    setLoading(true);
    try {
      const [rRes, tRes, vRes, gRes] = await Promise.all([
        fetch("/api/logistica/rutas"),
        fetch("/api/logistica/transportistas"),
        fetch("/api/logistica/vehiculos"),
        fetch("/api/logistica/gps"),
      ]);
      const [rJ, tJ, vJ, gJ] = await Promise.all([rRes.json(), tRes.json(), vRes.json(), gRes.json()]);
      if (rJ.success) setRutas(rJ.data);
      if (tJ.success) setTransportistas(tJ.data);
      if (vJ.success) setVehiculos(vJ.data);
      if (gJ.success) setGpsActivos(gJ.data);
    } catch { showToast("Error al cargar datos", true); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  // Polling GPS cada 30s
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/logistica/gps");
        const j = await r.json();
        if (j.success) setGpsActivos(j.data);
      } catch { /* silent */ }
    }, 15000); // 15s — más responsivo para el supervisor
    return () => clearInterval(id);
  }, []);

  const kpis = useMemo(() => {
    const activas = rutas.filter((r) => r.estado === "EN_CURSO").length;
    const pendientes = rutas.filter((r) => r.estado === "PENDIENTE").length;
    const finalizadas = rutas.filter((r) => r.estado === "FINALIZADA").length;
    const totalParadas = rutas.flatMap((r) => r.paradas).length;
    const entregadas = rutas.flatMap((r) => r.paradas).filter((p) => p.estado === "ENTREGADO").length;
    return { activas, pendientes, finalizadas, totalParadas, entregadas };
  }, [rutas]);

  async function cambiarEstadoRuta(ruta: Ruta, estado: string) {
    const res = await fetch(`/api/logistica/rutas/${ruta.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
    const json = await res.json();
    if (json.success) {
      setRutas((prev) => prev.map((r) => r.id === ruta.id ? { ...r, estado: estado as Ruta["estado"] } : r));
      if (rutaDetalle?.id === ruta.id) setRutaDetalle({ ...rutaDetalle, estado: estado as Ruta["estado"] });
      showToast("Estado actualizado ✓");
    } else showToast(json.error || "Error", true);
  }

  async function optimizarRuta(ruta: Ruta) {
    const res = await fetch(`/api/logistica/rutas/${ruta.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optimizar: true }) });
    const json = await res.json();
    if (json.success) {
      setRutas((prev) => prev.map((r) => r.id === ruta.id ? json.data : r));
      if (rutaDetalle?.id === ruta.id) setRutaDetalle(json.data);
      showToast("Ruta optimizada ✓");
    } else showToast(json.error || "Error", true);
  }

  async function eliminarRuta(id: string) {
    const res = await fetch(`/api/logistica/rutas/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) { setRutas((prev) => prev.filter((r) => r.id !== id)); showToast("Ruta eliminada"); }
    else showToast(json.error || "Error", true);
  }

  if (loading) return <div className="animate-fade-in"><Loading /></div>;

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: COLOR + "15", display: "flex", alignItems: "center", justifyContent: "center" }}><Route size={20} color={COLOR} /></div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Logística</h1>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>{rutas.length} rutas · {kpis.activas} en curso · {gpsActivos.length} conductores activos</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <TabBtn icon={<LayoutDashboard size={15} />} label="Panel" active={view === "panel"} onClick={() => setView("panel")} />
          <TabBtn icon={<List size={15} />} label="Rutas" active={view === "rutas"} onClick={() => setView("rutas")} />
          <TabBtn icon={<Truck size={15} />} label="Flota" active={view === "flota"} onClick={() => setView("flota")} />
          <TabBtn icon={<BarChart3 size={15} />} label="Conductores" active={(view as string) === "conductores"} onClick={() => {
            setView("conductores" as View);
            if (!kpisConductores.length) {
              setLoadingKpis(true);
              fetch("/api/logistica/conductores/kpis?dias=30").then(r => r.json()).then(j => { if (j.success) setKpisConductores(j.data); setLoadingKpis(false); });
            }
          }} />
          {canManage && <TabBtn icon={<Plus size={15} />} label="Nueva ruta" active={false} onClick={() => setCreandoRuta(true)} accent />}
          <button onClick={loadAll} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: "var(--surface2)", color: "var(--muted2)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* ── PANEL ── */}
      {view === "panel" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <Kpi label="En curso" val={kpis.activas} color="#3b82f6" onClick={() => setView("rutas")} />
            <Kpi label="Pendientes" val={kpis.pendientes} color="#f59e0b" onClick={() => setView("rutas")} />
            <Kpi label="Finalizadas" val={kpis.finalizadas} color="#10b981" onClick={() => setView("rutas")} />
            <Kpi label="Entregadas" val={kpis.entregadas} color="#10b981" />
            <Kpi label="Total paradas" val={kpis.totalParadas} color={COLOR} />
          </div>

          {/* Mapa GPS */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem 1.4rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted2)" }}>Posiciones en tiempo real</div>
              {gpsActivos.length > 0 && <span style={{ fontSize: 11, color: "var(--muted)" }}>{gpsActivos.length} conductor{gpsActivos.length !== 1 ? "es" : ""} activo{gpsActivos.length !== 1 ? "s" : ""}</span>}
            </div>
            <MapaRutas posiciones={gpsActivos} height={380} />
          </div>

          {/* Rutas activas */}
          <RutasTable rutas={rutas.filter((r) => r.estado === "EN_CURSO" || r.estado === "PENDIENTE")} onDetalle={setRutaDetalle} onCambiarEstado={cambiarEstadoRuta} onEliminar={eliminarRuta} canManage={canManage} canDel={canDel} />
        </div>
      )}

      {/* ── RUTAS ── */}
      {view === "rutas" && (
        <RutasTable rutas={rutas} onDetalle={setRutaDetalle} onCambiarEstado={cambiarEstadoRuta} onEliminar={eliminarRuta} canManage={canManage} canDel={canDel} />
      )}

      {/* ── FLOTA ── */}
      {view === "flota" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: "1rem" }}>
            <TabBtn icon={<Truck size={15} />} label="Transportistas" active={flotaTab === "transportistas"} onClick={() => setFlotaTab("transportistas")} />
            <TabBtn icon={<Package size={15} />} label="Vehículos" active={flotaTab === "vehiculos"} onClick={() => setFlotaTab("vehiculos")} />
          </div>
          {flotaTab === "transportistas" && (
            <TransportistasPanel
              transportistas={transportistas}
              vehiculos={vehiculos}
              canManage={canManage}
              canDel={canDel}
              onEdit={setEditandoTransportista}
              onCrear={() => setEditandoTransportista({ id: "", nombre: "", telefono: null, vehiculoId: null, vehiculo: null, userId: null, activo: true })}
              onDeleted={(id) => { setTransportistas((p) => p.filter((t) => t.id !== id)); showToast("Eliminado"); }}
              onError={(m) => showToast(m, true)}
            />
          )}
          {flotaTab === "vehiculos" && (
            <VehiculosPanel
              vehiculos={vehiculos}
              canManage={canManage}
              canDel={canDel}
              onEdit={setEditandoVehiculo}
              onCrear={() => setEditandoVehiculo({ id: "", placa: "", tipo: "CAMION", capacidadKg: null, estado: "ACTIVO" })}
              onDeleted={(id) => { setVehiculos((p) => p.filter((v) => v.id !== id)); showToast("Eliminado"); }}
              onError={(m) => showToast(m, true)}
            />
          )}
        </div>
      )}

      {/* ── Vista: KPIs Conductores ── */}
      {(view as string) === "conductores" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Productividad de los últimos 30 días</p>
            <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => { setLoadingKpis(true); fetch("/api/logistica/conductores/kpis?dias=30").then(r=>r.json()).then(j=>{ if(j.success) setKpisConductores(j.data); setLoadingKpis(false); }); }}>
              <RefreshCw size={13} />Actualizar
            </button>
          </div>
          {loadingKpis ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({length:3}).map((_,i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}
            </div>
          ) : kpisConductores.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontSize: 13 }}>
              Sin datos de rutas en los últimos 30 días
            </div>
          ) : (
            <div className="ds-panel" style={{ border: "1px solid var(--border)" }}>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Conductor</th>
                    <th style={{ textAlign: "center" }}>Rutas</th>
                    <th style={{ textAlign: "center" }}>Tasa entrega</th>
                    <th style={{ textAlign: "center" }}>T. prom/parada</th>
                    <th style={{ textAlign: "center" }}>Incidencias</th>
                    <th>Vehículo</th>
                  </tr>
                </thead>
                <tbody>
                  {kpisConductores.map((k: any) => {
                    const tasa = k.tasaEntrega ?? 0;
                    const color = tasa >= 90 ? "var(--success)" : tasa >= 70 ? "var(--warning)" : "var(--error)";
                    return (
                      <tr key={k.transportistaId} className="ds-row">
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{k.nombre}</div>
                          {k.telefono && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{k.telefono}</div>}
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "var(--mono)" }}>{k.rutas}</td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <span style={{ fontWeight: 800, fontFamily: "var(--mono)", color, fontSize: 14 }}>{tasa}%</span>
                            {tasa >= 90 ? <TrendingUp size={13} color="var(--success)" /> : <TrendingDown size={13} color="var(--error)" />}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>{k.entregadas}/{k.totalParadas}</div>
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 13 }}>
                          {k.tiempoPromedio != null ? `${k.tiempoPromedio}min` : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {k.incidencias > 0 ? (
                            <span style={{ fontWeight: 700, color: k.incidencias >= 3 ? "var(--error)" : "var(--warning)", fontFamily: "var(--mono)" }}>
                              {k.incidencias}
                            </span>
                          ) : <span style={{ color: "var(--success)" }}>✓</span>}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>
                          {k.vehiculo ? `${k.vehiculo.placa}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modales ── */}
      {rutaDetalle && (
        <ModalDetalleRuta
          ruta={rutaDetalle}
          onClose={() => setRutaDetalle(null)}
          onCambiarEstado={cambiarEstadoRuta}
          onOptimizar={optimizarRuta}
          onParadaActualizada={(rutaId, paradaId, estado) => {
            setRutas((prev) => prev.map((r) => r.id === rutaId ? { ...r, paradas: r.paradas.map((p) => p.id === paradaId ? { ...p, estado: estado as Parada["estado"] } : p) } : r));
            setRutaDetalle((rd) => rd ? { ...rd, paradas: rd.paradas.map((p) => p.id === paradaId ? { ...p, estado: estado as Parada["estado"] } : p) } : rd);
          }}
          canManage={canManage}
          showToast={showToast}
        />
      )}
      {creandoRuta && (
        <ModalCrearRuta
          transportistas={transportistas}
          onClose={() => setCreandoRuta(false)}
          onCreada={(r) => { setRutas((p) => [r, ...p]); setCreandoRuta(false); showToast("Ruta creada ✓"); }}
          onError={(m) => showToast(m, true)}
        />
      )}
      {editandoVehiculo && (
        <ModalVehiculo
          vehiculo={editandoVehiculo}
          onClose={() => setEditandoVehiculo(null)}
          onSaved={(v) => { setVehiculos((p) => { const i = p.findIndex((x) => x.id === v.id); return i >= 0 ? p.map((x) => x.id === v.id ? v : x) : [v, ...p]; }); setEditandoVehiculo(null); showToast("Guardado ✓"); }}
          onError={(m) => showToast(m, true)}
        />
      )}
      {editandoTransportista && (
        <ModalTransportista
          transportista={editandoTransportista}
          vehiculos={vehiculos}
          onClose={() => setEditandoTransportista(null)}
          onSaved={(t) => { setTransportistas((p) => { const i = p.findIndex((x) => x.id === t.id); return i >= 0 ? p.map((x) => x.id === t.id ? t : x) : [t, ...p]; }); setEditandoTransportista(null); showToast("Guardado ✓"); }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, background: toast.err ? "#ef4444" : "#0f172a", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px #0f172a40" }}>{toast.msg}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TABLA DE RUTAS
// ══════════════════════════════════════════════════════════════
function RutasTable({ rutas, onDetalle, onCambiarEstado, onEliminar, canManage, canDel }: {
  rutas: Ruta[]; onDetalle: (r: Ruta) => void; onCambiarEstado: (r: Ruta, e: string) => void;
  onEliminar: (id: string) => void; canManage: boolean; canDel: boolean;
}) {
  if (rutas.length === 0) return <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "3rem 2rem", textAlign: "center", color: "var(--muted)" }}>Sin rutas</div>;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
            {["Nombre", "Fecha", "Conductor", "Paradas", "Estado", ""].map((h) => (
              <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rutas.map((r) => {
              const prog = r.paradas.length > 0 ? Math.round(r.paradas.filter((p) => p.estado === "ENTREGADO").length / r.paradas.length * 100) : 0;
              return (
                <tr key={r.id} onClick={() => onDetalle(r)} className="hover-row" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                  <td style={{ padding: "0.65rem 0.85rem", fontWeight: 600 }}>{r.nombre}</td>
                  <td style={{ padding: "0.65rem 0.85rem", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{fmtFecha(r.fecha)}</td>
                  <td style={{ padding: "0.65rem 0.85rem" }}>{r.transportista?.nombre ?? "—"}</td>
                  <td style={{ padding: "0.65rem 0.85rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--mono)" }}>{r.paradas.filter((p) => p.estado === "ENTREGADO").length}/{r.paradas.length}</span>
                      <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2 }}><div style={{ width: `${prog}%`, height: "100%", background: prog === 100 ? "#10b981" : "#7c3aed", borderRadius: 2 }} /></div>
                    </div>
                  </td>
                  <td style={{ padding: "0.65rem 0.85rem" }}><Badge label={RUTA_ESTADO_LABEL[r.estado as keyof typeof RUTA_ESTADO_LABEL]} color={RUTA_ESTADO_COLOR[r.estado as keyof typeof RUTA_ESTADO_COLOR]} /></td>
                  <td style={{ padding: "0.65rem 0.85rem", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                    {canManage && r.estado === "PENDIENTE" && <button onClick={() => onCambiarEstado(r, "EN_CURSO")} title="Iniciar" style={{ ...iconBtn, color: "#3b82f6", fontSize: 10, padding: "4px 8px" }}>▶ Iniciar</button>}
                    {canManage && r.estado === "EN_CURSO" && <button onClick={() => onCambiarEstado(r, "FINALIZADA")} title="Finalizar" style={{ ...iconBtn, color: "#10b981", fontSize: 10, padding: "4px 8px" }}>✓ Finalizar</button>}
                    {canDel && <button onClick={() => onEliminar(r.id)} title="Eliminar" style={{ ...iconBtn, color: "#ef4444" }}><Trash2 size={13} /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODAL DETALLE DE RUTA
// ══════════════════════════════════════════════════════════════
function ModalDetalleRuta({ ruta, onClose, onCambiarEstado, onOptimizar, onParadaActualizada, canManage, showToast }: {
  ruta: Ruta; onClose: () => void; onCambiarEstado: (r: Ruta, e: string) => void;
  onOptimizar: (r: Ruta) => void; onParadaActualizada: (rutaId: string, paradaId: string, estado: string) => void;
  canManage: boolean; showToast: (m: string, e?: boolean) => void;
}) {
  const [confirmParada, setConfirmParada] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const prog = ruta.paradas.length > 0 ? Math.round(ruta.paradas.filter((p) => p.estado === "ENTREGADO").length / ruta.paradas.length * 100) : 0;

  async function confirmar(paradaId: string, estado: "ENTREGADO" | "NO_ENTREGADO") {
    setSaving(true);
    let lat: number | null = null, lng: number | null = null;
    if (estado === "ENTREGADO") {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch { /* GPS no disponible, continuar */ }
    }
    const res = await fetch(`/api/logistica/paradas/${paradaId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, observaciones: obs.trim() || null, fotoTomada: foto, latEntrega: lat, lngEntrega: lng }),
    });
    const json = await res.json();
    if (json.success) { onParadaActualizada(ruta.id, paradaId, estado); setConfirmParada(null); setObs(""); setFoto(false); showToast(estado === "ENTREGADO" ? "Entrega registrada ✓" : "Marcado como no entregado"); }
    else showToast(json.error || "Error", true);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title={ruta.nombre} sub={`${fmtFecha(ruta.fecha)} · ${ruta.transportista?.nombre ?? "Sin conductor"}`} wide>
      {/* Estado + progreso */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
        <Badge label={RUTA_ESTADO_LABEL[ruta.estado as keyof typeof RUTA_ESTADO_LABEL]} color={RUTA_ESTADO_COLOR[ruta.estado as keyof typeof RUTA_ESTADO_COLOR]} />
        <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3 }}><div style={{ width: `${prog}%`, height: "100%", background: prog === 100 ? "#10b981" : COLOR, borderRadius: 3, transition: "width .3s" }} /></div>
        <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>{prog}%</span>
      </div>

      {/* Botones de estado */}
      {canManage && (
        <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
          {ruta.estado === "PENDIENTE" && <button onClick={() => onCambiarEstado(ruta, "EN_CURSO")} style={{ padding: "0.45rem 0.9rem", background: "#3b82f615", color: "#3b82f6", border: "1px solid #3b82f640", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>▶ Iniciar ruta</button>}
          {ruta.estado === "EN_CURSO" && <button onClick={() => onCambiarEstado(ruta, "FINALIZADA")} style={{ padding: "0.45rem 0.9rem", background: "#10b98115", color: "#10b981", border: "1px solid #10b98140", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ Finalizar ruta</button>}
          {(ruta.estado === "PENDIENTE" || ruta.estado === "EN_CURSO") && <button onClick={() => onCambiarEstado(ruta, "CANCELADA")} style={{ padding: "0.45rem 0.9rem", background: "#ef444415", color: "#ef4444", border: "1px solid #ef444440", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕ Cancelar</button>}
          {canOptimize(ruta.paradas) && <button onClick={() => onOptimizar(ruta)} style={{ padding: "0.45rem 0.9rem", background: COLOR + "15", color: COLOR, border: `1px solid ${COLOR}40`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>⚡ Optimizar</button>}
        </div>
      )}

      {/* Lista de paradas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ruta.paradas.map((p, i) => (
          <div key={p.id} style={{ background: "var(--surface2)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "0.7rem 0.85rem" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: PARADA_ESTADO_COLOR[p.estado as keyof typeof PARADA_ESTADO_COLOR] + "20", color: PARADA_ESTADO_COLOR[p.estado as keyof typeof PARADA_ESTADO_COLOR], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.direccion}</div>
                {p.pedidoId && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>Pedido: {p.pedidoId}</div>}
                {p.observaciones && <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 2 }}>{p.observaciones}</div>}
                {p.fotoUrl && <a href={p.fotoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", marginTop: 4 }}><img src={p.fotoUrl} alt="Evidencia" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /></a>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <Badge label={PARADA_ESTADO_LABEL[p.estado as keyof typeof PARADA_ESTADO_LABEL]} color={PARADA_ESTADO_COLOR[p.estado as keyof typeof PARADA_ESTADO_COLOR]} />
                <a href={navUrl(p)} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "#3b82f615", color: "#3b82f6", border: "1px solid #3b82f640", borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: "none" }}><Navigation size={11} />Navegar</a>
                {p.estado === "PENDIENTE" && <button onClick={() => setConfirmParada(p.id)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: COLOR + "15", color: COLOR, border: `1px solid ${COLOR}40`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Confirmar</button>}
              </div>
            </div>
            {confirmParada === p.id && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "0.7rem 0.85rem", display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observaciones (opcional)…" rows={2} style={{ ...inp, resize: "vertical", fontSize: 12 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={foto} onChange={(e) => setFoto(e.target.checked)} />
                  Foto de evidencia tomada
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => confirmar(p.id, "ENTREGADO")} disabled={saving} style={{ flex: 1, padding: "0.55rem", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "…" : "✓ Entregado"}</button>
                  <button onClick={() => confirmar(p.id, "NO_ENTREGADO")} disabled={saving} style={{ flex: 1, padding: "0.55rem", background: "#ef444415", color: "#ef4444", border: "1px solid #ef444440", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕ No entregado</button>
                  <button onClick={() => setConfirmParada(null)} style={{ padding: "0.55rem 0.7rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// MODAL CREAR RUTA
// ══════════════════════════════════════════════════════════════
function ModalCrearRuta({ transportistas, onClose, onCreada, onError }: {
  transportistas: Transportista[]; onClose: () => void; onCreada: (r: Ruta) => void; onError: (m: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [transportistaId, setTransportistaId] = useState("");
  const [notas, setNotas] = useState("");
  const [paradas, setParadas] = useState([{ orden: 1, direccion: "", lat: "", lng: "", pedidoId: "" }]);
  const [saving, setSaving] = useState(false);

  function addParada() { setParadas((p) => [...p, { orden: p.length + 1, direccion: "", lat: "", lng: "", pedidoId: "" }]); }
  function removeParada(i: number) { setParadas((p) => p.filter((_, j) => j !== i).map((p, j) => ({ ...p, orden: j + 1 }))); }
  function updateParada(i: number, key: string, val: string) { setParadas((p) => p.map((x, j) => j === i ? { ...x, [key]: val } : x)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !fecha || !transportistaId) { onError("Completa nombre, fecha y conductor"); return; }
    if (paradas.some((p) => !p.direccion.trim())) { onError("Todas las paradas necesitan dirección"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/logistica/rutas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(), fecha, transportistaId, notas: notas.trim() || null,
          paradas: paradas.map((p) => ({
            orden: p.orden, direccion: p.direccion.trim(),
            lat: p.lat ? parseFloat(p.lat) : null, lng: p.lng ? parseFloat(p.lng) : null,
            pedidoId: p.pedidoId.trim() || null,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) onCreada(json.data); else onError(json.error || "Error");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }

  return (
    <Modal onClose={onClose} title="Nueva ruta" wide>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
          <Field label="Nombre de la ruta *"><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ruta Norte – 31/05/2026" style={inp} /></Field>
          <Field label="Fecha *"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></Field>
        </div>
        <Field label="Conductor *">
          <select value={transportistaId} onChange={(e) => setTransportistaId(e.target.value)} style={inp}>
            <option value="">Seleccionar conductor…</option>
            {transportistas.filter((t) => t.activo).map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.vehiculo ? ` · ${t.vehiculo.placa}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Notas"><textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.9rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Paradas ({paradas.length})</span>
            <button type="button" onClick={addParada} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: COLOR + "15", color: COLOR, border: `1px solid ${COLOR}40`, borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Plus size={12} />Agregar</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {paradas.map((p, i) => (
              <div key={i} style={{ background: "var(--surface2)", borderRadius: 10, padding: "0.7rem", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: COLOR, minWidth: 20 }}>{i + 1}</span>
                  <input value={p.direccion} onChange={(e) => updateParada(i, "direccion", e.target.value)} placeholder="Dirección *" style={{ ...inp, flex: 1 }} />
                  {paradas.length > 1 && <button type="button" onClick={() => removeParada(i)} style={{ ...iconBtn, color: "#ef4444" }}><X size={13} /></button>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <input value={p.lat} onChange={(e) => updateParada(i, "lat", e.target.value)} placeholder="Lat (opc.)" style={{ ...inp, fontSize: 11 }} type="number" step="any" />
                  <input value={p.lng} onChange={(e) => updateParada(i, "lng", e.target.value)} placeholder="Lng (opc.)" style={{ ...inp, fontSize: 11 }} type="number" step="any" />
                  <input value={p.pedidoId} onChange={(e) => updateParada(i, "pedidoId", e.target.value)} placeholder="ID pedido (opc.)" style={{ ...inp, fontSize: 11 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} style={{ marginTop: "0.5rem", padding: "0.7rem", background: saving ? "#94a3b8" : COLOR, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Creando…" : "Crear ruta"}</button>
      </form>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// PANELES DE FLOTA
// ══════════════════════════════════════════════════════════════
function VehiculosPanel({ vehiculos, canManage, canDel, onEdit, onCrear, onDeleted, onError }: {
  vehiculos: Vehiculo[]; canManage: boolean; canDel: boolean;
  onEdit: (v: Vehiculo) => void; onCrear: () => void;
  onDeleted: (id: string) => void; onError: (m: string) => void;
}) {
  async function del(id: string) {
    const res = await fetch(`/api/logistica/vehiculos/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) onDeleted(id); else onError(j.error || "Error");
  }
  return (
    <div>
      {canManage && <div style={{ marginBottom: "0.75rem" }}><button onClick={onCrear} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: COLOR, color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Plus size={14} />Agregar vehículo</button></div>}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
            {["Placa", "Tipo", "Cap. (kg)", "Estado", ""].map((h) => <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {vehiculos.length === 0 && <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Sin vehículos</td></tr>}
            {vehiculos.map((v) => (
              <tr key={v.id} className="hover-row" style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.65rem 0.85rem", fontFamily: "var(--mono)", fontWeight: 700 }}>{v.placa}</td>
                <td style={{ padding: "0.65rem 0.85rem" }}>{VEHICULO_TIPO_LABEL[v.tipo as keyof typeof VEHICULO_TIPO_LABEL]}</td>
                <td style={{ padding: "0.65rem 0.85rem", fontFamily: "var(--mono)" }}>{v.capacidadKg ?? "—"}</td>
                <td style={{ padding: "0.65rem 0.85rem" }}><Badge label={VEHICULO_ESTADO_LABEL[v.estado as keyof typeof VEHICULO_ESTADO_LABEL]} color={VEHICULO_ESTADO_COLOR[v.estado as keyof typeof VEHICULO_ESTADO_COLOR]} /></td>
                <td style={{ padding: "0.65rem 0.85rem", whiteSpace: "nowrap" }}>
                  {canManage && <button onClick={() => onEdit(v)} style={iconBtn}><Pencil size={13} /></button>}
                  {canDel && <button onClick={() => del(v.id)} style={{ ...iconBtn, color: "#ef4444" }}><Trash2 size={13} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransportistasPanel({ transportistas, vehiculos, canManage, canDel, onEdit, onCrear, onDeleted, onError }: {
  transportistas: Transportista[]; vehiculos: Vehiculo[]; canManage: boolean; canDel: boolean;
  onEdit: (t: Transportista) => void; onCrear: () => void;
  onDeleted: (id: string) => void; onError: (m: string) => void;
}) {
  void vehiculos;
  async function del(id: string) {
    const res = await fetch(`/api/logistica/transportistas/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) onDeleted(id); else onError(j.error || "Error");
  }
  return (
    <div>
      {canManage && <div style={{ marginBottom: "0.75rem" }}><button onClick={onCrear} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: COLOR, color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Plus size={14} />Agregar conductor</button></div>}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
            {["Nombre", "Teléfono", "Vehículo", "Estado", ""].map((h) => <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {transportistas.length === 0 && <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Sin transportistas</td></tr>}
            {transportistas.map((t) => (
              <tr key={t.id} className="hover-row" style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.65rem 0.85rem", fontWeight: 600 }}>{t.nombre}</td>
                <td style={{ padding: "0.65rem 0.85rem", fontFamily: "var(--mono)" }}>{t.telefono ?? "—"}</td>
                <td style={{ padding: "0.65rem 0.85rem" }}>{t.vehiculo ? `${t.vehiculo.placa} (${VEHICULO_TIPO_LABEL[t.vehiculo.tipo as keyof typeof VEHICULO_TIPO_LABEL]})` : "—"}</td>
                <td style={{ padding: "0.65rem 0.85rem" }}><Badge label={t.activo ? "Activo" : "Inactivo"} color={t.activo ? "#10b981" : "#ef4444"} /></td>
                <td style={{ padding: "0.65rem 0.85rem", whiteSpace: "nowrap" }}>
                  {canManage && <button onClick={() => onEdit(t)} style={iconBtn}><Pencil size={13} /></button>}
                  {canDel && <button onClick={() => del(t.id)} style={{ ...iconBtn, color: "#ef4444" }}><Trash2 size={13} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODALES CRUD FLOTA
// ══════════════════════════════════════════════════════════════
function ModalVehiculo({ vehiculo, onClose, onSaved, onError }: { vehiculo: Vehiculo; onClose: () => void; onSaved: (v: Vehiculo) => void; onError: (m: string) => void }) {
  const isNew = !vehiculo.id;
  const [placa, setPlaca] = useState(vehiculo.placa);
  const [tipo, setTipo] = useState(vehiculo.tipo || "CAMION");
  const [cap, setCap] = useState(vehiculo.capacidadKg != null ? String(vehiculo.capacidadKg) : "");
  const [estado, setEstado] = useState(vehiculo.estado || "ACTIVO");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!placa.trim()) { onError("Placa requerida"); return; }
    setSaving(true);
    const body = { placa: placa.trim().toUpperCase(), tipo, capacidadKg: cap ? parseInt(cap) : null, estado };
    const url = isNew ? "/api/logistica/vehiculos" : `/api/logistica/vehiculos/${vehiculo.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.success) onSaved(json.data); else onError(json.error || "Error");
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title={isNew ? "Agregar vehículo" : "Editar vehículo"}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Field label="Placa *"><input value={placa} onChange={(e) => setPlaca(e.target.value)} style={inp} /></Field>
        <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} style={inp}>{(["CAMION","FURGON","VAN","MOTO"] as const).map((t) => <option key={t} value={t}>{VEHICULO_TIPO_LABEL[t]}</option>)}</select></Field>
        <Field label="Capacidad (kg)"><input type="number" value={cap} onChange={(e) => setCap(e.target.value)} style={inp} /></Field>
        <Field label="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} style={inp}>{(["ACTIVO","MANTENIMIENTO","INACTIVO"] as const).map((s) => <option key={s} value={s}>{VEHICULO_ESTADO_LABEL[s]}</option>)}</select></Field>
        <button type="submit" disabled={saving} style={{ padding: "0.65rem", background: saving ? "#94a3b8" : COLOR, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{saving ? "Guardando…" : "Guardar"}</button>
      </form>
    </Modal>
  );
}

function ModalTransportista({ transportista, vehiculos, onClose, onSaved, onError }: { transportista: Transportista; vehiculos: Vehiculo[]; onClose: () => void; onSaved: (t: Transportista) => void; onError: (m: string) => void }) {
  const isNew = !transportista.id;
  const [nombre, setNombre] = useState(transportista.nombre);
  const [tel, setTel] = useState(transportista.telefono ?? "");
  const [vehiculoId, setVehiculoId] = useState(transportista.vehiculoId ?? "");
  const [activo, setActivo] = useState(transportista.activo);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { onError("Nombre requerido"); return; }
    setSaving(true);
    const body = { nombre: nombre.trim(), telefono: tel.trim() || null, vehiculoId: vehiculoId || null, activo };
    const url = isNew ? "/api/logistica/transportistas" : `/api/logistica/transportistas/${transportista.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.success) onSaved(json.data); else onError(json.error || "Error");
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title={isNew ? "Agregar conductor" : "Editar conductor"}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Field label="Nombre *"><input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inp} /></Field>
        <Field label="Teléfono"><input value={tel} onChange={(e) => setTel(e.target.value)} style={inp} /></Field>
        <Field label="Vehículo asignado">
          <select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} style={inp}>
            <option value="">Sin vehículo</option>
            {vehiculos.filter((v) => v.estado === "ACTIVO").map((v) => <option key={v.id} value={v.id}>{v.placa} — {VEHICULO_TIPO_LABEL[v.tipo as keyof typeof VEHICULO_TIPO_LABEL]}</option>)}
          </select>
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />Activo
        </label>
        <button type="submit" disabled={saving} style={{ padding: "0.65rem", background: saving ? "#94a3b8" : COLOR, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{saving ? "Guardando…" : "Guardar"}</button>
      </form>
    </Modal>
  );
}

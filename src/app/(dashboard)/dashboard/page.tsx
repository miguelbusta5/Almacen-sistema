"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Package, Truck, Route, ClipboardList, ArrowRight, AlertTriangle,
  Clock, Plus, CheckCircle2, Navigation, MapPin, RefreshCw,
} from "lucide-react";
import { Stat, SkeletonStat, TimelineItem, SectionHeader, SkeletonStat as SK } from "@/components/ui";
import { IntelBanner } from "@/components/ui/SlidePanel";
import { consolidarInsights, insightsGuardados } from "@/lib/inteligencia";
import { urgencia, tieneAlerta } from "@/lib/transporte";
import type { Novedad } from "@/lib/muebles";
import type { Guardado } from "@/lib/transporte";
import type { Ruta } from "@/lib/logistica";
import { RUTA_ESTADO_LABEL, RUTA_ESTADO_COLOR, PARADA_ESTADO_COLOR, PARADA_ESTADO_LABEL } from "@/lib/logistica";

// ── Helpers ──────────────────────────────────────────────
function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "ahora";
  if (d < 3600) return `hace ${Math.floor(d / 60)}min`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)}h`;
  return `hace ${Math.floor(d / 86400)}d`;
}
function moduleColor(mod: string) {
  if (mod === "muebles") return "#2563EB";
  if (mod === "transporte") return "#0E7490";
  if (mod === "logistica") return "#7C3AED";
  if (mod === "conteo") return "#16A34A";
  return "#6B7280";
}
function moduleLabel(mod: string) {
  const m: Record<string, string> = { muebles: "Muebles", transporte: "Transporte", logistica: "Logística", conteo: "Conteo", users: "Usuarios" };
  return m[mod] ?? mod;
}
function actionDot(action: string): "active" | "success" | "warning" | "error" | "default" {
  if (action === "CREATE") return "active";
  if (action === "UPDATE") return "success";
  if (action === "DELETE") return "error";
  return "default";
}

interface Stats {
  novedades: { total: number; pendientes: number; solucionados: number };
  transporte: { total: number; pendientes: number; despachados: number; alertas: number };
}
interface ActivityItem {
  id: string; action: string; module: string; details: string | null;
  createdAt: string; user: { name: string; email: string } | null;
}

// ── Tarjeta de módulo (estilo Vercel) ───────────────────
function ModuleCard({ href, icon, label, color, value, sub, alert }: {
  href: string; icon: React.ReactNode; label: string; color: string;
  value?: number | string; sub?: string; alert?: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        className="lift"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px", cursor: "pointer", transition: "border-color .15s" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = color + "55"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: color + "14", display: "flex", alignItems: "center", justifyContent: "center", color }}>
            {icon}
          </div>
          {alert && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text)", lineHeight: 1, marginBottom: 4 }}>{value ?? "—"}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 14, fontSize: 12, color, fontWeight: 500 }}>
          Abrir <ArrowRight size={12} />
        </div>
      </div>
    </Link>
  );
}

// ── Ítem de alerta accionable ─────────────────────────────
function AlertItem({ level, text, sub, href }: { level: "critical" | "warning"; text: string; sub?: string; href: string }) {
  const color = level === "critical" ? "var(--error)" : "var(--warning)";
  const bg = level === "critical" ? "var(--error-tint)" : "var(--warning-tint)";
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: bg, borderRadius: 10, transition: "opacity .1s" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = ".85"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        <AlertTriangle size={15} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{text}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
        </div>
        <ArrowRight size={13} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      </div>
    </Link>
  );
}

// ── Botón de acción rápida ────────────────────────────────
function QuickAction({ href, icon, label, color, description }: { href: string; icon: React.ReactNode; label: string; color: string; description?: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, transition: "border-color .15s, box-shadow .15s", cursor: "pointer" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = color + "55"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 10, background: color + "14", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>{label}</div>
          {description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{description}</div>}
        </div>
        <ArrowRight size={14} color="var(--faint)" style={{ marginLeft: "auto" }} />
      </div>
    </Link>
  );
}

// ════════════════════════════════════════════════════════════
// VISTA: ADMIN / GERENTE
// "¿Qué está pasando en toda la empresa?"
// ════════════════════════════════════════════════════════════
function AdminDashboard({ nombre }: { nombre: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sR, aR, nR, gR] = await Promise.all([
          fetch("/api/stats"), fetch("/api/activity?pageSize=12"),
          fetch("/api/novedades?pageSize=200"), fetch("/api/transporte?pageSize=200"),
        ]);
        if (sR.ok) setStats(await sR.json());
        const aJ = await aR.json(); if (aJ.success) setActivity(aJ.data ?? []);
        const nJ = await nR.json(); if (nJ.success) setNovedades(nJ.data ?? []);
        const gJ = await gR.json(); if (gJ.success) setGuardados(gJ.data ?? []);
      } catch { /* noop */ } finally { setLoading(false); }
    })();
  }, []);

  const insights = useMemo(() => consolidarInsights(novedades, guardados, []), [novedades, guardados]);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="animate-fade-in" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
          {saludo}{nombre ? `, ${nombre}` : ""}.
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Inteligencia operacional */}
      {!loading && insights.length > 0 && (
        <div className="animate-fade-up" style={{ marginBottom: 28 }}>
          <IntelBanner insights={insights} maxVisible={4} title="Centro de inteligencia operacional" />
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 28, marginBottom: 36, padding: "0 2px" }}>
        {loading ? <><SK /><SK /><SK /><SK /></> : (
          <>
            <Stat value={stats?.novedades.total ?? 0} label="Novedades totales" color="var(--brand)" />
            <Stat value={stats?.novedades.pendientes ?? 0} label="Sin resolver" color={(stats?.novedades.pendientes ?? 0) > 0 ? "var(--error)" : "var(--success)"} />
            <Stat value={stats?.transporte.total ?? 0} label="Guardados activos" color="#0E7490" />
            <Stat value={stats?.transporte.alertas ?? 0} label="Alertas de entrega" color={(stats?.transporte.alertas ?? 0) > 0 ? "var(--warning)" : "var(--success)"} />
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 28, alignItems: "start" }}>
        {/* Módulos */}
        <div>
          <SectionHeader title="Módulos" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ModuleCard href="/dashboard/muebles" icon={<Package size={17} />} label="Novedades Muebles" color="#2563EB" value={stats?.novedades.total} sub={`${stats?.novedades.pendientes ?? 0} sin resolver`} alert={(stats?.novedades.pendientes ?? 0) > 0} />
            <ModuleCard href="/dashboard/transporte" icon={<Truck size={17} />} label="Guardados Transporte" color="#0E7490" value={stats?.transporte.total} sub={`${stats?.transporte.pendientes ?? 0} pendientes`} alert={(stats?.transporte.alertas ?? 0) > 0} />
            <ModuleCard href="/dashboard/logistica" icon={<Route size={17} />} label="Logística" color="#7C3AED" sub="Rutas y conductores" />
            <ModuleCard href="/dashboard/conteo" icon={<ClipboardList size={17} />} label="Conteo Cíclico" color="#16A34A" sub="Conteos de inventario" />
          </div>
        </div>

        {/* Timeline */}
        <div>
          <SectionHeader title="Actividad reciente" />
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "6px 0" }}>
                  <div className="skeleton" style={{ width: 15, height: 15, borderRadius: "50%", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                    <div className="skeleton" style={{ height: 12, borderRadius: 3, width: "80%" }} />
                    <div className="skeleton" style={{ height: 10, borderRadius: 3, width: "50%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              <Clock size={28} style={{ margin: "0 auto 8px", opacity: 0.4, display: "block" }} />
              Sin actividad reciente
            </div>
          ) : (
            <div className="ds-timeline">
              {activity.slice(0, 10).map((item) => (
                <TimelineItem
                  key={item.id}
                  title={item.details ?? `${item.action} en ${item.module}`}
                  meta={item.user?.name}
                  time={timeAgo(item.createdAt)}
                  dot={actionDot(item.action)}
                  module={moduleLabel(item.module)}
                  moduleColor={moduleColor(item.module)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// VISTA: OPERADOR
// "¿Qué debo hacer hoy?"
// ════════════════════════════════════════════════════════════
function OperadorDashboard({ nombre }: { nombre: string }) {
  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [gR, nR] = await Promise.all([
          fetch("/api/transporte?pageSize=500"),
          fetch("/api/novedades?pageSize=200"),
        ]);
        const gJ = await gR.json(); if (gJ.success) setGuardados(gJ.data ?? []);
        const nJ = await nR.json(); if (nJ.success) setNovedades(nJ.data ?? []);
      } catch { /* noop */ } finally { setLoading(false); }
    })();
  }, []);

  const vencidas = useMemo(() => guardados.filter((g) => { const u = urgencia(g); return u?.tipo === "vencida"; }), [guardados]);
  const proximas = useMemo(() => guardados.filter((g) => { const u = urgencia(g); return u?.tipo === "proxima" && (u.dias ?? 10) <= 2; }), [guardados]);
  const pendientesNov = useMemo(() => novedades.filter((n) => n.estado === "PENDIENTE"), [novedades]);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="animate-fade-in" style={{ maxWidth: 680 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
          {saludo}{nombre ? `, ${nombre}` : ""}.
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 5 }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
          {!loading && (vencidas.length > 0 || proximas.length > 0 || pendientesNov.length > 0) && (
            <span style={{ marginLeft: 8, color: "var(--warning)", fontWeight: 600 }}>
              · {vencidas.length + proximas.length + pendientesNov.length} item{vencidas.length + proximas.length + pendientesNov.length !== 1 ? "s" : ""} requieren atención
            </span>
          )}
        </p>
      </div>

      {/* Alertas que requieren atención */}
      {!loading && (vencidas.length > 0 || proximas.length > 0 || pendientesNov.length > 0) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Requieren atención ahora
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vencidas.length > 0 && (
              <AlertItem
                level="critical"
                text={`${vencidas.length} entrega${vencidas.length !== 1 ? "s" : ""} con fecha de entrega vencida`}
                sub={vencidas.slice(0, 2).map((g) => g.documento).join(" · ")}
                href="/dashboard/transporte"
              />
            )}
            {proximas.length > 0 && (
              <AlertItem
                level="warning"
                text={`${proximas.length} entrega${proximas.length !== 1 ? "s" : ""} vence${proximas.length === 1 ? "" : "n"} en menos de 2 días`}
                sub={proximas.slice(0, 2).map((g) => g.documento).join(" · ")}
                href="/dashboard/transporte"
              />
            )}
            {pendientesNov.length > 0 && (
              <AlertItem
                level="warning"
                text={`${pendientesNov.length} novedad${pendientesNov.length !== 1 ? "es" : ""} de inventario sin resolver`}
                sub="Pendientes de seguimiento"
                href="/dashboard/muebles"
              />
            )}
          </div>
        </div>
      )}

      {/* Acciones rápidas */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeader title="Acciones rápidas" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <QuickAction
            href="/dashboard/muebles"
            icon={<Plus size={18} />}
            label="Nueva novedad de inventario"
            color="#2563EB"
            description="Registrar diferencia de PLU, posición o cantidad"
          />
          <QuickAction
            href="/dashboard/transporte"
            icon={<Plus size={18} />}
            label="Nuevo guardado en transporte"
            color="#0E7490"
            description="Registrar pedido en custodia de almacén"
          />
          <QuickAction
            href="/dashboard/conteo/contar"
            icon={<ClipboardList size={18} />}
            label="Ir a conteo cíclico"
            color="#16A34A"
            description="Continuar con los PLUs asignados para hoy"
          />
          <QuickAction
            href="/dashboard/logistica/mi-ruta"
            icon={<Route size={18} />}
            label="Ver mi ruta asignada"
            color="#7C3AED"
            description="Acceder a paradas y entregas del día"
          />
        </div>
      </div>

      {/* Resumen rápido */}
      {!loading && (
        <div>
          <SectionHeader title="Estado actual" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, padding: "0 2px" }}>
            <Stat
              value={pendientesNov.length}
              label="Novedades pendientes"
              color={pendientesNov.length > 0 ? "var(--error)" : "var(--success)"}
              onClick={() => window.location.href = "/dashboard/muebles"}
            />
            <Stat
              value={guardados.filter((g) => g.estado === "PENDIENTE DESPACHO").length}
              label="En espera de despacho"
              color="var(--warning)"
              onClick={() => window.location.href = "/dashboard/transporte"}
            />
            <Stat
              value={vencidas.length + proximas.length}
              label="Con alerta de entrega"
              color={(vencidas.length + proximas.length) > 0 ? "var(--error)" : "var(--success)"}
              onClick={() => window.location.href = "/dashboard/transporte"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// VISTA: TRANSPORTISTA
// "Mi ruta de hoy"
// ════════════════════════════════════════════════════════════
function TransportistaDashboard({ nombre }: { nombre: string }) {
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadRuta() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/logistica/rutas?mia=1");
      const json = await res.json();
      setRuta(json.success && json.data?.length > 0 ? json.data[0] : null);
    } catch { /* noop */ } finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { loadRuta(); }, []);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  const entregadas = ruta?.paradas.filter((p) => p.estado === "ENTREGADO").length ?? 0;
  const total = ruta?.paradas.length ?? 0;
  const prog = total > 0 ? Math.round(entregadas / total * 100) : 0;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 560 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
          {saludo}{nombre ? `, ${nombre}` : ""}.
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 5 }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Ruta activa */}
      {loading ? (
        <div className="ds-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="skeleton" style={{ height: 20, width: "60%", borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 8, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 14, width: "40%", borderRadius: 4 }} />
          </div>
        </div>
      ) : !ruta ? (
        <div className="ds-card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Route size={22} color="var(--muted)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Sin ruta asignada</div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.55 }}>
            No tienes ninguna ruta activa para hoy. Cuando el supervisor te asigne una, aparecerá aquí.
          </p>
          <button
            onClick={loadRuta}
            disabled={refreshing}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--muted2)", cursor: "pointer" }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? "spin .8s linear infinite" : "none" }} />
            {refreshing ? "Verificando…" : "Actualizar"}
          </button>
        </div>
      ) : (
        <>
          {/* Card de la ruta */}
          <div className="ds-card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "#7C3AED14", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Route size={15} color="#7C3AED" />
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>{ruta.nombre}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: RUTA_ESTADO_COLOR[ruta.estado as keyof typeof RUTA_ESTADO_COLOR] + "18", color: RUTA_ESTADO_COLOR[ruta.estado as keyof typeof RUTA_ESTADO_COLOR] }}>
                  {RUTA_ESTADO_LABEL[ruta.estado as keyof typeof RUTA_ESTADO_LABEL]}
                </span>
              </div>
              <button onClick={loadRuta} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}>
                <RefreshCw size={14} style={{ animation: refreshing ? "spin .8s linear infinite" : "none" }} />
              </button>
            </div>

            {/* Barra de progreso */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>Progreso del día</span>
                <span style={{ fontWeight: 700, color: prog === 100 ? "var(--success)" : "var(--text)", fontFamily: "var(--mono)" }}>{entregadas}/{total} entregas · {prog}%</span>
              </div>
              <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${prog}%`, background: prog === 100 ? "var(--success)" : "#7C3AED", borderRadius: 4, transition: "width .4s cubic-bezier(.16,1,.3,1)" }} />
              </div>
            </div>

            {/* Estadísticas de paradas */}
            <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
              {(["PENDIENTE", "ENTREGADO", "NO_ENTREGADO"] as const).map((estado) => {
                const count = ruta.paradas.filter((p) => p.estado === estado).length;
                return count > 0 ? (
                  <div key={estado} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: PARADA_ESTADO_COLOR[estado], flexShrink: 0 }} />
                    {count} {PARADA_ESTADO_LABEL[estado].toLowerCase()}
                  </div>
                ) : null;
              })}
            </div>
          </div>

          {/* Próxima parada */}
          {ruta.estado === "EN_CURSO" && (() => {
            const siguiente = ruta.paradas.find((p) => p.estado === "PENDIENTE");
            return siguiente ? (
              <div style={{ background: "var(--brand-tint)", border: "1px solid var(--brand-tint)", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
                  Siguiente parada
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6, letterSpacing: "-0.01em" }}>
                  {siguiente.direccion}
                </div>
                {siguiente.pedidoId && (
                  <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: 12 }}>
                    Pedido: {siguiente.pedidoId}
                  </div>
                )}
                <a
                  href={siguiente.lat && siguiente.lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${siguiente.lat},${siguiente.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siguiente.direccion)}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--brand)", color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                >
                  <Navigation size={13} />Iniciar navegación
                </a>
              </div>
            ) : null;
          })()}

          {/* CTA a Mi Ruta */}
          <Link href="/dashboard/logistica/mi-ruta" style={{ textDecoration: "none", display: "block" }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", transition: "border-color .15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#7C3AED55"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#7C3AED14", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MapPin size={17} color="#7C3AED" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Abrir vista de conductor</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>GPS, paradas y confirmación de entregas</div>
                </div>
              </div>
              <ArrowRight size={16} color="var(--muted)" />
            </div>
          </Link>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ROUTER POR ROL — página raíz del dashboard
// ════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const nombre = (session?.user?.name || "").split(" ")[0] || "";

  // Mientras carga la sesión
  if (!session) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 28, maxWidth: 900, padding: "0 2px" }}>
        <SK /><SK /><SK /><SK />
      </div>
    );
  }

  // Conductores → vista de ruta
  if (role === "TRANSPORTISTA") return <TransportistaDashboard nombre={nombre} />;

  // Operarios de área → vista de tareas del día
  if (role === "OPERADOR" || role === "INVENTARIO" || role === "TRANSPORTE" || role === "TIENDA")
    return <OperadorDashboard nombre={nombre} />;

  // Supervisores y gerencia → vista ejecutiva
  return <AdminDashboard nombre={nombre} />;
}

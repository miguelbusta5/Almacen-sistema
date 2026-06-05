"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Package, Truck, ClipboardList, ArrowRight, AlertTriangle,
  Clock, Plus,
  CheckSquare, Store, BarChart2, Users, History,
} from "lucide-react";
import { Stat, SkeletonStat, TimelineItem, SectionHeader, SkeletonStat as SK } from "@/components/ui";
import { IntelBanner } from "@/components/ui/SlidePanel";
import { consolidarInsights } from "@/lib/inteligencia";
import { urgencia } from "@/lib/transporte";
import type { Novedad } from "@/lib/muebles";
import type { Guardado } from "@/lib/transporte";
import { getHomeActionsByRole, type HomeAction } from "@/config/homeActions";

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

// ── Mapa de íconos para acciones del config ───────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  Plus:         <Plus size={18} />,
  ClipboardList:<ClipboardList size={18} />,
  CheckSquare:  <CheckSquare size={18} />,
  Store:        <Store size={18} />,
  BarChart2:    <BarChart2 size={18} />,
  Users:        <Users size={18} />,
  History:      <History size={18} />,
};

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
// VISTA: OPERADOR / SUPERVISOR DE ÁREA
// "¿Qué debo hacer hoy?" — contextual por rol
// ════════════════════════════════════════════════════════════
function OperadorDashboard({ nombre, role }: { nombre: string; role: string }) {
  // ── Determinar qué datos necesita este rol ──────────────
  const needsNovedades = ["INVENTARIO", "SUPERVISOR_INVENTARIO", "OPERADOR"].includes(role);
  const needsGuardados = ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERADOR"].includes(role);
  const needsTienda    = ["TIENDA", "SUPERVISOR_TIENDA"].includes(role);

  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [tiendaDespachos, setTiendaDespachos] = useState<{ estado: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetches: Promise<void>[] = [];
    if (needsGuardados) fetches.push(
      fetch("/api/transporte?pageSize=500").then((r) => r.json())
        .then((j) => { if (j.success) setGuardados(j.data ?? []); }).catch(() => {})
    );
    if (needsNovedades) fetches.push(
      fetch("/api/novedades?pageSize=200").then((r) => r.json())
        .then((j) => { if (j.success) setNovedades(j.data ?? []); }).catch(() => {})
    );
    if (needsTienda) fetches.push(
      fetch("/api/tienda?pageSize=200").then((r) => r.json())
        .then((j) => { if (j.success) setTiendaDespachos(j.data ?? []); }).catch(() => {})
    );
    Promise.all(fetches).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // ── Cómputos por área ────────────────────────────────────
  const vencidas     = useMemo(() => guardados.filter((g) => urgencia(g)?.tipo === "vencida"), [guardados]);
  const proximas     = useMemo(() => guardados.filter((g) => { const u = urgencia(g); return u?.tipo === "proxima" && (u.dias ?? 10) <= 2; }), [guardados]);
  const pendientesNov = useMemo(() => novedades.filter((n) => n.estado === "PENDIENTE"), [novedades]);
  const enProcesoNov  = useMemo(() => novedades.filter((n) => n.estado === "EN PROCESO"), [novedades]);
  const solucionadas  = useMemo(() => novedades.filter((n) => n.estado === "SOLUCIONADO"), [novedades]);
  const guardadosPend = useMemo(() => guardados.filter((g) => g.estado === "PENDIENTE DESPACHO"), [guardados]);
  const guardadosDesp = useMemo(() => guardados.filter((g) => g.estado === "DESPACHADO"), [guardados]);
  const tiendaPend    = useMemo(() => tiendaDespachos.filter((d) => d.estado === "CREADO_TIENDA" || d.estado === "ASIGNADO_RECOGIDA" || d.estado === "RECOGIDO_TIENDA" || d.estado === "ENTREGADO_CEDI"), [tiendaDespachos]);
  const tiendaNovedad = useMemo(() => tiendaDespachos.filter((d) => d.estado === "CON_NOVEDAD"), [tiendaDespachos]);
  const tiendaDesp    = useMemo(() => tiendaDespachos.filter((d) => d.estado === "ENTREGADO_CLIENTE"), [tiendaDespachos]);

  // ── Alerta total para el header de greeting ──────────────
  const totalAlertas = (() => {
    if (needsNovedades && needsGuardados) return vencidas.length + proximas.length + pendientesNov.length; // OPERADOR
    if (needsNovedades) return pendientesNov.length;
    if (needsGuardados) return vencidas.length + proximas.length;
    if (needsTienda)    return tiendaNovedad.length;
    return 0;
  })();

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  const quickActions = getHomeActionsByRole(role, 4);

  // ── Alertas visibles según área ──────────────────────────
  const showGuardadosAlerts = needsGuardados && (vencidas.length > 0 || proximas.length > 0);
  const showNovedadesAlerts = needsNovedades && pendientesNov.length > 0;
  const showTiendaAlerts    = needsTienda && tiendaNovedad.length > 0;
  const hasAlerts = showGuardadosAlerts || showNovedadesAlerts || showTiendaAlerts;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 680 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
          {saludo}{nombre ? `, ${nombre}` : ""}.
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 5 }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
          {!loading && totalAlertas > 0 && (
            <span style={{ marginLeft: 8, color: "var(--warning)", fontWeight: 600 }}>
              · {totalAlertas} item{totalAlertas !== 1 ? "s" : ""} requieren atención
            </span>
          )}
        </p>
      </div>

      {/* Alertas que requieren atención */}
      {!loading && hasAlerts && (
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
            {showNovedadesAlerts && (
              <AlertItem
                level="warning"
                text={`${pendientesNov.length} novedad${pendientesNov.length !== 1 ? "es" : ""} de inventario sin resolver`}
                sub="Pendientes de seguimiento"
                href="/dashboard/muebles"
              />
            )}
            {tiendaNovedad.length > 0 && (
              <AlertItem
                level="warning"
                text={`${tiendaNovedad.length} despacho${tiendaNovedad.length !== 1 ? "s" : ""} de tienda con novedad`}
                sub="Requieren revisión y reasignación"
                href="/dashboard/tienda"
              />
            )}
          </div>
        </div>
      )}

      {/* Acciones rápidas — filtradas por rol */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeader title="Acciones rápidas" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {quickActions.map((action: HomeAction) => (
            <QuickAction
              key={action.id}
              href={action.href}
              icon={ICON_MAP[action.icon] ?? <Plus size={18} />}
              label={action.title}
              color={action.color}
              description={action.description}
            />
          ))}
        </div>
      </div>

      {/* KPIs contextuales por área */}
      {!loading && (
        <div>
          <SectionHeader title="Estado actual" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, padding: "0 2px" }}>

            {/* Inventario */}
            {needsNovedades && !needsGuardados && (
              <>
                <Stat value={pendientesNov.length} label="Novedades pendientes"
                  color={pendientesNov.length > 0 ? "var(--error)" : "var(--success)"}
                  onClick={() => { window.location.href = "/dashboard/muebles"; }} />
                <Stat value={enProcesoNov.length} label="En proceso"
                  color="var(--warning)" />
                <Stat value={solucionadas.length} label="Solucionadas"
                  color="var(--success)" />
              </>
            )}

            {/* Transporte */}
            {needsGuardados && !needsNovedades && (
              <>
                <Stat value={guardadosPend.length} label="Pendientes despacho"
                  color={guardadosPend.length > 0 ? "var(--warning)" : "var(--success)"}
                  onClick={() => { window.location.href = "/dashboard/transporte"; }} />
                <Stat value={vencidas.length + proximas.length} label="Con alerta de entrega"
                  color={(vencidas.length + proximas.length) > 0 ? "var(--error)" : "var(--success)"}
                  onClick={() => { window.location.href = "/dashboard/transporte"; }} />
                <Stat value={guardadosDesp.length} label="Despachados"
                  color="var(--success)" />
              </>
            )}

            {/* Tienda */}
            {needsTienda && (
              <>
                <Stat value={tiendaPend.length} label="Pendientes recogida"
                  color={tiendaPend.length > 0 ? "var(--warning)" : "var(--success)"}
                  onClick={() => { window.location.href = "/dashboard/tienda"; }} />
                <Stat value={tiendaNovedad.length} label="Con novedad"
                  color={tiendaNovedad.length > 0 ? "var(--error)" : "var(--success)"} />
                <Stat value={tiendaDesp.length} label="Completados"
                  color="var(--success)" />
              </>
            )}

            {/* OPERADOR legacy: mezcla de ambas áreas */}
            {needsNovedades && needsGuardados && (
              <>
                <Stat value={pendientesNov.length} label="Novedades pendientes"
                  color={pendientesNov.length > 0 ? "var(--error)" : "var(--success)"}
                  onClick={() => { window.location.href = "/dashboard/muebles"; }} />
                <Stat value={guardadosPend.length} label="En espera de despacho"
                  color="var(--warning)"
                  onClick={() => { window.location.href = "/dashboard/transporte"; }} />
                <Stat value={vencidas.length + proximas.length} label="Con alerta de entrega"
                  color={(vencidas.length + proximas.length) > 0 ? "var(--error)" : "var(--success)"}
                  onClick={() => { window.location.href = "/dashboard/transporte"; }} />
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// VISTA: TRANSPORTISTA
// Preoperacional
// ════════════════════════════════════════════════════════════
function TransportistaDashboard({ nombre }: { nombre: string }) {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="animate-fade-in" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
          {saludo}{nombre ? `, ${nombre}` : ""}.
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 5 }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="ds-card" style={{ padding: 28 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <CheckSquare size={21} color="var(--muted)" />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Preoperacional
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
          Tu acceso operativo se concentrará en la inspección preoperacional del vehículo.
        </p>
      </div>
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

  // Conductores → vista preoperacional
  if (role === "TRANSPORTISTA") return <TransportistaDashboard nombre={nombre} />;

  // Operarios y supervisores de área → vista contextual por rol
  const AREA_ROLES = [
    "OPERADOR",
    "INVENTARIO", "SUPERVISOR_INVENTARIO",
    "TRANSPORTE", "SUPERVISOR_TRANSPORTE",
    "TIENDA",     "SUPERVISOR_TIENDA",
  ];
  if (AREA_ROLES.includes(role ?? ""))
    return <OperadorDashboard nombre={nombre} role={role!} />;

  // Dirección → vista ejecutiva global
  return <AdminDashboard nombre={nombre} />;
}

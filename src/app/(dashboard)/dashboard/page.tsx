"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Package, Truck, ClipboardList, ArrowRight, AlertTriangle,
  Clock, Plus, CheckCircle2,
  CheckSquare, Store, BarChart2, Users, History, ShieldCheck, GitMerge, FileText, Tags,
} from "lucide-react";
import { Badge, Stat, TimelineItem, SectionHeader, SkeletonStat as SK } from "@/components/ui";
import { IntelBanner } from "@/components/ui/SlidePanel";
import { consolidarInsights } from "@/lib/inteligencia";
import { urgencia } from "@/lib/transporte";
import type { Novedad } from "@/lib/muebles";
import type { Guardado } from "@/lib/transporte";
import { getHomeActionsByRole, type HomeAction } from "@/config/homeActions";
import { useIsMobile } from "@/lib/useIsMobile";
import { getModuleColor, getModuleTheme } from "@/lib/moduleTheme";
import { PRODUCT } from "@/config/product";
import type { ControlLogisticoResumen } from "@/lib/controlLogistico/types";
import {
  ControlHero,
  ModuleSignalGrid,
  PriorityPanel,
  RecommendedActions,
  controlStatusColor,
} from "@/components/control-logistico";

// ── Helpers ──────────────────────────────────────────────
function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "ahora";
  if (d < 3600) return `hace ${Math.floor(d / 60)}min`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)}h`;
  return `hace ${Math.floor(d / 86400)}d`;
}
function moduleColor(mod: string) {
  if (mod === "muebles" || mod === "inventario" || mod === "novedades") return getModuleColor("inventario");
  if (mod === "transporte") return getModuleColor("transporte");
  if (mod === "conteo") return getModuleColor("conteo");
  if (mod === "tienda") return getModuleColor("tienda");
  if (mod === "integracion") return getModuleColor("integracion");
  if (mod === "exportaciones") return getModuleColor("exportaciones");
  if (mod === "users" || mod === "usuarios") return getModuleColor("usuarios");
  return "#6B7280";
}
function moduleLabel(mod: string) {
  const m: Record<string, string> = {
    muebles: getModuleTheme("inventario").shortLabel,
    inventario: getModuleTheme("inventario").shortLabel,
    transporte: getModuleTheme("transporte").shortLabel,
    conteo: getModuleTheme("conteo").shortLabel,
    tienda: getModuleTheme("tienda").shortLabel,
    integracion: getModuleTheme("integracion").shortLabel,
    exportaciones: getModuleTheme("exportaciones").shortLabel,
    users: getModuleTheme("usuarios").shortLabel,
    usuarios: getModuleTheme("usuarios").shortLabel,
  };
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
interface DespachoHome {
  id: string;
  estado: string;
  numeroDocumento: string;
  clienteNombre: string;
  centroCostos: string;
  createdAt: string;
  guardadoPendiente?: { estado: string; asignadoANombre?: string | null } | null;
}
interface PendienteGuardadoHome {
  id: string;
  estado: string;
  createdAt: string;
  asignadoANombre?: string | null;
  despacho?: { numeroDocumento: string; clienteNombre: string; centroCostos: string };
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
  GitMerge:     <GitMerge size={18} />,
  ShieldCheck:  <ShieldCheck size={18} />,
  FileText:     <FileText size={18} />,
  Tags:         <Tags size={18} />,
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

function OperationFlow({ stages, isMobile }: {
  isMobile: boolean;
  stages: Array<{ key: string; label: string; value: number | string; href: string; color: string; sub?: string; alert?: boolean }>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${Math.max(stages.length, 1)}, minmax(0, 1fr))`, gap: 10 }}>
      {stages.map((stage, i) => (
        <Link key={stage.key} href={stage.href} style={{ textDecoration: "none", minWidth: 0 }}>
          <div style={{
            minHeight: 104, padding: "14px 14px 12px", border: "1px solid var(--border)",
            borderRadius: 8, background: "var(--surface)", position: "relative", overflow: "hidden",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {stage.alert ? <AlertTriangle size={14} color="var(--warning)" /> : <CheckCircle2 size={14} color={stage.color} />}
            </div>
            <div>
              <div style={{ fontSize: 24, lineHeight: 1, fontWeight: 800, color: stage.color, letterSpacing: "-0.03em", marginBottom: 5 }}>
                {stage.value}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflowWrap: "anywhere" }}>{stage.label}</div>
              {stage.sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{stage.sub}</div>}
            </div>
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: stage.color }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function PriorityList({ items, emptyText }: {
  emptyText: string;
  items: Array<{ id: string; label: string; sub?: string; href: string; color: string; badge?: string; level?: "error" | "warning" | "info" }>;
}) {
  if (items.length === 0) {
    return (
      <div style={{ padding: "18px 0", color: "var(--muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
        <CheckCircle2 size={15} color="var(--success)" />{emptyText}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.slice(0, 6).map((item) => (
        <Link key={item.id} href={item.href} style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, boxShadow: `0 0 0 3px ${item.color}20`, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
              {item.sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sub}</div>}
            </div>
            {item.badge && <Badge label={item.badge} variant={item.level === "error" ? "error" : item.level === "warning" ? "warning" : "info"} dot={false} />}
            <ArrowRight size={13} color="var(--faint)" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// VISTA: ADMIN / GERENTE
// "¿Qué está pasando en toda la empresa?"
// ════════════════════════════════════════════════════════════
function AdminDashboard({ nombre }: { nombre: string }) {
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const [tiendaDespachos, setTiendaDespachos] = useState<DespachoHome[]>([]);
  const [pendientesGuardado, setPendientesGuardado] = useState<PendienteGuardadoHome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sR, aR, nR, gR, tR, pR] = await Promise.all([
          fetch("/api/stats"), fetch("/api/activity?pageSize=12"),
          fetch("/api/novedades?pageSize=200"), fetch("/api/transporte?pageSize=200"),
          fetch("/api/tienda?pageSize=300"), fetch("/api/transporte/pendientes-tienda"),
        ]);
        if (sR.ok) setStats(await sR.json());
        const aJ = await aR.json(); if (aJ.success) setActivity(aJ.data ?? []);
        const nJ = await nR.json(); if (nJ.success) setNovedades(nJ.data ?? []);
        const gJ = await gR.json(); if (gJ.success) setGuardados(gJ.data ?? []);
        const tJ = await tR.json(); if (tJ.success) setTiendaDespachos(tJ.data ?? []);
        const pJ = await pR.json(); if (pJ.success) setPendientesGuardado(pJ.data ?? []);
      } catch { /* noop */ } finally { setLoading(false); }
    })();
  }, []);

  const insights = useMemo(() => consolidarInsights(novedades, guardados, []), [novedades, guardados]);
  const tiendaCreados = useMemo(() => tiendaDespachos.filter((d) => d.estado === "CREADO_TIENDA"), [tiendaDespachos]);
  const tiendaCedi = useMemo(() => tiendaDespachos.filter((d) => d.estado === "ENTREGADO_CEDI"), [tiendaDespachos]);
  const tiendaRechazados = useMemo(() => tiendaDespachos.filter((d) => d.estado === "RECHAZADO"), [tiendaDespachos]);
  const tiendaNovedad = useMemo(() => tiendaDespachos.filter((d) => d.estado === "CON_NOVEDAD"), [tiendaDespachos]);
  const integraciones = useMemo(() => activity.filter((a) => a.module === "integracion"), [activity]);
  const prioridades = useMemo(() => [
    ...tiendaRechazados.slice(0, 2).map((d) => ({
      id: `rech-${d.id}`, label: d.numeroDocumento, sub: `${d.clienteNombre} · despacho rechazado`,
      href: "/dashboard/tienda", color: "var(--error)", badge: "Rechazado", level: "error" as const,
    })),
    ...tiendaNovedad.slice(0, 2).map((d) => ({
      id: `nov-t-${d.id}`, label: d.numeroDocumento, sub: `${d.clienteNombre} · con novedad`,
      href: "/dashboard/tienda", color: "var(--warning)", badge: "Novedad", level: "warning" as const,
    })),
    ...pendientesGuardado.slice(0, 2).map((p) => ({
      id: `pg-${p.id}`, label: p.despacho?.numeroDocumento ?? "Pendiente de guardado",
      sub: p.despacho ? `${p.despacho.clienteNombre} · ${p.despacho.centroCostos}` : "Asignado a transporte",
      href: "/dashboard/transporte", color: getModuleColor("transporte"), badge: "Guardado", level: "info" as const,
    })),
  ], [tiendaRechazados, tiendaNovedad, pendientesGuardado]);
  const flowStages = [
    { key: "inventario", label: "Inventario", value: stats?.novedades.pendientes ?? 0, sub: "novedades abiertas", href: "/dashboard/inventario", color: getModuleColor("inventario"), alert: (stats?.novedades.pendientes ?? 0) > 0 },
    { key: "tienda", label: "Tienda", value: tiendaCreados.length, sub: "solicitudes creadas", href: "/dashboard/tienda", color: getModuleColor("tienda"), alert: tiendaRechazados.length > 0 },
    { key: "cedi", label: "CEDI", value: tiendaCedi.length, sub: "en llegada/guardado", href: "/dashboard/tienda", color: getModuleColor("transporte"), alert: pendientesGuardado.length > 0 },
    { key: "conteo", label: "Conteo", value: "Activo", sub: "control cíclico", href: "/dashboard/conteo", color: getModuleColor("conteo") },
  ];
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

      <div style={{ marginBottom: 30 }}>
        <SectionHeader title="Flujo operativo" />
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4,1fr)", gap: 10 }}>
            <SK /><SK /><SK /><SK />
          </div>
        ) : (
          <OperationFlow stages={flowStages} isMobile={isMobile} />
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 14 : 28, marginBottom: 36, padding: "0 2px" }}>
        {loading ? <><SK /><SK /><SK /><SK /></> : (
          <>
            <Stat value={stats?.novedades.total ?? 0} label="Novedades totales" color="var(--brand)" />
            <Stat value={stats?.novedades.pendientes ?? 0} label="Sin resolver" color={(stats?.novedades.pendientes ?? 0) > 0 ? "var(--error)" : "var(--success)"} />
            <Stat value={stats?.transporte.total ?? 0} label="Guardados activos" color={getModuleColor("transporte")} />
            <Stat value={stats?.transporte.alertas ?? 0} label="Alertas de entrega" color={(stats?.transporte.alertas ?? 0) > 0 ? "var(--warning)" : "var(--success)"} />
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 28, alignItems: "start" }}>
        {/* Módulos */}
        <div>
          <SectionHeader title={PRODUCT.displayName} />
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
            <ModuleCard href="/dashboard/inventario" icon={<Package size={17} />} label={getModuleTheme("inventario").label} color={getModuleColor("inventario")} value={stats?.novedades.total} sub={`${stats?.novedades.pendientes ?? 0} sin resolver`} alert={(stats?.novedades.pendientes ?? 0) > 0} />
            <ModuleCard href="/dashboard/tienda" icon={<Store size={17} />} label={getModuleTheme("tienda").label} color={getModuleColor("tienda")} value={tiendaDespachos.length} sub={`${tiendaRechazados.length} rechazados`} alert={tiendaRechazados.length > 0 || tiendaNovedad.length > 0} />
            <ModuleCard href="/dashboard/transporte" icon={<Truck size={17} />} label={getModuleTheme("transporte").label} color={getModuleColor("transporte")} value={stats?.transporte.total} sub={`${stats?.transporte.pendientes ?? 0} pendientes`} alert={(stats?.transporte.alertas ?? 0) > 0} />
            <ModuleCard href="/dashboard/conteo" icon={<ClipboardList size={17} />} label={getModuleTheme("conteo").label} color={getModuleColor("conteo")} sub="Conteos de inventario" />
            <ModuleCard href="/dashboard/integracion" icon={<GitMerge size={17} />} label={getModuleTheme("integracion").label} color={getModuleColor("integracion")} value={integraciones.length} sub="movimientos recientes" />
            <ModuleCard href="/dashboard/preoperacional" icon={<ShieldCheck size={17} />} label={getModuleTheme("preoperacional").label} color={getModuleColor("preoperacional")} sub="inspecciones diarias" />
          </div>
        </div>

        <div>
          <SectionHeader title="Prioridades" />
          <PriorityList items={prioridades} emptyText="Sin prioridades críticas en el flujo CEDI." />

          <div style={{ height: 22 }} />
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
  const isMobile = useIsMobile();
  // ── Determinar qué datos necesita este rol ──────────────
  const needsNovedades = ["INVENTARIO", "SUPERVISOR_INVENTARIO", "OPERADOR"].includes(role);
  const needsGuardados = ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERADOR"].includes(role);
  const needsTienda    = ["TIENDA", "SUPERVISOR_TIENDA", "SUPERVISOR_TRANSPORTE"].includes(role);
  const needsPendientesGuardado = ["TRANSPORTE", "SUPERVISOR_TRANSPORTE"].includes(role);
  const needsIntegracion = ["OPERACIONES_MUEBLES", "OPERACIONES_GOURMET"].includes(role);

  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [tiendaDespachos, setTiendaDespachos] = useState<DespachoHome[]>([]);
  const [pendientesGuardado, setPendientesGuardado] = useState<PendienteGuardadoHome[]>([]);
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
    if (needsPendientesGuardado) fetches.push(
      fetch("/api/transporte/pendientes-tienda").then((r) => r.json())
        .then((j) => { if (j.success) setPendientesGuardado(j.data ?? []); }).catch(() => {})
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
  const tiendaPend    = useMemo(() => tiendaDespachos.filter((d) => d.estado === "CREADO_TIENDA" || d.estado === "RECOGIDO_TIENDA" || d.estado === "ENTREGADO_CEDI"), [tiendaDespachos]);
  const tiendaNovedad = useMemo(() => tiendaDespachos.filter((d) => d.estado === "CON_NOVEDAD"), [tiendaDespachos]);
  const tiendaDesp    = useMemo(() => tiendaDespachos.filter((d) => d.estado === "ENVIADO_CLIENTE"), [tiendaDespachos]);
  const tiendaCreados = useMemo(() => tiendaDespachos.filter((d) => d.estado === "CREADO_TIENDA"), [tiendaDespachos]);
  const tiendaRecogidos = useMemo(() => tiendaDespachos.filter((d) => d.estado === "RECOGIDO_TIENDA"), [tiendaDespachos]);
  const tiendaCedi = useMemo(() => tiendaDespachos.filter((d) => d.estado === "ENTREGADO_CEDI"), [tiendaDespachos]);
  const tiendaRechazados = useMemo(() => tiendaDespachos.filter((d) => d.estado === "RECHAZADO"), [tiendaDespachos]);

  // ── Alerta total para el header de greeting ──────────────
  const totalAlertas =
    (needsNovedades ? pendientesNov.length : 0) +
    (needsGuardados ? vencidas.length + proximas.length : 0) +
    (needsPendientesGuardado ? pendientesGuardado.length : 0) +
    (needsTienda ? tiendaNovedad.length + tiendaRechazados.length : 0);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  const quickActions = getHomeActionsByRole(role, 4);

  // ── Alertas visibles según área ──────────────────────────
  const showGuardadosAlerts = needsGuardados && (vencidas.length > 0 || proximas.length > 0);
  const showNovedadesAlerts = needsNovedades && pendientesNov.length > 0;
  const showTiendaAlerts    = needsTienda && (tiendaNovedad.length > 0 || tiendaRechazados.length > 0);
  const showPendientesGuardado = needsPendientesGuardado && pendientesGuardado.length > 0;
  const hasAlerts = showGuardadosAlerts || showNovedadesAlerts || showTiendaAlerts || showPendientesGuardado;
  const flowStages = [
    ...(needsNovedades ? [
      { key: "inventario", label: "Inventario", value: pendientesNov.length, sub: "novedades pendientes", href: "/dashboard/inventario", color: getModuleColor("inventario"), alert: pendientesNov.length > 0 },
      { key: "conteo", label: "Conteo", value: enProcesoNov.length, sub: "en proceso", href: "/dashboard/conteo/contar", color: getModuleColor("conteo") },
    ] : []),
    ...(needsTienda ? [
      { key: "creados", label: "Creados", value: tiendaCreados.length, sub: "esperan transporte", href: "/dashboard/tienda", color: getModuleColor("tienda"), alert: tiendaRechazados.length > 0 },
      { key: "recogidos", label: "Recogidos", value: tiendaRecogidos.length, sub: "en tránsito CEDI", href: "/dashboard/tienda", color: getModuleColor("transporte") },
      { key: "cedi", label: "En CEDI", value: tiendaCedi.length, sub: "listos para guardado/envío", href: "/dashboard/tienda", color: getModuleColor("transporte"), alert: pendientesGuardado.length > 0 },
    ] : []),
    ...(needsGuardados ? [
      { key: "guardados", label: "Guardados", value: guardadosPend.length, sub: "pendientes despacho", href: "/dashboard/transporte", color: getModuleColor("transporte"), alert: vencidas.length + proximas.length > 0 },
    ] : []),
    ...(needsIntegracion ? [
      { key: "integracion", label: "Integración", value: "OVDM", sub: "picking coordinado", href: "/dashboard/integracion", color: getModuleColor("integracion") },
    ] : []),
  ];
  const prioridades = [
    ...tiendaRechazados.slice(0, 2).map((d) => ({ id: `rech-${d.id}`, label: d.numeroDocumento, sub: `${d.clienteNombre} · corregir y re-enviar`, href: "/dashboard/tienda", color: "var(--error)", badge: "Rechazado", level: "error" as const })),
    ...tiendaNovedad.slice(0, 2).map((d) => ({ id: `nov-t-${d.id}`, label: d.numeroDocumento, sub: `${d.clienteNombre} · revisar novedad`, href: "/dashboard/tienda", color: "var(--warning)", badge: "Novedad", level: "warning" as const })),
    ...pendientesGuardado.slice(0, 3).map((p) => ({ id: `pg-${p.id}`, label: p.despacho?.numeroDocumento ?? "Pendiente de guardado", sub: p.despacho ? `${p.despacho.clienteNombre} · asignado a guardado` : "Pendiente asignado", href: "/dashboard/transporte", color: getModuleColor("transporte"), badge: "Guardar", level: "info" as const })),
    ...vencidas.slice(0, 2).map((g) => ({ id: `ven-${g.clientId}`, label: g.documento, sub: `${g.ubicacion} · fecha vencida`, href: "/dashboard/transporte", color: "var(--error)", badge: "Vencida", level: "error" as const })),
    ...pendientesNov.slice(0, 2).map((n) => ({ id: `nov-${n.id}`, label: `PLU ${n.plu}`, sub: `${n.descripcion ?? "Sin descripción"} · ${n.posicion}`, href: "/dashboard/inventario", color: getModuleColor("inventario"), badge: "Pendiente", level: "warning" as const })),
  ];

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

      {!loading && flowStages.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionHeader title="Flujo operativo" />
          <OperationFlow stages={flowStages} isMobile={isMobile} />
        </div>
      )}

      {!loading && (
        <div style={{ marginBottom: 28 }}>
          <SectionHeader title="Prioridades de hoy" />
          <PriorityList items={prioridades} emptyText="Sin bloqueos visibles para tu rol." />
        </div>
      )}

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
                href="/dashboard/inventario"
              />
            )}
            {tiendaRechazados.length > 0 && (
              <AlertItem
                level="critical"
                text={`${tiendaRechazados.length} despacho${tiendaRechazados.length !== 1 ? "s" : ""} de tienda rechazado${tiendaRechazados.length !== 1 ? "s" : ""}`}
                sub="Tienda debe corregir y re-enviar"
                href="/dashboard/tienda"
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
            {showPendientesGuardado && (
              <AlertItem
                level="warning"
                text={`${pendientesGuardado.length} despacho${pendientesGuardado.length !== 1 ? "s" : ""} de tienda pendiente${pendientesGuardado.length !== 1 ? "s" : ""} por guardar`}
                sub={pendientesGuardado.slice(0, 2).map((p) => p.despacho?.numeroDocumento).filter(Boolean).join(" · ")}
                href="/dashboard/transporte"
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: isMobile ? 14 : 20, padding: "0 2px" }}>

            {/* Inventario */}
            {needsNovedades && !needsGuardados && (
              <>
                <Stat value={pendientesNov.length} label="Novedades pendientes"
                  color={pendientesNov.length > 0 ? "var(--error)" : "var(--success)"}
                  onClick={() => { window.location.href = "/dashboard/inventario"; }} />
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
                <Stat value={tiendaCreados.length} label="Creados tienda"
                  color={tiendaPend.length > 0 ? "var(--warning)" : "var(--success)"}
                  onClick={() => { window.location.href = "/dashboard/tienda"; }} />
                <Stat value={tiendaCedi.length} label="En CEDI"
                  color={tiendaCedi.length > 0 ? getModuleColor("transporte") : "var(--success)"} />
                <Stat value={tiendaRechazados.length + tiendaNovedad.length} label="Bloqueados"
                  color={(tiendaRechazados.length + tiendaNovedad.length) > 0 ? "var(--error)" : "var(--success)"} />
                <Stat value={tiendaDesp.length} label="Enviados cliente"
                  color="var(--success)" />
              </>
            )}

            {/* OPERADOR legacy: mezcla de ambas áreas */}
            {needsNovedades && needsGuardados && (
              <>
                <Stat value={pendientesNov.length} label="Novedades pendientes"
                  color={pendientesNov.length > 0 ? "var(--error)" : "var(--success)"}
                  onClick={() => { window.location.href = "/dashboard/inventario"; }} />
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

      <Link href="/dashboard/preoperacional" style={{ textDecoration: "none" }}>
      <div className="ds-card lift" style={{ padding: 28, cursor: "pointer" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <ShieldCheck size={21} color={getModuleColor("preoperacional")} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Preoperacional
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
          Tu acceso operativo se concentrará en la inspección preoperacional del vehículo.
        </p>
      </div>
      </Link>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ROUTER POR ROL — página raíz del dashboard
// ════════════════════════════════════════════════════════════
function ControlLogisticoDashboard({ nombre }: { nombre: string }) {
  const isMobile = useIsMobile();
  const [data, setData] = useState<ControlLogisticoResumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/control-logistico/resumen")
      .then((res) => res.json())
      .then((json) => { if (active && json.success) setData(json); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || !data) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: 1180 }}>
        <div className="skeleton" style={{ height: 176, borderRadius: 14, marginBottom: 18 }} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr .8fr", gap: 16 }}>
          <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in control-dashboard" style={{ maxWidth: 1180 }}>
      <ControlHero nombre={nombre} resumen={data} isMobile={isMobile} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.15fr .85fr", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section className="ds-card" style={{ padding: isMobile ? 16 : 18 }}>
            <SectionHeader title="Flujo logistico CEDI" />
            <OperationFlow stages={data.flow.map((stage) => ({ ...stage, color: controlStatusColor(stage.status) }))} isMobile={isMobile} />
          </section>

          <ModuleSignalGrid modules={data.modules} isMobile={isMobile} />
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <PriorityPanel priorities={data.priorities} isMobile={isMobile} />
          <RecommendedActions actions={data.actions} isMobile={isMobile} />
        </aside>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const nombre = (session?.user?.name || "").split(" ")[0] || "";
  useEffect(() => {
    if (role === "ETIQUETADO") router.replace("/dashboard/exportaciones");
  }, [role, router]);
  if (role === "ETIQUETADO") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 14 : 28, maxWidth: 900, padding: "0 2px" }}>
        <SK /><SK /><SK /><SK />
      </div>
    );
  }
  if (session) return <ControlLogisticoDashboard nombre={nombre} />;

  // Mientras carga la sesión
  if (!session) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 14 : 28, maxWidth: 900, padding: "0 2px" }}>
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
    "OPERACIONES_MUEBLES", "OPERACIONES_GOURMET",
  ];
  if (AREA_ROLES.includes(role ?? ""))
    return <OperadorDashboard nombre={nombre} role={role!} />;

  // Dirección → vista ejecutiva global
  return <AdminDashboard nombre={nombre} />;
}

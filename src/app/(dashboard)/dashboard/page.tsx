"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Package, Truck, Route, ClipboardList, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { Stat, SkeletonStat, TimelineItem, SectionHeader } from "@/components/ui";

interface Stats {
  novedades: { total: number; pendientes: number; solucionados: number };
  transporte: { total: number; pendientes: number; despachados: number; alertas: number };
}

interface ActivityItem {
  id: string;
  action: string;
  module: string;
  details: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
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

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

function actionDot(action: string): "active" | "success" | "warning" | "error" | "default" {
  if (action === "CREATE") return "active";
  if (action === "UPDATE") return "success";
  if (action === "DELETE") return "error";
  return "default";
}

// Tarjeta de módulo — estilo Vercel project card
function ModuleCard({ href, icon, label, color, value, sub, alert }: {
  href: string; icon: React.ReactNode; label: string; color: string;
  value?: number; sub?: string; alert?: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        className="lift"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "20px",
          cursor: "pointer",
          transition: "border-color .15s, box-shadow .15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = color + "55"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: color + "14", display: "flex", alignItems: "center", justifyContent: "center", color }}>
            {icon}
          </div>
          {alert && (
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", display: "block" }} />
          )}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text)", lineHeight: 1, marginBottom: 4 }}>
          {value ?? "—"}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 14, fontSize: 12, color, fontWeight: 500 }}>
          Abrir <ArrowRight size={12} />
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const nombre = (session?.user?.name || "").split(" ")[0] || "";
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, aRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/activity?pageSize=12&page=1"),
        ]);
        if (sRes.ok) setStats(await sRes.json());
        const aJson = await aRes.json();
        if (aJson.success) setActivity(aJson.data ?? []);
      } catch { /* noop */ }
      finally { setLoading(false); }
    })();
  }, []);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  const tienePendientes = (stats?.novedades.pendientes ?? 0) > 0 || (stats?.transporte.alertas ?? 0) > 0;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 860 }}>
      {/* ── Greeting ──────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
          {saludo}{nombre ? `, ${nombre}` : ""}.
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 6, letterSpacing: "-0.01em" }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ── Banner de alerta si hay pendientes ─────────── */}
      {!loading && tienePendientes && (
        <div
          className="animate-fade-up"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.20)",
            borderRadius: 10, padding: "12px 16px",
            marginBottom: 28,
          }}
        >
          <AlertTriangle size={16} color="#F59E0B" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: "var(--text)" }}>
            <strong>
              {[
                stats?.novedades.pendientes ? `${stats.novedades.pendientes} novedad${stats.novedades.pendientes !== 1 ? "es" : ""} pendiente${stats.novedades.pendientes !== 1 ? "s" : ""}` : null,
                stats?.transporte.alertas ? `${stats.transporte.alertas} alerta${stats.transporte.alertas !== 1 ? "s" : ""} de entrega` : null,
              ].filter(Boolean).join(" · ")}
            </strong>
            {" "}requieren atención.
          </div>
        </div>
      )}

      {/* ── KPIs flotantes sin caja ─────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 32, marginBottom: 40, padding: "0 4px" }}>
        {loading ? (
          <>
            <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
          </>
        ) : (
          <>
            <Stat
              value={stats?.novedades.total ?? 0}
              label="Novedades totales"
              color="var(--brand)"
            />
            <Stat
              value={stats?.novedades.pendientes ?? 0}
              label="Sin resolver"
              color={stats?.novedades.pendientes ? "var(--error)" : "var(--success)"}
            />
            <Stat
              value={stats?.transporte.total ?? 0}
              label="Guardados activos"
              color="#0E7490"
            />
            <Stat
              value={stats?.transporte.alertas ?? 0}
              label="Alertas de entrega"
              color={stats?.transporte.alertas ? "var(--warning)" : "var(--success)"}
            />
          </>
        )}
      </div>

      {/* ── Grid: módulos + actividad ───────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 28, alignItems: "start" }}>
        {/* Módulos */}
        <div>
          <SectionHeader title="Módulos" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ModuleCard
              href="/dashboard/muebles"
              icon={<Package size={17} />}
              label="Novedades Muebles"
              color="#2563EB"
              value={stats?.novedades.total}
              sub={`${stats?.novedades.pendientes ?? 0} sin resolver`}
              alert={(stats?.novedades.pendientes ?? 0) > 0}
            />
            <ModuleCard
              href="/dashboard/transporte"
              icon={<Truck size={17} />}
              label="Guardados Transporte"
              color="#0E7490"
              value={stats?.transporte.total}
              sub={`${stats?.transporte.pendientes ?? 0} pendientes`}
              alert={(stats?.transporte.alertas ?? 0) > 0}
            />
            <ModuleCard
              href="/dashboard/logistica"
              icon={<Route size={17} />}
              label="Logística"
              color="#7C3AED"
              sub="Rutas y conductores"
            />
            <ModuleCard
              href="/dashboard/conteo"
              icon={<ClipboardList size={17} />}
              label="Conteo Cíclico"
              color="#16A34A"
              sub="Conteos de inventario"
            />
          </div>
        </div>

        {/* Timeline de actividad */}
        <div>
          <SectionHeader title="Actividad reciente" />
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0" }}>
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
              <Clock size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
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

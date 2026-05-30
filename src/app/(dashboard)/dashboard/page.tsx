"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Package, Truck, ArrowRight, AlertTriangle, CheckCircle2, Clock, Boxes, PackageCheck,
} from "lucide-react";

interface Stats {
  novedades: { total: number; pendientes: number; solucionados: number };
  transporte: { total: number; pendientes: number; despachados: number; alertas: number };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const nombre = (session?.user?.name || "").split(" ")[0] || "";
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) setStats(await res.json());
      } catch { /* noop */ }
      finally { setLoading(false); }
    })();
  }, []);

  const hoy = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  const kpis = [
    { label: "Novedades", value: stats?.novedades.total, icon: <Boxes size={16} />, color: "var(--brand)" },
    { label: "Pendientes muebles", value: stats?.novedades.pendientes, icon: <AlertTriangle size={16} />, color: "var(--red)" },
    { label: "Guardados", value: stats?.transporte.total, icon: <Package size={16} />, color: "#0e7490" },
    { label: "Pendiente despacho", value: stats?.transporte.pendientes, icon: <Clock size={16} />, color: "var(--amber)" },
  ];

  return (
    <div className="animate-fade-in">
      {/* Encabezado */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>{hoy}</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
          {nombre ? <>Hola, {nombre}.</> : "Panel de Control"}
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Resumen de tu almacén y accesos rápidos.</p>
      </div>

      {/* KPIs */}
      <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.9rem", marginBottom: "1.75rem" }}>
        {kpis.map((k, i) => (
          <div key={i} className="lift" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.1rem 1.25rem", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>{k.label}</span>
              <span style={{ display: "flex", width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", background: k.color + "18", color: k.color }}>{k.icon}</span>
            </div>
            {loading ? (
              <div className="skeleton" style={{ height: 30, width: 56 }} />
            ) : (
              <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--text)", lineHeight: 1 }}>{k.value ?? "—"}</div>
            )}
          </div>
        ))}
      </div>

      {/* Tarjetas de módulo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 stagger">
        <ModuleCard
          href="/dashboard/muebles"
          title="Novedades Muebles"
          desc="Control de incidencias de inventario e impacto económico."
          icon={<Package size={22} />}
          grad="linear-gradient(135deg, #1e40af, #3b82f6)"
          accent="var(--brand)"
          loading={loading}
          stats={[
            { label: "Total", value: stats?.novedades.total },
            { label: "Pendientes", value: stats?.novedades.pendientes, icon: <AlertTriangle size={13} />, tone: "var(--red)" },
            { label: "Solucionadas", value: stats?.novedades.solucionados, icon: <CheckCircle2 size={13} />, tone: "var(--green)" },
          ]}
        />
        <ModuleCard
          href="/dashboard/transporte"
          title="Guardados Transporte"
          desc="Despachos de clientes y costos de almacenaje."
          icon={<Truck size={22} />}
          grad="linear-gradient(135deg, #0e7490, #06b6d4)"
          accent="#0e7490"
          loading={loading}
          stats={[
            { label: "Total", value: stats?.transporte.total },
            { label: "Pendientes", value: stats?.transporte.pendientes, icon: <Clock size={13} />, tone: "var(--amber)" },
            { label: "Despachados", value: stats?.transporte.despachados, icon: <PackageCheck size={13} />, tone: "var(--green)" },
          ]}
        />
      </div>
    </div>
  );
}

interface CardStat { label: string; value?: number; icon?: React.ReactNode; tone?: string; }

function ModuleCard({ href, title, desc, icon, grad, accent, stats, loading }: {
  href: string; title: string; desc: string; icon: React.ReactNode;
  grad: string; accent: string; stats: CardStat[]; loading: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        className="lift"
        style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
          overflow: "hidden", boxShadow: "var(--shadow)", cursor: "pointer", height: "100%",
          display: "flex", flexDirection: "column",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        {/* Cabecera con gradiente */}
        <div style={{ background: grad, padding: "1.4rem 1.5rem", color: "#fff", display: "flex", alignItems: "center", gap: 13 }}>
          <span style={{ display: "flex", width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", background: "#ffffff22" }}>{icon}</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em" }}>{title}</div>
            <div style={{ fontSize: 12, color: "#ffffffcc", marginTop: 2 }}>{desc}</div>
          </div>
        </div>

        {/* Mini-stats */}
        <div style={{ padding: "1.1rem 1.5rem", display: "flex", gap: "1.5rem", flex: 1 }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                {s.icon && <span style={{ display: "flex", color: s.tone || accent }}>{s.icon}</span>}{s.label}
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 24, width: 40 }} />
              ) : (
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", color: s.tone || "var(--text)", lineHeight: 1 }}>{s.value ?? "—"}</div>
              )}
            </div>
          ))}
        </div>

        {/* Pie */}
        <div style={{ padding: "0.85rem 1.5rem", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: accent }}>
          <span>Abrir módulo</span>
          <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}

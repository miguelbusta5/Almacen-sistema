"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import type { StudioDashboardData, StudioComponent, LayoutItem } from "@/types/studio";
import { ComponentRenderer } from "@/components/studio/ComponentRenderer";

export default function StudioViewPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const canEdit = can(role, "manageStudio");

  const [dashboard, setDashboard] = useState<StudioDashboardData | null>(null);
  const [componentes, setComponentes] = useState<StudioComponent[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/studio/dashboards/${id}`);
      if (!res.ok) { router.push("/dashboard/studio"); return; }
      const d = await res.json();
      const db: StudioDashboardData = d.dashboard;
      setDashboard(db);
      setComponentes(db.componentes as StudioComponent[]);
      setLayout(db.layout as LayoutItem[]);
      setLoading(false);
    }
    load();
  }, [id, router]);

  if (loading || !dashboard) {
    return <div style={{ padding: 40, color: "var(--muted)" }}>Cargando…</div>;
  }

  // Calcular altura del lienzo basándonos en el layout
  const maxY = layout.reduce((acc, l) => Math.max(acc, l.y + l.h), 0);
  const ROW_HEIGHT = 80;
  const GAP = 10;
  const canvasHeight = maxY * ROW_HEIGHT + (maxY + 1) * GAP + 40;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface2)" }}>
      {/* Top bar */}
      <div style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <Link href="/dashboard/studio" style={{ textDecoration: "none" }}>
          <button style={{ padding: "5px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "transparent", color: "var(--muted2)" }}>
            ← Studio
          </button>
        </Link>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)", flex: 1 }}>
          {dashboard.nombre}
        </h1>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 4,
          background: dashboard.estado === "PUBLICADO" ? "var(--success-tint)" : "var(--warning-tint)",
          color: dashboard.estado === "PUBLICADO" ? "var(--success)" : "var(--warning)",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {dashboard.estado}
        </span>
        {canEdit && (
          <Link href={`/dashboard/studio/${id}/edit`} style={{ textDecoration: "none" }}>
            <button style={{ padding: "6px 14px", fontSize: 12, border: "none", borderRadius: 6, cursor: "pointer", background: "var(--brand)", color: "#fff" }}>
              Editar
            </button>
          </Link>
        )}
      </div>

      {/* Canvas view-only */}
      <div style={{ padding: 20, minHeight: canvasHeight, position: "relative" }}>
        {componentes.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--muted)", fontSize: 13 }}>
            Este dashboard no tiene componentes aún.
          </div>
        ) : (
          <div style={{ position: "relative", width: "100%", minHeight: canvasHeight }}>
            {componentes.map((comp) => {
              const l = layout.find((li) => li.i === comp.id);
              if (!l) return null;
              const COLS = 12;
              const containerWidth = typeof window !== "undefined" ? window.innerWidth - 40 - 20 : 900;
              const colWidth = (containerWidth - GAP * (COLS + 1)) / COLS;
              const left = l.x * colWidth + (l.x + 1) * GAP;
              const top = l.y * ROW_HEIGHT + (l.y + 1) * GAP;
              const width = l.w * colWidth + (l.w - 1) * GAP;
              const height = l.h * ROW_HEIGHT + (l.h - 1) * GAP;

              return (
                <div
                  key={comp.id}
                  style={{ position: "absolute", left, top, width, height }}
                >
                  <ComponentRenderer component={comp} readOnly />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

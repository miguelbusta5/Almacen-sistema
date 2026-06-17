"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CediPage, CediEmpty } from "@/components/ui/cedi";
import { can } from "@/lib/permissions";
import type { StudioDashboardData } from "@/types/studio";

export default function StudioPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const canManage = can(role, "manageStudio");

  const [dashboards, setDashboards] = useState<StudioDashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/studio/dashboards");
      if (res.ok) {
        const d = await res.json();
        setDashboards(d.dashboards ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!nombre.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Error al crear"); return; }
      router.push(`/dashboard/studio/${d.dashboard.id}/edit`);
    } catch {
      setError("Error de red");
    } finally {
      setCreating(false);
    }
  }

  return (
    <CediPage
      title="Studio"
      description={loading ? "Cargando…" : `${dashboards.length} dashboard${dashboards.length !== 1 ? "s" : ""}`}
      actions={
        canManage ? (
          <button
            onClick={() => setShowForm(true)}
            className="ds-btn ds-btn-primary"
          >
            + Nuevo dashboard
          </button>
        ) : undefined
      }
    >
      {showForm && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 500,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)", borderRadius: 14, padding: 28, width: 400,
              border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, marginBottom: 16 }}>Nuevo dashboard</h2>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder="Nombre del dashboard"
              style={{
                width: "100%", padding: "10px 12px", fontSize: 14,
                border: "1px solid var(--border)", borderRadius: 8,
                background: "var(--surface2)", marginBottom: 12, boxSizing: "border-box",
              }}
            />
            {error && <p style={{ color: "#EF4444", fontSize: 12, marginBottom: 8 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} className="ds-btn">Cancelar</button>
              <button onClick={handleCreate} disabled={creating} className="ds-btn ds-btn-primary">
                {creating ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, color: "var(--muted)" }}>Cargando dashboards…</div>
      ) : dashboards.length === 0 ? (
        <CediEmpty
          title="Sin dashboards"
          description={canManage ? 'Crea tu primer dashboard con el botón "+ Nuevo dashboard".' : "No hay dashboards disponibles aún."}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
            padding: "16px 0",
          }}
        >
          {dashboards.map((d) => (
            <div
              key={d.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{d.nombre}</h3>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 7px",
                    borderRadius: 4,
                    background: d.estado === "PUBLICADO" ? "#DCFCE7" : "#FEF3C7",
                    color: d.estado === "PUBLICADO" ? "#16A34A" : "#D97706",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {d.estado}
                </span>
              </div>
              {d.descripcion && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{d.descripcion}</p>
              )}
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
                {d.fuentes.length} fuente{d.fuentes.length !== 1 ? "s" : ""} ·{" "}
                {(d.componentes as unknown[]).length} componente{(d.componentes as unknown[]).length !== 1 ? "s" : ""} ·{" "}
                {new Date(d.updatedAt).toLocaleDateString("es-CO")}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Link href={`/dashboard/studio/${d.id}/view`} style={{ textDecoration: "none", flex: 1 }}>
                  <button style={{ width: "100%", padding: "7px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "transparent", color: "var(--foreground)" }}>
                    Ver
                  </button>
                </Link>
                {canManage && (
                  <Link href={`/dashboard/studio/${d.id}/edit`} style={{ textDecoration: "none", flex: 1 }}>
                    <button style={{ width: "100%", padding: "7px", fontSize: 12, border: "none", borderRadius: 6, cursor: "pointer", background: "var(--brand)", color: "#fff" }}>
                      Editar
                    </button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </CediPage>
  );
}

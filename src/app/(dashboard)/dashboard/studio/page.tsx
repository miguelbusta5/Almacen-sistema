"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CediPage, CediEmpty } from "@/components/ui/cedi";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui";
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
      kicker="Constructor de dashboards"
      moduleKey="studio"
      description={loading ? "Cargando…" : `${dashboards.length} dashboard${dashboards.length !== 1 ? "s" : ""}`}
      actions={
        canManage ? (
          <button onClick={() => setShowForm(true)} className="g-btn g-btn-primary">
            + Nuevo dashboard
          </button>
        ) : undefined
      }
    >
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nuevo dashboard"
        subtitle="Crea un tablero en blanco para empezar a construir."
        size="sm"
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="g-btn g-btn-secondary">Cancelar</button>
            <button onClick={handleCreate} disabled={creating} className="g-btn g-btn-primary">
              {creating ? "Creando…" : "Crear"}
            </button>
          </>
        }
      >
        <Field label="Nombre del dashboard" error={error ?? undefined} required>
          <Input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder="Ej. Indicadores logística"
            error={!!error}
          />
        </Field>
      </Modal>

      {loading ? (
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 150, borderRadius: 12 }} />
          ))}
        </div>
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
          }}
        >
          {dashboards.map((d) => (
            <div key={d.id} className="g-panel lift" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{d.nombre}</h3>
                <Badge
                  label={d.estado}
                  variant={d.estado === "PUBLICADO" ? "success" : "warning"}
                  dot={false}
                />
              </div>
              {d.descripcion && (
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)" }}>{d.descripcion}</p>
              )}
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
                {d.fuentes.length} fuente{d.fuentes.length !== 1 ? "s" : ""} ·{" "}
                {(d.componentes as unknown[]).length} componente{(d.componentes as unknown[]).length !== 1 ? "s" : ""} ·{" "}
                {new Date(d.updatedAt).toLocaleDateString("es-CO")}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Link href={`/dashboard/studio/${d.id}/view`} style={{ textDecoration: "none", flex: 1 }}>
                  <button className="g-btn g-btn-secondary" style={{ width: "100%" }}>Ver</button>
                </Link>
                {canManage && (
                  <Link href={`/dashboard/studio/${d.id}/edit`} style={{ textDecoration: "none", flex: 1 }}>
                    <button className="g-btn g-btn-primary" style={{ width: "100%" }}>Editar</button>
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

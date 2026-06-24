"use client";

import { Bell } from "lucide-react";
import { EmptyState, TimelineItem } from "@/components/ui";

export interface NotificacionItem {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  leida: boolean;
  enlace: string | null;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Ahora";
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  return `${dias} d`;
}

/**
 * Dropdown anclado en desktop, panel ancho-completo en móvil (mismo umbral
 * que el resto del DS: 640px). Solo lectura — no marca como leída, no llama
 * a ningún endpoint de escritura (eso es Fase C2).
 */
export function ActivityCenterPanel({
  open,
  notifications,
  totalNoLeidas,
  loading,
  isMobile,
  onNavigate,
}: {
  open: boolean;
  notifications: NotificacionItem[];
  totalNoLeidas: number;
  loading: boolean;
  isMobile: boolean;
  onNavigate: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="ds-card animate-scale-in"
      role="dialog"
      aria-label="Centro de actividad"
      style={{
        position: isMobile ? "fixed" : "absolute",
        top: isMobile ? 60 : "calc(100% + 8px)",
        left: isMobile ? 12 : undefined,
        right: isMobile ? 12 : 0,
        width: isMobile ? "auto" : 360,
        maxWidth: isMobile ? "calc(100vw - 24px)" : 360,
        maxHeight: isMobile ? "calc(100vh - 84px)" : 440,
        zIndex: 201,
        padding: 0,
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Bell size={14} color="var(--brand)" />
          <strong style={{ fontSize: 13, color: "var(--text)" }}>Centro de actividad</strong>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: totalNoLeidas > 0 ? "var(--brand)" : "var(--muted)", fontFamily: "var(--mono)" }}>
          {totalNoLeidas} sin leer
        </span>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: notifications.length > 0 ? "6px 6px" : 0 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Cargando…</div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={22} />}
            title="Sin notificaciones"
            description="No tienes notificaciones pendientes por ahora."
          />
        ) : (
          <div className="ds-timeline">
            {notifications.map((n) => {
              const content = (
                <TimelineItem
                  title={n.titulo}
                  meta={n.descripcion ?? undefined}
                  time={timeAgo(n.createdAt)}
                  dot={n.leida ? "default" : "active"}
                />
              );
              if (!n.enlace) {
                return <div key={n.id} style={{ padding: "2px 6px" }}>{content}</div>;
              }
              return (
                <a
                  key={n.id}
                  href={n.enlace}
                  onClick={onNavigate}
                  style={{ display: "block", padding: "2px 6px", textDecoration: "none", borderRadius: 8, cursor: "pointer" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {content}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

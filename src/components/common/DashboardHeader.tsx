"use client";

import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";

export function DashboardHeader() {
  const { data: session } = useSession();

  return (
    <header
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "0.75rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>
        {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand)", boxShadow: "0 0 0 3px var(--brand-tint)" }} className="animate-pulse-dot" />
          Online
        </div>
        <div style={{ fontSize: 12, color: "var(--muted2)", fontWeight: 600 }}>
          Hola, {session?.user?.name?.split(" ")[0] ?? "Usuario"} 👋
        </div>
      </div>
    </header>
  );
}

"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { useIsMobile } from "@/lib/useIsMobile";

interface HeaderProps {
  user?: { name?: string | null; email?: string | null };
}

export default function Header({ user }: HeaderProps) {
  const isMobile = useIsMobile();

  return (
    <header
      className="theme-tr"
      style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: isMobile ? "0 1rem 0 3.6rem" : "0 1.5rem", height: 56, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100, flexShrink: 0, gap: "0.75rem",
      }}
    >
      {isMobile ? (
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
          MATEC <span style={{ color: "var(--blue)" }}>CEDI</span>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--mono)", textTransform: "capitalize", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexShrink: 0 }}>
        {!isMobile && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{user?.name || "Usuario"}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{user?.email}</div>
          </div>
        )}

        <ThemeToggle />

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Cerrar sesión"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9,
            padding: isMobile ? "0.45rem" : "0.45rem 0.85rem", fontSize: 12, fontWeight: 600,
            color: "var(--muted2)", cursor: "pointer", fontFamily: "var(--sans)",
          }}
        >
          <LogOut size={14} />{!isMobile && "Salir"}
        </button>
      </div>
    </header>
  );
}

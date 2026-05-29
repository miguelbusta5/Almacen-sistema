"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  user?: { name?: string | null; email?: string | null };
}

export default function Header({ user }: HeaderProps) {
  return (
    <header
      className="theme-tr"
      style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "0 1.5rem", height: 56, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100, flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--mono)", textTransform: "capitalize" }}>
        {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{user?.name || "Usuario"}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{user?.email}</div>
        </div>

        <ThemeToggle />

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9,
            padding: "0.45rem 0.85rem", fontSize: 12, fontWeight: 600,
            color: "var(--muted2)", cursor: "pointer", fontFamily: "var(--sans)",
          }}
        >
          <LogOut size={14} />Salir
        </button>
      </div>
    </header>
  );
}

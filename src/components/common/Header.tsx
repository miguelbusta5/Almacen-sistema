"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { useIsMobile } from "@/lib/useIsMobile";

interface HeaderProps {
  user?: { name?: string | null; email?: string | null };
}

export default function Header({ user }: HeaderProps) {
  const isMobile = useIsMobile();

  return (
    <header
      className="theme-tr glass"
      style={{
        borderBottom: "1px solid var(--border)",
        padding: isMobile ? "0 1rem 0 3.6rem" : "0 1.75rem",
        height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100, flexShrink: 0, gap: "0.75rem",
      }}
    >
      {/* Izquierda */}
      {isMobile ? (
        <Logo variant="auto" height={17} />
      ) : (
        <div style={{ fontSize: 13, color: "var(--muted)", letterSpacing: "-0.01em", textTransform: "capitalize" }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      )}

      {/* Derecha */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
        {!isMobile && user?.name && (
          <div style={{ textAlign: "right", marginRight: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {user.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
              {user.email}
            </div>
          </div>
        )}

        <ThemeToggle />

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Cerrar sesión"
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: isMobile ? "0.42rem" : "0.42rem 0.8rem",
            fontSize: 12, fontWeight: 500,
            color: "var(--muted2)", cursor: "pointer",
            fontFamily: "var(--sans)",
            transition: "background .15s, color .15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface3)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.color = "var(--muted2)"; }}
        >
          <LogOut size={13} />{!isMobile && "Salir"}
        </button>
      </div>
    </header>
  );
}

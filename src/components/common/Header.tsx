"use client";

import { signOut } from "next-auth/react";
import { LogOut, ChevronDown } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { useIsMobile } from "@/lib/useIsMobile";
import { useState } from "react";

interface HeaderProps {
  user?: { name?: string | null; email?: string | null };
}

function UserInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: "var(--brand-grad)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, color: "#fff",
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export default function Header({ user }: HeaderProps) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const userName = user?.name ?? "Usuario";

  return (
    <header
      className="glass"
      style={{
        borderBottom: "1px solid var(--border)",
        padding: isMobile ? "0 12px 0 56px" : "0 32px",
        height: 48,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100, flexShrink: 0,
      }}
    >
      {/* Izquierda: fecha o logo en móvil */}
      {isMobile ? (
        <Logo variant="auto" height={16} />
      ) : (
        <div style={{ fontSize: 13, color: "var(--muted)", letterSpacing: "-0.01em" }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      )}

      {/* Derecha: acciones */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ThemeToggle />

        {/* User menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: menuOpen ? "var(--surface2)" : "transparent",
              border: "1px solid transparent",
              borderColor: menuOpen ? "var(--border-strong)" : "transparent",
              borderRadius: 8, padding: "3px 8px 3px 4px",
              cursor: "pointer",
              transition: "all .12s ease",
            }}
            onMouseEnter={(e) => {
              if (!menuOpen) (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
            }}
            onMouseLeave={(e) => {
              if (!menuOpen) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <UserInitials name={userName} />
            {!isMobile && (
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userName}
              </span>
            )}
            <ChevronDown size={13} color="var(--muted)" style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>

          {menuOpen && (
            <>
              <div
                onClick={() => setMenuOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 200 }}
              />
              <div
                className="ds-card animate-scale-in"
                style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  minWidth: 200, zIndex: 201, padding: "4px",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                {/* Info de usuario */}
                <div style={{ padding: "8px 10px 8px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{userName}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 1 }}>{user?.email}</div>
                </div>
                {/* Cerrar sesión */}
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", background: "none", border: "none",
                    borderRadius: 6, fontSize: 13, color: "var(--error)",
                    cursor: "pointer", textAlign: "left",
                    transition: "background .1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--error-tint)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <LogOut size={14} />Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

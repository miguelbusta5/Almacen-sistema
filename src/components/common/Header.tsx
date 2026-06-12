"use client";

import { signOut } from "next-auth/react";
import { LogOut, ChevronDown, Search, Bell, Activity } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { useIsMobile } from "@/lib/useIsMobile";
import { useEffect, useState } from "react";
import { useCommandPalette } from "@/contexts/CommandPaletteContext";
import Link from "next/link";
import { getVisibleModules, ROLE_LABEL_EXT, type AppRole } from "@/lib/modulePermissions";

interface HeaderProps {
  user?: { name?: string | null; email?: string | null; role?: string | null };
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
  const role = user?.role ?? undefined;
  const roleLabel = role ? (ROLE_LABEL_EXT[role as AppRole] ?? role) : "Sin rol";
  const visibleModules = getVisibleModules(role);
  const scopeLabel = visibleModules.length <= 2
    ? visibleModules.map((m) => m.replace("-", " ")).join(" · ") || "Operación"
    : `${visibleModules.length} módulos`;
  const { open: openPalette } = useCommandPalette();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    async function fetchNotif() {
      try {
        const res = await fetch("/api/notificaciones?unread=true");
        const json = await res.json();
        if (json.success) setNotifCount(json.totalNoLeidas ?? 0);
      } catch { /* noop */ }
    }
    fetchNotif();
    const id = setInterval(fetchNotif, 60_000); // polling 1min
    return () => clearInterval(id);
  }, []);

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)", boxShadow: "0 0 0 3px var(--brand-tint)" }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, lineHeight: 1 }}>
              <span style={{ fontSize: 11, color: "var(--muted2)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Torre CEDI
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 10, fontWeight: 700 }}>
                <Activity size={10} />{roleLabel}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: "-0.01em", marginTop: 3 }}>
              {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {scopeLabel}
            </div>
          </div>
        </div>
      )}

      {/* Derecha: acciones */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Botón Ctrl+K */}
        {!isMobile && (
          <button
            onClick={openPalette}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 12px",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              cursor: "pointer",
              color: "var(--muted)",
              fontSize: 12,
              fontFamily: "var(--sans)",
              transition: "background .12s, border-color .12s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface3)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
          >
            <Search size={12} />
            <span>Comando CEDI</span>
            <kbd style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontFamily: "var(--mono)", color: "var(--faint)" }}>Ctrl K</kbd>
          </button>
        )}
        {isMobile && (
          <button
            onClick={openPalette}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 7, cursor: "pointer", color: "var(--muted)", display: "flex" }}
          >
            <Search size={15} />
          </button>
        )}
        {/* Campana de notificaciones */}
        <Link href="/dashboard/mis-tareas" style={{ position: "relative", textDecoration: "none", display: "flex", alignItems: "center" }}>
          <button
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 7, cursor: "pointer", color: "var(--muted)", display: "flex", transition: "background .12s" }}
            title="Mis tareas"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface3)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
          >
            <Bell size={15} />
          </button>
          {notifCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, background: "var(--error)", color: "#fff", fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)" }}>
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </Link>
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

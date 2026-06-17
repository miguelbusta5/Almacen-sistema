"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, ChevronDown, Clock3, LogOut, Search, ShieldCheck, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { useIsMobile } from "@/lib/useIsMobile";
import { useCommandPalette } from "@/contexts/CommandPaletteContext";
import { getVisibleModules, ROLE_LABEL_EXT, type AppRole } from "@/lib/modulePermissions";
import { PRODUCT } from "@/config/product";

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
      width: 30,
      height: 30,
      borderRadius: 10,
      background: "var(--brand)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 11,
      fontWeight: 800,
      color: "#fff",
      flexShrink: 0,
      boxShadow: "0 8px 18px rgba(37,99,235,0.20)",
    }}>
      {initials}
    </div>
  );
}

export default function Header({ user }: HeaderProps) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const { open: openPalette } = useCommandPalette();
  const [notifCount, setNotifCount] = useState(0);

  const userName = user?.name ?? "Usuario";
  const role = user?.role ?? undefined;
  const roleLabel = role ? (ROLE_LABEL_EXT[role as AppRole] ?? role) : "Sin rol";
  const visibleModules = getVisibleModules(role);
  const scopeLabel = visibleModules.length <= 2
    ? visibleModules.map((m) => m.replace("-", " ")).join(" / ") || "Operacion"
    : `${visibleModules.length} modulos visibles`;

  useEffect(() => {
    async function fetchNotif() {
      try {
        const res = await fetch("/api/notificaciones?unread=true");
        const json = await res.json();
        if (json.success) setNotifCount(json.totalNoLeidas ?? 0);
      } catch {
        // No bloquear el shell por notificaciones.
      }
    }
    fetchNotif();
    const id = setInterval(fetchNotif, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="glass"
      style={{
        borderBottom: "1px solid var(--border)",
        padding: isMobile ? "0 12px 0 58px" : "0 28px",
        minHeight: isMobile ? 54 : 62,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        flexShrink: 0,
        boxShadow: "0 8px 22px rgba(15,23,42,0.055)",
      }}
    >
      {isMobile ? (
        <Logo variant="auto" height={16} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--brand)", boxShadow: "0 0 0 4px var(--brand-tint)" }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, lineHeight: 1 }}>
              <span style={{ fontSize: 11, color: "var(--muted2)", fontWeight: 850, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                {PRODUCT.displayName}
              </span>
              <span className="op-status-band" style={{ minHeight: 24, padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, color: "var(--brand)", background: "var(--brand-tint)" }}>
                <Wifi size={11} />{PRODUCT.statusLabel}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              {roleLabel} / {scopeLabel} / {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {!isMobile && (
          <button
            onClick={openPalette}
            className="op-action"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              height: 36,
              padding: "0 12px",
              cursor: "pointer",
              color: "var(--muted2)",
              fontSize: 12,
              fontFamily: "var(--sans)",
            }}
          >
            <Search size={14} />
            <span>{PRODUCT.commandLabel}</span>
            <kbd style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 5, padding: "1px 6px", fontSize: 10, fontFamily: "var(--mono)", color: "var(--muted)" }}>Ctrl K</kbd>
          </button>
        )}
        {isMobile && (
          <button onClick={openPalette} className="op-action" style={{ width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--muted)" }}>
            <Search size={15} />
          </button>
        )}

        <Link href="/dashboard/mis-tareas" style={{ position: "relative", textDecoration: "none", display: "flex", alignItems: "center" }}>
          <button className="op-action" style={{ width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--muted)" }} title="Mis tareas">
            <Bell size={15} />
          </button>
          {notifCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, background: "var(--error)", color: "#fff", fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)" }}>
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </Link>
        <ThemeToggle />

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="op-action"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "3px 9px 3px 4px",
              cursor: "pointer",
              background: menuOpen ? "var(--surface2)" : "var(--surface)",
            }}
          >
            <UserInitials name={userName} />
            {!isMobile && (
              <span style={{ fontSize: 13, fontWeight: 650, color: "var(--text)", maxWidth: 128, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userName}
              </span>
            )}
            <ChevronDown size={13} color="var(--muted)" style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>

          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
              <div
                className="ds-card animate-scale-in"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  minWidth: 230,
                  zIndex: 201,
                  padding: 6,
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                <div style={{ padding: "10px 11px", borderBottom: "1px solid var(--border)", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 800, color: "var(--text)" }}>
                    <ShieldCheck size={14} color="var(--brand)" />{userName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                    <Clock3 size={11} />{user?.email}
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: "none",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--error)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--error-tint)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <LogOut size={14} />Cerrar sesion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

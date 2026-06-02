"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Home, Package, Truck, Users, ScrollText, Route, ClipboardList } from "lucide-react";
import { useIsMobile } from "@/lib/useIsMobile";
import Logo from "./Logo";

interface SidebarProps { role?: string; }
interface NavLink { href: string; label: string; icon: React.ReactNode; }

const links: NavLink[] = [
  { href: "/dashboard",                   label: "Inicio",      icon: <Home size={16} /> },
  { href: "/dashboard/muebles",           label: "Muebles",     icon: <Package size={16} /> },
  { href: "/dashboard/transporte",        label: "Transporte",  icon: <Truck size={16} /> },
  { href: "/dashboard/logistica/mi-ruta", label: "Mi ruta",     icon: <Route size={16} /> },
  { href: "/dashboard/conteo/contar",     label: "Contar",      icon: <ClipboardList size={16} /> },
];
const gestionLinks: NavLink[] = [
  { href: "/dashboard/logistica", label: "Logística", icon: <Route size={16} /> },
  { href: "/dashboard/conteo",    label: "Conteo",    icon: <ClipboardList size={16} /> },
];
const adminLinks: NavLink[] = [
  { href: "/dashboard/usuarios",  label: "Usuarios",  icon: <Users size={16} /> },
  { href: "/dashboard/auditoria", label: "Auditoría", icon: <ScrollText size={16} /> },
];

const W = 200; // sidebar width px

// Fondo del sidebar — muy oscuro, casi negro, como Linear
const SIDE_BG = "#0D0F14";
const SIDE_BORDER = "rgba(255,255,255,0.05)";

export default function Sidebar({ role }: SidebarProps) {
  const path = usePathname();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);

  const linksVisibles = role === "TRANSPORTISTA"
    ? links.filter((l) => l.href === "/dashboard/logistica/mi-ruta")
    : links;

  const isActive = (href: string) =>
    href === "/dashboard" ? path === href : path.startsWith(href);

  const Item = ({ l, onNav }: { l: NavLink; onNav?: () => void }) => {
    const active = isActive(l.href);
    return (
      <Link href={l.href} onClick={onNav} style={{ textDecoration: "none", display: "block", padding: "1px 8px" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: active ? 500 : 400,
            color: active ? "#FFFFFF" : "rgba(255,255,255,0.45)",
            background: active ? "rgba(255,255,255,0.09)" : "transparent",
            transition: "all .12s ease",
            position: "relative",
          }}
          onMouseEnter={(e) => {
            if (!active) {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
            }
          }}
          onMouseLeave={(e) => {
            if (!active) {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
            }
          }}
        >
          {/* Indicador activo — punto azul a la izquierda */}
          {active && (
            <span style={{
              position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)",
              width: 3, height: 16, borderRadius: 2,
              background: "#3B82F6",
            }} />
          )}
          <span style={{ color: active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.30)", display: "flex", flexShrink: 0 }}>
            {l.icon}
          </span>
          {l.label}
        </div>
      </Link>
    );
  };

  const SectionDivider = ({ label }: { label: string }) => (
    <div style={{
      padding: "12px 18px 4px",
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.22)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ flex: 1, height: 1, background: SIDE_BORDER }} />
      {label}
      <span style={{ flex: 1, height: 1, background: SIDE_BORDER }} />
    </div>
  );

  const NavContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav style={{ flex: 1, padding: "6px 0", overflowY: "auto" }}>
        {linksVisibles.map((l) => <Item key={l.href} l={l} onNav={onNav} />)}

        {(role === "GERENTE" || role === "ADMIN") && (
          <>
            <SectionDivider label="Ops" />
            {gestionLinks.map((l) => <Item key={l.href} l={l} onNav={onNav} />)}
          </>
        )}

        {role === "ADMIN" && (
          <>
            <SectionDivider label="Admin" />
            {adminLinks.map((l) => <Item key={l.href} l={l} onNav={onNav} />)}
          </>
        )}
      </nav>

      {/* Footer con versión */}
      <div style={{
        padding: "12px 16px",
        borderTop: `1px solid ${SIDE_BORDER}`,
        fontSize: 11,
        color: "rgba(255,255,255,0.18)",
        fontFamily: "var(--mono)",
      }}>
        v2.1 · Grupo Ambiente
      </div>
    </>
  );

  const Brand = () => (
    <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${SIDE_BORDER}` }}>
      <Logo variant="dark" height={17} tagline />
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          style={{
            position: "fixed", top: 10, left: 12, zIndex: 300,
            width: 34, height: 34, borderRadius: 8, border: "none",
            background: "rgba(13,15,20,0.90)",
            backdropFilter: "blur(8px)",
            color: "rgba(255,255,255,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        >
          <Menu size={17} />
        </button>

        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.50)",
              zIndex: 400,
              backdropFilter: "blur(3px)",
              animation: "fade-in .2s ease",
            }}
          />
        )}

        <aside style={{
          position: "fixed", top: 0, left: 0, height: "100vh", width: W,
          background: SIDE_BG,
          display: "flex", flexDirection: "column",
          zIndex: 401,
          transform: open ? "translateX(0)" : "translateX(-110%)",
          transition: "transform .26s cubic-bezier(.16,1,.3,1)",
          boxShadow: open ? "4px 0 32px rgba(0,0,0,0.5)" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ flex: 1 }}><Brand /></div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "18px 12px 0" }}
            >
              <X size={18} />
            </button>
          </div>
          <NavContent onNav={() => setOpen(false)} />
        </aside>
      </>
    );
  }

  return (
    <aside style={{
      width: W, background: SIDE_BG, display: "flex", flexDirection: "column",
      position: "sticky", top: 0, height: "100vh", flexShrink: 0,
    }}>
      <Brand />
      <NavContent />
    </aside>
  );
}

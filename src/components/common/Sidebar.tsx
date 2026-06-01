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
  { href: "/dashboard",                       label: "Inicio",    icon: <Home size={17} /> },
  { href: "/dashboard/muebles",               label: "Muebles",   icon: <Package size={17} /> },
  { href: "/dashboard/transporte",            label: "Transporte",icon: <Truck size={17} /> },
  { href: "/dashboard/logistica/mi-ruta",     label: "Mi ruta",   icon: <Route size={17} /> },
  { href: "/dashboard/conteo/contar",         label: "Contar",    icon: <ClipboardList size={17} /> },
];
const gestionLinks: NavLink[] = [
  { href: "/dashboard/logistica", label: "Logística", icon: <Route size={17} /> },
  { href: "/dashboard/conteo",    label: "Conteo",    icon: <ClipboardList size={17} /> },
];
const adminLinks: NavLink[] = [
  { href: "/dashboard/usuarios",  label: "Usuarios",  icon: <Users size={17} /> },
  { href: "/dashboard/auditoria", label: "Auditoría", icon: <ScrollText size={17} /> },
];

const SIDEBAR_W = 224;

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
      <Link href={l.href} onClick={onNav} style={{ textDecoration: "none", display: "block", padding: "2px 8px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.6rem",
          padding: "0.5rem 0.75rem", borderRadius: 10,
          fontSize: 14, fontWeight: active ? 600 : 400,
          color: active ? "#ffffff" : "rgba(255,255,255,0.6)",
          background: active ? "rgba(255,255,255,0.15)" : "transparent",
          transition: "background .15s ease, color .15s ease",
        }}
          onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; } }}
          onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; } }}
        >
          <span style={{ color: active ? "#ffffff" : "rgba(255,255,255,0.5)", display: "flex", flexShrink: 0 }}>{l.icon}</span>
          {l.label}
        </div>
      </Link>
    );
  };

  const SectionLabel = ({ text }: { text: string }) => (
    <div style={{ padding: "0.75rem 1.25rem 0.25rem", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
      {text}
    </div>
  );

  const NavLinks = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav style={{ flex: 1, padding: "0.5rem 0", overflowY: "auto" }}>
        {linksVisibles.map((l) => <Item key={l.href} l={l} onNav={onNav} />)}

        {(role === "GERENTE" || role === "ADMIN") && (
          <>
            <SectionLabel text="Operaciones" />
            {gestionLinks.map((l) => <Item key={l.href} l={l} onNav={onNav} />)}
          </>
        )}

        {role === "ADMIN" && (
          <>
            <SectionLabel text="Administración" />
            {adminLinks.map((l) => <Item key={l.href} l={l} onNav={onNav} />)}
          </>
        )}
      </nav>

      <div style={{ padding: "1rem 1.25rem 1.25rem", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--mono)", letterSpacing: "0.02em" }}>
        v2.1 · Grupo Ambiente
      </div>
    </>
  );

  const Brand = () => (
    <div style={{ padding: "1.4rem 1.25rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <Logo variant="dark" height={18} tagline />
    </div>
  );

  const sidebarBg = "linear-gradient(180deg, #0f1629 0%, #0a1020 100%)";

  // ── MÓVIL ──
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          style={{
            position: "fixed", top: 10, left: 12, zIndex: 300,
            width: 36, height: 36, borderRadius: 9, border: "none",
            background: "rgba(15,22,41,0.92)", backdropFilter: "blur(10px)",
            color: "rgba(255,255,255,0.85)", display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
        >
          <Menu size={18} />
        </button>

        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 400, backdropFilter: "blur(4px)" }}
          />
        )}

        <aside style={{
          position: "fixed", top: 0, left: 0, height: "100vh", width: SIDEBAR_W,
          background: sidebarBg, display: "flex", flexDirection: "column",
          zIndex: 401,
          transform: open ? "translateX(0)" : "translateX(-105%)",
          transition: "transform .28s cubic-bezier(.16,1,.3,1)",
          boxShadow: open ? "4px 0 40px rgba(0,0,0,0.4)" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "0 0.5rem 0 0" }}>
            <div style={{ flex: 1 }}><Brand /></div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar"
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "1.4rem 0.75rem 0" }}>
              <X size={20} />
            </button>
          </div>
          <NavLinks onNav={() => setOpen(false)} />
        </aside>
      </>
    );
  }

  // ── ESCRITORIO ──
  return (
    <aside style={{
      width: SIDEBAR_W, background: sidebarBg, display: "flex", flexDirection: "column",
      position: "sticky", top: 0, height: "100vh", flexShrink: 0,
    }}>
      <Brand />
      <NavLinks />
    </aside>
  );
}

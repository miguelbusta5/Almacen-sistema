"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Home, Package, Truck, Users, ScrollText, Route } from "lucide-react";
import { useIsMobile } from "@/lib/useIsMobile";
import Logo from "./Logo";

interface SidebarProps {
  role?: string;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const links: NavLink[] = [
  { href: "/dashboard", label: "Inicio", icon: <Home size={18} /> },
  { href: "/dashboard/muebles", label: "Muebles", icon: <Package size={18} /> },
  { href: "/dashboard/transporte", label: "Transporte", icon: <Truck size={18} /> },
  { href: "/dashboard/logistica", label: "Logística", icon: <Route size={18} /> },
  { href: "/dashboard/logistica/mi-ruta", label: "Mi ruta", icon: <Truck size={18} /> },
];
const adminLinks: NavLink[] = [
  { href: "/dashboard/usuarios", label: "Usuarios", icon: <Users size={18} /> },
  { href: "/dashboard/auditoria", label: "Auditoría", icon: <ScrollText size={18} /> },
];

const INK = "#0a1326";

export default function Sidebar({ role }: SidebarProps) {
  const path = usePathname();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);

  const Item = ({ l, onNav }: { l: NavLink; onNav?: () => void }) => {
    const active = path === l.href;
    return (
      <Link href={l.href} onClick={onNav} style={{ textDecoration: "none" }}>
        <div
          style={{
            position: "relative", display: "flex", alignItems: "center", gap: "0.7rem",
            padding: "0.65rem 1.1rem", margin: "0.15rem 0.7rem", borderRadius: 11,
            fontSize: 14, fontWeight: 600,
            color: active ? "#fff" : "#93a3be",
            background: active ? "#1d4ed826" : "transparent",
            transition: "color .15s, background .15s",
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "#dbe3f0"; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "#93a3be"; }}
        >
          {active && (
            <span aria-hidden style={{ position: "absolute", left: -2, top: "50%", transform: "translateY(-50%)", width: 4, height: 22, borderRadius: 4, background: "var(--brand-grad)" }} />
          )}
          <span style={{ display: "flex", color: active ? "#60a5fa" : "inherit" }}>{l.icon}</span>
          {l.label}
        </div>
      </Link>
    );
  };

  const NavLinks = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav style={{ flex: 1, padding: "0.75rem 0" }}>
        {links.map((l) => <Item key={l.href} l={l} onNav={onNav} />)}
        {role === "ADMIN" && (
          <>
            <div style={{ padding: "1rem 1.25rem 0.35rem", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3a4a6b" }}>
              Administración
            </div>
            {adminLinks.map((l) => <Item key={l.href} l={l} onNav={onNav} />)}
          </>
        )}
      </nav>
      <div style={{ padding: "1rem 1.4rem", borderTop: "1px solid #1b2742", fontSize: 10, color: "#3a4a6b", fontFamily: "var(--mono)" }}>
        v2.0 · Grupo Ambiente
      </div>
    </>
  );

  const Brand = () => (
    <div style={{ padding: "0.25rem 1.25rem 1.3rem", borderBottom: "1px solid #1b2742" }}>
      <Logo variant="dark" height={20} tagline />
    </div>
  );

  // ── MÓVIL ──
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          style={{
            position: "fixed", top: 10, left: 12, zIndex: 300,
            width: 38, height: 38, borderRadius: 10, border: "none",
            background: INK, color: "#fff", display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 2px 10px #0a132688",
          }}
        >
          <Menu size={20} />
        </button>

        {open && (
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "#0a132699", zIndex: 400, backdropFilter: "blur(2px)" }} />
        )}

        <aside style={{
          position: "fixed", top: 0, left: 0, height: "100vh", width: 248,
          background: INK, display: "flex", flexDirection: "column",
          padding: "1.5rem 0 0", zIndex: 401,
          transform: open ? "translateX(0)" : "translateX(-105%)",
          transition: "transform .25s ease", boxShadow: open ? "4px 0 28px #0a1326aa" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "0 0.5rem 0 0" }}>
            <div style={{ flex: 1 }}><Brand /></div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar menú" style={{ background: "none", border: "none", color: "#93a3be", cursor: "pointer", padding: "0 0.75rem" }}><X size={22} /></button>
          </div>
          <NavLinks onNav={() => setOpen(false)} />
        </aside>
      </>
    );
  }

  // ── ESCRITORIO ──
  return (
    <aside style={{
      width: 232, background: INK, display: "flex", flexDirection: "column",
      padding: "1.5rem 0 0", position: "sticky", top: 0, height: "100vh", flexShrink: 0,
    }}>
      <Brand />
      <NavLinks />
    </aside>
  );
}

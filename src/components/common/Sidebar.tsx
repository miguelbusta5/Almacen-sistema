"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useIsMobile } from "@/lib/useIsMobile";

interface SidebarProps {
  role?: string;
}

const links = [
  { href: "/dashboard",            label: "Inicio",     icon: "🏠" },
  { href: "/dashboard/muebles",    label: "Muebles",    icon: "📦" },
  { href: "/dashboard/transporte", label: "Transporte", icon: "🚛" },
];
const adminLinks = [
  { href: "/dashboard/usuarios",   label: "Usuarios",   icon: "👥" },
  { href: "/dashboard/auditoria",  label: "Auditoría",  icon: "📋" },
];

export default function Sidebar({ role }: SidebarProps) {
  const path = usePathname();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Cerrar el drawer al navegar
  useEffect(() => { setOpen(false); }, [path]);

  const NavLinks = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav style={{ flex: 1, padding: "1rem 0" }}>
        {links.map(l => (
          <Link key={l.href} href={l.href} onClick={onNav} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.7rem 1.25rem", margin: "0.1rem 0.75rem", borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              color: path === l.href ? "#fff" : "#94a3b8",
              background: path === l.href ? "#1e293b" : "transparent", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 17 }}>{l.icon}</span>{l.label}
            </div>
          </Link>
        ))}
        {role === "ADMIN" && (
          <>
            <div style={{ padding: "0.75rem 1.25rem 0.25rem", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#334155" }}>Administración</div>
            {adminLinks.map(l => (
              <Link key={l.href} href={l.href} onClick={onNav} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.7rem 1.25rem", margin: "0.1rem 0.75rem", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  color: path === l.href ? "#fff" : "#94a3b8",
                  background: path === l.href ? "#1e293b" : "transparent",
                }}>
                  <span style={{ fontSize: 17 }}>{l.icon}</span>{l.label}
                </div>
              </Link>
            ))}
          </>
        )}
      </nav>
      <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #1e293b", fontSize: 10, color: "#334155", fontFamily: "DM Mono, monospace" }}>
        v2.0.0 · Next.js
      </div>
    </>
  );

  const Brand = () => (
    <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: "1px solid #1e293b" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#475569", marginBottom: 4 }}>Sistema de gestión</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Almacén <span style={{ color: "#38bdf8" }}>/</span></div>
    </div>
  );

  // ── MÓVIL: botón hamburguesa + drawer deslizable ──
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          style={{
            position: "fixed", top: 10, left: 12, zIndex: 300,
            width: 38, height: 38, borderRadius: 9, border: "none",
            background: "#0f172a", color: "#fff", display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 2px 8px #0f172a55",
          }}
        >
          <Menu size={20} />
        </button>

        {/* Backdrop */}
        {open && (
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "#0f172a99", zIndex: 400 }} />
        )}

        {/* Drawer */}
        <aside style={{
          position: "fixed", top: 0, left: 0, height: "100vh", width: 240,
          background: "#0f172a", display: "flex", flexDirection: "column",
          padding: "1.25rem 0", zIndex: 401,
          transform: open ? "translateX(0)" : "translateX(-105%)",
          transition: "transform .25s ease", boxShadow: open ? "4px 0 24px #0f172a66" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0.75rem 0 0" }}>
            <div style={{ flex: 1 }}><Brand /></div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar menú" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "0 0.75rem", marginBottom: "1.5rem" }}><X size={22} /></button>
          </div>
          <NavLinks onNav={() => setOpen(false)} />
        </aside>
      </>
    );
  }

  // ── ESCRITORIO: sidebar fija ──
  return (
    <aside style={{
      width: 220, background: "#0f172a", display: "flex", flexDirection: "column",
      padding: "1.5rem 0", position: "sticky", top: 0, height: "100vh", flexShrink: 0,
    }}>
      <Brand />
      <NavLinks />
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  role?: string;
}

const links = [
  { href: "/dashboard",            label: "Inicio",        icon: "🏠" },
  { href: "/dashboard/muebles",    label: "Muebles",       icon: "📦" },
  { href: "/dashboard/transporte", label: "Transporte",    icon: "🚛" },
];

const adminLinks = [
  { href: "/dashboard/usuarios",   label: "Usuarios",      icon: "👥" },
];

export default function Sidebar({ role }: SidebarProps) {
  const path = usePathname();

  return (
    <aside style={{
      width: 220, background: "#0f172a", display: "flex", flexDirection: "column",
      padding: "1.5rem 0", position: "sticky", top: 0, height: "100vh", flexShrink: 0
    }}>
      {/* Brand */}
      <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: "1px solid #1e293b" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "#475569", marginBottom: 4 }}>
          Sistema de gestión
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
          Almacén <span style={{ color: "#38bdf8" }}>/</span>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: "1rem 0" }}>
        {links.map(l => (
          <Link key={l.href} href={l.href} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.65rem 1.25rem", margin: "0.1rem 0.75rem",
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              color: path === l.href ? "#fff" : "#94a3b8",
              background: path === l.href ? "#1e293b" : "transparent",
              transition: "all 0.15s"
            }}>
              <span style={{ fontSize: 16 }}>{l.icon}</span>
              {l.label}
            </div>
          </Link>
        ))}

        {role === "ADMIN" && (
          <>
            <div style={{ padding: "0.75rem 1.25rem 0.25rem",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#334155" }}>
              Administración
            </div>
            {adminLinks.map(l => (
              <Link key={l.href} href={l.href} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.65rem 1.25rem", margin: "0.1rem 0.75rem",
                  borderRadius: 10, fontSize: 13, fontWeight: 600,
                  color: path === l.href ? "#fff" : "#94a3b8",
                  background: path === l.href ? "#1e293b" : "transparent"
                }}>
                  <span style={{ fontSize: 16 }}>{l.icon}</span>
                  {l.label}
                </div>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Version */}
      <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #1e293b",
        fontSize: 10, color: "#334155", fontFamily: "DM Mono, monospace" }}>
        v2.0.0 · Next.js
      </div>
    </aside>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Package, Truck, LayoutDashboard, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",           label: "Inicio",      icon: LayoutDashboard },
  { href: "/dashboard/muebles",   label: "Muebles",     icon: Package,  color: "var(--blue)"   },
  { href: "/dashboard/transporte",label: "Transporte",  icon: Truck,    color: "var(--orange)" },
];

const adminItems = [
  { href: "/dashboard/usuarios",  label: "Usuarios",    icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <aside
      style={{
        width: 220,
        background: "var(--text)",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #1e293b",
        flexShrink: 0,
      }}
      className="hidden md:flex"
    >
      {/* Logo */}
      <div style={{ padding: "1.5rem 1.25rem", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#38bdf820", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={16} color="#38bdf8" />
          </div>
          <div>
            <div style={{ color: "#ffffff", fontWeight: 800, fontSize: 13, letterSpacing: "-0.01em" }}>Almacén</div>
            <div style={{ color: "#38bdf8", fontWeight: 800, fontSize: 13, letterSpacing: "-0.01em" }}>/ Inventarios</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#475569", padding: "0.5rem 0.5rem 0.25rem" }}>
          Módulos
        </div>

        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.6rem 0.75rem",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "#ffffff" : "#94a3b8",
                background: active ? "#1e293b" : "transparent",
                transition: "background .15s, color .15s",
              }}
              className="hover:bg-slate-800 hover:text-white"
            >
              <Icon size={16} color={active ? (item.color || "#38bdf8") : "#64748b"} />
              {item.label}
              {active && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: item.color || "#38bdf8" }} />}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#475569", padding: "1rem 0.5rem 0.25rem", marginTop: "0.5rem" }}>
              Administración
            </div>
            {adminItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0.6rem 0.75rem",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#ffffff" : "#94a3b8",
                    background: active ? "#1e293b" : "transparent",
                  }}
                  className="hover:bg-slate-800 hover:text-white"
                >
                  <Icon size={16} color={active ? "#a78bfa" : "#64748b"} />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User + Logout */}
      <div style={{ padding: "1rem 0.75rem", borderTop: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {session?.user?.name ?? "Usuario"}
            </div>
            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "var(--mono)" }}>
              {session?.user?.role ?? "OPERADOR"}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 12,
            color: "#64748b",
            fontFamily: "var(--sans)",
          }}
          className="hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

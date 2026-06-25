"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CheckSquare,
  FileText,
  GitMerge,
  Home,
  Menu,
  Package,
  ScanLine,
  ScrollText,
  ShieldCheck,
  Store,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useIsMobile } from "@/lib/useIsMobile";
import Logo from "./Logo";
import { canSeeModule, type ModuleKey } from "@/lib/modulePermissions";
import { getModuleCssVars } from "@/lib/moduleTheme";
import { PRODUCT } from "@/config/product";

interface SidebarProps {
  role?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  moduleKey: ModuleKey | null;
}

const ALL_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: <Home size={16} strokeWidth={2.1} />, moduleKey: null },
  { href: "/dashboard/mis-tareas", label: "Mis Tareas", icon: <CheckSquare size={16} strokeWidth={2.1} />, moduleKey: "mis-tareas" },
  { href: "/dashboard/preoperacional", label: "Preoperacional", icon: <ShieldCheck size={16} strokeWidth={2.1} />, moduleKey: "preoperacional" },
  { href: "/dashboard/inventario", label: "Novedades Inventario", icon: <Package size={16} strokeWidth={2.1} />, moduleKey: "inventario" },
  { href: "/dashboard/tienda", label: "Facturas Contado", icon: <Store size={16} strokeWidth={2.1} />, moduleKey: "tienda" },
  { href: "/dashboard/integracion", label: "Integracion Pedidos", icon: <GitMerge size={16} strokeWidth={2.1} />, moduleKey: "integracion" },
  { href: "/dashboard/cargue-gourmet", label: "Cargue Gourmet", icon: <ScanLine size={16} strokeWidth={2.1} />, moduleKey: "cargue-gourmet" },
  { href: "/dashboard/exportaciones", label: "Exportaciones", icon: <Tags size={16} strokeWidth={2.1} />, moduleKey: "exportaciones" },
  { href: "/dashboard/solicitudes-transporte", label: "Solicitudes Transporte", icon: <FileText size={16} strokeWidth={2.1} />, moduleKey: "solicitudes-transporte" },
  { href: "/dashboard/transporte", label: "Guardados", icon: <Truck size={16} strokeWidth={2.1} />, moduleKey: "transporte" },
  { href: "/dashboard/centro-control", label: "Centro de Control", icon: <BarChart3 size={16} strokeWidth={2.1} />, moduleKey: "centro-control" },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: <Users size={16} strokeWidth={2.1} />, moduleKey: "usuarios" },
  { href: "/dashboard/auditoria", label: "Auditoria", icon: <ScrollText size={16} strokeWidth={2.1} />, moduleKey: "auditoria" },
];

const GROUPS = [
  ["/dashboard", "/dashboard/mis-tareas", "/dashboard/preoperacional"],
  [
    "/dashboard/inventario",
    "/dashboard/tienda",
    "/dashboard/integracion",
    "/dashboard/cargue-gourmet",
    "/dashboard/exportaciones",
    "/dashboard/solicitudes-transporte",
    "/dashboard/transporte",
  ],
  ["/dashboard/centro-control"],
  ["/dashboard/usuarios", "/dashboard/auditoria"],
];

const W = 240;

export default function Sidebar({ role }: SidebarProps) {
  const path = usePathname();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);

  const visibleItems = ALL_ITEMS.filter((item) =>
    item.moduleKey === null ? true : canSeeModule(role, item.moduleKey)
  );

  const isActive = (href: string) =>
    href === "/dashboard" ? path === href : path.startsWith(href);

  const Item = ({ item, onNav }: { item: NavItem; onNav?: () => void }) => {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={onNav}
        className={`g-nav-item${active ? " active" : ""}`}
        style={getModuleCssVars(item.moduleKey ?? "home") as React.CSSProperties}
      >
        <span className="g-nav-icon">{item.icon}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.label}
        </span>
      </Link>
    );
  };

  const NavContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav className="g-sidebar-nav">
        {GROUPS.map((group, gi) => {
          const groupItems = group
            .map((href) => visibleItems.find((i) => i.href === href))
            .filter(Boolean) as NavItem[];
          if (groupItems.length === 0) return null;
          return (
            <div key={gi} className="g-nav-group">
              {groupItems.map((item) => <Item key={item.href} item={item} onNav={onNav} />)}
            </div>
          );
        })}
      </nav>

      <div className="g-sidebar-footer">
        <div style={{ fontSize: 11, color: "var(--faint)", fontFamily: "var(--mono)" }}>
          {PRODUCT.version} · {PRODUCT.environmentLabel}
        </div>
      </div>
    </>
  );

  const Brand = () => (
    <div className="g-sidebar-brand">
      <Logo variant="auto" height={18} tagline />
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--faint)", letterSpacing: "0.03em" }}>
        Control logístico CEDI
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          style={{
            position: "fixed", top: 10, left: 12, zIndex: 300,
            width: 36, height: 36, borderRadius: "var(--r)",
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--brand)", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", boxShadow: "var(--shadow-sm)",
          }}
        >
          <Menu size={17} />
        </button>
        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 400, backdropFilter: "blur(4px)" }}
          />
        )}
        <aside
          className="g-sidebar"
          style={{
            position: "fixed", top: 0, left: 0, zIndex: 401,
            transform: open ? "translateX(0)" : "translateX(-110%)",
            transition: "transform .26s cubic-bezier(.16,1,.3,1)",
            boxShadow: open ? "var(--shadow-lg)" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ flex: 1 }}><Brand /></div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: "18px 14px 0", flexShrink: 0 }}
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
    <aside className="g-sidebar">
      <Brand />
      <NavContent />
    </aside>
  );
}

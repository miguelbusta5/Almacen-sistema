"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CheckSquare,
  ClipboardList,
  FileText,
  GitMerge,
  Home,
  Menu,
  Package,
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
import { getModuleTheme } from "@/lib/moduleTheme";
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
  { href: "/dashboard", label: "Inicio", icon: <Home size={16} />, moduleKey: null },
  { href: "/dashboard/mis-tareas", label: "Mis Tareas", icon: <CheckSquare size={16} />, moduleKey: "mis-tareas" },
  { href: "/dashboard/preoperacional", label: "Preoperacional", icon: <ShieldCheck size={16} />, moduleKey: "preoperacional" },
  { href: "/dashboard/inventario", label: "Novedades Inventario", icon: <Package size={16} />, moduleKey: "inventario" },
  { href: "/dashboard/conteo/contar", label: "Contar", icon: <ClipboardList size={16} />, moduleKey: "conteo-contar" },
  { href: "/dashboard/tienda", label: "Facturas Contado", icon: <Store size={16} />, moduleKey: "tienda" },
  { href: "/dashboard/integracion", label: "Integración Pedidos", icon: <GitMerge size={16} />, moduleKey: "integracion" },
  { href: "/dashboard/exportaciones", label: "Exportaciones", icon: <Tags size={16} />, moduleKey: "exportaciones" },
  { href: "/dashboard/solicitudes-transporte", label: "Solicitudes Transporte", icon: <FileText size={16} />, moduleKey: "solicitudes-transporte" },
  { href: "/dashboard/transporte", label: "Guardados", icon: <Truck size={16} />, moduleKey: "transporte" },
  { href: "/dashboard/conteo", label: "Conteo", icon: <ClipboardList size={16} />, moduleKey: "conteo" },
  { href: "/dashboard/centro-control", label: "Centro de Control", icon: <BarChart3 size={16} />, moduleKey: "centro-control" },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: <Users size={16} />, moduleKey: "usuarios" },
  { href: "/dashboard/auditoria", label: "Auditoría", icon: <ScrollText size={16} />, moduleKey: "auditoria" },
];

const SECTIONS = [
  { label: "Control operativo", items: ["/dashboard", "/dashboard/mis-tareas", "/dashboard/preoperacional"] },
  {
    label: "Operación CEDI",
    items: [
      "/dashboard/inventario",
      "/dashboard/tienda",
      "/dashboard/integracion",
      "/dashboard/exportaciones",
      "/dashboard/solicitudes-transporte",
      "/dashboard/transporte",
      "/dashboard/conteo/contar",
    ],
  },
  { label: "Supervisión", items: ["/dashboard/conteo", "/dashboard/centro-control"] },
  { label: "Gobierno", items: ["/dashboard/usuarios", "/dashboard/auditoria"] },
];

const W = 244;
const SIDE_BG = "linear-gradient(180deg, #07111E 0%, #0A1628 48%, #08111F 100%)";
const SIDE_BORDER = "rgba(255,255,255,0.075)";

export default function Sidebar({ role }: SidebarProps) {
  const path = usePathname();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  const visibleItems = ALL_ITEMS.filter((item) =>
    item.moduleKey === null ? true : canSeeModule(role, item.moduleKey)
  );

  const isActive = (href: string) =>
    href === "/dashboard" ? path === href : path.startsWith(href);

  const Item = ({ item, onNav }: { item: NavItem; onNav?: () => void }) => {
    const active = isActive(item.href);
    const theme = getModuleTheme(item.moduleKey ?? "home");
    return (
      <Link href={item.href} onClick={onNav} title={theme.description} style={{ textDecoration: "none", display: "block", padding: "2px 10px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "9px 11px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: active ? 750 : 520,
            color: active ? "#FFFFFF" : "rgba(255,255,255,0.56)",
            background: active ? `linear-gradient(90deg, ${theme.color}24, rgba(255,255,255,0.08))` : "transparent",
            boxShadow: active ? `inset 0 0 0 1px ${theme.color}44, 0 8px 18px rgba(0,0,0,0.16)` : "none",
            transition: "all .12s ease",
            position: "relative",
          }}
          onMouseEnter={(e) => {
            if (!active) {
              e.currentTarget.style.background = "rgba(255,255,255,0.055)";
              e.currentTarget.style.color = "rgba(255,255,255,0.78)";
            }
          }}
          onMouseLeave={(e) => {
            if (!active) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.56)";
            }
          }}
        >
          {active && <span style={{ position: "absolute", left: -10, top: 8, bottom: 8, width: 3, borderRadius: 2, background: theme.color }} />}
          <span style={{ color: active ? theme.color : "rgba(255,255,255,0.36)", display: "flex", flexShrink: 0 }}>
            {item.icon}
          </span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
          {active && item.moduleKey && (
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.color, boxShadow: `0 0 0 3px ${theme.color}24`, flexShrink: 0 }} />
          )}
        </div>
      </Link>
    );
  };

  const SectionDivider = ({ label }: { label: string }) => (
    <div style={{ padding: "14px 20px 6px", fontSize: 10, fontWeight: 800, letterSpacing: "0.11em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ flex: 1, height: 1, background: SIDE_BORDER }} />
      {label}
      <span style={{ flex: 1, height: 1, background: SIDE_BORDER }} />
    </div>
  );

  const NavContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav style={{ flex: 1, padding: "6px 0", overflowY: "auto" }}>
        {SECTIONS.map((section) => {
          const sectionItems = section.items
            .map((href) => visibleItems.find((i) => i.href === href))
            .filter(Boolean) as NavItem[];
          if (sectionItems.length === 0) return null;
          return (
            <div key={section.label}>
              <SectionDivider label={section.label} />
              {sectionItems.map((item) => <Item key={item.href} item={item} onNav={onNav} />)}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: "12px 14px", borderTop: `1px solid ${SIDE_BORDER}` }}>
        <div className="op-command-surface" style={{ borderRadius: 12, padding: "11px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.66)", fontFamily: "var(--mono)" }}>{PRODUCT.version}</span>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,0.16)" }} />
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.36)", fontFamily: "var(--mono)" }}>
            {PRODUCT.shortName} · {PRODUCT.environmentLabel}
          </div>
        </div>
      </div>
    </>
  );

  const Brand = () => (
    <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${SIDE_BORDER}` }}>
      <Logo variant="dark" height={18} tagline />
      <div style={{ marginTop: 13, padding: "9px 10px", borderRadius: 12, background: "rgba(255,255,255,0.055)", border: `1px solid ${SIDE_BORDER}` }}>
        <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Control operativo
        </div>
        <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, marginTop: 2 }}>
          Inventario · Tienda · Transporte
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button onClick={() => setOpen(true)} aria-label="Abrir menú"
          style={{ position: "fixed", top: 10, left: 12, zIndex: 300, width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,17,31,0.94)", backdropFilter: "blur(8px)", color: "rgba(255,255,255,0.82)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.35)" }}>
          <Menu size={17} />
        </button>
        {open && (
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.50)", zIndex: 400, backdropFilter: "blur(3px)" }} />
        )}
        <aside style={{ position: "fixed", top: 0, left: 0, height: "100vh", width: W, background: SIDE_BG, display: "flex", flexDirection: "column", zIndex: 401, transform: open ? "translateX(0)" : "translateX(-110%)", transition: "transform .26s cubic-bezier(.16,1,.3,1)", boxShadow: open ? "4px 0 32px rgba(0,0,0,0.5)" : "none" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ flex: 1 }}><Brand /></div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "18px 12px 0" }}><X size={18} /></button>
          </div>
          <NavContent onNav={() => setOpen(false)} />
        </aside>
      </>
    );
  }

  return (
    <aside style={{ width: W, background: SIDE_BG, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
      <Brand />
      <NavContent />
    </aside>
  );
}

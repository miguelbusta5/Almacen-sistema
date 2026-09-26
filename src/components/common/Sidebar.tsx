"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChartColumnIncreasing,
  ClipboardCheck,
  FileText,
  Forklift,
  GitMerge,
  Globe,
  Hammer,
  Home,
  
  Menu,
  PackageOpen,
  Container,
  ClipboardList,
  PackageSearch,
  ScanLine,
  ScrollText,
  SlidersHorizontal,
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
  { href: "/dashboard/stretch-film", label: "Stretch film", icon: <PackageOpen size={16} />, moduleKey: "stretch-film" },
  { href: "/dashboard/inventarios", label: "Inventarios", icon: <ClipboardCheck size={16} />, moduleKey: "inventarios" },
  { href: "/dashboard/capacidad-picking", label: "Capacidad picking", icon: <PackageSearch size={16} />, moduleKey: "capacidad-picking" },
  { href: "/dashboard", label: "Inicio", icon: <Home size={16} strokeWidth={2.1} />, moduleKey: null },
  { href: "/dashboard/tienda", label: "Facturas Contado", icon: <Store size={16} strokeWidth={2.1} />, moduleKey: "tienda" },
  { href: "/dashboard/integracion", label: "Integracion Pedidos", icon: <GitMerge size={16} strokeWidth={2.1} />, moduleKey: "integracion" },
  { href: "/dashboard/cargue-gourmet", label: "Cargue Gourmet", icon: <ScanLine size={16} strokeWidth={2.1} />, moduleKey: "cargue-gourmet" },
  { href: "/dashboard/cargue-camiones", label: "Cargue de camiones", icon: <Truck size={16} strokeWidth={2.1} />, moduleKey: "cargue-camiones" },
  { href: "/dashboard/picking-muebles", label: "Picking Muebles", icon: <Hammer size={16} strokeWidth={2.1} />, moduleKey: "picking-muebles" },
  { href: "/dashboard/inspeccion-muebles", label: "Inspeccion Muebles", icon: <ClipboardCheck size={16} strokeWidth={2.1} />, moduleKey: "inspeccion-muebles" },
  { href: "/dashboard/entrega-muebles", label: "Entrega a Transporte", icon: <Truck size={16} strokeWidth={2.1} />, moduleKey: "entrega-muebles" },
  { href: "/dashboard/historial-muebles", label: "Historial Muebles", icon: <ScrollText size={16} strokeWidth={2.1} />, moduleKey: "historial-muebles" },
  { href: "/dashboard/admin-muebles", label: "Admin Muebles", icon: <SlidersHorizontal size={16} strokeWidth={2.1} />, moduleKey: "admin-muebles" },
  { href: "/dashboard/control-montacargas", label: "Control Montacargas", icon: <Forklift size={16} strokeWidth={2.1} />, moduleKey: "control-montacargas" },
  { href: "/dashboard/resurtido", label: "Resurtido", icon: <PackageOpen size={16} strokeWidth={2.1} />, moduleKey: "resurtido" },
  { href: "/dashboard/recepcion-contenedores", label: "Recepcion Contenedores", icon: <Container size={16} strokeWidth={2.1} />, moduleKey: "recepcion-contenedores" },
  { href: "/dashboard/montaje-resurtido", label: "Montaje Resurtido", icon: <ClipboardList size={16} strokeWidth={2.1} />, moduleKey: "montaje-resurtido" },
  { href: "/dashboard/pendientes", label: "Pendientes", icon: <PackageSearch size={16} strokeWidth={2.1} />, moduleKey: "pendientes" },
  { href: "/dashboard/tareas-generales", label: "Tareas generales", icon: <ClipboardList size={16} strokeWidth={2.1} />, moduleKey: "tareas-generales" },
  { href: "/dashboard/exportaciones", label: "Exportaciones Ecuador", icon: <Tags size={16} strokeWidth={2.1} />, moduleKey: "exportaciones" },
  { href: "/dashboard/exportaciones-mexico", label: "Exportaciones México", icon: <Globe size={16} strokeWidth={2.1} />, moduleKey: "exportaciones-mexico" },
  { href: "/dashboard/exportaciones-eeuu", label: "Exportaciones EE.UU", icon: <Globe size={16} strokeWidth={2.1} />, moduleKey: "exportaciones-eeuu" },
  { href: "/dashboard/solicitudes-transporte", label: "Solicitudes Transporte", icon: <FileText size={16} strokeWidth={2.1} />, moduleKey: "solicitudes-transporte" },
  { href: "/dashboard/transporte", label: "Guardados", icon: <Truck size={16} strokeWidth={2.1} />, moduleKey: "transporte" },
  { href: "/dashboard/indicadores", label: "Indicadores", icon: <ChartColumnIncreasing size={16} strokeWidth={2.1} />, moduleKey: "indicadores" },
  // Quien no ve Indicadores (supervision de transporte) entra directo a su area.
  { href: "/dashboard/indicadores?area=transporte", label: "Indicadores Transporte", icon: <ChartColumnIncreasing size={16} strokeWidth={2.1} />, moduleKey: "indicadores-transporte" },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: <Users size={16} strokeWidth={2.1} />, moduleKey: "usuarios" },
  { href: "/dashboard/auditoria", label: "Auditoria", icon: <ScrollText size={16} strokeWidth={2.1} />, moduleKey: "auditoria" },
];

const GROUPS = [
  ["/dashboard"],
  [
    "/dashboard/tienda",
    "/dashboard/integracion",
    "/dashboard/cargue-gourmet",
    "/dashboard/cargue-camiones",
    "/dashboard/control-montacargas",
    "/dashboard/resurtido",
    "/dashboard/recepcion-contenedores",
    "/dashboard/montaje-resurtido",
    "/dashboard/capacidad-picking",
    "/dashboard/inventarios",
    "/dashboard/stretch-film",
    "/dashboard/pendientes",
    "/dashboard/tareas-generales",
    "/dashboard/picking-muebles",
    "/dashboard/inspeccion-muebles",
    "/dashboard/entrega-muebles",
    "/dashboard/exportaciones",
    "/dashboard/exportaciones-mexico",
    "/dashboard/exportaciones-eeuu",
    "/dashboard/solicitudes-transporte",
    "/dashboard/transporte",
  ],
  ["/dashboard/indicadores"],
  // Configuracion del area, junto a Usuarios y Auditoria.
  ["/dashboard/admin-muebles", "/dashboard/usuarios", "/dashboard/auditoria"],
];

const W = 240;

export default function Sidebar({ role }: SidebarProps) {
  const path = usePathname();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [pickingAccess, setPickingAccess] = useState(false);
  const [inventariosAccess, setInventariosAccess] = useState(false);
  const [stretchAccess, setStretchAccess] = useState(false);
  useEffect(() => { fetch('/dashboard/api/me').then(r => r.ok ? r.json() : null).then(r => { setPickingAccess(r?.user?.can?.capacidadPicking === true); setStretchAccess(r?.user?.can?.stretch?.gestionar === true || r?.user?.can?.stretch?.solicitar === true); setInventariosAccess(r?.user?.can?.gestionarInventarios === true || r?.user?.can?.contarInventarios === true); }).catch(() => {}); }, []);

  useEffect(() => { setOpen(false); }, [path]);

  const visibleItems = ALL_ITEMS.filter((item) =>
    (item.moduleKey === null || canSeeModule(role, item.moduleKey)) && (item.moduleKey !== 'indicadores-transporte' || !canSeeModule(role, 'indicadores')) && (item.moduleKey !== 'capacidad-picking' || pickingAccess) && (item.moduleKey !== 'inventarios' || inventariosAccess) && (item.moduleKey !== 'stretch-film' || stretchAccess) && item.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
  );

  const isActive = (href: string) =>
    path === href || path.startsWith(href + '/');

  const Item = ({ item, onNav }: { item: NavItem; onNav?: () => void }) => {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={onNav}
        className={`g-nav-item${active ? " active" : ""}`}
        aria-current={active ? 'page' : undefined}
        style={{ ...getModuleCssVars(item.moduleKey ?? "home"), textDecoration: 'none' } as React.CSSProperties}
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
      <input aria-label="Buscar módulo" type="search" placeholder="Buscar módulo…" value={query} onChange={e => setQuery(e.target.value)} style={{ margin: '10px 12px', padding: 10, width: 'calc(100% - 24px)', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }} />
      <nav className="g-sidebar-nav" style={{ overflowX: 'hidden', scrollbarWidth: 'thin' }}>
        {GROUPS.map((group, gi) => {
          const groupItems = group
            .map((href) => visibleItems.find((i) => i.href === href))
            .filter(Boolean) as NavItem[];
          if (groupItems.length === 0) return null;
          return (
            <div key={gi} className="g-nav-group">
              <button aria-expanded={!!query || !collapsed[gi]} onClick={() => setCollapsed(c => ({ ...c, [gi]: !c[gi] }))} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 12px', background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', textAlign: 'left' }}>{['Inicio', 'Operación CEDI', 'Indicadores', 'Gestión'][gi] ?? 'Módulos'} <span>{collapsed[gi] && !query ? '+' : '−'}</span></button>
              {(query || !collapsed[gi]) && groupItems.map((item) => <Item key={item.href} item={item} onNav={onNav} />)}
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
          {NavContent({ onNav: () => setOpen(false) })}
        </aside>
      </>
    );
  }

  return (
    <aside className="g-sidebar">
      <Brand />
      {NavContent({})}
    </aside>
  );
}

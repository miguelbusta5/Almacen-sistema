import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVisibleModules, type ModuleKey } from "@/lib/modulePermissions";

// El módulo "Inicio" se retiró (se reconstruirá desde cero más adelante) — esta
// ruta ahora solo decide a qué módulo real mandar al usuario según su rol.
const MODULE_HREF: Record<ModuleKey, string> = {
  'stretch-film': '/dashboard/stretch-film',
  inventarios: '/dashboard/inventarios',
  'capacidad-picking': '/dashboard/capacidad-picking',
  tienda: "/dashboard/tienda",
  transporte: "/dashboard/transporte",
  integracion: "/dashboard/integracion",
  "cargue-gourmet": "/dashboard/cargue-gourmet",
  "control-montacargas": "/dashboard/control-montacargas",
  resurtido: "/dashboard/resurtido",
  "recepcion-contenedores": "/dashboard/recepcion-contenedores",
  "montaje-resurtido": "/dashboard/montaje-resurtido",
  pendientes: "/dashboard/pendientes",
  "tareas-generales": "/dashboard/tareas-generales",
  "entrega-muebles": "/dashboard/entrega-muebles",
  "historial-muebles": "/dashboard/historial-muebles",
  indicadores: "/dashboard/indicadores",
  exportaciones: "/dashboard/exportaciones",
  "exportaciones-mexico": "/dashboard/exportaciones-mexico",
  "exportaciones-eeuu": "/dashboard/exportaciones-eeuu",
  "solicitudes-transporte": "/dashboard/solicitudes-transporte",
  "centro-control": "/dashboard/centro-control",
  usuarios: "/dashboard/usuarios",
  auditoria: "/dashboard/auditoria",
  "picking-muebles": "/dashboard/picking-muebles",
  "inspeccion-muebles": "/dashboard/inspeccion-muebles",
  "indicadores-muebles": "/dashboard/indicadores-muebles",
  "admin-muebles": "/dashboard/admin-muebles",
  "cargue-camiones": "/dashboard/cargue-camiones",
  "indicadores-transporte": "/dashboard/indicadores?area=transporte",
};

// Mismo orden visual que el Sidebar: el primer módulo visible del rol es el
// destino del redirect.
const PRIORITY_ORDER: ModuleKey[] = [
  "tienda",
  "transporte",
  "integracion",
  "cargue-gourmet",
  "cargue-camiones",
  "recepcion-contenedores",
  "control-montacargas",
  "montaje-resurtido",
  "pendientes",
  "resurtido",
  "exportaciones",
  "exportaciones-mexico",
  "exportaciones-eeuu",
  "picking-muebles",
  "inspeccion-muebles",
  "entrega-muebles",
  "tareas-generales",
  "solicitudes-transporte",
  "indicadores",
  "indicadores-muebles",
  "indicadores-transporte",
  "historial-muebles",
  "admin-muebles",
  "centro-control",
  "usuarios",
  "auditoria",
  "inventarios",
  "capacidad-picking",
  "stretch-film",
];

export default async function DashboardHome() {
  const session = await auth();
  const role = session?.user?.role;

  const visible = new Set(getVisibleModules(role));
  // Si un modulo nuevo no se agrego a PRIORITY_ORDER, igual se entra a el: antes
  // un rol cuyo unico modulo faltaba en la lista (el Patinador Muebles) caia en
  // "sin modulos" aunque tuviera acceso.
  const firstModule =
    PRIORITY_ORDER.find((key) => visible.has(key)) ??
    [...visible].find((key) => MODULE_HREF[key]);

  if (firstModule) redirect(MODULE_HREF[firstModule]);

  redirect("/sin-modulos");
}

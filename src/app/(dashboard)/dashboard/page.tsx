import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVisibleModules, type ModuleKey } from "@/lib/modulePermissions";

// El módulo "Inicio" se retiró (se reconstruirá desde cero más adelante) — esta
// ruta ahora solo decide a qué módulo real mandar al usuario según su rol.
const MODULE_HREF: Record<ModuleKey, string> = {
  tienda: "/dashboard/tienda",
  transporte: "/dashboard/transporte",
  integracion: "/dashboard/integracion",
  "cargue-gourmet": "/dashboard/cargue-gourmet",
  "control-montacargas": "/dashboard/control-montacargas",
  resurtido: "/dashboard/resurtido",
  "recepcion-contenedores": "/dashboard/recepcion-contenedores",
  "montaje-resurtido": "/dashboard/montaje-resurtido",
  pendientes: "/dashboard/pendientes",
  indicadores: "/dashboard/indicadores",
  exportaciones: "/dashboard/exportaciones",
  "exportaciones-mexico": "/dashboard/exportaciones-mexico",
  "exportaciones-eeuu": "/dashboard/exportaciones-eeuu",
  "solicitudes-transporte": "/dashboard/solicitudes-transporte",
  preoperacional: "/dashboard/preoperacional",
  "centro-control": "/dashboard/centro-control",
  usuarios: "/dashboard/usuarios",
  auditoria: "/dashboard/auditoria",
  "picking-muebles": "/dashboard/picking-muebles",
  "inspeccion-muebles": "/dashboard/inspeccion-muebles",
};

// Mismo orden visual que el Sidebar: el primer módulo visible del rol es el
// destino del redirect.
const PRIORITY_ORDER: ModuleKey[] = [
  "tienda",
  "transporte",
  "integracion",
  "cargue-gourmet",
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
  "solicitudes-transporte",
  "preoperacional",
  "indicadores",
  "centro-control",
  "usuarios",
  "auditoria",
];

export default async function DashboardHome() {
  const session = await auth();
  const role = session?.user?.role;

  const visible = new Set(getVisibleModules(role));
  const firstModule = PRIORITY_ORDER.find((key) => visible.has(key));

  if (firstModule) redirect(MODULE_HREF[firstModule]);

  redirect("/sin-modulos");
}

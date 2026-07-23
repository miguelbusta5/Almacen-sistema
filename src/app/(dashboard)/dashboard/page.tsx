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
  exportaciones: "/dashboard/exportaciones",
  "exportaciones-mexico": "/dashboard/exportaciones-mexico",
  "exportaciones-eeuu": "/dashboard/exportaciones-eeuu",
  "solicitudes-transporte": "/dashboard/solicitudes-transporte",
  preoperacional: "/dashboard/preoperacional",
  "centro-control": "/dashboard/centro-control",
  "mapa-ciudades": "/dashboard/mapa-ciudades",
  usuarios: "/dashboard/usuarios",
  auditoria: "/dashboard/auditoria",
};

// Mismo orden visual que el Sidebar: el primer módulo visible del rol es el
// destino del redirect.
const PRIORITY_ORDER: ModuleKey[] = [
  "tienda",
  "transporte",
  "integracion",
  "cargue-gourmet",
  "exportaciones",
  "exportaciones-mexico",
  "exportaciones-eeuu",
  "solicitudes-transporte",
  "preoperacional",
  "centro-control",
  "mapa-ciudades",
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

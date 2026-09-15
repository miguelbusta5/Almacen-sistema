// Matriz de visibilidad de modulos por rol.
// CRUD vive en permissions.ts; este archivo controla UI/navegacion.

import type { UserRole } from "@/types";

export type AppRole = UserRole;

export type ModuleKey =
  | "capacidad-picking"
  | "transporte"
  | "tienda"
  | "solicitudes-transporte"
  | "exportaciones"
  | "exportaciones-mexico"
  | "exportaciones-eeuu"
  | "usuarios"
  | "auditoria"
  | "centro-control"
  | "integracion"
  | "cargue-gourmet"
  | "control-montacargas"
  | "resurtido"
  | "recepcion-contenedores"
  | "montaje-resurtido"
  | "pendientes"
  | "indicadores"
  | "picking-muebles"
  | "inspeccion-muebles"
  | "indicadores-muebles"
  | "admin-muebles";

export const MODULE_ACCESS: Record<ModuleKey, AppRole[]> = {
  "capacidad-picking": ["ADMIN", "GERENTE", "SUPERVISOR_ALMACENAMIENTO", "OPERARIO_ALMACENAMIENTO", "MONTACARGAS", "INVENTARIO", "SUPERVISOR_INVENTARIO", "OPERADOR"],
  transporte: ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN", "OPERADOR"],
  tienda: ["TIENDA", "SUPERVISOR_TIENDA", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  // Los dos roles OPERACIONES_* quedan fuera a proposito: son patinadores de area
  // y solo operan Integracion de Pedidos (+ Cargue Gourmet en el caso gourmet),
  // tal como dice ROLE_DESCRIPTION mas abajo. Esta lista tambien gobierna el
  // acceso de servidor via puedeCrear/puedeVerSolicitudTransporte.
  "solicitudes-transporte": [
    "ADMIN",
    "GERENTE",
    "OPERADOR",
    "INVENTARIO",
    "TRANSPORTE",
    "SUPERVISOR_INVENTARIO",
    "SUPERVISOR_TRANSPORTE",
    "TIENDA",
    "SUPERVISOR_TIENDA",
  ],
  exportaciones: ["ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  "exportaciones-mexico": ["ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  "exportaciones-eeuu": ["ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  usuarios: ["ADMIN"],
  // Solo ADMIN: /api/activity exige requireRole(["ADMIN"]), asi que un GERENTE
  // veia el modulo en el menu y recibia 403 al entrar.
  auditoria: ["ADMIN"],
  "centro-control": [
    "GERENTE",
    "ADMIN",
    "SUPERVISOR_INVENTARIO",
    "SUPERVISOR_TRANSPORTE",
    "SUPERVISOR_TIENDA",
    "SUPERVISOR_ALMACENAMIENTO",
  ],
  integracion: [
    "OPERACIONES_MUEBLES",
    "OPERACIONES_GOURMET",
    "ADMIN",
    "GERENTE",
    "SUPERVISOR_TRANSPORTE",
    "TRANSPORTE",
  ],
  "cargue-gourmet": [
    "ADMIN",
    "GERENTE",
    "OPERACIONES_GOURMET",
    "TRANSPORTE",
    "SUPERVISOR_TRANSPORTE",
  ],
  // Montacarguistas y quien responde por el almacenamiento. Los supervisores de
  // inventario y de transporte quedan fuera: el trabajo de montacargas no es su area.
  "control-montacargas": ["MONTACARGAS", "OPERARIO_ALMACENAMIENTO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  resurtido: ["MONTACARGAS", "OPERARIO_ALMACENAMIENTO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  // Sin MONTACARGAS a proposito: descargan el contenedor y salen en la lista
  // de personas descargando, pero la planilla la lleva siempre el operario.
  "recepcion-contenedores": ["OPERARIO_ALMACENAMIENTO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  // Ver el modulo es una cosa; montar un resurtido o asignar un pendiente es
  // otra, y esa va por permiso POR PERSONA (users.puede_montar_resurtido).
  "montaje-resurtido": ["SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  // Gourmet pide; almacenamiento asigna. Los operarios ven SUS tareas dentro
  // de Resurtido, no aqui.
  pendientes: ["OPERACIONES_GOURMET", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  // Tiempo laborado de todo el CEDI: son los numeros con los que se evalua al
  // equipo, asi que solo gestion. El servidor lo exige tambien.
  indicadores: ["SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  // Picking de muebles: el operario solo ve su propia bandeja. Los dos roles
  // OPERACIONES_* quedan fuera a proposito — coordinan Integracion, no pickean.
  "picking-muebles": ["PICKING_MUEBLES", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  // Login compartido del area: son 2 PCs para ~5 inspectores, asi que la
  // trazabilidad la da el catalogo de inspectores, no la autenticacion.
  "inspeccion-muebles": ["INSPECCION_MUEBLES", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  // Los numeros con los que se evalua al area: solo gestion. El servidor lo
  // exige tambien, como en el resto de indicadores.
  "indicadores-muebles": ["SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  // Equipos, inspectores, asignacion del dia y tipos de PLU. Solo gestion: el
  // operario no configura el area en la que trabaja.
  "admin-muebles": ["SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
};

export function canSeeModule(role: string | undefined | null, moduleKey: ModuleKey): boolean {
  if (!role) return false;
  return (MODULE_ACCESS[moduleKey] as string[] | undefined)?.includes(role) ?? false;
}

export function getVisibleModules(role: string | undefined | null): ModuleKey[] {
  if (!role) return [];
  return (Object.keys(MODULE_ACCESS) as ModuleKey[]).filter((key) => canSeeModule(role, key));
}

export const ROLE_LABEL_EXT: Record<AppRole, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  OPERADOR: "Operador (General)",
  TRANSPORTISTA: "Transportista (Conductor)",
  INVENTARIO: "Operario de Inventario",
  TRANSPORTE: "Operario de Transporte",
  SUPERVISOR_INVENTARIO: "Supervisor de Inventario",
  SUPERVISOR_TRANSPORTE: "Supervisor de Transporte",
  TIENDA: "Operario de Tienda",
  SUPERVISOR_TIENDA: "Supervisor de Tienda",
  OPERACIONES_MUEBLES: "Operaciones Muebles",
  OPERACIONES_GOURMET: "Operaciones Gourmet",
  ETIQUETADO: "Etiquetado",
  SUPERVISOR_ALMACENAMIENTO: "Supervisor de Almacenamiento",
  MONTACARGAS: "Montacarguista",
  OPERARIO_ALMACENAMIENTO: "Operario de Almacenamiento",
  PICKING_MUEBLES: "Picking Muebles",
  INSPECCION_MUEBLES: "Inspeccion Muebles",
};

export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  ADMIN: "Acceso total al sistema.",
  GERENTE: "Ve todo. Sin acceso a configuracion de sistema.",
  OPERADOR: "Acceso general a inventario y transporte.",
  TRANSPORTISTA: "Sin modulos activos (Preoperacional se retiro).",
  INVENTARIO: "Solo ve el modulo de inventario.",
  TRANSPORTE: "Solo ve guardados y pendientes asignados.",
  SUPERVISOR_INVENTARIO: "Inventario + analisis operacional.",
  SUPERVISOR_TRANSPORTE: "Facturas Contado + guardados + centro de control.",
  TIENDA: "Solo ve y gestiona Facturas Contado.",
  SUPERVISOR_TIENDA: "Tienda + analisis + Centro de Control.",
  OPERACIONES_MUEBLES: "Solo ve y gestiona el modulo Integracion de Pedidos.",
  OPERACIONES_GOURMET: "Solo ve y gestiona el modulo Integracion de Pedidos.",
  ETIQUETADO: "Solo ve y captura etiquetas de Exportaciones.",
  SUPERVISOR_ALMACENAMIENTO: "Gestiona Exportaciones, etiquetado y Estibas.",
  MONTACARGAS: "Control Montacargas y Resurtido.",
  OPERARIO_ALMACENAMIENTO: "Ayudante: recibe PLUs y los ubica.",
  PICKING_MUEBLES: "Solo ve su bandeja de picking de muebles.",
  INSPECCION_MUEBLES: "Login compartido del area de inspeccion de muebles.",
};

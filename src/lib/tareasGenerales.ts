// Tareas generales — FUENTE DE VERDAD.
//
// Lo que Felipe Ossa y Eduardo mandan a hacer y no cabe en ningun modulo:
// organizar una zona, apoyar una descarga, un aseo. La tarea se describe en
// texto libre porque es justo lo que no tiene formulario, y el valor esta en el
// tiempo: cuanto costo y quien la hizo.
//
// Se duplica en nuxt-app/server/utils/tareasGeneralesCalc.ts (Nitro no puede
// importar de src/lib). Hay un guard que compara las dos copias.

/** Quien crea, asigna y da por terminada una tarea general. */
export const ROLES_MANDAN_TAREA = ["SUPERVISOR_ALMACENAMIENTO", "ADMIN"] as const;

/** Quien puede verlas todas sin poder tocarlas. */
export const ROLES_MIRAN_TAREA = ["GERENTE"] as const;

/**
 * A quien se le puede asignar: los que trabajan en el CEDI. Tienda y
 * transportistas quedan fuera —no estan aqui— igual que los patinadores de area.
 */
export const ROLES_ASIGNABLES = [
  "OPERARIO_ALMACENAMIENTO",
  "MONTACARGAS",
  "PICKING_MUEBLES",
  "INSPECCION_MUEBLES",
  "ETIQUETADO",
  "INVENTARIO",
] as const;

export function puedeMandarTarea(role: string | null | undefined): boolean {
  return !!role && (ROLES_MANDAN_TAREA as readonly string[]).includes(role);
}

export function puedeVerTareas(role: string | null | undefined): boolean {
  return puedeMandarTarea(role) || (!!role && (ROLES_MIRAN_TAREA as readonly string[]).includes(role));
}

export function esAsignable(role: string | null | undefined): boolean {
  return !!role && (ROLES_ASIGNABLES as readonly string[]).includes(role);
}

export const MAX_DESCRIPCION = 500;

export function validarTarea(entrada: {
  descripcion: string;
  usuarioIds: readonly string[];
}): string | null {
  const texto = entrada.descripcion.trim();
  if (!texto) return "Escribe que hay que hacer";
  if (texto.length > MAX_DESCRIPCION) return `La descripcion no puede pasar de ${MAX_DESCRIPCION} caracteres`;
  if (entrada.usuarioIds.length === 0) return "Elige al menos un operario";
  if (new Set(entrada.usuarioIds).size !== entrada.usuarioIds.length) {
    return "Hay un operario repetido";
  }
  return null;
}

/**
 * Segundos que lleva (o llevo) una persona en la tarea.
 *
 * Abierta cuenta contra `ahora`: en pantalla el reloj tiene que correr, igual
 * que en el resto de modulos.
 */
export function segundosAsignado(
  a: { horaInicio: Date | string; horaFin: Date | string | null },
  ahora: number,
): number {
  const inicio = new Date(a.horaInicio).getTime();
  const fin = a.horaFin ? new Date(a.horaFin).getTime() : ahora;
  return Math.max(0, Math.round((fin - inicio) / 1000));
}

/** La tarea termina cuando ya nadie la tiene abierta. */
export function tareaTerminada(
  asignados: readonly { horaFin: Date | string | null }[],
): boolean {
  return asignados.length > 0 && asignados.every((a) => a.horaFin != null);
}

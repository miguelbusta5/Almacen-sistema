// Lógica pura del resurtido por tareas y de los pendientes de gourmet.
//
// Fuente de verdad. Se replica en nuxt-app/server/utils/resurtidoCalc.ts (Nitro)
// y nuxt-app/app/utils/resurtidoTareas.ts (Vue), que resuelven alias distintos.
import { normalizarUbicacion } from "./montacargas";

export const ESTADOS_MONTAJE = ["EN_CURSO", "COMPLETADO"] as const;
export type EstadoMontajeResurtido = (typeof ESTADOS_MONTAJE)[number];

export const ESTADOS_TAREA = ["PENDIENTE", "EN_CURSO", "COMPLETADA"] as const;
export type EstadoTareaResurtido = (typeof ESTADOS_TAREA)[number];

export const ESTADOS_PENDIENTE = [
  "SOLICITADO", "ASIGNADO", "EN_CURSO", "COMPLETADO", "DEVUELTO", "NOVEDAD",
] as const;
export type EstadoPendienteGourmet = (typeof ESTADOS_PENDIENTE)[number];

/** Quién ejecuta las tareas: los que mueven la mercancía. */
export const ROLES_EJECUTORES = ["OPERARIO_ALMACENAMIENTO", "MONTACARGAS"] as const;
/** Quién puede pedir un pendiente. */
export const ROLES_SOLICITANTES = ["OPERACIONES_GOURMET", "GERENTE", "ADMIN"] as const;
/** Quién ve los módulos de montaje y de pendientes (además del permiso propio). */
export const ROLES_ALMACENAMIENTO = [
  "SUPERVISOR_ALMACENAMIENTO",
  "GERENTE",
  "ADMIN",
] as const;

export function esEjecutor(role: string | null | undefined): boolean {
  return !!role && (ROLES_EJECUTORES as readonly string[]).includes(role);
}

export function esSolicitante(role: string | null | undefined): boolean {
  return !!role && (ROLES_SOLICITANTES as readonly string[]).includes(role);
}

export const ESTADO_TAREA_LABEL: Record<EstadoTareaResurtido, string> = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
};

export const ESTADO_PENDIENTE_LABEL: Record<EstadoPendienteGourmet, string> = {
  SOLICITADO: "Solicitado",
  ASIGNADO: "Asignado",
  EN_CURSO: "En curso",
  COMPLETADO: "Ubicado",
  DEVUELTO: "Devuelto",
  NOVEDAD: "Con novedad",
};

// ── Archivo de resurtido ─────────────────────────────────────────────
/**
 * Una fila del Excel, ya normalizada.
 *
 * El archivo trae también un NOMBRE, que se ignora a propósito: la descripción
 * sale del maestro. El nombre del archivo puede venir de una exportación vieja y
 * acabaría poniéndole al operario un producto distinto del que va a coger.
 */
export interface FilaResurtido {
  plu: string;
  altura: string;
  picking: string;
  unidadesSolicitadas: number;
}

export const CABECERAS_RESURTIDO: Record<keyof FilaResurtido, string[]> = {
  plu: ["PLU"],
  altura: ["ALTURA"],
  picking: ["PICKING"],
  unidadesSolicitadas: ["UNIDAD SOLICITADA", "UNIDADES SOLICITADAS", "UNIDADES"],
};

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.result === "string" || typeof o.result === "number") return String(o.result);
    if (typeof o.text === "string") return o.text;
    return "";
  }
  return String(v).trim();
}

function normalizarCabecera(v: unknown): string {
  return texto(v).replace(/\s+/g, " ").trim().toUpperCase();
}

/** Índice de cada columna que importa, buscada por encabezado y no por posición. */
export function columnasResurtido(cabecera: readonly unknown[]): Record<keyof FilaResurtido, number> {
  const headers = cabecera.map(normalizarCabecera);
  const buscar = (alias: string[]) => headers.findIndex((h) => alias.includes(h));
  return {
    plu: buscar(CABECERAS_RESURTIDO.plu),
    altura: buscar(CABECERAS_RESURTIDO.altura),
    picking: buscar(CABECERAS_RESURTIDO.picking),
    unidadesSolicitadas: buscar(CABECERAS_RESURTIDO.unidadesSolicitadas),
  };
}

export function faltanColumnas(cols: Record<keyof FilaResurtido, number>): string | null {
  const faltan = Object.entries(cols)
    .filter(([, i]) => i < 0)
    .map(([k]) => CABECERAS_RESURTIDO[k as keyof FilaResurtido][0]);
  return faltan.length ? `Al archivo le faltan columnas: ${faltan.join(", ")}` : null;
}

/** Fila cruda -> fila normalizada, o null si no es una fila de datos. */
export function mapFilaResurtido(
  fila: readonly unknown[],
  cols: Record<keyof FilaResurtido, number>,
): FilaResurtido | null {
  const plu = texto(fila[cols.plu]).trim().toUpperCase();
  if (!plu || plu === "0") return null;

  const altura = normalizarUbicacion(texto(fila[cols.altura]));
  const picking = normalizarUbicacion(texto(fila[cols.picking]));
  const unidades = Number(texto(fila[cols.unidadesSolicitadas]).replace(",", "."));
  if (!altura || !picking) return null;
  if (!Number.isFinite(unidades) || unidades < 1) return null;

  return { plu, altura, picking, unidadesSolicitadas: Math.round(unidades) };
}

/**
 * Ordena la ruta por la ubicación de origen.
 *
 * El operario tiene que recorrer el almacén una sola vez y en línea recta: ir
 * saltando de un pasillo a otro y volver es lo que hace larga una tarea que en
 * sí misma dura segundos. Se compara segmento a segmento y los tramos numéricos
 * como números, para que 02-B-9 no quede después de 02-B-10.
 */
export function compararUbicaciones(a: string, b: string): number {
  const pa = a.split("-");
  const pb = b.split("-");
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] ?? "";
    const y = pb[i] ?? "";
    const nx = Number(x);
    const ny = Number(y);
    const dif = Number.isFinite(nx) && Number.isFinite(ny) && x !== "" && y !== ""
      ? nx - ny
      : x.localeCompare(y);
    if (dif !== 0) return dif;
  }
  return 0;
}

export function ordenarPorPosicion(filas: readonly FilaResurtido[]): FilaResurtido[] {
  return [...filas].sort((a, b) => compararUbicaciones(a.altura, b.altura));
}

// ── Ejecución de una tarea de resurtido ──────────────────────────────
/**
 * El escaneo de la posición es lo que arranca el reloj.
 *
 * Se compara contra la ubicación que la tarea manda: si el operario escanea otra
 * estantería, o está en el sitio equivocado o cogió la tarea equivocada, y en
 * ambos casos dejarle seguir acabaría con mercancía mal ubicada.
 */
export function validarEscaneoPosicion(escaneada: string, esperada: string): string | null {
  const a = normalizarUbicacion(escaneada);
  if (!a) return "Escanea la ubicación para empezar";
  if (a !== normalizarUbicacion(esperada)) {
    return `Esa no es la ubicación de la tarea. Ve a ${normalizarUbicacion(esperada)}`;
  }
  return null;
}

export function validarEscaneoPlu(escaneado: string, esperado: string): string | null {
  const a = String(escaneado ?? "").trim().toUpperCase();
  if (!a) return "Escanea el PLU del producto";
  if (a !== String(esperado ?? "").trim().toUpperCase()) {
    return `Ese no es el PLU de la tarea. Buscas el ${esperado}`;
  }
  return null;
}

export interface CierreTarea {
  unidadesBajadas: number;
  pickingFinal: string;
}

/**
 * Cierre de la tarea.
 *
 * Las unidades bajadas pueden no coincidir con las solicitadas —depende del
 * espacio que haya en el picking— así que no se comparan; lo único que no se
 * acepta es cero, que significaría que no se hizo nada.
 */
export function validarCierreTarea(d: CierreTarea): string | null {
  if (!Number.isInteger(d.unidadesBajadas) || d.unidadesBajadas < 1) {
    return "Indica cuántas unidades bajaste";
  }
  if (!normalizarUbicacion(d.pickingFinal)) return "Indica la ubicación de picking";
  return null;
}

// ── Progreso del montaje ─────────────────────────────────────────────
export interface ProgresoMontaje {
  total: number;
  completadas: number;
  porcentaje: number;
}

export function progresoMontaje(
  tareas: readonly { estado: EstadoTareaResurtido }[],
): ProgresoMontaje {
  const total = tareas.length;
  const completadas = tareas.filter((t) => t.estado === "COMPLETADA").length;
  return {
    total,
    completadas,
    // Sin tareas el porcentaje es 0 y no NaN: la barra tiene que poder pintarse.
    porcentaje: total > 0 ? Math.round((completadas / total) * 100) : 0,
  };
}

// ── Pendientes de gourmet ────────────────────────────────────────────
export interface SolicitudPendiente {
  plu: string;
  descripcion: string;
  unidadesSolicitadas: number;
}

export function validarSolicitudPendiente(d: SolicitudPendiente): string | null {
  if (!d.plu?.trim()) return "Escribe el PLU";
  if (!d.descripcion?.trim()) return "El PLU no existe en el maestro";
  if (!Number.isInteger(d.unidadesSolicitadas) || d.unidadesSolicitadas < 1) {
    return "Indica cuántas unidades necesitas";
  }
  return null;
}

export interface CierrePendiente {
  unidadesBajadas: number;
  ubicacionFinal: string;
}

export function validarCierrePendiente(d: CierrePendiente): string | null {
  if (!Number.isInteger(d.unidadesBajadas) || d.unidadesBajadas < 1) {
    return "Indica cuántas unidades bajaste";
  }
  if (!normalizarUbicacion(d.ubicacionFinal)) return "Indica la ubicación final";
  return null;
}


/**
 * Un pendiente se puede corregir mientras NO se haya ubicado.
 *
 * Aunque ya este asignado: el operario todavia no lo ha bajado, asi que cambiar
 * la cantidad o el producto sigue siendo util. Una vez ubicado ya es historia y
 * tocarlo falsearia lo que de verdad paso.
 */
export function puedeEditarPendiente(estado: EstadoPendienteGourmet): boolean {
  return estado !== "COMPLETADO";
}

/**
 * Novedades que el operario puede reportar sobre un pendiente.
 *
 * Solo una DEVUELVE el pendiente a quien lo pidio: el area de muebles, porque no
 * es un problema de almacenamiento sino que se pidio al area equivocada. El
 * resto son problemas del deposito y se quedan en almacenamiento, en rojo, para
 * que alguien decida.
 */
export const NOVEDADES_PENDIENTE = [
  "SIN_EXISTENCIAS",
  "EN_INSPECCION",
  "AREA_MUEBLES",
  "EN_PASILLO",
] as const;
export type NovedadPendiente = (typeof NOVEDADES_PENDIENTE)[number];

export const NOVEDAD_PENDIENTE_LABEL: Record<NovedadPendiente, string> = {
  SIN_EXISTENCIAS: "Sin existencias",
  EN_INSPECCION: "PLU en inspeccion",
  AREA_MUEBLES: "PLU del area de muebles",
  EN_PASILLO: "Mercancia en pasillo",
};

export function esNovedadPendiente(v: unknown): v is NovedadPendiente {
  return typeof v === "string" && (NOVEDADES_PENDIENTE as readonly string[]).includes(v);
}

/** El area de muebles es la unica que vuelve a quien lo pidio. */
export function devuelveASolicitante(n: NovedadPendiente): boolean {
  return n === "AREA_MUEBLES";
}

// ── Color de la vineta ───────────────────────────────────────────────
/**
 * Color de un pendiente, para verlo de un vistazo.
 *
 * - sin color: nadie lo tiene todavia
 * - amarillo:  un operario lo esta haciendo
 * - verde:     ya esta ubicado
 * - rojo:      tiene una novedad, o se devolvio
 */
export type ColorPendiente = "ninguno" | "amarillo" | "verde" | "rojo";

export function colorPendiente(estado: EstadoPendienteGourmet): ColorPendiente {
  switch (estado) {
    case "SOLICITADO":
      return "ninguno";
    case "ASIGNADO":
    case "EN_CURSO":
      return "amarillo";
    case "COMPLETADO":
      return "verde";
    case "NOVEDAD":
    case "DEVUELTO":
      return "rojo";
  }
}

// ── Orden de la lista del operario ───────────────────────────────────
/**
 * Lo prioritario va primero; lo demas, por la ruta.
 *
 * Un pendiente es alguien esperando en la tienda, asi que se hace antes que el
 * resurtido de rutina. Entre iguales se respeta la posicion para no romper el
 * recorrido en linea recta.
 */
export function compararPorPrioridad(
  a: { prioridad: boolean; orden: number },
  b: { prioridad: boolean; orden: number },
): number {
  if (a.prioridad !== b.prioridad) return a.prioridad ? -1 : 1;
  return a.orden - b.orden;
}

/**
 * Quien puede asignar un pendiente.
 *
 * Almacenamiento con el permiso por persona, o quien lo pidio: quien solicita
 * sabe mejor que nadie a quien tiene cerca y cuanta prisa hay.
 */
export function puedeAsignarPendiente(opts: {
  tienePermisoMontar: boolean;
  esQuienLoPidio: boolean;
}): boolean {
  return opts.tienePermisoMontar || opts.esQuienLoPidio;
}

/**
 * Quien puede borrar un pendiente, y cuando.
 *
 * - Sin asignar (solicitado, devuelto, con novedad): quien lo pidio (lo pidio
 *   por error, o ya no hace falta), almacenamiento con el permiso por persona
 *   y el administrador.
 * - Asignado o en curso: solo el administrador. Ya esta en la lista de un
 *   operario, que puede ir camino del sitio, y quitarselo es una decision que
 *   la operacion reserva al administrador.
 * - Ubicado: nadie. Es historia, igual que no se corrige, y borrarlo le
 *   quitaria al operario de los indicadores el tiempo que de verdad trabajo.
 */
export function puedeBorrarPendiente(opts: {
  estado: EstadoPendienteGourmet;
  esAdmin: boolean;
  tienePermisoMontar: boolean;
  esQuienLoPidio: boolean;
}): boolean {
  if (opts.estado === "COMPLETADO") return false;
  if (opts.estado === "ASIGNADO" || opts.estado === "EN_CURSO") return opts.esAdmin;
  return opts.esAdmin || opts.tienePermisoMontar || opts.esQuienLoPidio;
}

// ── Tiempo ───────────────────────────────────────────────────────────
/**
 * Segundos entre dos instantes, o contra `ahora` si aún no hay fin.
 *
 * En segundos por lo mismo que en el resto del proyecto: se redondea una sola
 * vez, al presentar, y los acumulados suman segundos exactos.
 */
export function segundosEntre(
  inicio: Date | string | null | undefined,
  fin: Date | string | null | undefined,
  ahora?: Date,
): number | null {
  if (!inicio) return null;
  const ini = inicio instanceof Date ? inicio : new Date(inicio);
  const finRaw = fin ?? ahora ?? null;
  if (!finRaw) return null;
  const f = finRaw instanceof Date ? finRaw : new Date(finRaw);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(f.getTime())) return null;
  return Math.max(0, Math.round((f.getTime() - ini.getTime()) / 1000));
}

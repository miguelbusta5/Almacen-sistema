// Helpers PUROS del módulo Estibas (montacargas). Sin Prisma ni nada de runtime:
// los importan tanto los tests como el port de Nitro
// (nuxt-app/server/utils/estibasCalc.ts), que debe mantenerse 1:1 con este
// archivo. Mismo criterio que src/lib/exportaciones.ts ↔ exportacionesCalc.ts.

export const ROLES_ESTIBAS = [
  "MONTACARGAS",
  "SUPERVISOR_ALMACENAMIENTO",
  "GERENTE",
  "ADMIN",
] as const;

// Quienes ven las estibas de todo el mundo y pueden exportar, corregir horas o
// borrar. Un MONTACARGAS solo ve y cierra las suyas.
export const GESTORES_ESTIBAS = [
  "SUPERVISOR_ALMACENAMIENTO",
  "GERENTE",
  "ADMIN",
] as const;

export function puedeUsarEstibas(role: string | null | undefined): boolean {
  return !!role && (ROLES_ESTIBAS as readonly string[]).includes(role);
}

export function puedeGestionarEstibas(role: string | null | undefined): boolean {
  return !!role && (GESTORES_ESTIBAS as readonly string[]).includes(role);
}

// ── Normalización de entrada ─────────────────────────────────────────
// El operario captura con guantes desde una tablet o con pistola: todo llega en
// mayúsculas y sin espacios de sobra para que el mismo dato no entre de tres
// formas distintas al histórico.
function normalizarCodigo(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizarPedido(value: unknown): string {
  return normalizarCodigo(value).replace(/\s/g, "");
}

export function normalizarUbicacion(value: unknown): string {
  return normalizarCodigo(value);
}

/** Código escaneado: PLU o EAN. Se conserva tal cual, en mayúsculas. */
export function normalizarCodigoProducto(value: unknown): string {
  return normalizarCodigo(value).replace(/\s/g, "");
}

/** Un EAN es puramente numérico y largo; un PLU puede ser corto o alfanumérico
 *  ("BONO", "BONO100"). Sirve para decidir por cuál de los dos buscar primero. */
export function pareceEan(codigo: string): boolean {
  return /^\d{8,20}$/.test(codigo);
}

// ── Validación ───────────────────────────────────────────────────────
// Nomenclatura real de la empresa: PEDDM11887. Se acepta cualquier prefijo de
// letras seguido de dígitos para no romper con otras series de pedido.
export const PEDIDO_PATTERN = /^[A-Z]{2,6}\d{3,10}$/;

// Ubicación canónica del CEDI: bodega-pasillo-módulo-nivel-posición
// (05-B-25-03-01). El pasillo puede llevar dígito (G1).
export const UBICACION_PATTERN = /^\d{2}-[A-Z]\d?-\d{2}-\d{2}-\d{2}$/;

/** ¿La ubicación sigue el formato canónico? Las que no (INSPECCION, MUEBLES,
 *  ECUADOR…) son válidas igual — el histórico tiene 2.406 valores distintos y
 *  bloquearlas pararía la operación. Solo se marcan en la UI. */
export function esUbicacionCanonica(ubicacion: string): boolean {
  return UBICACION_PATTERN.test(ubicacion);
}

export function validarPedido(pedido: string): string | null {
  if (!pedido) return "El número de pedido es obligatorio";
  if (pedido.length > 50) return "El número de pedido es demasiado largo";
  if (!PEDIDO_PATTERN.test(pedido)) {
    return "Formato de pedido inválido. Se espera algo como PEDDM11887";
  }
  return null;
}

export function validarUbicacion(ubicacion: string): string | null {
  if (!ubicacion) return "La ubicación final es obligatoria";
  if (ubicacion.length > 120) return "La ubicación es demasiado larga";
  return null;
}

export function validarCapturaEstiba(input: {
  pedido?: string;
  codigo?: string;
  cajas?: number;
  unidadesPorCaja?: number;
}): string | null {
  const errPedido = validarPedido(normalizarPedido(input.pedido));
  if (errPedido) return errPedido;
  if (!input.codigo?.trim()) return "El PLU o código de barras es obligatorio";
  if (!input.cajas || !Number.isInteger(input.cajas) || input.cajas < 1) {
    return "La cantidad de cajas debe ser un entero mayor a 0";
  }
  if (
    !input.unidadesPorCaja ||
    !Number.isInteger(input.unidadesPorCaja) ||
    input.unidadesPorCaja < 1
  ) {
    return "Las unidades por caja deben ser un entero mayor a 0";
  }
  return null;
}

// ── Cálculo ──────────────────────────────────────────────────────────
/** Réplica de la columna CANTIDAD TOTAL de la planilla: CAJAS × UNIDADES X CAJA. */
export function calcularCantidadTotal(cajas: number, unidadesPorCaja: number): number {
  if (!Number.isFinite(cajas) || !Number.isFinite(unidadesPorCaja)) return 0;
  return Math.max(0, Math.round(cajas) * Math.round(unidadesPorCaja));
}

export type EstadoEstiba = "EN_CURSO" | "CERRADA";

/** El estado no es una columna: se deriva de si ya se asignó la ubicación. */
export function estadoEstiba(horaFinalizacion: Date | string | null | undefined): EstadoEstiba {
  return horaFinalizacion ? "CERRADA" : "EN_CURSO";
}

export const ESTADO_ESTIBA_LABEL: Record<EstadoEstiba, string> = {
  EN_CURSO: "En curso",
  CERRADA: "Cerrada",
};

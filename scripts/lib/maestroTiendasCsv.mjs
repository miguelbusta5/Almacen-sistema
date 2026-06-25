// ═══════════════════════════════════════════════════════════
// Parser/validador puro del CSV de Maestro de Tiendas Gourmet.
// Sin acceso a base de datos — usado por el script de importación
// y por los tests unitarios (Vitest puede importar .mjs directamente).
// ═══════════════════════════════════════════════════════════

export const REQUIRED_COLUMNS = ["codigo", "tienda", "ciudad"];
export const OPTIONAL_COLUMNS = ["activo"];
export const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const TRUE_VALUES = new Set(["true", "1", "si", "sí", "yes"]);
const FALSE_VALUES = new Set(["false", "0", "no"]);

/**
 * Valida que el CSV tenga las columnas requeridas (codigo, tienda, ciudad).
 * `activo` es opcional. Columnas extra no declaradas se ignoran sin error.
 */
export function validateColumns(fields) {
  const present = new Set((fields ?? []).map((f) => String(f).trim().toLowerCase()));
  const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
  return { ok: missing.length === 0, missing };
}

/**
 * Parsea el valor de la columna `activo`. Vacío/ausente → true (default).
 * Devuelve { value: boolean } o { error: string } si el valor no es reconocible.
 */
function parseActivo(raw) {
  const v = (raw ?? "").trim();
  if (v === "") return { value: true };
  const lower = v.toLowerCase();
  if (TRUE_VALUES.has(lower)) return { value: true };
  if (FALSE_VALUES.has(lower)) return { value: false };
  return { error: `valor de "activo" no reconocido: "${raw}"` };
}

/**
 * Valida y normaliza una fila cruda del CSV (objeto con claves de columna).
 * Todos los campos se recortan (trim). `codigo` siempre se trata como string
 * (nunca se convierte a número) para no perder ceros a la izquierda.
 *
 * Devuelve { ok: true, row: { codigo, tienda, ciudad, activo } }
 * o { ok: false, error: string }.
 */
export function validateRow(raw, rowNumber) {
  const codigo = String(raw.codigo ?? "").trim();
  const tienda = String(raw.tienda ?? "").trim();
  const ciudad = String(raw.ciudad ?? "").trim();

  if (!codigo) return { ok: false, rowNumber, error: "codigo requerido" };
  if (!tienda) return { ok: false, rowNumber, error: "tienda requerida" };
  if (!ciudad) return { ok: false, rowNumber, error: "ciudad requerida" };

  const activoResult = parseActivo(raw.activo);
  if ("error" in activoResult) {
    return { ok: false, rowNumber, error: activoResult.error };
  }

  return { ok: true, rowNumber, row: { codigo, tienda, ciudad, activo: activoResult.value } };
}

/**
 * Procesa todas las filas ya parseadas del CSV (array de objetos por fila).
 * No escribe nada — solo clasifica. Códigos duplicados dentro del mismo CSV
 * se reportan; la última fila válida con ese código es la que se usaría en
 * el upsert (consistente con cómo procesaría el archivo de arriba a abajo).
 */
export function processRows(rawRows) {
  const valid = [];
  const invalid = [];
  const seenCodigos = new Map(); // codigo -> primera rowNumber vista
  const duplicateCodigos = new Set();

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // fila 1 = encabezado
    const result = validateRow(raw, rowNumber);
    if (!result.ok) {
      invalid.push(result);
      return;
    }
    const { codigo } = result.row;
    if (seenCodigos.has(codigo)) {
      duplicateCodigos.add(codigo);
    } else {
      seenCodigos.set(codigo, rowNumber);
    }
    valid.push(result);
  });

  // upsertPlan: un único registro final por código (gana la última fila válida
  // del archivo si hay duplicados — comportamiento explícito, no silencioso).
  const upsertPlan = new Map();
  for (const { row } of valid) {
    upsertPlan.set(row.codigo, row);
  }

  return {
    totalRows: rawRows.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    invalid,
    duplicateCodigos: Array.from(duplicateCodigos),
    upsertPlan: Array.from(upsertPlan.values()),
  };
}

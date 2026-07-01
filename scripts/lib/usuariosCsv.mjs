// ═══════════════════════════════════════════════════════════
// Parser/validador puro del CSV de usuarios a crear en lote, más la
// generación de email/contraseña temporal. Sin acceso a base de datos —
// usado por el script de importación y por los tests unitarios.
// ═══════════════════════════════════════════════════════════

// Mantener en sincronía con USER_ROLE_VALUES en src/lib/roles.ts — este
// script .mjs no puede importar ese archivo .ts directamente.
export const USER_ROLE_VALUES = [
  "ADMIN",
  "GERENTE",
  "OPERADOR",
  "TRANSPORTISTA",
  "INVENTARIO",
  "TRANSPORTE",
  "SUPERVISOR_INVENTARIO",
  "SUPERVISOR_TRANSPORTE",
  "TIENDA",
  "SUPERVISOR_TIENDA",
  "OPERACIONES_MUEBLES",
  "OPERACIONES_GOURMET",
  "ETIQUETADO",
  "SUPERVISOR_ALMACENAMIENTO",
];

export const REQUIRED_COLUMNS = ["nombre", "rol"];
export const OPTIONAL_COLUMNS = ["email"];
export const DEFAULT_EMAIL_DOMAIN = "grupoambiente.com";

/** Valida que el CSV tenga las columnas requeridas (nombre, rol). `email` es opcional (se genera si falta). */
export function validateColumns(fields) {
  const present = new Set((fields ?? []).map((f) => String(f).trim().toLowerCase()));
  const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
  return { ok: missing.length === 0, missing };
}

export function normalizeRowKeys(raw) {
  const normalized = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    normalized[String(key).trim().toLowerCase()] = value;
  }
  return normalized;
}

/**
 * Genera un email tipo "nombre.apellido@dominio" a partir de un nombre
 * completo: minúsculas, sin tildes/diacríticos, espacios → ".", solo
 * a-z0-9 y puntos. Ej: "María Fernández" → "maria.fernandez@dominio".
 */
export function generateEmailFromName(nombre, domain = DEFAULT_EMAIL_DOMAIN) {
  const local = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar tildes/diacriticos (rango Unicode de marcas combinadas)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(".");
  return `${local}@${domain}`;
}

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Contraseña temporal aleatoria (no cripto-secreta a largo plazo — es de un solo uso, se fuerza el cambio en el primer login). */
export function generateTemporaryPassword(length = 12, random = Math.random) {
  let pw = "";
  for (let i = 0; i < length; i++) {
    pw += PASSWORD_CHARS[Math.floor(random() * PASSWORD_CHARS.length)];
  }
  return pw;
}

/**
 * Valida y normaliza una fila cruda del CSV.
 * Devuelve { ok: true, row: { nombre, rol, email } } o { ok: false, error }.
 * `email` es el del CSV si viene, o se genera desde `nombre` si no.
 */
export function validateRow(raw, rowNumber, domain = DEFAULT_EMAIL_DOMAIN) {
  const r = normalizeRowKeys(raw);

  const nombre = String(r.nombre ?? "").trim();
  const rolRaw = String(r.rol ?? "").trim().toUpperCase();
  const emailRaw = String(r.email ?? "").trim().toLowerCase();

  if (!nombre) return { ok: false, rowNumber, error: "nombre requerido" };
  if (!rolRaw) return { ok: false, rowNumber, error: "rol requerido" };
  if (!USER_ROLE_VALUES.includes(rolRaw)) {
    return { ok: false, rowNumber, error: `rol no reconocido: "${rolRaw}"` };
  }

  const email = emailRaw || generateEmailFromName(nombre, domain);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, rowNumber, error: `email inválido: "${email}"` };
  }

  return { ok: true, rowNumber, row: { nombre, rol: rolRaw, email } };
}

/**
 * Procesa todas las filas ya parseadas del CSV. No escribe nada — solo
 * clasifica y detecta emails duplicados dentro del propio archivo.
 */
export function processRows(rawRows, domain = DEFAULT_EMAIL_DOMAIN) {
  const valid = [];
  const invalid = [];
  const seenEmails = new Map();
  const duplicateEmails = new Set();

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // fila 1 = encabezado
    const result = validateRow(raw, rowNumber, domain);
    if (!result.ok) {
      invalid.push(result);
      return;
    }
    const { email } = result.row;
    if (seenEmails.has(email)) {
      duplicateEmails.add(email);
    } else {
      seenEmails.set(email, rowNumber);
    }
    valid.push(result);
  });

  // createPlan: una fila final por email (gana la última si hay duplicados
  // dentro del propio CSV — comportamiento explícito, no silencioso).
  const createPlan = new Map();
  for (const { row } of valid) {
    createPlan.set(row.email, row);
  }

  return {
    totalRows: rawRows.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    invalid,
    duplicateEmails: Array.from(duplicateEmails),
    createPlan: Array.from(createPlan.values()),
  };
}

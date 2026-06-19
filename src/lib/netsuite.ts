// ============================================================================
// INTEGRACIÓN NETSUITE — ARQUITECTURA Y STUBS
//
// Estado: NO CONECTADO. Solo trazabilidad de IDs.
//
// Cuándo activar:
//   1. Obtener credenciales REST/SOAP de la cuenta de NetSuite.
//   2. Configurar las variables de entorno requeridas (ver NETSUITE_CONFIG).
//   3. Descomentar los clientes y reemplazar los stubs por llamadas reales.
//
// Endpoints previstos (NetSuite SuiteTalk REST API v1):
//   Base URL: https://<accountId>.suitetalk.api.netsuite.com/services/rest/record/v1
//
//   Novedades   → /inventoryAdjustment/<id>   (ajuste de inventario)
//   Guardados   → /salesOrder/<id>            (orden de venta en custodia)
//   Despachos   → /transferOrder/<id>         (orden de transferencia tienda)
//
// Autenticación: OAuth 1.0 (token-based) o TBA (Token-Based Auth).
//   NetSuite NO soporta OAuth 2.0 en la mayoría de endpoints REST.
//   Usar la librería `netsuite-oauth` o implementar el header manualmente.
// ============================================================================

// ── Variables de entorno requeridas (en .env.local / Vercel) ─────────────
// NETSUITE_ACCOUNT_ID=<tu-account-id>
// NETSUITE_CONSUMER_KEY=<consumer-key>
// NETSUITE_CONSUMER_SECRET=<consumer-secret>
// NETSUITE_TOKEN_ID=<token-id>
// NETSUITE_TOKEN_SECRET=<token-secret>

// ── Tipos de entidades NetSuite ───────────────────────────────────────────

/** Respuesta mínima de NetSuite al crear/buscar un registro */
export interface NetSuiteRecord {
  id: string;           // ID interno NetSuite (número como string)
  externalId?: string;  // ID externo (se puede poner el ID de nuestro sistema)
  type: string;         // Tipo de registro ("inventoryAdjustment", "salesOrder", etc.)
  links?: Array<{ rel: string; href: string }>;
}

/** Resultado de sincronización hacia NetSuite */
export interface NetSuiteSyncResult {
  success: boolean;
  netsuiteId: string | null;
  error?: string;
}

/** Módulos del sistema mapeados a tipos de registros en NetSuite */
export type NetSuiteModule =
  | "novedad"      // → inventoryAdjustment
  | "guardado"     // → salesOrder (o customRecord si se prefiere)
  | "despacho";    // transferOrder

// ── Mapa de módulo → tipo de registro NetSuite ───────────────────────────
export const NETSUITE_RECORD_TYPE: Record<NetSuiteModule, string> = {
  novedad:  "inventoryAdjustment",
  guardado: "salesOrder",
  despacho: "transferOrder",
};

// ── Helper: URL del registro en NetSuite ─────────────────────────────────
/**
 * Construye la URL de acceso directo a un registro en la UI de NetSuite.
 * Útil para el enlace "Ver en NetSuite →" que se mostrará en los paneles.
 *
 * @param module   Módulo del sistema
 * @param nsId     ID interno de NetSuite
 * @returns        URL completa o null si faltan datos
 */
export function netsuiteUrl(module: NetSuiteModule, nsId: string | null): string | null {
  const accountId = process.env.NEXT_PUBLIC_NETSUITE_ACCOUNT_ID;
  if (!nsId || !accountId) return null;
  const recordType = NETSUITE_RECORD_TYPE[module];
  // URL de la UI de NetSuite para ver el registro
  return `https://${accountId}.app.netsuite.com/app/common/record/${recordType}.nl?id=${nsId}`;
}

// ── Validación de formato de ID NetSuite ─────────────────────────────────
/**
 * NetSuite usa IDs numéricos internos como strings ("12345").
 * Esta función valida que el valor ingresado tenga el formato correcto.
 */
export function isValidNetSuiteId(id: string | null): boolean {
  if (!id) return false;
  return /^\d{1,10}$/.test(id.trim());
}

// ── STUBS (implementar cuando se active la integración) ──────────────────

/**
 * STUB: Sincroniza un registro hacia NetSuite.
 *
 * Implementación futura:
 *   1. Construir el payload según el tipo de registro.
 *   2. Generar el header OAuth 1.0 con las credenciales.
 *   3. POST a /services/rest/record/v1/<recordType>
 *   4. Retornar el ID interno de NetSuite.
 *
 * @param _module   Módulo origen
 * @param _payload  Datos del registro a enviar
 * @returns         Resultado de la sincronización
 */
export async function pushToNetSuite(
  _module: NetSuiteModule,
  _payload: Record<string, unknown>
): Promise<NetSuiteSyncResult> {
  // TODO: implementar cuando las credenciales estén disponibles
  return { success: false, netsuiteId: null, error: "Integración NetSuite no activa" };
}

/**
 * STUB: Obtiene un registro de NetSuite por ID interno.
 *
 * @param _module   Módulo / tipo de registro
 * @param _nsId     ID interno de NetSuite
 * @returns         Registro de NetSuite o null
 */
export async function getFromNetSuite(
  _module: NetSuiteModule,
  _nsId: string
): Promise<NetSuiteRecord | null> {
  // TODO: implementar cuando las credenciales estén disponibles
  return null;
}

/**
 * STUB: Verifica que un ID de NetSuite exista y pertenezca al tipo correcto.
 *
 * @param _module  Módulo / tipo de registro
 * @param _nsId    ID a verificar
 * @returns        true si existe y es válido
 */
export async function verifyNetSuiteId(
  _module: NetSuiteModule,
  _nsId: string
): Promise<boolean> {
  // TODO: implementar cuando las credenciales estén disponibles
  return false;
}

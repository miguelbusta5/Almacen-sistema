// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// INTEGRACIÃ“N NETSUITE â€” ARQUITECTURA Y STUBS
//
// Estado: NO CONECTADO. Solo trazabilidad de IDs.
//
// CuÃ¡ndo activar:
//   1. Obtener credenciales REST/SOAP de la cuenta de NetSuite.
//   2. Configurar las variables de entorno requeridas (ver NETSUITE_CONFIG).
//   3. Descomentar los clientes y reemplazar los stubs por llamadas reales.
//
// Endpoints previstos (NetSuite SuiteTalk REST API v1):
//   Base URL: https://<accountId>.suitetalk.api.netsuite.com/services/rest/record/v1
//
//   Novedades   â†’ /inventoryAdjustment/<id>   (ajuste de inventario)
//   Guardados   â†’ /salesOrder/<id>            (orden de venta en custodia)
//   Despachos   â†’ /transferOrder/<id>         (orden de transferencia tienda)
//
// AutenticaciÃ³n: OAuth 1.0 (token-based) o TBA (Token-Based Auth).
//   NetSuite NO soporta OAuth 2.0 en la mayorÃ­a de endpoints REST.
//   Usar la librerÃ­a `netsuite-oauth` o implementar el header manualmente.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Variables de entorno requeridas (en .env.local / Vercel) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NETSUITE_ACCOUNT_ID=<tu-account-id>
// NETSUITE_CONSUMER_KEY=<consumer-key>
// NETSUITE_CONSUMER_SECRET=<consumer-secret>
// NETSUITE_TOKEN_ID=<token-id>
// NETSUITE_TOKEN_SECRET=<token-secret>

// â”€â”€ Tipos de entidades NetSuite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Respuesta mÃ­nima de NetSuite al crear/buscar un registro */
export interface NetSuiteRecord {
  id: string;           // ID interno NetSuite (nÃºmero como string)
  externalId?: string;  // ID externo (se puede poner el ID de nuestro sistema)
  type: string;         // Tipo de registro ("inventoryAdjustment", "salesOrder", etc.)
  links?: Array<{ rel: string; href: string }>;
}

/** Resultado de sincronizaciÃ³n hacia NetSuite */
export interface NetSuiteSyncResult {
  success: boolean;
  netsuiteId: string | null;
  error?: string;
}

/** MÃ³dulos del sistema mapeados a tipos de registros en NetSuite */
export type NetSuiteModule =
  | "novedad"      // â†’ inventoryAdjustment
  | "guardado"     // â†’ salesOrder (o customRecord si se prefiere)
  | "despacho";    // transferOrder

// â”€â”€ Mapa de mÃ³dulo â†’ tipo de registro NetSuite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const NETSUITE_RECORD_TYPE: Record<NetSuiteModule, string> = {
  novedad:  "inventoryAdjustment",
  guardado: "salesOrder",
  despacho: "transferOrder",
};

// â”€â”€ Helper: URL del registro en NetSuite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Construye la URL de acceso directo a un registro en la UI de NetSuite.
 * Ãštil para el enlace "Ver en NetSuite â†’" que se mostrarÃ¡ en los paneles.
 *
 * @param module   MÃ³dulo del sistema
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

// â”€â”€ ValidaciÃ³n de formato de ID NetSuite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * NetSuite usa IDs numÃ©ricos internos como strings ("12345").
 * Esta funciÃ³n valida que el valor ingresado tenga el formato correcto.
 */
export function isValidNetSuiteId(id: string | null): boolean {
  if (!id) return false;
  return /^\d{1,10}$/.test(id.trim());
}

// â”€â”€ STUBS (implementar cuando se active la integraciÃ³n) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * STUB: Sincroniza un registro hacia NetSuite.
 *
 * ImplementaciÃ³n futura:
 *   1. Construir el payload segÃºn el tipo de registro.
 *   2. Generar el header OAuth 1.0 con las credenciales.
 *   3. POST a /services/rest/record/v1/<recordType>
 *   4. Retornar el ID interno de NetSuite.
 *
 * @param _module   MÃ³dulo origen
 * @param _payload  Datos del registro a enviar
 * @returns         Resultado de la sincronizaciÃ³n
 */
export async function pushToNetSuite(
  _module: NetSuiteModule,
  _payload: Record<string, unknown>
): Promise<NetSuiteSyncResult> {
  // TODO: implementar cuando las credenciales estÃ©n disponibles
  return { success: false, netsuiteId: null, error: "IntegraciÃ³n NetSuite no activa" };
}

/**
 * STUB: Obtiene un registro de NetSuite por ID interno.
 *
 * @param _module   MÃ³dulo / tipo de registro
 * @param _nsId     ID interno de NetSuite
 * @returns         Registro de NetSuite o null
 */
export async function getFromNetSuite(
  _module: NetSuiteModule,
  _nsId: string
): Promise<NetSuiteRecord | null> {
  // TODO: implementar cuando las credenciales estÃ©n disponibles
  return null;
}

/**
 * STUB: Verifica que un ID de NetSuite exista y pertenezca al tipo correcto.
 *
 * @param _module  MÃ³dulo / tipo de registro
 * @param _nsId    ID a verificar
 * @returns        true si existe y es vÃ¡lido
 */
export async function verifyNetSuiteId(
  _module: NetSuiteModule,
  _nsId: string
): Promise<boolean> {
  // TODO: implementar cuando las credenciales estÃ©n disponibles
  return false;
}

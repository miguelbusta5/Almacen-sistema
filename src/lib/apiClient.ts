// Cliente HTTP centralizado del lado del cliente.
//
// Estandariza el acceso a `/api/*`: construcción de query strings, headers JSON,
// parseo de la envoltura `{ success, data, error, code }` y manejo de errores
// como excepción tipada `ApiError`. Reutiliza la forma real de respuestas del
// backend (ver `src/types/index.ts`).
//
// Lecturas: usar el hook `useApi` (SWR) de `src/hooks/useApi.ts`, que se apoya
// en `swrFetcher`. Escrituras: `apiPost/apiPut/apiPatch/apiDelete` (o `apiSend`)
// y `apiUpload` para multipart. Todos lanzan `ApiError` si la respuesta no es OK
// o trae `success: false`; el call-site captura y usa `getErrorMessage` /
// `getErrorCode` (`src/lib/errors.ts`).

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

// Error de una llamada a la API. `status` es el HTTP; `code` es el código de
// negocio opcional del backend (p. ej. "CONFLICT", "ESTADO_NO_EDITABLE").
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  // Payload de negocio opcional que algunos endpoints adjuntan a errores 409
  // (p. ej. el pedido en conflicto), para que el call-site pueda ofrecer una
  // acción sin volver a pedir datos al backend.
  readonly data?: unknown;
  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Construye un query string a partir de un objeto, omitiendo null/undefined y
// cadenas vacías. Devuelve "" o "?a=1&b=2" (ya url-encoded).
export function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const str = String(value);
    if (str === "") continue;
    sp.set(key, str);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// Parseo central de la respuesta. Lanza `ApiError` si `!res.ok` o si el cuerpo
// trae `success: false` explícito. No exige `success` (hay endpoints como
// `/api/stats` o `GET /api/preoperacional` que no lo incluyen). Devuelve el
// cuerpo JSON completo (la envoltura, incl. `total`/`page`/`historial`/etc.).
async function parseApiResponse<T>(res: Response): Promise<T> {
  const body: unknown = await res.json().catch(() => ({}));
  const obj = (typeof body === "object" && body !== null ? body : {}) as {
    success?: boolean;
    error?: string;
    code?: string;
    data?: unknown;
  };
  if (!res.ok || obj.success === false) {
    throw new ApiError(obj.error ?? "Error en la solicitud", res.status, obj.code, obj.data);
  }
  return body as T;
}

// GET tipado. `T` es la envoltura completa de éxito (p. ej.
// `{ data: Foo[]; total: number }` o `{ data: Foo }`).
export async function apiGet<T>(url: string, params?: QueryParams): Promise<T> {
  const res = await fetch(`${url}${buildQuery(params)}`);
  return parseApiResponse<T>(res);
}

// Escritura JSON (POST/PUT/PATCH/DELETE). El body se serializa con JSON.stringify
// solo si se proporciona (algunas acciones no llevan cuerpo).
export async function apiSend<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseApiResponse<T>(res);
}

export const apiPost = <T>(url: string, body?: unknown) => apiSend<T>(url, "POST", body);
export const apiPut = <T>(url: string, body?: unknown) => apiSend<T>(url, "PUT", body);
export const apiPatch = <T>(url: string, body?: unknown) => apiSend<T>(url, "PATCH", body);
export const apiDelete = <T>(url: string, body?: unknown) => apiSend<T>(url, "DELETE", body);

// Subida multipart (FormData). No se fija `Content-Type`: el navegador añade el
// boundary correcto automáticamente.
export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", body: formData });
  return parseApiResponse<T>(res);
}

// Fetcher para SWR: la key es la URL ya construida (incluye query string).
export const swrFetcher = <T>(key: string): Promise<T> => apiGet<T>(key);

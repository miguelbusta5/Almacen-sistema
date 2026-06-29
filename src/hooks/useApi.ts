"use client";

import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";
import { swrFetcher, ApiError } from "@/lib/apiClient";

// Hook de lectura sobre SWR con el fetcher central tipado.
//
// `key` es la URL completa (incluye query string; usar `buildQuery`). Pasar
// `null` desactiva la petición (fetch condicional: rol sin permiso, modal
// cerrado, dependencia aún no lista). El error es siempre `ApiError`.
//
// Devuelve `{ data, error, isLoading, mutate, ... }`. Tras una mutación
// (`apiPost`/`apiPut`/...), llamar `mutate()` para revalidar.
export function useApi<T>(
  key: string | null,
  options?: SWRConfiguration<T, ApiError>,
): SWRResponse<T, ApiError> {
  return useSWR<T, ApiError>(key, swrFetcher, {
    revalidateOnFocus: true,
    ...options,
  });
}

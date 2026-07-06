// Helpers compartidos para el formulario de "estibas + cajas" (ubicación
// física de un pedido Gourmet), usados tanto por `AsignarUbicacionModal`
// (flujo dedicado) como por `EditarPedidoModal` (edición conjunta con los
// datos básicos del pedido). Un solo lugar para la codificación de
// `observacion`, el parseo de formulario → payload y las validaciones, para
// que ambos flujos se comporten igual.

export interface EstibaForm { ubicacion: string; cantidadCajas: string; observacion: string; }
export interface CajaForm { codigoCaja: string; numeroSecuencia: string; }

export interface PedidoConEstibasCajas {
  estibas: Array<{ id: string; secuencia: number; ubicacion: string; observacion: string | null }>;
  cajas: Array<{ numeroSecuencia: number | null; codigoCaja: string | null; estibaId: string | null }>;
}

// ── Codificación de "cajas por estiba" dentro de `observacion` ──────────────
// El modelo de datos real (operación) es "por estiba": cada estiba tiene una
// ubicación y una cantidad de cajas. El esquema actual (`GourmetPedidoEstiba`)
// no tiene una columna `cantidadCajas` — solo `secuencia`, `ubicacion` y
// `observacion` libre. Para no tocar Prisma/el endpoint, la cantidad de cajas
// se codifica como un prefijo `[cajas:N]` dentro del mismo texto de
// `observacion` que el backend ya acepta y persiste tal cual.
const CAJAS_TAG_RE = /^\[cajas:(\d+)\]\s*(?:·\s*(.*))?$/;

export function decodeEstibaObservacion(raw: string | null): { cantidadCajas: number | null; observacion: string } {
  if (!raw) return { cantidadCajas: null, observacion: "" };
  const m = raw.match(CAJAS_TAG_RE);
  if (!m) return { cantidadCajas: null, observacion: raw };
  return { cantidadCajas: parseInt(m[1], 10), observacion: m[2] ?? "" };
}

export function encodeEstibaObservacion(cantidadCajas: number, observacion: string): string {
  const obs = observacion.trim();
  return obs ? `[cajas:${cantidadCajas}] · ${obs}` : `[cajas:${cantidadCajas}]`;
}

export function emptyEstiba(): EstibaForm {
  return { ubicacion: "", cantidadCajas: "", observacion: "" };
}
export function emptyCaja(): CajaForm {
  return { codigoCaja: "", numeroSecuencia: "" };
}

export function estibasFromPedido(p: PedidoConEstibasCajas | null): EstibaForm[] {
  if (!p || p.estibas.length === 0) return [emptyEstiba()];
  return p.estibas
    .slice()
    .sort((a, b) => a.secuencia - b.secuencia)
    .map((e) => {
      const { cantidadCajas, observacion } = decodeEstibaObservacion(e.observacion);
      return {
        ubicacion: e.ubicacion,
        cantidadCajas: cantidadCajas != null ? String(cantidadCajas) : "",
        observacion,
      };
    });
}

export function cajasFromPedido(p: PedidoConEstibasCajas | null): CajaForm[] {
  return (p?.cajas ?? []).map((c) => ({
    codigoCaja: c.codigoCaja ?? "",
    numeroSecuencia: c.numeroSecuencia != null ? String(c.numeroSecuencia) : "",
  }));
}

export interface EstibaCajaPayload {
  estibas: { secuencia: number; ubicacion: string; observacion?: string }[];
  cajas: { codigoCaja?: string; numeroSecuencia?: number }[];
}

// Valida y transforma las filas de formulario al payload de
// `POST /api/cargue-gourmet/[id]/ubicacion`. Devuelve `{ error }` con el
// primer problema encontrado, o `{ data }` con el payload ya listo.
export function parseEstibasCajas(
  estibas: EstibaForm[],
  cajas: CajaForm[],
  cajasEsperadas: number
): { error: string } | { data: EstibaCajaPayload } {
  if (estibas.length === 0) return { error: "Agrega al menos una estiba" };

  const estibasParsed: { secuencia: number; ubicacion: string; observacion?: string }[] = [];
  let sumaCajas = 0;
  for (let i = 0; i < estibas.length; i++) {
    const row = estibas[i];
    if (!row.ubicacion.trim()) return { error: `Estiba ${i + 1}: indica la ubicación` };
    const cantidad = parseInt(row.cantidadCajas, 10);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return { error: `Estiba ${i + 1}: indica la cantidad de cajas (mayor a 0)` };
    }
    sumaCajas += cantidad;
    estibasParsed.push({
      secuencia: i + 1,
      ubicacion: row.ubicacion.trim(),
      observacion: encodeEstibaObservacion(cantidad, row.observacion),
    });
  }

  if (sumaCajas !== cajasEsperadas) {
    return {
      error: `La suma de cajas por estiba (${sumaCajas}) no coincide con las cajas esperadas del pedido (${cajasEsperadas})`,
    };
  }

  const cajasParsed: { codigoCaja?: string; numeroSecuencia?: number }[] = [];
  for (const row of cajas) {
    if (!row.codigoCaja.trim() && !row.numeroSecuencia.trim()) continue;
    const entry: { codigoCaja?: string; numeroSecuencia?: number } = {};
    if (row.codigoCaja.trim()) entry.codigoCaja = row.codigoCaja.trim();
    if (row.numeroSecuencia.trim()) {
      const n = parseInt(row.numeroSecuencia, 10);
      if (!Number.isInteger(n) || n <= 0) return { error: "El número de secuencia de caja debe ser un entero mayor a 0" };
      entry.numeroSecuencia = n;
    }
    cajasParsed.push(entry);
  }
  const numerosCaja = cajasParsed.map((c) => c.numeroSecuencia).filter((n): n is number => n !== undefined);
  if (new Set(numerosCaja).size !== numerosCaja.length) {
    return { error: "No puede haber dos cajas con el mismo número de secuencia" };
  }

  return { data: { estibas: estibasParsed, cajas: cajasParsed } };
}

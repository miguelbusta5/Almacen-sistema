// Peso y volumen de lo que se mueve, para todo el CEDI.
//
// Las medidas del maestro (medidas_caja_master) son de la CAJA MASTER, y una
// caja puede traer varias unidades ("Und Emp"). Bajar 3 cajas de 4 unidades es
// lo mismo que bajar 12 unidades: el peso de la caja repartido entre lo que
// trae, multiplicado por las unidades. Por eso aqui todo se cuenta en UNIDADES
// y la conversion es una sola formula, igual en muebles, resurtido, pendientes
// y montacargas.
//
// Un PLU sin medir NO vale cero: vale null y se cuenta aparte, para que la
// pantalla diga "faltan N sin medida" en vez de mostrar un total que parece
// completo y no lo es.
//
// Fuente de verdad; Nitro usa una copia en nuxt-app/server/utils/cargaCalc.ts
// (no puede importar de src/lib). Un test compara los dos archivos.

/** Lo que el maestro sabe de un PLU: su caja master y cuantas unidades trae. */
export interface MedidaPlu {
  /** Unidades que trae la caja master. 1 cuando el maestro no lo declara. */
  unidadesPorCaja: number;
  /** Peso bruto de la caja (suma de sus partes). Null si no esta medido. */
  cajaKg: number | null;
  /** Volumen de la caja (suma de sus partes). Null si no esta medido. */
  cajaM3: number | null;
}

/** Lo que pesa y ocupa un trabajo. Null = ese PLU no esta medido. */
export interface Carga {
  kg: number | null;
  m3: number | null;
}

/** Varias cargas sumadas, diciendo cuantas no se pudieron contar. */
export interface CargaTotal {
  kg: number;
  m3: number;
  /** Cuantos de los sumados no tenian medida en el maestro. */
  sinMedida: number;
}

function redondear(valor: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

/** Unidades por caja usables: sin dato valido se asume 1 (la mayoria). */
export function unidadesPorCajaValidas(valor: number | null | undefined): number {
  if (valor == null || !Number.isFinite(valor) || valor < 1) return 1;
  return Math.trunc(valor);
}

/**
 * Peso y volumen de N unidades de un PLU.
 *
 * Da lo mismo contar cajas o unidades: una caja de 4 pesa lo que 4 unidades.
 * Lo que no se puede es redondear hacia arriba a caja completa, porque en
 * muebles se abre la caja y se saca lo que pide la orden.
 */
export function cargaDeUnidades(unidades: number, medida: MedidaPlu | null | undefined): Carga {
  const n = Number.isFinite(unidades) ? Math.max(0, Math.trunc(unidades)) : 0;
  if (!medida) return { kg: null, m3: null };
  const porCaja = unidadesPorCajaValidas(medida.unidadesPorCaja);
  return {
    kg: medida.cajaKg == null ? null : redondear((medida.cajaKg / porCaja) * n, 3),
    m3: medida.cajaM3 == null ? null : redondear((medida.cajaM3 / porCaja) * n, 6),
  };
}

/** Suma de cargas. Lo no medido no suma cero: se cuenta aparte. */
export function sumarCargas(cargas: readonly (Carga | null | undefined)[]): CargaTotal {
  let kg = 0;
  let m3 = 0;
  let sinMedida = 0;
  for (const c of cargas) {
    if (!c || (c.kg == null && c.m3 == null)) {
      sinMedida += 1;
      continue;
    }
    kg += c.kg ?? 0;
    m3 += c.m3 ?? 0;
  }
  return { kg: redondear(kg, 3), m3: redondear(m3, 6), sinMedida };
}

/** "1,2 m³" / "—" cuando el PLU no esta medido. */
export function fmtM3Carga(m3: number | null | undefined): string {
  if (m3 == null) return "—";
  return `${m3.toLocaleString("es-CO", { maximumFractionDigits: 2, minimumFractionDigits: m3 < 1 ? 2 : 0 })} m³`;
}

/** "45 kg" / "—" cuando el PLU no esta medido. */
export function fmtKgCarga(kg: number | null | undefined): string {
  if (kg == null) return "—";
  return `${kg.toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg`;
}

// ── Carga por persona (Indicadores) ─────────────────────────────────────────

export type TipoCarga = "resurtido" | "pendiente" | "montacargas";
export const TIPOS_CARGA: readonly TipoCarga[] = ["resurtido", "pendiente", "montacargas"];

export interface CargaPersona {
  id: string;
  nombre: string;
  kg: number;
  m3: number;
  /** Trabajos que no se pudieron contar porque su PLU no esta medido. */
  sinMedida: number;
  porTipo: Record<TipoCarga, { kg: number; m3: number }>;
}

/**
 * Kg y m3 que movio cada persona en el periodo, con el desglose por modulo.
 *
 * Solo entra trabajo CERRADO: lo que sigue abierto todavia no se sabe cuanto
 * bajaron. Quien no movio nada medido no sale en la tabla.
 */
export function resumirCargaPorPersona(
  personas: readonly { id: string; nombre: string }[],
  items: readonly { usuarioId: string; tipo: TipoCarga; carga: Carga }[],
): CargaPersona[] {
  const porPersona = new Map<string, CargaPersona>();
  for (const p of personas) {
    porPersona.set(p.id, {
      id: p.id,
      nombre: p.nombre,
      kg: 0,
      m3: 0,
      sinMedida: 0,
      porTipo: {
        resurtido: { kg: 0, m3: 0 },
        pendiente: { kg: 0, m3: 0 },
        montacargas: { kg: 0, m3: 0 },
      },
    });
  }
  for (const it of items) {
    const fila = porPersona.get(it.usuarioId);
    if (!fila) continue;
    if (it.carga.kg == null && it.carga.m3 == null) {
      fila.sinMedida += 1;
      continue;
    }
    fila.kg += it.carga.kg ?? 0;
    fila.m3 += it.carga.m3 ?? 0;
    fila.porTipo[it.tipo].kg += it.carga.kg ?? 0;
    fila.porTipo[it.tipo].m3 += it.carga.m3 ?? 0;
  }
  return [...porPersona.values()]
    .map((f) => ({
      ...f,
      kg: redondear(f.kg, 1),
      m3: redondear(f.m3, 3),
      porTipo: {
        resurtido: { kg: redondear(f.porTipo.resurtido.kg, 1), m3: redondear(f.porTipo.resurtido.m3, 3) },
        pendiente: { kg: redondear(f.porTipo.pendiente.kg, 1), m3: redondear(f.porTipo.pendiente.m3, 3) },
        montacargas: { kg: redondear(f.porTipo.montacargas.kg, 1), m3: redondear(f.porTipo.montacargas.m3, 3) },
      },
    }))
    .filter((f) => f.kg > 0 || f.m3 > 0 || f.sinMedida > 0)
    .sort((a, b) => b.m3 - a.m3 || b.kg - a.kg || a.nombre.localeCompare(b.nombre));
}

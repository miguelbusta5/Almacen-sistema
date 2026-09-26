// Alertas de lo que lleva abierto demasiado tiempo (25-09): un contenedor en
// descarga, un PLU de montacargas, una orden de muebles o un camion que nadie
// cerro. Se calculan en vivo (no se guardan): en cuanto se cierra, desaparece.
//
// Puro (sin Prisma). No tiene gemelo en src/lib: sus tests lo cargan con
// cargarNuxt (ver src/__tests__/apoyo/nuxt.ts).
//
// Limites (minutos): cerca del doble de lo que tarda el 90 % de los registros
// cerrados hasta el 25-09 (contenedor 4 h 23, PLU de montacargas 14-23 min,
// picking de muebles 25 min, camion 1 h 56).

export const LIMITES_ABIERTO_MIN = {
  recepcion: 360,
  montacargas: 45,
  picking: 60,
  inspeccion: 240,
  camion: 180,
} as const

export type TipoAlertaAbierta = keyof typeof LIMITES_ABIERTO_MIN

export const TIPO_ALERTA_LABEL: Record<TipoAlertaAbierta, string> = {
  recepcion: 'Contenedor en descarga',
  montacargas: 'PLU de montacargas abierto',
  picking: 'Orden de muebles en picking',
  inspeccion: 'Orden de muebles en inspección',
  camion: 'Camión en cargue',
}

export interface RegistroAbierto {
  tipo: TipoAlertaAbierta
  id: string
  titulo: string
  detalle: string | null
  desde: Date
  /** Quien lo tiene a su nombre: lo ve aunque no sea supervision. */
  duenoId: string | null
  /** Modulo que da permiso de verlo a supervision (canSeeModule). */
  modulo: string
  enlace: string
}

export interface AlertaAbierta {
  tipo: TipoAlertaAbierta
  id: string
  etiqueta: string
  titulo: string
  detalle: string | null
  desde: string
  minutos: number
  limite: number
  enlace: string
}

/** Supervision de cualquier area, gerencia y administracion. */
export function esGestionAlertas(role: string | null | undefined): boolean {
  const r = role ?? ''
  return r === 'ADMIN' || r === 'GERENTE' || r.startsWith('SUPERVISOR_')
}

/**
 * Lo que pasa el limite y le toca a esta persona: supervision ve lo de los
 * modulos que puede ver; los demas, solo lo que tienen a su nombre. Primero lo
 * mas pasado de su limite (proporcionalmente: 2 h en un PLU pesa mas que 7 h en
 * un contenedor).
 */
export function alertasAbiertas(
  registros: readonly RegistroAbierto[],
  ahora: Date,
  usuario: { id: string; role: string },
  puedeVer: (modulo: string) => boolean,
): AlertaAbierta[] {
  const gestion = esGestionAlertas(usuario.role)
  return registros
    .map((r) => ({ r, minutos: Math.floor((ahora.getTime() - r.desde.getTime()) / 60_000), limite: LIMITES_ABIERTO_MIN[r.tipo] }))
    .filter(({ r, minutos, limite }) => minutos >= limite && ((gestion && puedeVer(r.modulo)) || r.duenoId === usuario.id))
    .sort((a, b) => b.minutos / b.limite - a.minutos / a.limite)
    .map(({ r, minutos, limite }) => ({
      tipo: r.tipo,
      id: r.id,
      etiqueta: TIPO_ALERTA_LABEL[r.tipo],
      titulo: r.titulo,
      detalle: r.detalle,
      desde: r.desde.toISOString(),
      minutos,
      limite,
      enlace: r.enlace,
    }))
}

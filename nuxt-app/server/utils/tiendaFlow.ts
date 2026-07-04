// Máquina de estados del flujo Tienda → CEDI → Cliente.
// Portado 1:1 desde src/lib/tiendaFlow.ts (fuente única de verdad en la app Next).
export type EstadoDespacho =
  | 'CREADO_TIENDA'
  | 'RECHAZADO'
  | 'RECOGIDO_TIENDA'
  | 'ENTREGADO_CEDI'
  | 'ENVIADO_CLIENTE'
  | 'CON_NOVEDAD'

// Flujo simplificado a 3 estados: Pendiente recogida (CREADO_TIENDA) → En CEDI
// (ENTREGADO_CEDI) → Enviado al cliente (ENVIADO_CLIENTE). RECOGIDO_TIENDA queda
// como valor LEGADO (ya no se produce; los registros históricos se migran y se
// toleran sus transiciones hacia adelante). Ver docs/cerebro/decisiones.md.
export const ESTADOS_ACTIVOS: EstadoDespacho[] = ['CREADO_TIENDA', 'RECOGIDO_TIENDA', 'ENTREGADO_CEDI']

export const TRANSICIONES_VALIDAS: Record<EstadoDespacho, EstadoDespacho[]> = {
  CREADO_TIENDA: ['ENTREGADO_CEDI', 'CON_NOVEDAD', 'RECHAZADO'],
  RECHAZADO: ['CREADO_TIENDA'],
  // Legado: registros aún en RECOGIDO_TIENDA pueden avanzar a En CEDI o al cliente.
  RECOGIDO_TIENDA: ['ENTREGADO_CEDI', 'ENVIADO_CLIENTE', 'CON_NOVEDAD'],
  ENTREGADO_CEDI: ['ENVIADO_CLIENTE', 'CON_NOVEDAD'],
  ENVIADO_CLIENTE: [],
  CON_NOVEDAD: [],
}

export const ROLES_POR_TRANSICION: Record<string, string[]> = {
  'CREADO_TIENDA-ENTREGADO_CEDI': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  'CREADO_TIENDA-RECHAZADO': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  'RECHAZADO-CREADO_TIENDA': ['TIENDA', 'SUPERVISOR_TIENDA', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  'ENTREGADO_CEDI-ENVIADO_CLIENTE': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  // Legado (registros que quedaron en RECOGIDO_TIENDA antes de la fusión):
  'RECOGIDO_TIENDA-ENTREGADO_CEDI': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  'RECOGIDO_TIENDA-ENVIADO_CLIENTE': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
}

export function esTransicionValida(origen: EstadoDespacho, destino: EstadoDespacho): boolean {
  return TRANSICIONES_VALIDAS[origen]?.includes(destino) ?? false
}

export function rolPuedeTransicionar(role: string, origen: EstadoDespacho, destino: EstadoDespacho): boolean {
  if (destino === 'CON_NOVEDAD') return ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'].includes(role)
  return ROLES_POR_TRANSICION[`${origen}-${destino}`]?.includes(role) ?? false
}

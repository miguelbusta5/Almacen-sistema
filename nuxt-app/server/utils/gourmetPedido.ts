// Helpers de pedido — Cargue Gourmet. Portado 1:1 desde
// src/lib/gourmetTipoOrden.ts y src/lib/gourmetCliente.ts.

// Deriva el tipo de orden a partir del prefijo del código de orden. El
// usuario solo escribe la orden (ej. "TSDM123456"); el tipo se infiere aquí
// y se persiste en la columna `tipo_orden` (NOT NULL) del pedido.
export function derivarTipoOrden(orden: string): 'OVDM' | 'TSDM' {
  const o = orden.trim().toUpperCase()
  if (o.startsWith('TSDM')) return 'TSDM'
  if (o.startsWith('OVDM')) return 'OVDM'
  return 'OVDM' // fallback por defecto cuando no hay prefijo reconocible
}

// Valor especial de "código tienda" para pedidos que van directo al cliente
// final, sin tienda real asociada en MaestroTiendaGourmet.
export const CODIGO_TIENDA_CLIENTE = 'CLIENTE'
export const NOMBRE_TIENDA_CLIENTE = 'Cliente final'
export const CIUDAD_TIENDA_CLIENTE = 'CLIENTE'

export function esCodigoTiendaCliente(codigo: string): boolean {
  return codigo.trim().toUpperCase() === CODIGO_TIENDA_CLIENTE
}

// Igual que CLIENTE: valor especial para pedidos institucionales, sin tienda
// real asociada en MaestroTiendaGourmet.
export const CODIGO_TIENDA_INSTITUCIONAL = 'INSTITUCIONAL'
export const NOMBRE_TIENDA_INSTITUCIONAL = 'Institucional'
export const CIUDAD_TIENDA_INSTITUCIONAL = 'Institucional'

export function esCodigoTiendaInstitucional(codigo: string): boolean {
  return codigo.trim().toUpperCase() === CODIGO_TIENDA_INSTITUCIONAL
}

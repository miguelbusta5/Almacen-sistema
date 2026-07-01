// Valor especial de "código tienda" para pedidos Gourmet que van directo al
// cliente final, sin tienda real asociada en MaestroTiendaGourmet.
export const CODIGO_TIENDA_CLIENTE = "CLIENTE";
export const NOMBRE_TIENDA_CLIENTE = "Cliente final";
export const CIUDAD_TIENDA_CLIENTE = "CLIENTE";

export function esCodigoTiendaCliente(codigo: string): boolean {
  return codigo.trim().toUpperCase() === CODIGO_TIENDA_CLIENTE;
}

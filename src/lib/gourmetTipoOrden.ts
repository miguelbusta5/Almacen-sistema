// Deriva el tipo de orden Gourmet a partir del prefijo del código de orden.
// El usuario solo escribe la orden (ej. "TSDM123456"); el tipo se infiere aquí
// y se persiste en la columna `tipo_orden` (NOT NULL) del pedido.
export function derivarTipoOrden(orden: string): "OVDM" | "TSDM" {
  const o = orden.trim().toUpperCase();
  if (o.startsWith("TSDM")) return "TSDM";
  if (o.startsWith("OVDM")) return "OVDM";
  return "OVDM"; // fallback por defecto cuando no hay prefijo reconocible
}

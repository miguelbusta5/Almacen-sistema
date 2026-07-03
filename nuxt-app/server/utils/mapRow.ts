// Mapea la fila de TransporteGuardado al shape del cliente (igual que la app Next).
export function mapGuardado(r: any) {
  return {
    id: r.id,
    clientId: r.client_id,
    fecha: r.fecha.toISOString().slice(0, 10),
    documento: r.documento,
    ubicacion: r.ubicacion,
    estado: r.estado,
    tipo: r.tipo ?? 'COMUN',
    fechaDespacho: r.fecha_despacho ? r.fecha_despacho.toISOString().slice(0, 10) : null,
    nota: r.nota,
    ciudad: r.ciudad ?? null,
    netsuiteId: r.netsuiteId ?? null,
  }
}

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

// Mapea la fila de DespachoTienda al shape del cliente (igual que src/app/api/tienda/route.ts).
export function mapDespacho(r: any) {
  return {
    id: r.id,
    centroCostos: r.centroCostos,
    numeroDocumento: r.numeroDocumento,
    consecutivo: r.consecutivo,
    clienteNombre: r.clienteNombre,
    clienteDocumento: r.clienteDocumento,
    clienteTelefono: r.clienteTelefono,
    estado: r.estado,
    fechaCreacion: r.fechaCreacion instanceof Date ? r.fechaCreacion.toISOString().slice(0, 10) : r.fechaCreacion,
    fechaEntregaComprometida: r.fechaEntregaComprometida instanceof Date
      ? r.fechaEntregaComprometida.toISOString().slice(0, 10)
      : (r.fechaEntregaComprometida ?? null),
    numeroCajas: r.numeroCajas ?? null,
    netsuiteId: r.netsuiteId ?? null,
    recibidoAt: r.recibidoAt ? r.recibidoAt.toISOString() : null,
    entregadoCediAt: r.entregadoCediAt ? r.entregadoCediAt.toISOString() : null,
    despachadoAt: r.despachadoAt ? r.despachadoAt.toISOString() : null,
    novedadAt: r.novedadAt ? r.novedadAt.toISOString() : null,
    rechazadoAt: r.rechazadoAt ? r.rechazadoAt.toISOString() : null,
    motivoRechazo: r.motivoRechazo ?? null,
    notaEntrega: r.notaEntrega ?? null,
    guardadoPendiente: r.guardadoPendiente ? {
      id: r.guardadoPendiente.id,
      estado: r.guardadoPendiente.estado,
      asignadoAId: r.guardadoPendiente.asignadoAId,
      asignadoANombre: r.guardadoPendiente.asignadoA?.name ?? null,
      guardadoClientId: r.guardadoPendiente.guardadoClientId ?? null,
    } : null,
    direccionEntrega: r.direccionEntrega ?? null,
    barrio: r.barrio ?? null,
    ciudad: r.ciudad ?? null,
    departamento: r.departamento ?? null,
    latitud: r.latitud ?? null,
    longitud: r.longitud ?? null,
    contactoEntrega: r.contactoEntrega ?? null,
    telefonoEntrega: r.telefonoEntrega ?? null,
    fotoRecogidaUrl: r.fotoRecogidaUrl ?? null,
    fotoCediUrl: r.fotoCediUrl ?? null,
    recibidoPorCedi: r.recibidoPorCedi ?? null,
    observacionEntrega: r.observacionEntrega ?? null,
    fechaEntregaReal: r.fechaEntregaReal ? r.fechaEntregaReal.toISOString() : null,
    novedad: r.novedad ?? null,
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    plines: r.plines ?? [],
  }
}

export const ESTADO_DESPACHO_LABEL: Record<string, string> = {
  CREADO_TIENDA: 'Creado en tienda',
  RECHAZADO: 'Rechazado',
  RECOGIDO_TIENDA: 'Recogido en tienda',
  ENTREGADO_CEDI: 'Entregado en CEDI',
  ENVIADO_CLIENTE: 'Enviado al cliente',
  CON_NOVEDAD: 'Con novedad',
}

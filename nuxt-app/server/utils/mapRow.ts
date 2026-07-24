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
    codigoTienda: r.codigoTienda ?? null,
    nombreTienda: r.nombreTienda ?? null,
    clienteNombre: r.clienteNombre ?? null,
    clienteDocumento: r.clienteDocumento ?? null,
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
    tiendaOrigenCodigo: r.tiendaOrigenCodigo ?? null,
    tiendaOrigenNombre: r.tiendaOrigenNombre ?? null,
    ciudadOrigen: r.ciudadOrigen ?? null,
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

// Mapea la fila de GourmetPedido (listado) al shape del cliente — igual que
// src/app/api/cargue-gourmet/route.ts.
export function mapPedidoGourmet(r: any) {
  const ubicaciones = Array.from(
    new Set(
      (r.estibas ?? [])
        .slice()
        .sort((a: any, b: any) => a.secuencia - b.secuencia)
        .map((e: any) => (e.ubicacion ?? '').trim())
        .filter(Boolean)
    )
  ).join(', ')
  return {
    id: r.id,
    orden: r.orden,
    tipoOrden: r.tipoOrden,
    codigoTienda: r.codigoTienda,
    nombreTienda: r.nombreTienda,
    ciudadDestino: r.ciudadDestino,
    cajasEsperadas: r.cajasEsperadas,
    estibasEsperadas: r.estibasEsperadas,
    estado: r.estado,
    tipoPedido: r.tipoPedido,
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ubicacionAsignadaAt: r.ubicacionAsignadaAt ? r.ubicacionAsignadaAt.toISOString() : null,
    enviadoTransporteAt: r.enviadoTransporteAt ? r.enviadoTransporteAt.toISOString() : null,
    cargueIniciadoAt: r.cargueIniciadoAt ? r.cargueIniciadoAt.toISOString() : null,
    cargueCompletadoAt: r.cargueCompletadoAt ? r.cargueCompletadoAt.toISOString() : null,
    esCierreManual: r.esCierreManual,
    ubicaciones,
  }
}

// Mapea el detalle completo de GourmetPedido (con estibas/cajas/cargues/
// escaneos/novedades) — igual que src/app/api/cargue-gourmet/[id]/route.ts.
// `nombrePorId` resuelve los actores de cargues/escaneos/novedades (columnas
// planas sin relación de Prisma a User).
export function mapPedidoGourmetDetalle(r: any, nombrePorId: Map<string, string> = new Map()) {
  return {
    id: r.id,
    orden: r.orden,
    tipoOrden: r.tipoOrden,
    codigoTienda: r.codigoTienda,
    nombreTienda: r.nombreTienda,
    ciudadDestino: r.ciudadDestino,
    cajasEsperadas: r.cajasEsperadas,
    estibasEsperadas: r.estibasEsperadas,
    estado: r.estado,
    tipoPedido: r.tipoPedido,
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ubicacionAsignadaAt: r.ubicacionAsignadaAt ? r.ubicacionAsignadaAt.toISOString() : null,
    ubicacionAsignadaPorId: r.ubicacionAsignadaPorId ?? null,
    enviadoTransporteAt: r.enviadoTransporteAt ? r.enviadoTransporteAt.toISOString() : null,
    enviadoTransportePorId: r.enviadoTransportePorId ?? null,
    cargueIniciadoAt: r.cargueIniciadoAt ? r.cargueIniciadoAt.toISOString() : null,
    cargueIniciadoPorId: r.cargueIniciadoPorId ?? null,
    cargueCompletadoAt: r.cargueCompletadoAt ? r.cargueCompletadoAt.toISOString() : null,
    cargueCompletadoPorId: r.cargueCompletadoPorId ?? null,
    esCierreManual: r.esCierreManual,
    cantidadContadaManual: r.cantidadContadaManual ?? null,
    motivoCierreManual: r.motivoCierreManual ?? null,
    observacionCierreManual: r.observacionCierreManual ?? null,
    estibas: (r.estibas ?? []).map((e: any) => ({
      id: e.id, secuencia: e.secuencia, ubicacion: e.ubicacion, observacion: e.observacion ?? null,
    })),
    cajas: (r.cajas ?? []).map((c: any) => ({
      id: c.id, numeroSecuencia: c.numeroSecuencia ?? null, codigoCaja: c.codigoCaja ?? null, estibaId: c.estibaId ?? null,
    })),
    cargues: (r.cargues ?? []).map((c: any) => ({
      id: c.id,
      iniciadoPorId: c.iniciadoPorId,
      iniciadoPorNombre: nombrePorId.get(c.iniciadoPorId) ?? null,
      iniciadoAt: c.iniciadoAt.toISOString(),
      finalizadoPorId: c.finalizadoPorId ?? null,
      finalizadoPorNombre: c.finalizadoPorId ? nombrePorId.get(c.finalizadoPorId) ?? null : null,
      finalizadoAt: c.finalizadoAt ? c.finalizadoAt.toISOString() : null,
      tipoCierre: c.tipoCierre ?? null,
      cantidadEsperada: c.cantidadEsperada,
      cantidadEscaneada: c.cantidadEscaneada,
      cantidadContadaManual: c.cantidadContadaManual ?? null,
      motivoCierreManual: c.motivoCierreManual ?? null,
      observacion: c.observacion ?? null,
      estado: c.estado,
      escaneos: (c.escaneos ?? []).map((e: any) => ({
        id: e.id,
        codigoEscaneado: e.codigoEscaneado,
        resultado: e.resultado,
        escaneadoPorId: e.escaneadoPorId,
        escaneadoPorNombre: nombrePorId.get(e.escaneadoPorId) ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    })),
    novedades: (r.novedades ?? []).map((n: any) => ({
      id: n.id,
      tipo: n.tipo,
      estado: n.estado,
      descripcion: n.descripcion,
      registradaPorId: n.registradaPorId,
      registradaPorNombre: nombrePorId.get(n.registradaPorId) ?? null,
      resueltaPorId: n.resueltaPorId ?? null,
      resueltaPorNombre: n.resueltaPorId ? nombrePorId.get(n.resueltaPorId) ?? null : null,
      resueltaAt: n.resueltaAt ? n.resueltaAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
  }
}

// Flujo fusionado a 3 estados (ver docs/cerebro/decisiones.md): RECOGIDO_TIENDA
// es legado y se etiqueta igual que ENTREGADO_CEDI ("En CEDI"). Usado solo en
// mensajes de notificación/ActivityLog, no en la UI (ver app/utils/despacho.ts).
export const ESTADO_DESPACHO_LABEL: Record<string, string> = {
  CREADO_TIENDA: 'Pendiente recogida',
  RECHAZADO: 'Rechazado',
  RECOGIDO_TIENDA: 'En CEDI',
  ENTREGADO_CEDI: 'En CEDI',
  ENVIADO_CLIENTE: 'Enviado al cliente',
  CON_NOVEDAD: 'Con novedad',
}

// Mapea InspeccionPreoperacional (+ vehiculo/conductor/items) al shape del
// cliente — igual que src/app/api/preoperacional/route.ts.
export function mapInspeccion(i: any) {
  return {
    id: i.id,
    fecha: i.fecha instanceof Date ? i.fecha.toISOString().slice(0, 10) : i.fecha,
    kilometraje: i.kilometraje ?? null,
    observaciones: i.observaciones ?? null,
    estado: i.estado,
    vigente: i.vigente,
    createdAt: i.createdAt.toISOString(),
    vehiculo: i.vehiculo ? { id: i.vehiculo.id, placa: i.vehiculo.placa, tipo: i.vehiculo.tipo } : null,
    conductor: i.conductor ? { id: i.conductor.id, nombre: i.conductor.nombre } : null,
    items: (i.items ?? []).map((item: any) => ({
      id: item.id,
      categoria: item.categoria,
      item: item.item,
      resultado: item.resultado,
      esCritico: item.esCritico,
      fotoUrl: item.fotoUrl ?? null,
      observacion: item.observacion ?? null,
    })),
  }
}

// Mapea IntegracionPedido (+ plines/creadoPor/completadoPor) al shape del
// cliente — igual que src/app/api/integracion/route.ts.
export function mapIntegracion(r: any) {
  return {
    id: r.id,
    numeroDocumento: r.numeroDocumento,
    tipoDocumento: r.tipoDocumento,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
    estado: r.estado,
    areaIniciadora: r.areaIniciadora,
    numeroCajasArea1: r.numeroCajasArea1,
    numeroCajasArea2: r.numeroCajasArea2,
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    completadoPorNombre: r.completadoPor?.name ?? null,
    creadoAt: r.creadoAt,
    completadoAt: r.completadoAt,
    entregadoATransporteAt: r.entregadoATransporteAt,
    marcadoCompletadoPorId: r.marcadoCompletadoPorId ?? null,
    marcadoCompletadoAt: r.marcadoCompletadoAt,
    observaciones: r.observaciones,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    plines: (r.plines ?? []).map((p: any) => ({
      id: p.id, area: p.area, plu: p.plu, descripcion: p.descripcion ?? null, unidades: p.unidades,
    })),
  }
}

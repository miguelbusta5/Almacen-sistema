// Desde exportacionesCalc (puro), NO desde exportaciones: ese último importa el
// cliente de Prisma para el delegate por país, y mapRow lo usan los handlers de
// TODOS los módulos. Ver la nota en exportacionesCalc.ts.
import { calcularDuracionMinutos, formatDateOnly } from './exportacionesCalc'
import { avancePersonas } from './resurtidoAvance'
import {
  huboTraspaso, segundosDeAyudantes, segundosDelCreador, segundosTrabajados,
} from './montacargasCalc'
import { segundosRecepcion } from './recepcionCalc'
import { progresoMontaje, segundosEntre } from './resurtidoCalc'
import { desvioSugerencia } from './sugerenciaPendienteCalc'
import {
  duracionInspeccionNetaMinutos,
  inspeccionRepartida,
  duracionMinutos as duracionMinutosMuebles,
  leadTimeMinutos,
  minutosPrecisos,
  resumenOrden,
  volumenOrden,
} from './mueblesCalc'

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
    posicionesOcupadas: r.posicionesOcupadas ?? null,
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

// Mapea SolicitudTransporte al shape del cliente — port de mapSolicitudTransporte
// en src/app/api/solicitudes-transporte/route.ts.
// Ojo con dos detalles del original: `cantidadCajas` y `unidades` mapean la MISMA
// columna (`unidades`; no existe columna cantidadCajas), y `valorFlete` es Decimal
// de Prisma, así que necesita Number() o el JSON sale como objeto.
export function mapSolicitudTransporte(r: any) {
  const dateOnly = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : null)
  const iso = (v: any) => (v ? new Date(v).toISOString() : null)
  return {
    id: r.id,
    fechaSolicitud: dateOnly(r.fechaSolicitud),
    areaSolicitante: r.areaSolicitante,
    areaOtro: r.areaOtro,
    solicitanteNombre: r.solicitanteNombre,
    solicitanteCorreo: r.solicitanteCorreo,
    solicitanteTelefono: r.solicitanteTelefono,
    tipoVenta: r.tipoVenta,
    numeroPedido: r.numeroPedido,
    facturaIntegracion: r.facturaIntegracion,
    cobroFlete: r.cobroFlete,
    valorFlete: r.valorFlete === null || r.valorFlete === undefined ? null : Number(r.valorFlete),
    cantidadCajas: r.unidades,
    unidades: r.unidades,
    volumenEstimado: r.volumenEstimado,
    tipoMercancia: r.tipoMercancia,
    ciudadOrigen: r.ciudadOrigen,
    zonaRecogida: r.zonaRecogida,
    direccionRecogida: r.direccionRecogida,
    puntoRecogida: r.puntoRecogida,
    puntoRecogidaOtro: r.puntoRecogidaOtro,
    ciudadEntrega: r.ciudadEntrega,
    direccionEntrega: r.direccionEntrega,
    zonaEntrega: r.zonaEntrega,
    fechaPromesaEntrega: dateOnly(r.fechaPromesaEntrega),
    ventanaEntrega: r.ventanaEntrega,
    restriccionHoraria: r.restriccionHoraria,
    descripcionRestriccion: r.descripcionRestriccion,
    tipoServicio: r.tipoServicio,
    tipoServicioOtro: r.tipoServicioOtro,
    observacionesSolicitante: r.observacionesSolicitante,
    estado: r.estado,
    stellaEstado: r.stellaEstado,
    documentoNetSuite: r.documentoNetSuite,
    transportadora: r.transportadora,
    numeroGuia: r.numeroGuia,
    fechaProgramacion: dateOnly(r.fechaProgramacion),
    observacionTransporte: r.observacionTransporte,
    prioridad: r.prioridad,
    semaforo: r.semaforo,
    mesSolicitud: r.mesSolicitud,
    motivoRechazo: r.motivoRechazo,
    rechazadoAt: iso(r.rechazadoAt),
    reenviadoAt: iso(r.reenviadoAt),
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    gestionadoPorId: r.gestionadoPorId,
    gestionadoPorNombre: r.gestionadoPor?.name ?? null,
    deletedAt: iso(r.deletedAt),
    plines: (r.plines ?? []).map((p: any) => ({
      id: p.id, plu: p.plu, descripcion: p.descripcion, unidades: p.unidades,
    })),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }
}

// Historial de una solicitud. La app Next lo devuelve en GET /[id] pero su UI nunca
// lo consume; en Nuxt sí se muestra como timeline en el detalle.
export function mapHistorialSolicitud(h: any) {
  return {
    id: h.id,
    estadoAnterior: h.estadoAnterior,
    estadoNuevo: h.estadoNuevo,
    observacion: h.observacion,
    usuarioNombre: h.usuario?.name ?? null,
    createdAt: h.createdAt ? new Date(h.createdAt).toISOString() : null,
  }
}

// Mapea EtiquetadoExportacion (+ Mexico/Eeuu: los 3 modelos comparten forma) al
// shape del cliente — port de src/lib/exportaciones/map.ts.
// No expone hayReguero/cantidadReguero: no tienen UI, solo salen en el Excel.
export function mapExportacion(r: any) {
  return {
    id: r.id,
    numeroCaja: r.numeroCaja,
    plu: r.plu,
    descripcion: r.descripcion,
    unidadEmpaque: r.unidadEmpaque,
    fecha: formatDateOnly(r.fecha),
    horaInicio: r.horaInicio.toISOString(),
    horaFinalizacion: r.horaFinalizacion ? r.horaFinalizacion.toISOString() : null,
    duracionMinutos: calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion),
    motivoCorreccion: r.motivoCorreccion ?? null,
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    actualizadoPorId: r.actualizadoPorId ?? null,
    actualizadoPorNombre: r.actualizadoPor?.name ?? null,
  }
}

// Mapea la fila de MovimientoMontacargas al shape del cliente.
//
// `duracionMinutos` suma SOLO los tramos cerrados, no `fin - inicio`: entre
// medias puede haber una novedad, y verificar no se cronometra.
export function mapMovimientoMontacargas(r: any) {
  const tramos = (r.tramos ?? []).map((t: any) => ({
    id: t.id,
    orden: t.orden,
    usuarioId: t.usuarioId,
    usuarioNombre: t.usuario?.name ?? null,
    inicio: t.inicio.toISOString(),
    fin: t.fin ? t.fin.toISOString() : null,
  }))
  const novedades = (r.novedades ?? []).map((n: any) => ({
    id: n.id,
    tipo: n.tipo,
    detalle: n.detalle ?? null,
    cantidadEncontrada: n.cantidadEncontrada ?? null,
    ubicacionEncontrada: n.ubicacionEncontrada ?? null,
    abiertaPorId: n.abiertaPorId,
    abiertaPorNombre: n.abiertaPor?.name ?? null,
    abiertaAt: n.abiertaAt.toISOString(),
    resueltaPorId: n.resueltaPorId ?? null,
    resueltaPorNombre: n.resueltaPor?.name ?? null,
    resueltaAt: n.resueltaAt ? n.resueltaAt.toISOString() : null,
    notaResolucion: n.notaResolucion ?? null,
  }))

  return {
    pausaId: r.pausaId ?? null,
    pausaInicio: r.pausaInicio?.toISOString() ?? null,
    pausaSegundos: r.pausaSegundos ?? 0,
    id: r.id,
    tipo: r.tipo,
    estado: r.estado,
    plu: r.plu,
    ean: r.ean ?? null,
    descripcion: r.descripcion,
    cajas: r.cajas,
    unidadesPorCaja: r.unidadesPorCaja,
    unidadesManuales: r.unidadesManuales,
    hayReguero: r.hayReguero,
    unidadesSueltas: r.unidadesSueltas,
    cantidadTotal: r.cantidadTotal,
    ubicacionInicial: r.ubicacionInicial ?? null,
    ubicacionFinal: r.ubicacionFinal ?? null,
    fecha: formatDateOnly(r.fecha),
    horaInicio: r.horaInicio.toISOString(),
    horaFinalizacion: r.horaFinalizacion ? r.horaFinalizacion.toISOString() : null,
    duracionSegundos: r.horaFinalizacion ? segundosTrabajados(tramos) : null,
    // Los dos tramos por separado: el del montacarguista hasta que lo paso, y
    // el del ayudante desde ahi hasta que termino. Sumarlos en una sola cifra
    // escondia quien hizo que parte del trabajo.
    segundosMontacarguista: segundosDelCreador(tramos, r.creadoPorId),
    segundosAyudante: huboTraspaso(tramos, r.creadoPorId)
      ? segundosDeAyudantes(tramos, r.creadoPorId)
      : null,
    motivoCorreccion: r.motivoCorreccion ?? null,
    // Cuando el ayudante no pudo almacenar todo, lo que quedo nacio como un
    // registro aparte que apunta aqui. La UI lo marca para que nadie lo lea como
    // una estiba nueva que salio de la nada.
    origenId: r.origenId ?? null,
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    responsableId: r.responsableId,
    responsableNombre: r.responsable?.name ?? null,
    actualizadoPorId: r.actualizadoPorId ?? null,
    actualizadoPorNombre: r.actualizadoPor?.name ?? null,
    tramos,
    novedades,
    novedadAbierta: novedades.find((n: any) => !n.resueltaAt) ?? null,
  }
}


// ── Recepcion de Contenedores ────────────────────────────────────────
/**
 * Fila de recepcion -> DTO del cliente.
 *
 * `duracionSegundos` va en null mientras la recepcion esta abierta: el reloj
 * sigue corriendo y quien lo pinta es el cronometro del cliente, no el servidor.
 */
export function mapRecepcion(r: any) {
  return {
    pausaId: r.pausaId ?? null,
    pausaInicio: r.pausaInicio?.toISOString() ?? null,
    pausaSegundos: r.pausaSegundos ?? 0,
    id: r.id,
    estado: r.estado,
    numeroPedido: r.numeroPedido,
    proveedor: r.proveedor,
    tipoProducto: r.tipoProducto,
    tipoContenedor: r.tipoContenedor ?? null,
    // Decimal de Prisma: al cliente va como number, que es lo que espera el DTO.
    pesoKg: Number(r.pesoKg),
    referenciasEsperadas: r.referenciasEsperadas,
    cajas: r.cajas,
    unidades: r.unidades,
    estibasUsadas: r.estibasUsadas ?? null,
    referenciasNuevas: r.referenciasNuevas ?? null,
    unidadesNuevas: r.unidadesNuevas ?? null,
    fecha: formatDateOnly(r.fecha),
    horaInicio: r.horaInicio.toISOString(),
    horaFinalizacion: r.horaFinalizacion ? r.horaFinalizacion.toISOString() : null,
    duracionSegundos: r.horaFinalizacion ? Math.max(0, (segundosRecepcion(r.horaInicio, r.horaFinalizacion) ?? 0) - (r.pausaSegundos ?? 0)) : null,
    motivoCorreccion: r.motivoCorreccion ?? null,
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    descargadores: (r.descargadores ?? []).map((d: any) => ({
      id: d.usuarioId,
      nombre: d.usuario?.name ?? 'Usuario',
    })),
    novedades: (r.novedades ?? []).map((n: any) => ({
      id: n.id,
      tipo: n.tipo,
      plu: n.plu,
      descripcion: n.descripcion,
      cantidad: n.cantidad,
      fotoUrl: n.fotoUrl ?? null,
      observacion: n.observacion ?? null,
      creadoPorNombre: n.creadoPor?.name ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  }
}


// ── Montaje de resurtido, tareas y pendientes ────────────────────────
export function mapTareaResurtido(t: any) {
  return {
    // Tramos por persona: con ellos la pantalla muestra el reloj de quien la
    // tiene ahora, no el de la tarea desde que la empezo el primero.
    tramos: (t.tramos ?? []).map((x: any) => ({
      usuarioId: x.usuarioId,
      orden: x.orden,
      inicio: x.inicio?.toISOString?.() ?? x.inicio,
      fin: x.fin?.toISOString?.() ?? x.fin ?? null,
    })),
    pausaId: t.pausaId ?? null,
    pausaInicio: t.pausaInicio?.toISOString() ?? null,
    pausaSegundos: t.pausaSegundos ?? 0,
    id: t.id,
    orden: t.orden,
    estado: t.estado,
    plu: t.plu,
    descripcion: t.descripcion,
    altura: t.altura,
    pickingSugerido: t.pickingSugerido,
    unidadesSolicitadas: t.unidadesSolicitadas,
    // Se sumo un pendiente: va primero y en rojo. Las unidades del pendiente van
    // aparte para ver cuanto pidio el archivo y cuanto se sumo encima.
    prioridad: t.prioridad ?? false,
    unidadesPendientes: t.unidadesPendientes ?? 0,
    unidadesBajadas: t.unidadesBajadas ?? null,
    pickingFinal: t.pickingFinal ?? null,
    horaInicio: t.horaInicio ? t.horaInicio.toISOString() : null,
    horaFin: t.horaFin ? t.horaFin.toISOString() : null,
    // Pasada a un ayudante: quien la tiene ahora y quien se la paso. Null en
    // responsableId = la tiene el operario del montaje.
    responsableId: t.responsableId ?? null,
    responsableNombre: t.responsable?.name ?? null,
    pasadoPorId: t.pasadoPorId ?? null,
    pasadoPorNombre: t.pasadoPor?.name ?? null,
    // Null mientras no se ha escaneado la posicion: el reloj aun no arranco.
    duracionSegundos: t.horaInicio && t.horaFin ? Math.max(0, (segundosEntre(t.horaInicio, t.horaFin) ?? 0) - (t.pausaSegundos ?? 0)) : null,
  }
}

export function mapMontaje(m: any) {
  const tareas = (m.tareas ?? []).map(mapTareaResurtido)
  return {
    id: m.id,
    estado: m.estado,
    nombreArchivo: m.nombreArchivo,
    operarioId: m.operarioId,
    operarioNombre: m.operario?.name ?? null,
    creadoPorNombre: m.creadoPor?.name ?? null,
    fecha: formatDateOnly(m.fecha),
    montadoAt: m.montadoAt.toISOString(),
    detenidoSegundos: m.detenidoSegundos ?? 0,
    completadoAt: m.completadoAt ? m.completadoAt.toISOString() : null,
    // Supervision lo paro: las tareas sin empezar estan detenidas.
    detenidoAt: m.detenidoAt ? m.detenidoAt.toISOString() : null,
    progreso: progresoMontaje(tareas),
    personas: avancePersonas(m),
    tareas,
  }
}

export function mapPendiente(p: any) {
  return {
    // Tramos por persona: con ellos la pantalla muestra el reloj de quien la
    // tiene ahora, no el de la tarea desde que la empezo el primero.
    tramos: (p.tramos ?? []).map((x: any) => ({
      usuarioId: x.usuarioId,
      orden: x.orden,
      inicio: x.inicio?.toISOString?.() ?? x.inicio,
      fin: x.fin?.toISOString?.() ?? x.fin ?? null,
    })),
    pausaId: p.pausaId ?? null,
    pausaInicio: p.pausaInicio?.toISOString() ?? null,
    pausaSegundos: p.pausaSegundos ?? 0,
    id: p.id,
    estado: p.estado,
    plu: p.plu,
    descripcion: p.descripcion,
    unidadesSolicitadas: p.unidadesSolicitadas,
    observacion: p.observacion ?? null,
    solicitadoPorId: p.solicitadoPorId,
    solicitadoPorNombre: p.solicitadoPor?.name ?? null,
    solicitadoAt: p.solicitadoAt.toISOString(),
    asignadoPorNombre: p.asignadoPor?.name ?? null,
    operarioId: p.operarioId ?? null,
    operarioNombre: p.operario?.name ?? null,
    asignadoAt: p.asignadoAt ? p.asignadoAt.toISOString() : null,
    unidadesBajadas: p.unidadesBajadas ?? null,
    ubicacionInicial: p.ubicacionInicial ?? null,
    ubicacionFinal: p.ubicacionFinal ?? null,
    horaInicio: p.horaInicio ? p.horaInicio.toISOString() : null,
    horaFin: p.horaFin ? p.horaFin.toISOString() : null,
    completadoAt: p.completadoAt ? p.completadoAt.toISOString() : null,
    devueltoPorNombre: p.devueltoPor?.name ?? null,
    devueltoAt: p.devueltoAt ? p.devueltoAt.toISOString() : null,
    motivoDevolucion: p.motivoDevolucion ?? null,
    tipoNovedad: p.tipoNovedad ?? null,
    novedadPorNombre: p.novedadPor?.name ?? null,
    novedadAt: p.novedadAt ? p.novedadAt.toISOString() : null,
    tareaResurtidoId: p.tareaResurtidoId ?? null,
    pasadoPorId: p.pasadoPorId ?? null,
    pasadoPorNombre: p.pasadoPor?.name ?? null,
    // De que altura sacarlo y a que picking llevarlo (teorico vigente al asignar),
    // y si se uso otra ubicacion.
    sugerencia: p.sugerencia ?? null,
    desvio: desvioSugerencia(p.sugerencia ?? null, p.ubicacionInicial ?? null, p.ubicacionFinal ?? null),
    // Lo que lleva ESPERANDO desde que se pidio. Es otra cosa que el tiempo de
    // trabajo: mide al sistema, no al operario.
    esperaSegundos: segundosEntre(p.solicitadoAt, p.completadoAt, new Date()) ?? 0,
    duracionSegundos: p.horaInicio && p.horaFin ? Math.max(0, (segundosEntre(p.horaInicio, p.horaFin) ?? 0) - (p.pausaSegundos ?? 0)) : null,
  }
}

// ── Picking e Inspeccion de Muebles ─────────────────────────────────────────
// Las duraciones NO estan en la DB: se calculan aqui, igual que en
// Exportaciones. Persistirlas obligaria a recalcular cada fila al corregir una
// hora, y la correccion de horas es un caso real del area.

/** Minutos menos lo que estuvo en pausa (almuerzo), sin bajar de cero. */
function netoMin(min: number | null, pausaSegundos: number | null | undefined): number | null {
  if (min == null) return null
  return Math.round(Math.max(0, min - (pausaSegundos ?? 0) / 60) * 100) / 100
}

export function mapLineaMuebles(l: any) {
  return {
    id: l.id,
    plu: l.plu,
    descripcion: l.descripcion ?? null,
    partes: l.partes ?? null,
    pesoUnitarioKg: l.pesoUnitarioKg == null ? null : Number(l.pesoUnitarioKg),
    volumenUnitarioM3: l.volumenUnitarioM3 == null ? null : Number(l.volumenUnitarioM3),
    unidades: l.unidades ?? 0,
    ubicacion: l.ubicacion ?? null,
    numeroCaja: l.numeroCaja ?? null,
    volumenTotalM3: l.volumenTotalM3 == null ? null : Number(l.volumenTotalM3),
    pesoTotalKg: l.pesoTotalKg == null ? null : Number(l.pesoTotalKg),
    estado: l.estado,
    horaInicio: l.horaInicio?.toISOString?.() ?? l.horaInicio ?? null,
    horaFin: l.horaFin?.toISOString?.() ?? l.horaFin ?? null,
    // Con decimales y sin el almuerzo: un PLU de 12 s no es "0 min".
    duracionPickingMin: netoMin(minutosPrecisos(l.horaInicio, l.horaFin), l.pausaSegundos),
    inspHoraInicio: l.inspHoraInicio?.toISOString?.() ?? l.inspHoraInicio ?? null,
    inspHoraFin: l.inspHoraFin?.toISOString?.() ?? l.inspHoraFin ?? null,
    duracionInspeccionMin: duracionInspeccionNetaMinutos(l),
    ebanisteriaInicio: l.ebanisteriaInicio?.toISOString?.() ?? l.ebanisteriaInicio ?? null,
    ebanisteriaFin: l.ebanisteriaFin?.toISOString?.() ?? l.ebanisteriaFin ?? null,
    duracionEbanisteriaMin: duracionMinutosMuebles(l.ebanisteriaInicio, l.ebanisteriaFin),
    motivoEbanisteria: l.motivoEbanisteria ?? null,
    // Averia: esperando reposicion mientras reposicionInicio no tenga fin.
    averiado: l.averiado ?? false,
    errorPicking: l.erroresPicking?.[0]
      ? {
          id: l.erroresPicking[0].id,
          tipo: l.erroresPicking[0].tipo,
          nota: l.erroresPicking[0].nota ?? null,
          marcadoPor: l.erroresPicking[0].marcadoPor?.name ?? null,
        }
      : null,
    motivoAveria: l.motivoAveria ?? null,
    esperandoReposicion: Boolean(l.reposicionInicio && !l.reposicionFin),
    reposicionInicio: l.reposicionInicio?.toISOString?.() ?? l.reposicionInicio ?? null,
    reposicionFin: l.reposicionFin?.toISOString?.() ?? l.reposicionFin ?? null,
    almuerzoInicio: l.inspPausaInicio?.toISOString?.() ?? l.inspPausaInicio ?? null,
    operario: l.operario ? { id: l.operario.id, nombre: l.operario.name } : null,
    inspector: l.inspector ?? null,
    enviadoEbanisteriaPor: l.enviadoEbanisteriaPor ?? null,
    recibidoEbanisteriaPor: l.recibidoEbanisteriaPor ?? null,
  }
}

export function mapEquipoMuebles(e: any) {
  // Sin capacidad: el area decidio no medir el Order Picker ni el Genie.
  return { id: e.id, codigo: e.codigo, tipo: e.tipo, activo: e.activo ?? true }
}

export function mapOrdenMuebles(o: any) {
  // El tiempo de inspeccion de cada PLU va repartido entre los que el inspector
  // tenia abiertos a la vez; si no, abrir 23 PLU juntos daba 4 h por 11 min.
  const reparto = inspeccionRepartida(o.lineas ?? [])
  const lineas = (o.lineas ?? []).map((l: any) => {
    const m = mapLineaMuebles(l)
    return reparto.has(l) ? { ...m, duracionInspeccionMin: reparto.get(l)! } : m
  })
  return {
    id: o.id,
    codigo: o.codigo,
    tipoOrden: o.tipoOrden,
    estado: o.estado,
    fecha: o.fecha?.toISOString?.().slice(0, 10) ?? o.fecha ?? null,
    horaInicio: o.horaInicio?.toISOString?.() ?? o.horaInicio ?? null,
    horaPasoInspeccion: o.horaPasoInspeccion?.toISOString?.() ?? o.horaPasoInspeccion ?? null,
    horaFinInspeccion: o.horaFinInspeccion?.toISOString?.() ?? o.horaFinInspeccion ?? null,
    duracionPickingMin: netoMin(minutosPrecisos(o.horaInicio, o.horaPasoInspeccion), o.pausaSegundos),
    duracionInspeccionMin: netoMin(minutosPrecisos(o.horaPasoInspeccion, o.horaFinInspeccion), o.inspPausaSegundos),
    operario: o.operario ? { id: o.operario.id, nombre: o.operario.name } : null,
    equipo: o.equipo ? mapEquipoMuebles(o.equipo) : null,
    // En orden de entrada: el ultimo es quien pasa la orden a inspeccion.
    participantes: (o.participantes ?? []).map((p: any) => ({
      salioAt: p.salioAt?.toISOString() ?? null,
      id: p.usuarioId,
      nombre: p.usuario?.name ?? '',
      equipo: p.equipo?.codigo ?? null,
      esCreador: p.esCreador,
    })),
    inspector: o.inspector ?? null,
    // Todos los que han entrado a la orden (TSDM con varios inspectores).
    inspectores: (o.inspectores ?? []).map((i: any) => ({
      id: i.inspector?.id ?? i.inspectorId,
      nombre: i.inspector?.nombre ?? '',
      seUnioAt: i.seUnioAt?.toISOString?.() ?? i.seUnioAt ?? null,
    })),
    cliente: o.cliente ?? null,
    ciudadEnvio: o.ciudadEnvio ?? null,
    entregadaTransporteAt: o.entregadaTransporteAt?.toISOString?.() ?? o.entregadaTransporteAt ?? null,
    entregadaPor: o.entregadaPor ? { id: o.entregadaPor.id, nombre: o.entregadaPor.name } : null,
    // Todo el proceso: del primer PLU bajado a la entrega a transporte.
    leadTimeMin: leadTimeMinutos(o),
    almuerzoInicio: o.inspPausaInicio?.toISOString?.() ?? o.inspPausaInicio ?? null,
    almuerzoSegundos: o.inspPausaSegundos ?? 0,
    motivoCorreccion: o.motivoCorreccion ?? null,
    lineas,
    resumen: resumenOrden(lineas),
    volumen: volumenOrden(lineas),
  }
}

export function mapPendienteMuebles(p: any) {
  return {
    id: p.id,
    plu: p.plu,
    unidades: p.unidades,
    observacion: p.observacion ?? null,
    estado: p.estado,
    // FALTANTE (no estaba) o AVERIA (llego dañado: hay que traer otro).
    motivo: p.motivo ?? 'FALTANTE',
    orden: p.orden ? { id: p.orden.id, codigo: p.orden.codigo } : null,
    creadoPorInspector: p.creadoPorInspector ?? null,
    asignadoA: p.asignadoA ? { id: p.asignadoA.id, nombre: p.asignadoA.name } : null,
    resueltoPor: p.resueltoPor ? { id: p.resueltoPor.id, nombre: p.resueltoPor.name } : null,
    solicitadoAt: p.solicitadoAt?.toISOString?.() ?? p.solicitadoAt ?? null,
    horaInicio: p.horaInicio?.toISOString?.() ?? p.horaInicio ?? null,
    horaFin: p.horaFin?.toISOString?.() ?? p.horaFin ?? null,
    duracionMin: duracionMinutosMuebles(p.horaInicio, p.horaFin),
    // Lo que lleva esperando es un numero distinto de lo que costo resolverlo.
    esperaMin: duracionMinutosMuebles(p.solicitadoAt, p.horaInicio ?? new Date()),
  }
}

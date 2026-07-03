// Datos de ejemplo para modo demo (sin sesión/DB).
import type { Despacho } from './despacho'

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function isoAtHoursAgo(h: number): string {
  const d = new Date()
  d.setHours(d.getHours() - h)
  return d.toISOString()
}

function base(over: Partial<Despacho>): Despacho {
  return {
    id: 'demo', centroCostos: 'CC-100', numeroDocumento: 'FV-0000', consecutivo: '1',
    clienteNombre: 'Cliente demo', clienteDocumento: null, clienteTelefono: null,
    estado: 'CREADO_TIENDA', fechaCreacion: isoDaysAgo(1), fechaEntregaComprometida: null,
    numeroCajas: 1, netsuiteId: null,
    recibidoAt: null, entregadoCediAt: null, despachadoAt: null, novedadAt: null, rechazadoAt: null,
    motivoRechazo: null, notaEntrega: null, guardadoPendiente: null,
    direccionEntrega: null, barrio: null, ciudad: 'Bogota D.C.', departamento: null,
    contactoEntrega: null, telefonoEntrega: null, novedad: null,
    creadoPorId: 'demo', creadoPorNombre: 'Usuario demo',
    createdAt: isoAtHoursAgo(1), updatedAt: isoAtHoursAgo(1), plines: [],
    ...over,
  }
}

export const SAMPLE_DESPACHOS: Despacho[] = [
  base({
    id: 'd-1', numeroDocumento: 'FV-88231', consecutivo: '1', centroCostos: 'CC-Muebles',
    clienteNombre: 'Constructora Andina S.A.S', numeroCajas: 4, ciudad: 'Bogota D.C.',
    estado: 'CREADO_TIENDA', createdAt: isoAtHoursAgo(30), fechaCreacion: isoDaysAgo(1),
  }),
  base({
    id: 'd-2', numeroDocumento: 'FV-88544', consecutivo: '2', centroCostos: 'CC-Gourmet',
    clienteNombre: 'Restaurante La Sazon', numeroCajas: 2, ciudad: 'Medellin',
    estado: 'RECOGIDO_TIENDA', createdAt: isoAtHoursAgo(10), recibidoAt: isoAtHoursAgo(2),
  }),
  base({
    id: 'd-3', numeroDocumento: 'FV-89012', consecutivo: '3', centroCostos: 'CC-Muebles',
    clienteNombre: 'Hoteles del Caribe', numeroCajas: 8, ciudad: 'Cartagena',
    estado: 'ENTREGADO_CEDI', createdAt: isoAtHoursAgo(50), recibidoAt: isoAtHoursAgo(20), entregadoCediAt: isoAtHoursAgo(3),
  }),
  base({
    id: 'd-4', numeroDocumento: 'FV-89230', consecutivo: '4', centroCostos: 'CC-Gourmet',
    clienteNombre: 'Panaderia Central', numeroCajas: 1, ciudad: 'Cali',
    estado: 'ENVIADO_CLIENTE', createdAt: isoAtHoursAgo(80), recibidoAt: isoAtHoursAgo(60),
    entregadoCediAt: isoAtHoursAgo(40), despachadoAt: isoAtHoursAgo(5),
  }),
  base({
    id: 'd-5', numeroDocumento: 'FV-89401', consecutivo: '5', centroCostos: 'CC-Muebles',
    clienteNombre: 'Distribuidora Andes', numeroCajas: 3, ciudad: 'Bucaramanga',
    estado: 'CON_NOVEDAD', novedad: 'Cliente rechazó una caja por daño en el empaque.',
    createdAt: isoAtHoursAgo(35), recibidoAt: isoAtHoursAgo(20), novedadAt: isoAtHoursAgo(1),
  }),
  base({
    id: 'd-6', numeroDocumento: 'FV-89512', consecutivo: '6', centroCostos: 'CC-Gourmet',
    clienteNombre: 'Cafe Nariño', numeroCajas: 2, ciudad: 'Pasto',
    estado: 'RECHAZADO', motivoRechazo: 'Dirección de entrega incompleta.',
    createdAt: isoAtHoursAgo(15), rechazadoAt: isoAtHoursAgo(4),
  }),
]

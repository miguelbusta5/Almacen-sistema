// Datos de ejemplo para el mockup (no conectado a la API todavía).
// Las fechas son relativas a HOY para que los tiers de urgencia y los
// cobros de almacenaje se vean realistas al abrir la maqueta.
import type { Guardado, ContactoGuardado } from './guardado';

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isoInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export const SAMPLE_GUARDADOS: Guardado[] = [
  {
    id: 1, clientId: 't-1001', fecha: isoDaysAgo(112), documento: 'FV-88231',
    ubicacion: 'Pasillo B · Nivel 3', estado: 'PENDIENTE DESPACHO', tipo: 'ECOMMERCE',
    fechaDespacho: null, nota: `Cliente no responde. Entrega comprometida ${isoInDays(-9)}`,
    ciudad: 'Medellín', codigoTienda: null, nombreTienda: null,
    clienteNombre: 'Juliana Restrepo', clienteDocumento: '43128900', netsuiteId: '45120',
  },
  {
    id: 2, clientId: 't-1002', fecha: isoDaysAgo(74), documento: 'FV-88544',
    ubicacion: 'Bodega principal · A1', estado: 'PENDIENTE DESPACHO', tipo: 'COMUN',
    fechaDespacho: null, nota: `Pendiente coordinar transporte. Entrega ${isoInDays(2)}`,
    ciudad: 'Bogotá', codigoTienda: null, nombreTienda: null,
    clienteNombre: 'Carlos Andrés Peña', clienteDocumento: '79445210', netsuiteId: null,
  },
  {
    id: 3, clientId: 't-1003', fecha: isoDaysAgo(48), documento: 'REM-20391',
    ubicacion: 'Zona ecommerce · E12', estado: 'PENDIENTE DESPACHO', tipo: 'ECOMMERCE',
    fechaDespacho: null, nota: `Entrega ${isoInDays(4)}`,
    ciudad: 'Cali', codigoTienda: null, nombreTienda: null,
    clienteNombre: 'María Fernanda Ríos', clienteDocumento: '1144556677', netsuiteId: '45231',
  },
  {
    id: 4, clientId: 't-1004', fecha: isoDaysAgo(28), documento: 'FV-89012',
    ubicacion: 'Pasillo D · Nivel 1', estado: 'PENDIENTE DESPACHO', tipo: 'COMUN',
    fechaDespacho: null, nota: `Entrega ${isoInDays(12)}`,
    ciudad: 'Barranquilla', codigoTienda: null, nombreTienda: null,
    clienteNombre: 'Jorge Iván Salazar', clienteDocumento: '72334455', netsuiteId: null,
  },
  {
    id: 5, clientId: 't-1005', fecha: isoDaysAgo(15), documento: 'FV-89233',
    ubicacion: 'Bodega principal · C4', estado: 'PENDIENTE DESPACHO', tipo: 'COMUN',
    fechaDespacho: null, nota: 'Sin fecha de entrega definida aún',
    ciudad: null, codigoTienda: null, nombreTienda: null,
    clienteNombre: 'Sandra Milena Ortiz', clienteDocumento: '52667788', netsuiteId: null,
  },
  {
    id: 6, clientId: 't-1006', fecha: isoDaysAgo(6), documento: 'REM-20455',
    ubicacion: 'Zona ecommerce · E03', estado: 'PENDIENTE DESPACHO', tipo: 'ECOMMERCE',
    fechaDespacho: null, nota: `Entrega ${isoInDays(20)}`,
    ciudad: 'Medellín', codigoTienda: null, nombreTienda: null,
    clienteNombre: 'Andrés Felipe Gómez', clienteDocumento: '1017889900', netsuiteId: '45310',
  },
  {
    id: 7, clientId: 't-1007', fecha: isoDaysAgo(63), documento: 'FV-87990',
    ubicacion: 'Pasillo A · Nivel 2', estado: 'DESPACHADO', tipo: 'COMUN',
    fechaDespacho: isoDaysAgo(3), nota: 'Entregado al cliente en tienda',
    ciudad: 'Bogotá', codigoTienda: null, nombreTienda: null,
    clienteNombre: 'Luisa Fernanda Cárdenas', clienteDocumento: '80112233', netsuiteId: '44980',
  },
  {
    id: 8, clientId: 't-1008', fecha: isoDaysAgo(38), documento: 'FV-89320',
    ubicacion: 'Bodega principal · B7', estado: 'PENDIENTE DESPACHO', tipo: 'COMUN',
    fechaDespacho: null, nota: `Cliente pidió reprogramar. Entrega ${isoInDays(1)}`,
    ciudad: 'Pereira', codigoTienda: null, nombreTienda: null,
    clienteNombre: 'Ricardo Alonso Vélez', clienteDocumento: '98765432', netsuiteId: null,
  },
];

export const SAMPLE_CONTACTOS: Record<string, ContactoGuardado[]> = {
  't-1001': [
    { id: 'c1', guardadoClientId: 't-1001', tipo: 'ESCALACION', resultado: 'ESCALADO', fechaCompromiso: null, nota: 'Escalado a gerencia comercial por posible abandono.', registradoPorNombre: 'Laura M.', createdAt: isoDaysAgo(2) + 'T14:20:00' },
    { id: 'c2', guardadoClientId: 't-1001', tipo: 'LLAMADA', resultado: 'NO_CONTESTA', fechaCompromiso: null, nota: 'Tercer intento sin respuesta.', registradoPorNombre: 'Laura M.', createdAt: isoDaysAgo(6) + 'T09:10:00' },
    { id: 'c3', guardadoClientId: 't-1001', tipo: 'MENSAJE', resultado: 'NO_CONTESTA', fechaCompromiso: null, nota: 'WhatsApp entregado, sin lectura.', registradoPorNombre: 'Carlos R.', createdAt: isoDaysAgo(13) + 'T16:45:00' },
  ],
  't-1002': [
    { id: 'c4', guardadoClientId: 't-1002', tipo: 'LLAMADA', resultado: 'CONFIRMO_FECHA', fechaCompromiso: null, nota: 'Confirmó recogida para esta semana.', registradoPorNombre: 'Carlos R.', createdAt: isoDaysAgo(1) + 'T11:00:00' },
  ],
  't-1008': [
    { id: 'c5', guardadoClientId: 't-1008', tipo: 'MENSAJE', resultado: 'CANCELO', fechaCompromiso: null, nota: 'Solicitó reprogramar para próxima semana.', registradoPorNombre: 'Laura M.', createdAt: isoDaysAgo(4) + 'T15:30:00' },
  ],
};

export interface PendienteTienda {
  id: string;
  numeroDocumento: string;
  clienteNombre: string;
  centroCostos: string;
  numeroCajas: number | null;
  nota: string | null;
}

export const SAMPLE_PENDIENTES: PendienteTienda[] = [
  { id: 'p1', numeroDocumento: 'FV-89401', clienteNombre: 'Muebles del Valle S.A.S', centroCostos: 'Tienda Norte', numeroCajas: 4, nota: 'Retira transportadora asignada' },
  { id: 'p2', numeroDocumento: 'FV-89402', clienteNombre: 'Hogar & Estilo', centroCostos: 'Tienda Centro', numeroCajas: 2, nota: null },
];

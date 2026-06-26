import type { EstadoPedidoGourmet } from "../_components";

export interface EstibaDetalle {
  id: string;
  secuencia: number;
  ubicacion: string;
  observacion: string | null;
}

export interface CajaDetalle {
  id: string;
  numeroSecuencia: number | null;
  codigoCaja: string | null;
}

export interface EscaneoDetalle {
  id: string;
  codigoEscaneado: string;
  resultado: string;
  escaneadoPorId?: string;
  createdAt: string;
}

export interface CargueDetalle {
  id: string;
  estado: string;
  cantidadEsperada: number;
  cantidadEscaneada: number;
  tipoCierre: string | null;
  iniciadoPorId: string;
  iniciadoAt: string;
  finalizadoPorId: string | null;
  finalizadoAt: string | null;
  escaneos: EscaneoDetalle[];
}

export interface NovedadDetalle {
  id: string;
  tipo: string;
  estado: string;
  descripcion: string;
  registradaPorId: string;
  resueltaPorId: string | null;
  resueltaAt: string | null;
  createdAt: string;
}

export interface PedidoDetalle {
  id: string;
  orden: string;
  tipoOrden: string;
  estado: EstadoPedidoGourmet;
  codigoTienda: string;
  nombreTienda: string;
  ciudadDestino: string;
  cajasEsperadas: number;
  estibasEsperadas: number;
  creadoPorNombre: string | null;
  createdAt: string;
  updatedAt: string;
  ubicacionAsignadaAt: string | null;
  enviadoTransporteAt: string | null;
  cargueIniciadoAt: string | null;
  cargueCompletadoAt: string | null;
  estibas: EstibaDetalle[];
  cajas: CajaDetalle[];
  cargues: CargueDetalle[];
  novedades: NovedadDetalle[];
}

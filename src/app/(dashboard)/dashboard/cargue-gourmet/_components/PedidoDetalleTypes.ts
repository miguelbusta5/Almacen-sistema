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
  // Estiba a la que pertenece (G2+). Nula en cajas legacy sin escaneo inicial.
  estibaId: string | null;
}

export interface EscaneoDetalle {
  id: string;
  codigoEscaneado: string;
  resultado: string;
  escaneadoPorId?: string;
  escaneadoPorNombre?: string | null;
  createdAt: string;
}

export interface CargueDetalle {
  id: string;
  estado: string;
  cantidadEsperada: number;
  cantidadEscaneada: number;
  tipoCierre: string | null;
  iniciadoPorId: string;
  iniciadoPorNombre: string | null;
  iniciadoAt: string;
  finalizadoPorId: string | null;
  finalizadoPorNombre: string | null;
  finalizadoAt: string | null;
  escaneos: EscaneoDetalle[];
}

export interface NovedadDetalle {
  id: string;
  tipo: string;
  estado: string;
  descripcion: string;
  registradaPorId: string;
  registradaPorNombre: string | null;
  resueltaPorId: string | null;
  resueltaPorNombre: string | null;
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

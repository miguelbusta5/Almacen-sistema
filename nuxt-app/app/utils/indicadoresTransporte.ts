// Indicadores de Cargue de camiones — tipos de la respuesta (espejo de
// server/utils/cargueIndicadoresCalc.ts; la pantalla no importa del servidor).

export const API_INDICADORES_TRANSPORTE = '/api/indicadores-transporte'

export interface ResumenCargueDTO {
  camiones: number
  ordenes: number
  bultos: number
  bultosDeclarados: number
  dias: number
  camionesDia: number | null
  bultosDia: number | null
  minCamion: number | null
  minOrden: number | null
  bultosHora: number | null
  ordenesPorCamion: number | null
  bultosPorCamion: number | null
  novedades: number
  pctNovedad: number | null
  m3: number
  kg: number
  valorOvdm: number
}

export interface GrupoCargueDTO {
  clave: string
  camiones: number
  ordenes: number
  bultos: number
  minCamion: number | null
  minOrden: number | null
}

export interface IndicadoresTransporteDTO {
  rango: { desde: string; hasta: string }
  anterior: { desde: string; hasta: string; resumen: ResumenCargueDTO }
  resumen: ResumenCargueDTO
  porDia: Array<{ dia: string; camiones: number; ordenes: number; bultos: number; valorOvdm: number; m3: number; kg: number }>
  porTransportadora: GrupoCargueDTO[]
  porCiudad: GrupoCargueDTO[]
  porVehiculo: GrupoCargueDTO[]
  porOperario: GrupoCargueDTO[]
  porOrigen: GrupoCargueDTO[]
  porHora: Array<{ hora: number; camiones: number }>
  novedades: Array<{ fecha: string; codigo: string; transportadora: string; ciudad: string | null; declarados: number | null; cargados: number | null; nota: string | null }>
  camiones: Array<{
    fecha: string; transportadora: string; tipoVehiculo: string; placa: string | null; inicio: string; fin: string | null
    minutos: number | null; ordenes: number; bultos: number; personas: number; novedades: number
  }>
}

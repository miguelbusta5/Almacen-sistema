// Clasificación de escaneo — Cargue Gourmet. Función pura, sin acceso a base
// de datos — el endpoint le pasa los datos ya consultados y aplica el
// resultado. Portado 1:1 desde src/lib/gourmetEscaneo.ts.
export type ResultadoEscaneoGourmet =
  | 'VALIDO'
  | 'DUPLICADO'
  | 'CAJA_AJENA'
  | 'FORMATO_INVALIDO'
  | 'EXCEDE_CANTIDAD'

export type ModoCodigoGourmet =
  | 'QR_UNICO_CAJA'
  | 'QR_SOLO_ORDEN'
  | 'SIN_CODIGOS_PREVIOS'

export type TipoNovedadSugeridoGourmet =
  | 'CAJA_DUPLICADA'
  | 'CAJA_AJENA'
  | 'DIFERENCIA_CANTIDAD'

export interface ClasificarEscaneoGourmetInput {
  codigo: string
  ordenPedido: string
  cajasEsperadas: number
  /** Solo relevante en modo QR_UNICO_CAJA: códigos de caja registrados al ubicar. */
  codigosCajaEsperados?: string[]
  /** Códigos que ya tuvieron un escaneo VALIDO en este cargue. */
  escaneosValidosPrevios: string[]
  modoCodigo: ModoCodigoGourmet
  /**
   * Solo aplica a pedidos de tipo MUEBLES: un mueble puede venir en más de
   * una parte física con el mismo número de caja impreso — al marcar
   * "tiene parte 2" se permite repetir el código sin marcarlo DUPLICADO,
   * contando cada parte como una caja adicional. Rompe la regla de
   * duplicados a propósito, solo para este escaneo puntual.
   */
  permitirRepetirCaja?: boolean
}

export interface ClasificarEscaneoGourmetResultado {
  resultado: ResultadoEscaneoGourmet
  debeCrearNovedad: boolean
  tipoNovedadSugerido?: TipoNovedadSugeridoGourmet
  incrementaContador: boolean
  mensaje: string
}

function normalizar(s: string): string {
  return s.trim().toUpperCase()
}

function formatoValido(codigo: string): boolean {
  return normalizar(codigo).length > 0
}

function perteneceAOrden(codigo: string, ordenPedido: string): boolean {
  return normalizar(codigo).includes(normalizar(ordenPedido))
}

export function clasificarEscaneoGourmet(input: ClasificarEscaneoGourmetInput): ClasificarEscaneoGourmetResultado {
  const { codigo, ordenPedido, cajasEsperadas, codigosCajaEsperados, escaneosValidosPrevios, modoCodigo, permitirRepetirCaja } = input

  if (!formatoValido(codigo)) {
    return { resultado: 'FORMATO_INVALIDO', debeCrearNovedad: false, incrementaContador: false, mensaje: 'Código vacío o ilegible — vuelve a escanear.' }
  }

  const codigoNorm = normalizar(codigo)
  const previosNorm = escaneosValidosPrevios.map(normalizar)
  const cantidadValidaPrevia = previosNorm.length

  if (modoCodigo === 'QR_UNICO_CAJA') {
    const esperados = (codigosCajaEsperados ?? []).map(normalizar)
    const perteneceAlPedido = esperados.includes(codigoNorm)

    if (!perteneceAlPedido) {
      return { resultado: 'CAJA_AJENA', debeCrearNovedad: true, tipoNovedadSugerido: 'CAJA_AJENA', incrementaContador: false, mensaje: 'Esta caja no pertenece a este pedido.' }
    }
    if (previosNorm.includes(codigoNorm) && !permitirRepetirCaja) {
      return { resultado: 'DUPLICADO', debeCrearNovedad: true, tipoNovedadSugerido: 'CAJA_DUPLICADA', incrementaContador: false, mensaje: 'Esta caja ya fue escaneada antes en este cargue.' }
    }
    if (previosNorm.includes(codigoNorm) && permitirRepetirCaja) {
      return { resultado: 'VALIDO', debeCrearNovedad: false, incrementaContador: true, mensaje: 'Caja válida — parte 2 del mueble, contada como caja adicional.' }
    }
    return { resultado: 'VALIDO', debeCrearNovedad: false, incrementaContador: true, mensaje: 'Caja válida.' }
  }

  if (modoCodigo === 'QR_SOLO_ORDEN') {
    if (!perteneceAOrden(codigoNorm, ordenPedido)) {
      return { resultado: 'CAJA_AJENA', debeCrearNovedad: true, tipoNovedadSugerido: 'CAJA_AJENA', incrementaContador: false, mensaje: 'El código no corresponde a la orden de este pedido.' }
    }
    if (cantidadValidaPrevia >= cajasEsperadas) {
      return { resultado: 'EXCEDE_CANTIDAD', debeCrearNovedad: true, tipoNovedadSugerido: 'DIFERENCIA_CANTIDAD', incrementaContador: false, mensaje: 'Ya se alcanzó la cantidad esperada de cajas para esta orden.' }
    }
    return { resultado: 'VALIDO', debeCrearNovedad: false, incrementaContador: true, mensaje: 'Escaneo válido (código de orden, no certifica caja física única).' }
  }

  // SIN_CODIGOS_PREVIOS — el pedido no registró códigos de caja al ubicar.
  if (!perteneceAOrden(codigoNorm, ordenPedido)) {
    return { resultado: 'CAJA_AJENA', debeCrearNovedad: true, tipoNovedadSugerido: 'CAJA_AJENA', incrementaContador: false, mensaje: 'El código no corresponde a la orden de este pedido.' }
  }
  if (cantidadValidaPrevia >= cajasEsperadas) {
    return { resultado: 'EXCEDE_CANTIDAD', debeCrearNovedad: true, tipoNovedadSugerido: 'DIFERENCIA_CANTIDAD', incrementaContador: false, mensaje: 'Ya se alcanzó la cantidad esperada de cajas para esta orden.' }
  }
  return { resultado: 'VALIDO', debeCrearNovedad: false, incrementaContador: true, mensaje: 'Escaneo válido.' }
}

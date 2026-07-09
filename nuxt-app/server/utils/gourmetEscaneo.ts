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
  escaneosValidosPrevios?: string[]
  /**
   * Alternativa a `escaneosValidosPrevios`, precomputada en la base de
   * datos: con cargues grandes, cargar el arreglo completo de códigos
   * previos dentro del lock FOR UPDATE crecía linealmente con cada caja
   * escaneada. Solo se necesitan dos datos: si ESTE código ya tuvo un
   * escaneo VALIDO, y cuántos escaneos VALIDOS hay en total (una
   * consulta puntual indexada + el contador que el cargue ya mantiene).
   */
  previos?: { yaEscaneadoValido: boolean; cantidadValida: number }
  modoCodigo: ModoCodigoGourmet
  /**
   * Solo aplica a pedidos de tipo MUEBLES: un mueble puede venir en varias
   * partes físicas (2, 3, 4…) con el mismo número de caja impreso — al
   * marcar la opción en cada parte adicional se permite repetir el código
   * sin marcarlo DUPLICADO, contando cada parte como una caja adicional.
   * Rompe la regla de duplicados a propósito, solo para este escaneo
   * puntual (no hay límite de repeticiones).
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
  const { codigo, ordenPedido, cajasEsperadas, codigosCajaEsperados, escaneosValidosPrevios, previos, modoCodigo, permitirRepetirCaja } = input

  if (!formatoValido(codigo)) {
    return { resultado: 'FORMATO_INVALIDO', debeCrearNovedad: false, incrementaContador: false, mensaje: 'Código vacío o ilegible — vuelve a escanear.' }
  }

  const codigoNorm = normalizar(codigo)
  const previosNorm = (escaneosValidosPrevios ?? []).map(normalizar)
  const yaEscaneadoValido = previos ? previos.yaEscaneadoValido : previosNorm.includes(codigoNorm)
  const cantidadValidaPrevia = previos ? previos.cantidadValida : previosNorm.length

  if (modoCodigo === 'QR_UNICO_CAJA') {
    const esperados = (codigosCajaEsperados ?? []).map(normalizar)
    const perteneceAlPedido = esperados.includes(codigoNorm)

    if (!perteneceAlPedido) {
      return { resultado: 'CAJA_AJENA', debeCrearNovedad: true, tipoNovedadSugerido: 'CAJA_AJENA', incrementaContador: false, mensaje: 'Esta caja no pertenece a este pedido.' }
    }
    if (yaEscaneadoValido && !permitirRepetirCaja) {
      return { resultado: 'DUPLICADO', debeCrearNovedad: true, tipoNovedadSugerido: 'CAJA_DUPLICADA', incrementaContador: false, mensaje: 'Esta caja ya fue escaneada antes en este cargue.' }
    }
    // Antes esta comprobación no existía en este modo (a diferencia de los
    // otros dos) — un pedido con más códigos de caja registrados que
    // cajasEsperadas (por edición del encabezado o corrección de cajas)
    // podía escanear de más sin ninguna alerta, y el error solo aparecía
    // después, de forma opaca, al intentar finalizar.
    if (cantidadValidaPrevia >= cajasEsperadas) {
      return { resultado: 'EXCEDE_CANTIDAD', debeCrearNovedad: true, tipoNovedadSugerido: 'DIFERENCIA_CANTIDAD', incrementaContador: false, mensaje: 'Ya se alcanzó la cantidad esperada de cajas para este pedido.' }
    }
    if (yaEscaneadoValido && permitirRepetirCaja) {
      return { resultado: 'VALIDO', debeCrearNovedad: false, incrementaContador: true, mensaje: 'Caja válida — otra parte del mueble, contada como caja adicional.' }
    }
    return { resultado: 'VALIDO', debeCrearNovedad: false, incrementaContador: true, mensaje: 'Caja válida.' }
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

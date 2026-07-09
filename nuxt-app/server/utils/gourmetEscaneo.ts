// Clasificación de escaneo — Cargue Gourmet. Función pura, sin acceso a base
// de datos — el endpoint le pasa los datos ya consultados y aplica el
// resultado. (Originalmente portado de src/lib/gourmetEscaneo.ts; la regla
// de duplicados evolucionó aquí: ver multiplicidad abajo.)
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
  /** Solo relevante en modo QR_UNICO_CAJA: códigos de caja registrados al crear/ubicar. */
  codigosCajaEsperados?: string[]
  /**
   * Precomputado en la base de datos (consultas puntuales indexadas, no el
   * arreglo completo de escaneos — con cargues grandes eso crecía
   * linealmente dentro del lock FOR UPDATE):
   * - escaneosValidosDelCodigo: cuántos escaneos VALIDO previos tiene ESTE
   *   código en el cargue actual.
   * - cantidadValida: total de escaneos VALIDO del cargue (el contador que
   *   el propio cargue ya mantiene).
   */
  previos: { escaneosValidosDelCodigo: number; cantidadValida: number }
  modoCodigo: ModoCodigoGourmet
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

export function clasificarEscaneoGourmet(input: ClasificarEscaneoGourmetInput): ClasificarEscaneoGourmetResultado {
  const { codigo, cajasEsperadas, codigosCajaEsperados, previos, modoCodigo } = input

  if (!formatoValido(codigo)) {
    return { resultado: 'FORMATO_INVALIDO', debeCrearNovedad: false, incrementaContador: false, mensaje: 'Código vacío o ilegible — vuelve a escanear.' }
  }

  const codigoNorm = normalizar(codigo)
  const cantidadValidaPrevia = previos.cantidadValida

  if (modoCodigo === 'QR_UNICO_CAJA') {
    // Regla de duplicados por MULTIPLICIDAD (reemplaza al checkbox manual
    // "esta caja tiene varias partes" de MUEBLES): el pedido ya sabe
    // cuántas cajas con este código se registraron al crearlo/ubicarlo.
    // Si registró el código 2 veces (mueble en 2 partes), los primeros 2
    // escaneos son VALIDOS sin preguntar nada; el 3º es DUPLICADO. En
    // GOURMET cada código aparece 1 vez, así que se comporta igual que la
    // regla clásica de "no repetir".
    const esperados = (codigosCajaEsperados ?? []).map(normalizar)
    const registradasDelCodigo = esperados.filter((c) => c === codigoNorm).length

    if (registradasDelCodigo === 0) {
      return { resultado: 'CAJA_AJENA', debeCrearNovedad: true, tipoNovedadSugerido: 'CAJA_AJENA', incrementaContador: false, mensaje: 'Esta caja no pertenece a este pedido.' }
    }
    if (previos.escaneosValidosDelCodigo >= registradasDelCodigo) {
      const detalle = registradasDelCodigo === 1
        ? 'Esta caja ya fue escaneada antes en este cargue.'
        : `Este pedido registra ${registradasDelCodigo} cajas con este código y ya se escanearon todas.`
      return { resultado: 'DUPLICADO', debeCrearNovedad: true, tipoNovedadSugerido: 'CAJA_DUPLICADA', incrementaContador: false, mensaje: detalle }
    }
    // Un pedido con más códigos de caja registrados que cajasEsperadas
    // (por edición del encabezado o corrección de cajas) podía escanear
    // de más sin alerta, y el error solo aparecía después, de forma
    // opaca, al intentar finalizar.
    if (cantidadValidaPrevia >= cajasEsperadas) {
      return { resultado: 'EXCEDE_CANTIDAD', debeCrearNovedad: true, tipoNovedadSugerido: 'DIFERENCIA_CANTIDAD', incrementaContador: false, mensaje: 'Ya se alcanzó la cantidad esperada de cajas para este pedido.' }
    }
    return { resultado: 'VALIDO', debeCrearNovedad: false, incrementaContador: true, mensaje: 'Caja válida.' }
  }

  // SIN_CODIGOS_PREVIOS — el pedido no registró códigos de caja al
  // crearlo/ubicarlo: no hay contra qué comparar, así que NO hay alertas
  // de caja ajena ni de duplicado (decisión explícita del usuario; antes
  // se exigía que el código contuviera el número de orden, herencia del
  // flujo legado). La única alerta es el tope de cantidad — sin ella,
  // "Enviar" rechazaría después de forma opaca. Las cajas escaneadas se
  // convierten en las cajas asignadas del pedido al finalizar (ver
  // finalizar.post.ts).
  if (cantidadValidaPrevia >= cajasEsperadas) {
    return { resultado: 'EXCEDE_CANTIDAD', debeCrearNovedad: true, tipoNovedadSugerido: 'DIFERENCIA_CANTIDAD', incrementaContador: false, mensaje: 'Ya se alcanzó la cantidad esperada de cajas para esta orden.' }
  }
  return { resultado: 'VALIDO', debeCrearNovedad: false, incrementaContador: true, mensaje: 'Escaneo válido.' }
}

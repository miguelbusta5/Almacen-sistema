import { describe, expect, it } from 'vitest'
import { cargarNuxt } from './apoyo/nuxt'
// Logica pura de nuxt-app: se carga como texto (ver apoyo/nuxt.ts), no se importa.
const { fechasCronograma, leerMaestroPvp } = cargarNuxt('utils/inventarioMaestro.ts')

const headers = ['Referencia Original', 'Nombre para mostrar', 'Nombre del proveedor', 'Fabricante', 'Código UPC', 'Precio unitario', 'MARCAS', 'GRUPO']
const producto = ['00123', 'Plato', 'REF-1', 'Proveedor correcto', '0001234567890', 1200.50, 'Gourmet', 'Mesa']
describe('Maestro PVP de inventarios', () => {
  it('respeta el cruce confirmado y conserva ceros de los identificadores', () => {
    expect(leerMaestroPvp([headers, producto]).productos[0]).toEqual({ plu: '00123', descripcion: 'Plato', proveedor: 'Proveedor correcto', upc: '0001234567890', precio: 1200.50, marca: 'Gourmet', linea: 'Mesa' })
  })
  it('resuelve columnas por encabezado y no por posición', () => {
    expect(leerMaestroPvp([[...headers].reverse(), [...producto].reverse()]).productos[0]?.plu).toBe('00123')
  })
  it('rechaza duplicados contradictorios y consolida los idénticos', () => {
    expect(leerMaestroPvp([headers, producto, producto]).resumen.repetidos).toBe(1)
    expect(() => leerMaestroPvp([headers, producto, ['00123', 'Otro', ...producto.slice(2)]])).toThrow('datos diferentes')
  })
  it('distingue precio cero de precio faltante', () => {
    const rows = [headers, ['1', '', '', '', '', null, '', ''], ['2', 'Otro', '', '', '', 0, '', '']]
    const result = leerMaestroPvp(rows)
    expect(result.resumen.sinPrecio).toBe(1)
    expect(result.productos[1]?.precio).toBe(0)
    expect(result.resumen.sinUpc).toBe(2)
  })
  it('detecta UPC compartido sin asignarlo silenciosamente a un solo PLU', () => {
    expect(leerMaestroPvp([headers, producto, ['456', ...producto.slice(1)]]).resumen.upcCompartidos).toBe(1)
  })
  it('muestra las filas sin PLU como exclusiones para revisión, sin inventar identificadores', () => {
    const resultado = leerMaestroPvp([headers, producto, [null, 'SERVICIO FRANQUICIA', null, null, null, 0, null, 'SERVICIOS']])
    expect(resultado.resumen.sinPlu).toEqual([{ fila: 3, descripcion: 'SERVICIO FRANQUICIA' }])
    expect(resultado.productos).toHaveLength(1)
  })
  it('rechaza archivo sin columnas, sin productos o precios inválidos', () => {
    expect(() => leerMaestroPvp([['PLU'], ['1']])).toThrow('Encabezado')
    expect(() => leerMaestroPvp([headers, []])).toThrow('no contiene')
    expect(() => leerMaestroPvp([headers, [...producto.slice(0, 5), -1, 'Gourmet', 'Mesa']])).toThrow('precio inválido')
  })
  it('rechaza encabezados repetidos e identificadores numéricos inseguros', () => {
    expect(() => leerMaestroPvp([[...headers, 'Código UPC'], producto])).toThrow('repetido')
    expect(() => leerMaestroPvp([headers, ['1', 'Plato', '', '', 1e20, 0, '', '']])).toThrow('UPC inválido')
  })
})
describe('Duración de cronogramas', () => {
  it('incluye el primer día y cruza meses correctamente', () => {
    expect(fechasCronograma('2026-09-30', 2).fechaFin.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(fechasCronograma('2026-09-30', 1).fechaFin.toISOString()).toBe('2026-09-30T00:00:00.000Z')
  })
  it('rechaza fechas imposibles y duraciones inválidas', () => {
    expect(() => fechasCronograma('2026-02-30', 1)).toThrow('Fecha')
    for (const dias of [0, -1, 1.5, 367, NaN]) expect(() => fechasCronograma('2026-09-18', dias)).toThrow('duración')
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  claveUbicacion, desvioSugerencia, sugerirAlturas, teoricoVigente, type FilaTeorico,
} from '@/lib/sugerenciaPendiente'

const alm = (ubicacion: string, disponible: number): FilaTeorico => ({ plu: '10', ubicacion, disponible, concepto: 'ALMACENAMIENTO' })
const nada = new Map<string, number>()

describe('sugerencia de altura para pendientes', () => {
  it('redondea a cajas completas y elige la altura con menos existencia que alcance', () => {
    const r = sugerirAlturas({
      unidadesSolicitadas: 5, unidadesPorCaja: 6, comprometido: nada,
      filas: [alm('A-GRANDE', 60), alm('A-CHICA', 12), alm('A-CORTA', 4), { plu: '10', ubicacion: 'P1', disponible: 3, concepto: 'RETIRO' }],
    })
    // 5 und con caja de 6 = 1 caja (6 und). A-CORTA (4) no alcanza una caja.
    expect(r).toEqual({ alturas: [{ ubicacion: 'A-CHICA', cajas: 1, unidades: 6 }], unidadesSugeridas: 6, faltante: 0 })
  })

  it('combina alturas de menor a mayor si ninguna alcanza sola', () => {
    const r = sugerirAlturas({ unidadesSolicitadas: 30, unidadesPorCaja: 6, comprometido: nada, filas: [alm('B', 18), alm('A', 12)] })
    expect(r.alturas).toEqual([{ ubicacion: 'A', cajas: 2, unidades: 12 }, { ubicacion: 'B', cajas: 3, unidades: 18 }])
    expect(r.faltante).toBe(0)
  })

  it('reporta el faltante cuando la reserva no alcanza', () => {
    const r = sugerirAlturas({ unidadesSolicitadas: 30, unidadesPorCaja: 6, comprometido: nada, filas: [alm('A', 12)] })
    expect(r.alturas).toEqual([{ ubicacion: 'A', cajas: 2, unidades: 12 }])
    expect(r.faltante).toBe(18)
  })

  it('descuenta lo ya comprometido para no mandar dos veces por lo mismo', () => {
    const comprometido = new Map([[claveUbicacion('04-F-01'), 12]])
    const r = sugerirAlturas({ unidadesSolicitadas: 12, unidadesPorCaja: 6, comprometido, filas: [alm('04-F-01', 12), alm('04-F-09', 30)] })
    expect(r.alturas).toEqual([{ ubicacion: '04-F-09', cajas: 2, unidades: 12 }])
  })

  it('sin unidad de empaque calcula en unidades', () => {
    const r = sugerirAlturas({ unidadesSolicitadas: 5, unidadesPorCaja: null, comprometido: nada, filas: [alm('A', 4), alm('B', 9)] })
    expect(r).toEqual({ alturas: [{ ubicacion: 'B', cajas: null, unidades: 5 }], unidadesSugeridas: 5, faltante: 0 })
  })

  it('el teorico sirve 12 horas', () => {
    const cargado = new Date('2026-09-15T06:00:00Z')
    expect(teoricoVigente(cargado, new Date('2026-09-15T17:59:00Z'))).toBe(true)
    expect(teoricoVigente(cargado, new Date('2026-09-15T18:01:00Z'))).toBe(false)
  })

  it('detecta si no se uso la altura o el picking sugeridos', () => {
    const s = { alturas: [{ ubicacion: '04-F-01', cajas: 1, unidades: 6 }], picking: '02-B-02-01-10' }
    expect(desvioSugerencia(s, '04-f-01', '02-B-02-01-10')).toEqual({ altura: false, picking: false })
    expect(desvioSugerencia(s, '04-F-09', '02-B-02-01-11')).toEqual({ altura: true, picking: true })
    expect(desvioSugerencia(null, 'X', 'Y')).toEqual({ altura: null, picking: null })
  })
})

// Nitro no puede importar de src/lib: su copia debe ser identica a esta fuente.
describe('sugerencia de pendientes — copia de Nitro', () => {
  it('es identica a src/lib/sugerenciaPendiente.ts', () => {
    const limpiar = (s: string) => s.split(String.fromCharCode(13)).join('')
    const salto = String.fromCharCode(10)
    const lineas = limpiar(readFileSync('src/lib/sugerenciaPendiente.ts', 'utf8')).split(salto)
    const fuente = lineas.slice(lineas.findIndex((l) => !l.startsWith('//'))).join(salto).trim()
    const copiaLineas = limpiar(readFileSync('nuxt-app/server/utils/sugerenciaPendienteCalc.ts', 'utf8')).split(salto)
    const copia = copiaLineas.slice(copiaLineas.findIndex((l) => !l.startsWith('//'))).join(salto).trim()
    expect(copia).toBe(fuente)
  })
})

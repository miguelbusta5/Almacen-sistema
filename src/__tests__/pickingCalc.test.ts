import { describe, it, expect } from 'vitest'
import { calcularPicking, leerTeoricoPicking, type PickingFila, type PickingBase } from '../../nuxt-app/server/utils/pickingCalc'
const base: PickingBase = { plu: '10', ubicacion: 'P1', cajas: 10, tipo: 'DOBLE', unidadesPorCaja: 12, descripcion: 'Producto' }
const retiro = (n: number, ubicacion = 'P1'): PickingFila => ({ plu: '10', ubicacion, disponible: n, concepto: 'RETIRO' })
const altura = (n: number, ubicacion = 'A1'): PickingFila => ({ plu: '10', ubicacion, disponible: n, concepto: 'ALMACENAMIENTO' })
const calc = (filas: PickingFila[], b = base) => calcularPicking([b], filas, new Set())[0]!
describe('Capacidad picking', () => {
  it('usa los encabezados del Excel real y suma filas repetidas', () => {
    expect(leerTeoricoPicking([['Artículo', 'Nombre para mostrar', 'Número de depósito', 'Disponible', 'WMS Aisle'], [10, 'x', 'P1', 12, 'retiro'], [10, 'x', 'P1', 8, 'RETIRO']])).toEqual([retiro(20)])
  })
  it('rechaza cantidades vacías o negativas y conceptos desconocidos', () => {
    for (const n of [null, '', -1, Infinity]) expect(() => leerTeoricoPicking([['Artículo','Número de depósito','Disponible','WMS Aisle'], [10,'P1',n,'RETIRO']])).toThrow()
  })
  it('conserva existencias decimales del teórico real y solicita cajas enteras', () => {
    const filas = leerTeoricoPicking([['Artículo','Número de depósito','Disponible','WMS Aisle'], [10,'P1',0.62,'RETIRO'],[10,'A1',120,'Almacenamiento']])
    expect(filas[0]?.disponible).toBe(0.62)
    expect(calc(filas).cajasSolicitadas).toBe(9)
  })
  it('no multiplica doble profundidad y redondea hacia abajo', () => {
    const r = calc([retiro(95), altura(120)])
    expect(r.capacidad).toBe(120); expect(r.cajasSolicitadas).toBe(2); expect(r.tareas[0]?.unidadesSolicitadas).toBe(24)
  })
  it.each([120, 121, 200])('no resurte existencias %s iguales o superiores', n => expect(calc([retiro(n), altura(120)]).tareas).toEqual([]))
  it('selecciona la menor altura que cubra toda la solicitud', () => {
    const r = calc([retiro(60), altura(24,'A1'), altura(72,'A2'), altura(60,'A3')])
    expect(r.tareas.map(t => t.altura)).toEqual(['A3'])
  })
  it('combina alturas de menor a mayor cuando ninguna cubre', () => {
    const r = calc([retiro(60), altura(36,'A2'), altura(24,'A1')])
    expect(r.tareas.map(t => [t.altura,t.unidadesSolicitadas])).toEqual([['A1',24],['A2',36]])
  })
  it('resurte solo cajas completas disponibles y reporta faltante', () => {
    const r = calc([retiro(60), altura(25)])
    expect(r.tareas[0]?.unidadesSolicitadas).toBe(24); expect(r.faltantes).toBe(3)
  })
  it('no asume cero cuando falta retiro', () => expect(calc([altura(120)]).aviso).toBe('Picking ausente del teórico'))
  it('bloquea dobles y solo permite la validación de la ubicación vigente', () => {
    const filas = [retiro(0), retiro(24,'P2'), altura(120)]
    expect(calc(filas).tareas).toEqual([])
    const validacion = { '10': { ubicacion: 'P1', usuarioId: 'u1', fecha: '2026-09-14' } }
    expect(calcularPicking([base],filas,new Set(),validacion)[0]?.tareas).toHaveLength(1)
    expect(calcularPicking([{...base,ubicacion:'P2'}],filas,new Set(),validacion)[0]?.tareas).toHaveLength(0)
  })
  it('bloquea PLU con tarea pendiente incluso validado', () => expect(calcularPicking([base],[retiro(0),altura(120)],new Set(['10']))[0]?.tareas).toEqual([]))
  it('reporta ausencia de conversión', () => expect(calc([retiro(0)],{...base,unidadesPorCaja:0}).aviso).toContain('maestro'))
})

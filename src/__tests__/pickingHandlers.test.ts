import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
function load(file: string, deps: Record<string, unknown>) {
  const source = readFileSync(path.resolve('nuxt-app/server', file), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: any = {}
  new Function('require', 'exports', code)((k: string) => { if (!(k in deps)) throw new Error(k); return deps[k] }, exports)
  return exports.default
}
const h3 = { defineEventHandler: (fn: unknown) => fn, readBody: async (body: unknown) => body, createError: (v: object) => Object.assign(new Error(), v) }
function reportScenario() {
  let report: any = { id: 'r1', autorId: 'u1', estado: 'ABIERTO', inicio: new Date('2026-09-14T08:00:00Z'), pausaInicio: null, pausaSegundos: 0, pausas: [], revision: 0, lineas: [{ plu:'10',ubicacion:'P1',cajas:10,tipo:'DOBLE' }] }
  const tx: any = {
    pickingInforme: {
      findUnique: vi.fn(async () => report), findFirst: vi.fn(async () => report),
      update: vi.fn(async ({ data }) => { for (const [k,v] of Object.entries(data)) report[k] = k === 'revision' ? report.revision + 1 : v; return {...report} }),
      create: vi.fn(),
    },
    pickingCapacidad: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), createMany: vi.fn() },
    pickingLinea: { upsert: vi.fn(), deleteMany: vi.fn() },
    productoMaestro: { findUnique: vi.fn(async () => ({plu:'10'})) },
    activityLog: { create: vi.fn() },
  }
  const permission = vi.fn(async () => {})
  const handler = load('api/capacidad-picking/index.post.ts', { h3, '../../utils/auth': { requireAuth: async () => ({id:'u1',name:'Brayan'}) }, '../../utils/picking': { exigirPicking: permission, bloquearPicking: vi.fn(), informeConMaestro: async (_db: unknown, r: any) => ({ ...r, lineas: r.lineas.map((l: any) => ({ ...l, descripcion: 'Producto', unidadesPorCaja: 12, unidades: l.cajas * 12 })) }) }, '../../utils/prisma': { prisma: { $transaction: async (fn: any) => fn(tx) } }, '../../utils/pickingCalc': { textoPicking: (s: unknown) => String(s ?? '').trim().toUpperCase() }, '../../utils/codigoProducto': { resolverPluMaestro: async (c: unknown) => String(c ?? '') } })
  return { handler, tx, report, permission }
}
afterEach(() => vi.useRealTimers())
describe('informes de picking: persistencia y permisos', () => {
  it('crear recupera el informe abierto sin reiniciar su reloj', async () => {
    const e = reportScenario(); const r = await e.handler({accion:'crear'})
    expect(r.inicio).toEqual(new Date('2026-09-14T08:00:00Z')); expect(e.tx.pickingInforme.create).not.toHaveBeenCalled()
  })
  it('la respuesta trae descripcion y unidades del maestro', async () => {
    const e = reportScenario(); const r = await e.handler({accion:'crear'})
    expect(r.lineas[0]).toMatchObject({ descripcion: 'Producto', unidadesPorCaja: 12, unidades: 120 })
  })
  it('rechaza escrituras sin permiso individual', async () => {
    const e = reportScenario(); e.permission.mockRejectedValueOnce({statusCode:403})
    await expect(e.handler({accion:'crear'})).rejects.toMatchObject({statusCode:403})
    expect(e.tx.pickingInforme.findFirst).not.toHaveBeenCalled()
  })
  it('rechaza revisión antigua y el informe de otro autor', async () => {
    const e = reportScenario()
    await expect(e.handler({id:'r1',accion:'finalizar',revision:5})).rejects.toMatchObject({statusCode:409})
    e.report.autorId = 'u2'
    await expect(e.handler({id:'r1',accion:'finalizar',revision:0})).rejects.toMatchObject({statusCode:409})
    expect(e.tx.pickingCapacidad.createMany).not.toHaveBeenCalled()
  })
  it.each(['ALIMENTACION','FIN_TURNO'])('excluye la pausa %s y conserva líneas', async motivo => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-14T09:00:00Z'))
    const e = reportScenario()
    await e.handler({id:'r1',accion:'pausar',motivo,revision:0})
    await expect(e.handler({id:'r1',accion:'finalizar',revision:1})).rejects.toMatchObject({statusCode:409})
    vi.setSystemTime(new Date('2026-09-15T09:00:00Z'))
    const r = await e.handler({id:'r1',accion:'reanudar',revision:1})
    expect(r.pausaSegundos).toBe(86400); expect(r.pausaInicio).toBeNull(); expect(r.pausas).toHaveLength(1); expect(r.lineas).toHaveLength(1)
  })
  it('finalizar publica solo los PLU recorridos y sella el informe', async () => {
    const e = reportScenario(); await e.handler({id:'r1',accion:'finalizar',revision:0})
    expect(e.tx.pickingCapacidad.deleteMany).toHaveBeenCalledWith({where:{plu:{in:['10']}}})
    expect(e.report.estado).toBe('FINALIZADO'); expect(e.report.fin).toBeInstanceOf(Date)
    await expect(e.handler({id:'r1',accion:'linea',revision:1})).rejects.toMatchObject({statusCode:409})
  })
  it('no publica si la ubicación pertenece a un PLU no incluido', async () => {
    const e = reportScenario(); e.tx.pickingCapacidad.findMany.mockResolvedValue([{plu:'20',ubicacion:'P1'}])
    await expect(e.handler({id:'r1',accion:'finalizar',revision:0})).rejects.toMatchObject({statusCode:409})
    expect(e.tx.pickingCapacidad.deleteMany).not.toHaveBeenCalled()
  })
})
describe('confirmación de teórico', () => {
  function scenario() {
    let montajeId: string | null = null
    let cola = Promise.resolve()
    const filas = [{plu:'10',tareas:[{plu:'10',descripcion:'Producto',altura:'A1',pickingSugerido:'P1',unidadesSolicitadas:24}]}]
    const tx = { user: {findFirst: vi.fn(async () => ({id:'o1'}))}, montajeResurtido: {create:vi.fn(async () => ({id:'m1'}))}, pickingTeorico:{update:vi.fn(async ({data}: any) => {montajeId=data.montajeId})}, activityLog:{create:vi.fn()} }
    const preview = vi.fn(async () => ({carga:{id:'t1',nombre:'Excel',montajeId},filas}))
    const handler = load('api/picking-teorico/accion.post.ts',{h3,'../../utils/auth':{requireAuth:async()=>({id:'u1',role:'ADMIN'})},'../../utils/picking':{bloquearPicking:async()=>{},exigirTeorico:async()=>{},previewPicking:preview},'../../utils/prisma':{prisma:{$transaction:(fn:any)=>{const run=cola.then(()=>fn(tx));cola=run.catch(()=>{});return run}}},'../../utils/exportacionesCalc':{todayBogota:()=>new Date()}})
    return {handler,tx,preview,body:{id:'t1',accion:'generar',operarioId:'o1',plus:['10'],firma:JSON.stringify(filas)}}
  }
  it('recalcula y rechaza una vista previa desactualizada', async () => {
    const e = scenario(); await expect(e.handler({...e.body,firma:'vieja'})).rejects.toMatchObject({statusCode:409}); expect(e.tx.montajeResurtido.create).not.toHaveBeenCalled()
  })
  it('dos confirmaciones serializadas generan un solo montaje', async () => {
    const e = scenario(); const resultados = await Promise.allSettled([e.handler(e.body),e.handler(e.body)])
    expect(resultados.map(r=>r.status)).toEqual(['fulfilled','rejected']); expect(e.tx.montajeResurtido.create).toHaveBeenCalledTimes(1)
  })
})

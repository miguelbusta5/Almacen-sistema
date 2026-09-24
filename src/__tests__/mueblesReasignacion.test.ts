import {beforeEach,expect,it,vi} from 'vitest'
import { cargarHandlerNuxt, h3Falso } from './apoyo/nuxt'
// El endpoint se carga como texto (ver apoyo/nuxt.ts): importarlo obliga a CI a
// resolver el tsconfig de Nuxt, que ahi no existe.
const m={body:vi.fn(),actor:vi.fn(),orden:vi.fn(),abierta:vi.fn(),equipo:vi.fn(),audit:vi.fn(),user:{findFirst:vi.fn()},participante:{update:vi.fn(),upsert:vi.fn()},linea:{updateMany:vi.fn()},noti:{create:vi.fn()},ordenTx:{update:vi.fn()},tx:vi.fn()}
// Sacar al saliente y meter al entrante va en UNA transaccion: a medias, la
// orden se queda sin participante activo y nadie puede cerrarla.
const dentroDeTx={participanteOrdenMuebles:m.participante,lineaMuebles:m.linea,notificacion:m.noti,ordenMuebles:m.ordenTx}
const handler=cargarHandlerNuxt('api/picking-muebles/[id]/reasignar.post.ts',{
  h3:h3Falso({getRouterParam:()=>'o',readBody:m.body}),
  '../../../utils/operacionAlmacen':{defineOperacionAlmacenHandler:(f:unknown)=>f},
  '../../../utils/prisma':{prisma:{user:m.user,$transaction:m.tx}},
  '../../../utils/muebles':{requirePickingActivo:m.actor,ordenPorId:m.orden,ordenAbierta:m.abierta,equipoDelDia:m.equipo,auditar:m.audit,esParticipante:(o:any,id:string)=>o.participantes.some((p:any)=>p.usuarioId===id&&!p.salioAt)},
})
const event={} as never
let orden:any
beforeEach(()=>{vi.resetAllMocks();m.tx.mockImplementation((cb:any)=>cb(dentroDeTx));orden={id:'o',codigo:'QA',estado:'EN_PICKING',lineas:[{operarioId:'a',estado:'PICKING_LISTO'}],participantes:[{usuarioId:'a',salioAt:null}]};m.actor.mockResolvedValue({id:'a',name:'Primero'});m.orden.mockImplementation(async()=>orden);m.body.mockResolvedValue({operarioId:'b'});m.user.findFirst.mockResolvedValue({id:'b',name:'Segundo'});m.abierta.mockResolvedValue(null);m.equipo.mockResolvedValue({id:'equipo'});m.participante.update.mockImplementation(async()=>{orden.participantes[0].salioAt=new Date()})})
it('libera al primero, incorpora al segundo y no cambia la autoría de PLU',async()=>{await handler(event);expect(m.tx).toHaveBeenCalledOnce();expect(orden.participantes[0].salioAt).toBeInstanceOf(Date);expect(m.participante.upsert).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({usuarioId:'b',ordenId:'o'})}));expect(orden.lineas[0].operarioId).toBe('a');expect(m.linea.updateMany).not.toHaveBeenCalled();expect(m.noti.create).toHaveBeenCalledOnce()})
it('no permite liberar al primero con un PLU abierto',async()=>{orden.lineas[0].estado='EN_PICKING';await expect(handler(event)).rejects.toMatchObject({statusCode:409});expect(m.participante.update).not.toHaveBeenCalled()})
// 24-09: si el otro ya tiene una orden abierta ya no se bloquea: queda
// TRANSFERIDA a su nombre, pendiente de picking, y el que la pasa queda libre.
it('operario ocupado en otra orden: queda transferida y pendiente de picking',async()=>{
  m.abierta.mockResolvedValue({id:'otra',codigo:'OVDM9'})
  const r=await handler(event)
  expect(r).toMatchObject({transferida:true,operario:'Segundo'})
  expect(orden.participantes[0].salioAt).toBeInstanceOf(Date)
  expect(m.participante.upsert).not.toHaveBeenCalled()
  expect(m.ordenTx.update).toHaveBeenCalledWith({where:{id:'o'},data:{transferidaAId:'b',transferidaAt:expect.any(Date)}})
  expect(m.noti.create.mock.calls[0][0].data).toMatchObject({userId:'b',titulo:expect.stringContaining('pendiente de picking')})
  expect(m.audit.mock.calls[0][4]).toContain('transferida a Segundo')
})
it('una segunda solicitud del operario liberado no vuelve a reasignar',async()=>{await handler(event);await expect(handler(event)).rejects.toMatchObject({statusCode:403});expect(m.participante.update).toHaveBeenCalledOnce()})
it('si falla al incorporar al entrante, no queda nadie con la orden',async()=>{
  m.tx.mockImplementation(async(cb:any)=>{m.participante.upsert.mockRejectedValueOnce(new Error('caida'));await cb(dentroDeTx)})
  await expect(handler(event)).rejects.toThrow()
  expect(m.audit).not.toHaveBeenCalled()
})

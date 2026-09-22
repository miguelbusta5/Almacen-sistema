import {beforeEach,expect,it,vi} from 'vitest'
const m=vi.hoisted(()=>({body:vi.fn(),actor:vi.fn(),orden:vi.fn(),abierta:vi.fn(),equipo:vi.fn(),audit:vi.fn(),user:{findFirst:vi.fn()},participante:{update:vi.fn(),upsert:vi.fn()},linea:{updateMany:vi.fn()},noti:{create:vi.fn()}}))
vi.mock('../../nuxt-app/node_modules/h3/dist/index.mjs',()=>({getRouterParam:()=> 'o',readBody:m.body,createError:(o:object)=>Object.assign(new Error(),o)}))
vi.mock('../../nuxt-app/server/utils/operacionAlmacen',()=>({defineOperacionAlmacenHandler:(f:unknown)=>f}))
vi.mock('../../nuxt-app/server/utils/prisma',()=>({prisma:{user:m.user,participanteOrdenMuebles:m.participante,lineaMuebles:m.linea,notificacion:m.noti}}))
vi.mock('../../nuxt-app/server/utils/muebles',()=>({requirePickingActivo:m.actor,ordenPorId:m.orden,ordenAbierta:m.abierta,equipoDelDia:m.equipo,auditar:m.audit,esParticipante:(o:any,id:string)=>o.participantes.some((p:any)=>p.usuarioId===id&&!p.salioAt)}))
import handler from '../../nuxt-app/server/api/picking-muebles/[id]/reasignar.post'
const event={} as Parameters<typeof handler>[0]
let orden:any
beforeEach(()=>{vi.resetAllMocks();orden={id:'o',codigo:'QA',estado:'EN_PICKING',lineas:[{operarioId:'a',estado:'PICKING_LISTO'}],participantes:[{usuarioId:'a',salioAt:null}]};m.actor.mockResolvedValue({id:'a',name:'Primero'});m.orden.mockImplementation(async()=>orden);m.body.mockResolvedValue({operarioId:'b'});m.user.findFirst.mockResolvedValue({id:'b',name:'Segundo'});m.abierta.mockResolvedValue(null);m.equipo.mockResolvedValue({id:'equipo'});m.participante.update.mockImplementation(async()=>{orden.participantes[0].salioAt=new Date()})})
it('libera al primero, incorpora al segundo y no cambia la autoría de PLU',async()=>{await handler(event);expect(orden.participantes[0].salioAt).toBeInstanceOf(Date);expect(m.participante.upsert).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({usuarioId:'b',ordenId:'o'})}));expect(orden.lineas[0].operarioId).toBe('a');expect(m.linea.updateMany).not.toHaveBeenCalled();expect(m.noti.create).toHaveBeenCalledOnce()})
it('no permite liberar al primero con un PLU abierto',async()=>{orden.lineas[0].estado='EN_PICKING';await expect(handler(event)).rejects.toMatchObject({statusCode:409});expect(m.participante.update).not.toHaveBeenCalled()})
it('impide asignar a un operario ocupado en otra orden',async()=>{m.abierta.mockResolvedValue({id:'otra'});await expect(handler(event)).rejects.toMatchObject({statusCode:409});expect(m.participante.update).not.toHaveBeenCalled()})
it('una segunda solicitud del operario liberado no vuelve a reasignar',async()=>{await handler(event);await expect(handler(event)).rejects.toMatchObject({statusCode:403});expect(m.participante.update).toHaveBeenCalledOnce()})

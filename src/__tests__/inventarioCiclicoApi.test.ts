import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarHandlerNuxt, cargarNuxt, h3Falso } from './apoyo/nuxt'
// El endpoint se carga como texto (ver apoyo/nuxt.ts): importarlo obliga a CI a
// resolver el tsconfig de Nuxt, que ahi no existe.
const m={auth:vi.fn(),permiso:vi.fn(),body:vi.fn(),tx:vi.fn(),ciclo:{findUnique:vi.fn(),update:vi.fn()},tarea:{findFirst:vi.fn(),update:vi.fn(),create:vi.fn()},caso:{create:vi.fn(),update:vi.fn()},conteo:{upsert:vi.fn()},producto:vi.fn(),lock:vi.fn(),audit:vi.fn(),noti:{create:vi.fn()},acceso:{findUnique:vi.fn()},user:{findUnique:vi.fn()}}
const handler=cargarHandlerNuxt('api/inventarios/accion.post.ts',{
  h3:h3Falso({readBody:m.body}),
  '../../utils/prisma':{prisma:{$transaction:m.tx}},
  '../../utils/auth':{requireAuth:m.auth},
  '../../utils/inventarioCiclico':{actorInventario:m.permiso,lockInventario:m.lock,auditarInventario:m.audit,filasInventario:(x:unknown)=>x,productoInventario:m.producto},
  // La logica pura va de verdad: es lo que se quiere probar.
  '../../utils/inventarioCiclicoCalc':cargarNuxt('utils/inventarioCiclicoCalc.ts'),
})
const event={} as never
const task=()=>({id:'t',usuarioId:'u',ubicacion:'A1',tipo:'INICIAL',estado:'EN_CURSO',revision:0,inicio:new Date('2026-09-20T12:00:00Z'),pausaInicio:null,pausaSegundos:0,pausas:[],registros:[]})
let ciclo:any
beforeEach(()=>{
  vi.resetAllMocks();vi.useRealTimers();m.auth.mockResolvedValue({id:'u',name:'Juan'});m.permiso.mockResolvedValue({contar:true,gestionar:false})
  ciclo={id:'c',cronogramaId:'cro',estado:'EN_CONTEO',autorId:'carlos',nombre:'Día 1',filas:[{plu:'1',ubicacion:'A1',concepto:'RETIRO',disponible:25}],tareas:[task()],casos:[]};m.ciclo.findUnique.mockImplementation(async()=>ciclo)
  m.tx.mockImplementation(cb=>cb({inventarioCiclico:m.ciclo,inventarioTarea:m.tarea,inventarioCaso:m.caso,inventarioConteo:m.conteo,notificacion:m.noti,inventarioAcceso:m.acceso,user:m.user}));m.producto.mockResolvedValue({plu:'1'});m.acceso.findUnique.mockResolvedValue({contar:true});m.user.findUnique.mockResolvedValue({active:true});m.tarea.findFirst.mockResolvedValue(null)
})
describe('Cíclico: permisos, recuperación y reconteo',()=>{
  it('no permite capturar una tarea ajena',async()=>{m.auth.mockResolvedValue({id:'otro'});m.body.mockResolvedValue({accion:'guardar',cicloId:'c',tareaId:'t',revision:0});await expect(handler(event)).rejects.toMatchObject({statusCode:403});expect(m.conteo.upsert).not.toHaveBeenCalled()})
  it('rechaza una revisión obsoleta antes de sobrescribir avances',async()=>{m.body.mockResolvedValue({accion:'guardar',cicloId:'c',tareaId:'t',revision:2});await expect(handler(event)).rejects.toMatchObject({statusCode:409})})
  it('guarda físico y estado comparando solo RETIRO',async()=>{m.body.mockResolvedValue({accion:'guardar',cicloId:'c',tareaId:'t',revision:0,codigo:'001',cajas:2,empaque:12,reguero:1});await handler(event);expect(m.conteo.upsert).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({fisico:25,estado:'OK',teoricoActual:null})}));expect(m.lock).toHaveBeenCalledOnce()})
  // Una ubicación vacía y una con solo reguero son capturas normales (22-09).
  it('acepta la ubicación vacía y el reguero sin cajas',async()=>{
    m.body.mockResolvedValue({accion:'guardar',cicloId:'c',tareaId:'t',revision:0,codigo:'001',cajas:0,empaque:0,reguero:0});await handler(event)
    expect(m.conteo.upsert).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({fisico:0,estado:'FALTANTE'})}))
    m.conteo.upsert.mockClear()
    m.body.mockResolvedValue({accion:'guardar',cicloId:'c',tareaId:'t',revision:0,codigo:'001',cajas:0,empaque:0,reguero:25});await handler(event)
    expect(m.conteo.upsert).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({fisico:25,estado:'OK'})}))
  })
  it('sigue rechazando cajas sin unidad de empaque',async()=>{
    m.body.mockResolvedValue({accion:'guardar',cicloId:'c',tareaId:'t',revision:0,codigo:'001',cajas:3,empaque:0,reguero:0})
    await expect(handler(event)).rejects.toMatchObject({statusCode:409});expect(m.conteo.upsert).not.toHaveBeenCalled()
  })
  it('bloquea captura durante alimentación',async()=>{ciclo.tareas[0].pausaInicio=new Date();m.body.mockResolvedValue({accion:'guardar',cicloId:'c',tareaId:'t',revision:0});await expect(handler(event)).rejects.toMatchObject({statusCode:409})})
  it('reanuda al día siguiente descontando toda la pausa de turno',async()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));ciclo.tareas[0].pausaInicio=new Date('2026-09-20T20:00:00Z');ciclo.tareas[0].pausaMotivo='FIN_TURNO';m.body.mockResolvedValue({accion:'reanudar',cicloId:'c',tareaId:'t',revision:0});await handler(event);expect(m.tarea.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({pausaSegundos:{increment:57600},pausaInicio:null})}));vi.useRealTimers()})
  it('impide terminar sin contar el producto esperado',async()=>{m.body.mockResolvedValue({accion:'terminar',cicloId:'c',tareaId:'t',revision:0});await expect(handler(event)).rejects.toMatchObject({statusCode:409})})
  it('última ubicación crea novedades y pasa a Carlos',async()=>{ciclo.tareas[0].registros=[{plu:'1',fisico:0,estado:'FALTANTE',inesperado:false}];m.body.mockResolvedValue({accion:'terminar',cicloId:'c',tareaId:'t',revision:0});await handler(event);expect(m.caso.create).toHaveBeenCalledOnce();expect(m.ciclo.update).toHaveBeenCalledWith({where:{id:'c'},data:{estado:'REVISION'}});expect(m.noti.create).toHaveBeenCalledOnce()})
  it('el reconteo compara el teórico actual sin modificar el archivo inicial',async()=>{ciclo.estado='REVISION';ciclo.tareas[0].tipo='RECONTEO';ciclo.tareas[0].casoId='caso';ciclo.casos=[{id:'caso',plu:'1',estado:'ABIERTO'}];m.body.mockResolvedValue({accion:'guardar',cicloId:'c',tareaId:'t',revision:0,codigo:'1',cajas:1,empaque:12,reguero:0,teoricoActual:12});await handler(event);expect(m.conteo.upsert).toHaveBeenCalledWith(expect.objectContaining({update:expect.objectContaining({fisico:12,teoricoActual:12,estado:'OK'})}));expect(m.ciclo.update).not.toHaveBeenCalled();expect(ciclo.filas[0].disponible).toBe(25)})
  it('Carlos puede asignar el mismo caso a los dos operarios',async()=>{m.permiso.mockResolvedValue({gestionar:true});ciclo.estado='REVISION';ciclo.casos=[{id:'caso',plu:'1',ubicacion:'A1',estado:'ABIERTO'}];m.body.mockResolvedValue({accion:'reconteo',cicloId:'c',casoId:'caso',usuarios:['juan','keiner']});await handler(event);expect(m.tarea.create).toHaveBeenCalledTimes(2)})
  it('Carlos no cierra mientras quede un reconteo sin terminar',async()=>{m.permiso.mockResolvedValue({gestionar:true});ciclo.estado='REVISION';ciclo.casos=[{id:'caso',estado:'ABIERTO'}];ciclo.tareas[0].casoId='caso';m.body.mockResolvedValue({accion:'resolver',cicloId:'c',casoId:'caso',resultadoId:'r'});await expect(handler(event)).rejects.toMatchObject({statusCode:409});expect(m.caso.update).not.toHaveBeenCalled()})
})

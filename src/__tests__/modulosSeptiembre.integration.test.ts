import { expect, it, vi } from 'vitest'
// Opt-in: todas las escrituras se revierten al terminar, incluidos avisos y auditoría.
const ctx=vi.hoisted(()=>({actor:{} as any,body:{} as any,query:{} as any}))
vi.mock('../../nuxt-app/server/utils/auth',()=>({requireAuth:async()=>ctx.actor}))
vi.mock('../../nuxt-app/node_modules/h3/dist/index.mjs',()=>({defineEventHandler:(f:unknown)=>f,readBody:async()=>ctx.body,getQuery:()=>ctx.query,setHeader:()=>{},createError:(o:object)=>Object.assign(new Error(),o)}))
it.skipIf(process.env.CEDI_DB_QA!=='1')('conteo → dos reconteos → cierre Excel y pedido → salida, con rollback real',async()=>{
  const dotenv=await import('dotenv');dotenv.config({quiet:true})
  const {prismaBase}=await import('../../nuxt-app/server/utils/prisma')
  const {operacionContext}=await import('../../nuxt-app/server/utils/operacionContext')
  const accion=(await import('../../nuxt-app/server/api/inventarios/accion.post')).default
  const descargar=(await import('../../nuxt-app/server/api/inventarios/cierre.get')).default
  const stretch=(await import('../../nuxt-app/server/api/stretch-film/accion.post')).default
  const ExcelJS=(await import('exceljs')).default
  const event={} as Parameters<typeof accion>[0], rollback=new Error('QA_ROLLBACK'), id=crypto.randomUUID()
  try {
    await prismaBase.$transaction(async tx=>operacionContext.run(tx,async()=>{
      const personas=await tx.user.findMany({where:{name:{in:['CARLOS MORENO','JUAN ALBERTO JIMENEZ','KEINER BLANCO','FELIPE OSSA']}},select:{id:true,name:true,role:true,email:true}})
      const buscar=(nombre:string)=>personas.find(p=>p.name===nombre)!
      const carlos=buscar('CARLOS MORENO'),juan=buscar('JUAN ALBERTO JIMENEZ'),keiner=buscar('KEINER BLANCO'),felipe=buscar('FELIPE OSSA')
      expect(personas).toHaveLength(4)
      const cronograma=await tx.inventarioCronograma.create({data:{id,nombre:'QA rollback',fechaInicio:new Date('2026-09-21'),fechaFin:new Date('2026-09-23'),autorId:carlos.id,autorNombre:carlos.name}})
      const version=await tx.inventarioMaestroVersion.create({data:{cronogramaId:id,numero:1,archivo:'QA.xlsx',hash:'qa',total:1,resumen:{},autorId:carlos.id,autorNombre:carlos.name}})
      await tx.inventarioProductoPvp.create({data:{versionId:version.id,plu:'QA-PLU',descripcion:'Producto de prueba',upc:'00000001',precio:10,linea:'Gourmet',proveedor:'QA',marca:'QA'}})
      const ciclo=await tx.inventarioCiclico.create({data:{cronogramaId:cronograma.id,nombre:'QA',archivo:'QA.xlsx',autorId:carlos.id,filas:[{plu:'QA-PLU',descripcion:'Producto de prueba',ubicacion:'A1',concepto:'RETIRO',disponible:25},{plu:'QA-PLU',descripcion:'Producto de prueba',ubicacion:'H1',concepto:'ALMACENAMIENTO',disponible:10}],teorico:{'QA-PLU':35}}})
      const tarea=await tx.inventarioTarea.create({data:{cicloId:ciclo.id,ubicacion:'A1',usuarioId:juan.id}})
      async function actuar(actor:any,accionNombre:string,extra:Record<string,unknown>={}){ctx.actor=actor;ctx.body={accion:accionNombre,cicloId:ciclo.id,...extra};return accion(event)}
      async function captura(actor:any,tareaId:string,accionNombre:string,extra:Record<string,unknown>={}){const t=await tx.inventarioTarea.findUniqueOrThrow({where:{id:tareaId}});return actuar(actor,accionNombre,{tareaId,revision:t.revision,...extra})}
      await actuar(carlos,'lanzar')
      await captura(juan,tarea.id,'iniciar',{ubicacion:'A1'})
      await captura(juan,tarea.id,'guardar',{codigo:'00000001',cajas:2,empaque:12,reguero:0})
      await captura(juan,tarea.id,'pausar',{motivo:'FIN_TURNO'})
      await tx.inventarioTarea.update({where:{id:tarea.id},data:{pausaInicio:new Date(Date.now()-3600000)}})
      await captura(juan,tarea.id,'reanudar')
      expect((await tx.inventarioTarea.findUniqueOrThrow({where:{id:tarea.id}})).pausaSegundos).toBeGreaterThanOrEqual(3600)
      await captura(juan,tarea.id,'terminar')
      const caso=await tx.inventarioCaso.findFirstOrThrow({where:{cicloId:ciclo.id}})
      await actuar(carlos,'reconteo',{casoId:caso.id,usuarios:[juan.id,keiner.id]})
      const reconteos=await tx.inventarioTarea.findMany({where:{casoId:caso.id}});expect(reconteos).toHaveLength(2)
      for(const t of reconteos){const actor=personas.find(p=>p.id===t.usuarioId)!;await captura(actor,t.id,'iniciar',{ubicacion:'A1'});await captura(actor,t.id,'guardar',{codigo:'00000001',cajas:3,empaque:10,reguero:0,teoricoActual:30});await captura(actor,t.id,'terminar')}
      const elegido=await tx.inventarioConteo.findFirstOrThrow({where:{tareaId:reconteos[0].id}})
      await actuar(carlos,'resolver',{casoId:caso.id,resultadoId:elegido.id,observacion:'Verificado tras movimientos del CEDI'})
      await actuar(carlos,'cerrar')
      const cerrado=await tx.inventarioCiclico.findUniqueOrThrow({where:{id:ciclo.id}})
      expect(cerrado.cierre).toEqual([expect.objectContaining({plu:'QA-PLU',teorico:35,fisico:34,diferencia:-1,upc:'00000001',precio:10})])
      ctx.actor=carlos;ctx.query={id:ciclo.id};const buffer=await descargar(event),wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer as never)
      expect(wb.worksheets.map(s=>s.name)).toEqual(['Consecutivo Gourmet','Hoja1','maestro inv','Verificación'])
      expect(wb.worksheets[0].getCell('A2').value).toBe('00000001');expect(wb.worksheets[0].getCell('F2').value).toBe(34);expect(wb.worksheets[0].getCell('L2').value).toBe(-10)
      expect(wb.getWorksheet('Verificación')!.rowCount).toBe(3)
      ctx.actor=felipe
      const saldo=(await tx.stretchStock.findUnique({where:{id:'principal'}}))?.rollos??0
      ctx.body={accion:'entrada',id:crypto.randomUUID(),rollos:10,motivo:'QA rollback'};await stretch(event)
      const pedidoId=crypto.randomUUID();ctx.body={accion:'solicitar',id:pedidoId,solicitante:felipe.name,tipo:'INTERNO',destino:'QA rollback',rollos:4};await stretch(event)
      ctx.body={accion:'procesar',pedidoId};await stretch(event)
      expect((await tx.stretchStock.findUniqueOrThrow({where:{id:'principal'}})).rollos).toBe(saldo+6)
      await expect(stretch(event)).rejects.toMatchObject({statusCode:409})
      expect(await tx.stretchMovimiento.count({where:{pedidoId}})).toBe(1)
      console.log('QA: cierre con UPC y teórico original, ambos reconteos, pausa entre turnos, salida de stock única; revirtiendo toda la prueba.')
      throw rollback
    }),{timeout:120000})
  } catch(e){if(e!==rollback)throw e}
  finally {expect(await prismaBase.inventarioCronograma.count({where:{id}})).toBe(0);await prismaBase.$disconnect()}
},120000)

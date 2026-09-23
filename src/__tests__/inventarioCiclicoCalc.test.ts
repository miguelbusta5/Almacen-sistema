import { describe, expect, it } from 'vitest'
import { cargarNuxt } from './apoyo/nuxt'
// Logica pura de nuxt-app: se carga como texto (ver apoyo/nuxt.ts), no se importa.
const { consolidarInventario, estadoInventario, fisicoInventario, leerTeoricoInventario } = cargarNuxt('utils/inventarioCiclicoCalc.ts')
const { compararEquipos } = cargarNuxt('utils/mueblesEquiposCalc.ts')
const { avancePersonas } = cargarNuxt('utils/resurtidoAvance.ts')
const h1 = ['Artículo','Nombre para mostrar','Número de depósito','Disponible','WMS Aisle']
const h2 = ['Nombre','Teorico']
describe('Cíclico: archivo, captura y cierre', () => {
  it('agrupa filas repetidas sin contar físicamente altura, etapas y sin clasificación', () => {
    const r = leerTeoricoInventario([h1,['001','Vaso','A1',10,'RETIRO'],['001','Vaso','A1',2,'retiro'],['001','Vaso','H1',20,'Almacenamiento'],['001','Vaso','S1',3,'Etapas salientes'],['001','Vaso','',4,'']], [h2,['001',39]])
    expect(r.ubicaciones).toEqual(['A1']); expect(r.filas[0].disponible).toBe(12)
    expect(consolidarInventario(r.filas,r.teorico,[{ubicacion:'A1',plu:'001',fisico:11}])).toEqual([{plu:'001',teorico:39,fisico:38,diferencia:-1,estado:'FALTANTE'}])
  })
  it('alerta varios PLU sin eliminar la ubicación del conteo', () => {
    const r=leerTeoricoInventario([h1,['1','A','A1',1,'RETIRO'],['2','B','A1',1,'RETIRO']],[h2,['1',1],['2',1]])
    expect(r.ubicaciones).toEqual(['A1']);expect(r.filas).toHaveLength(2)
  })
  it('calcula cajas por empaque más reguero, incluidos ausentes', () => {
    expect(fisicoInventario(3,12,5)).toBe(41);expect(estadoInventario(0,12)).toBe('FALTANTE');expect(estadoInventario(41,41)).toBe('OK');expect(estadoInventario(42,41)).toBe('SOBRANTE')
  })
  it.each([[-1,12,0],[1.5,12,0],[1,12,-1],[1,12,0.5],[2147483647,2,0],[3,0,0]])('rechaza captura inválida %j', (c,e,r)=>expect(()=>fisicoInventario(c,e,r)).toThrow())
  // Una ubicación vacía y una con solo reguero son capturas normales: el `min=1`
  // del empaque frenaba el conteo del 22-09.
  it('acepta todo en cero y el reguero sin cajas', () => {
    expect(fisicoInventario(0,0,0)).toBe(0)
    expect(fisicoInventario(0,0,7)).toBe(7)
    expect(fisicoInventario(0,12,4)).toBe(4)
  })
  it('excluye con aviso únicamente productos sin teórico y con existencia cero',()=>{
    const r=leerTeoricoInventario([h1,['1','A','A1',1,'RETIRO'],['BONO100','Bono','',0,'']],[h2,['1',1]])
    expect(r.avisos).toEqual([{plu:'BONO100',descripcion:'Bono',ubicaciones:[],motivo:expect.stringContaining('Excluido')}])
    expect(r.filas.map((f:any)=>f.plu)).toEqual(['1'])
    expect(consolidarInventario(r.filas,r.teorico,[]).map((f:any)=>f.plu)).toEqual(['1'])
  })
  it.each([
    [['2','B','H2',1,'Almacenamiento']],
    [['2','B','H2',5,'Almacenamiento'],['2','B','H2',-5,'Almacenamiento']],
  ])('no excluye faltantes con existencias originales aunque se compensen', (...rows)=>{
    expect(()=>leerTeoricoInventario([h1,['1','A','A1',1,'RETIRO'],...rows],[h2,['1',1]])).toThrow('sin teórico')
  })
  it('incluye ubicación RETIRO en el aviso y no crea una tarea vacía para el excluido',()=>{
    const r=leerTeoricoInventario([h1,['1','A','A1',1,'RETIRO'],['2','B','A2',0,'RETIRO']],[h2,['1',1]])
    expect(r.avisos[0]).toMatchObject({plu:'2',ubicaciones:['A2']})
    expect(r.ubicaciones).toEqual(['A1'])
  })
  it('rechaza archivo incompleto y posiciones sin ubicación',()=>{
    expect(()=>leerTeoricoInventario([h1,['1','A','',1,'RETIRO']],[h2,['1',1]])).toThrow()
    expect(()=>leerTeoricoInventario([h1,['1','A','A1',1,'RETIRO']],[h2,['2',1]])).toThrow('sin teórico')
  })
  it('conserva los PLU inesperados en el consolidado sin inventar stock',()=>{
    expect(consolidarInventario([{plu:'1',descripcion:'A',ubicacion:'A1',concepto:'RETIRO',disponible:4}],{'1':4},[{ubicacion:'A1',plu:'2',fisico:3}])).toEqual([{plu:'1',teorico:4,fisico:0,diferencia:-4,estado:'FALTANTE'},{plu:'2',teorico:0,fisico:3,diferencia:3,estado:'SOBRANTE'}])
  })
  it('conserva decimales del ERP y excluye de alcance productos que solo están en hoja 2',()=>{
    const r=leerTeoricoInventario([h1,['1','Papel','A1',0.62,'RETIRO']],[h2,['1',0.62],['2',null],['3',10]])
    expect(r.filas[0].disponible).toBe(0.62);expect(r.fueraAlcance).toEqual(['2','3'])
    expect(consolidarInventario(r.filas,r.teorico,[{ubicacion:'A1',plu:'1',fisico:0.62}])).toEqual([{plu:'1',teorico:0.62,fisico:0.62,diferencia:0,estado:'OK'}])
  })
})
describe('Equipos y ayudantes',()=>{
  it('atribuye por equipo de cada línea y descuenta pausas; excluye abiertas',()=>{
    const base={ordenId:'o',plu:'1',unidades:10,operarioId:'a',horaInicio:new Date('2026-09-21T12:00:00Z'),horaFin:new Date('2026-09-21T12:10:00Z'),pausaSegundos:300,orden:{participantes:[{usuarioId:'a',equipo:{tipo:'GENIE'}}]}}
    const r=compararEquipos([base,{...base,tipoEquipo:'ORDER_PICKER',plu:'2'},{...base,horaFin:null,unidades:100}])
    expect(r[0]).toMatchObject({ordenes:1,plus:1,unidades:10,minutos:5,unidadesHora:120});expect(r[1].unidades).toBe(10)
  })
  it('separa participaciones del porcentaje de cierre sin duplicar tareas',()=>{
    // Cuenta quien cerro (ultimo tramo); el detalle esta en montajeRealizacion.test.ts.
    const r=avancePersonas({operarioId:'a',operario:{name:'A'},tareas:[{estado:'COMPLETADA',responsableId:'b',responsable:{name:'B'},tramos:[{usuarioId:'a',orden:1},{usuarioId:'b',orden:2}]},{estado:'PENDIENTE'}]})
    expect(r.find((p:any)=>p.id==='b')).toMatchObject({completadas:1,porcentaje:100,participadas:1});expect(r.find((p:any)=>p.id==='a')).toMatchObject({completadas:0,porcentaje:0,participadas:1})
  })
})

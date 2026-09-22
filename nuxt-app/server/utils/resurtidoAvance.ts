export function avancePersonas(m: { operarioId:string; operario?:{name:string}|null; tareas?:Array<{ estado:string; responsableId?:string|null; responsable?:{name:string}|null; tramos?:Array<{usuarioId:string; usuario?:{name:string}|null}> }> }) {
  const tareas=m.tareas??[], personas=new Map<string,{id:string;nombre:string;completadas:number;participadas:number;porcentaje:number}>()
  const obtener=(id:string,nombre?:string|null)=>{if(!personas.has(id))personas.set(id,{id,nombre:nombre??id,completadas:0,participadas:0,porcentaje:0});return personas.get(id)!}
  obtener(m.operarioId,m.operario?.name)
  for(const t of tareas){const responsable=t.responsableId??m.operarioId;const p=obtener(responsable,t.responsable?.name??m.operario?.name);if(t.estado==='COMPLETADA')p.completadas++
    const vistos=new Set<string>();for(const tramo of t.tramos??[]){const persona=obtener(tramo.usuarioId,tramo.usuario?.name);if(!vistos.has(persona.id)){persona.participadas++;vistos.add(persona.id)}}
  }
  return [...personas.values()].map(p=>({...p,porcentaje:tareas.length?Math.round(p.completadas/tareas.length*1000)/10:0})).sort((a,b)=>b.completadas-a.completadas)
}

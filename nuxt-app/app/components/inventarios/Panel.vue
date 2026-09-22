<script setup lang="ts">
import { ensureSession, useSessionState } from '~/composables/useSession'
const { me } = useSessionState()
const gestor = computed(() => !!me.value?.can.gestionarInventarios)
const permitido = computed(() => gestor.value || !!me.value?.can.contarInventarios)
const tab = ref('ciclos'), ciclos = ref<any[]>([]), actual = ref<any>(null), tareaId = ref(''), error = ref(''), busy = ref(false)
const operarios = ref<{id:string;name:string}[]>([]), cronogramas = ref<any[]>([]), seleccion = ref<string[]>([]), asignado = ref('')
const nuevo = ref(false), nombre = ref(''), cronogramaId = ref(''), archivo = ref<File|null>(null), solicitudId = ref('')
const ubicacion = ref(''), codigo = ref(''), producto = ref<{plu:string;descripcion:string}|null>(null)
const cajas=ref<number|null>(null), empaque=ref<number|null>(null), reguero=ref(0), teoricoActual=ref<number|null>(null)
const elegidos=ref<Record<string,string[]>>({}), resultados=ref<Record<string,string>>({}), notas=ref<Record<string,string>>({})
const tarea = computed(() => actual.value?.tareas.find((t:any)=>t.id===tareaId.value))
let restaurando = false
const claveBorrador = () => `inventario-borrador:${me.value?.id}:${tareaId.value}`
watch([codigo, producto, cajas, empaque, reguero, teoricoActual], () => {
  if (restaurando || !me.value || !tareaId.value || tarea.value?.usuarioId !== me.value.id) return
  try { localStorage.setItem(claveBorrador(), JSON.stringify({codigo:codigo.value,producto:producto.value,cajas:cajas.value,empaque:empaque.value,reguero:reguero.value,teoricoActual:teoricoActual.value})) } catch { /* Los avances confirmados permanecen en el servidor. */ }
}, { flush: 'sync' })
const ahora=ref(Date.now()); let reloj: ReturnType<typeof setInterval>
const mensajeError = (e:any) => { error.value=e.data?.statusMessage??e.message??'No se pudo completar. Intenta nuevamente.' }
async function lista() { try { ciclos.value=(await $fetch<any>('/api/inventarios/ciclos')).ciclos } catch(e){mensajeError(e)} }
async function abrir(id:string) { try { actual.value=await $fetch<any>('/api/inventarios/ciclos',{query:{id}}) }catch(e){mensajeError(e)} }
async function accion(accion:string, extra:Record<string,unknown>={}) {
  if(busy.value) return false
  busy.value=true;error.value=''
  try { await $fetch('/api/inventarios/accion',{method:'POST',body:{accion,cicloId:actual.value.id,tareaId:tareaId.value,revision:tarea.value?.revision,...extra}}); await abrir(actual.value.id); return true }
  catch(e){mensajeError(e);return false} finally{busy.value=false}
}
async function preparar() {
  error.value=''; try { cronogramas.value=await $fetch<any[]>('/api/inventarios'); nuevo.value=true; solicitudId.value=crypto.randomUUID() } catch(e) { mensajeError(e) }
}
async function crear() {
  if(!archivo.value||busy.value)return
  busy.value=true;error.value=''
  try {const body=new FormData();body.append('archivo',archivo.value);body.append('nombre',nombre.value);body.append('cronogramaId',cronogramaId.value);body.append('solicitudId',solicitudId.value)
    const r=await $fetch<{id:string}>('/api/inventarios/ciclos',{method:'POST',body});nuevo.value=false;await abrir(r.id);await lista()
  }catch(e){mensajeError(e)}finally{busy.value=false}
}
function elegir(t:any){
  restaurando=true;tareaId.value=t.id;ubicacion.value='';codigo.value='';producto.value=null;cajas.value=null;empaque.value=null;reguero.value=0;teoricoActual.value=null
  if(t.usuarioId===me.value?.id&&t.estado!=='COMPLETADA')try{const b=JSON.parse(localStorage.getItem(claveBorrador())??'null');if(b){codigo.value=b.codigo;producto.value=b.producto;cajas.value=b.cajas;empaque.value=b.empaque;reguero.value=b.reguero;teoricoActual.value=b.teoricoActual}}catch{}
  restaurando=false
}
async function escanear(){if(!codigo.value||busy.value)return;error.value='';producto.value=null;try{producto.value=await $fetch<any>('/api/inventarios/producto',{query:{tareaId:tareaId.value,codigo:codigo.value}})}catch(e){mensajeError(e)}}
async function guardar(){if(!producto.value)return;const ok=await accion('guardar',{codigo:codigo.value,cajas:cajas.value,empaque:empaque.value,reguero:reguero.value,teoricoActual:teoricoActual.value});if(ok){producto.value=null;codigo.value='';cajas.value=null;empaque.value=null;reguero.value=0;teoricoActual.value=null}}
function tiempo(t:any){if(!t.inicio)return 'Sin iniciar';const s=Math.max(0,Math.floor((new Date(t.fin??t.pausaInicio??ahora.value).getTime()-new Date(t.inicio).getTime())/1000-t.pausaSegundos));return `${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m ${s%60}s`}
const persona=(id:string)=>actual.value?.personas.find((p:any)=>p.id===id)?.name??operarios.value.find(p=>p.id===id)?.name??'Sin asignar'
async function descargar(){try{const blob=await $fetch<Blob>('/api/inventarios/cierre',{query:{id:actual.value.id},responseType:'blob'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Cierre-${actual.value.nombre}.xlsx`;a.click();URL.revokeObjectURL(url)}catch(e){mensajeError(e)}}
onMounted(async()=>{await ensureSession();if(permitido.value){await lista();if(gestor.value)try{operarios.value=await $fetch<{id:string;name:string}[]>('/api/inventarios/operarios')}catch(e){mensajeError(e)}}reloj=setInterval(()=>ahora.value=Date.now(),1000)})
onUnmounted(()=>clearInterval(reloj))
</script>
<template>
  <div class="inv-flow">
    <nav v-if="gestor" class="actions" aria-label="Secciones de inventarios"><button @click="tab='ciclos'" :aria-pressed="tab==='ciclos'">Cíclicos</button><button @click="tab='maestro'" :aria-pressed="tab==='maestro'">Cronogramas y maestro PVP</button></nav>
    <InventariosModule v-if="tab==='maestro' && gestor" />
    <template v-else>
      <header><h1>Conteo cíclico Gourmet</h1><p>{{gestor?'Carga el teórico, distribuye las ubicaciones y revisa las diferencias.':'Escanea cada ubicación y registra lo que encuentres.'}}</p></header>
      <p v-if="!permitido" role="alert">No tienes acceso a Inventarios.</p>
      <template v-else>
        <p v-if="error" class="notice" role="alert">{{error}}</p>
        <div class="actions"><button v-if="gestor" :disabled="busy" @click="preparar">Nuevo cíclico</button><button v-if="actual" :disabled="busy" @click="actual=null;tareaId='';lista()">Volver a cíclicos</button><button :disabled="busy" @click="actual?abrir(actual.id):lista()">Actualizar</button></div>
        <form v-if="nuevo" class="card" @submit.prevent="crear"><h2>Crear conteo</h2><fieldset :disabled="busy"><label>Cronograma<select v-model="cronogramaId" required><option value="">Selecciona</option><option v-for="c in cronogramas.filter(c=>c.estado==='ABIERTO')" :key="c.id" :value="c.id">{{c.nombre}}</option></select></label><label>Nombre del cíclico<input v-model="nombre" required maxlength="120" /></label><label>Teórico filtrado (.xlsx, dos hojas)<input type="file" accept=".xlsx" required @change="archivo=($event.target as HTMLInputElement).files?.[0]??null" /></label><button type="submit">{{busy?'Cargando…':'Crear tareas RETIRO'}}</button><button type="button" @click="nuevo=false">Cancelar</button></fieldset></form>
        <div v-if="!actual" class="cards"><button class="card" v-for="c in ciclos" :key="c.id" @click="abrir(c.id)"><strong>{{c.nombre}}</strong><p>{{c.cronograma.nombre}} · {{c.estado}}</p><span>{{c._count.tareas}} tareas · {{c._count.casos}} novedades</span></button><p v-if="!ciclos.length">No tienes cíclicos disponibles.</p></div>
        <template v-else>
          <article class="card"><h2>{{actual.nombre}}</h2><p>{{actual.estado}} · {{actual.tareas.filter((t:any)=>t.estado==='COMPLETADA').length}} / {{actual.tareas.length}} tareas terminadas</p><div class="actions"><button v-if="gestor && actual.estado==='BORRADOR'" :disabled="busy" @click="accion('lanzar')">Lanzar conteo</button><button v-if="gestor && actual.estado==='REVISION'" :disabled="busy" @click="accion('cerrar')">Cerrar cíclico</button><button v-if="gestor && actual.estado==='CERRADO'" @click="descargar">Descargar informe de cierre</button></div></article>
          <section v-if="gestor && actual.avisos?.length" class="notice" role="status"><h2>PLU excluidos del cíclico ({{actual.avisos.length}})</h2><p>Estos productos no tienen teórico en hoja 2, tienen disponible cero. No se incluyen en el conteo ni en el consolidado de cierre.</p><ul><li v-for="aviso in actual.avisos" :key="aviso.plu"><strong>{{aviso.plu}}</strong> · {{aviso.descripcion}} · Ubicación: {{aviso.ubicaciones?.join(", ") || "Sin ubicación"}}</li></ul></section>
          <article v-if="gestor && actual.estado==='BORRADOR'" class="card"><h2>Asignar ubicaciones</h2><label>Operario<select v-model="asignado"><option value="">Selecciona</option><option v-for="p in operarios" :key="p.id" :value="p.id">{{p.name}}</option></select></label><div class="actions"><button @click="seleccion=actual.tareas.map((t:any)=>t.id)">Seleccionar todas</button><button :disabled="busy||!seleccion.length||!asignado" @click="accion('asignar',{tareas:seleccion,usuarioId:asignado})">Asignar seleccionadas</button></div><label v-for="t in actual.tareas" :key="t.id" class="check"><input v-model="seleccion" type="checkbox" :value="t.id" />{{t.ubicacion}} · {{persona(t.usuarioId)}}<span v-if="t.esperados.length>1"> · Atención: {{t.esperados.length}} PLU</span></label></article>
          <article v-else class="card"><h2>Ubicaciones y reconteos</h2><div class="tasks"><button v-for="t in actual.tareas" :key="t.id" @click="elegir(t)"><strong>{{t.ubicacion}}</strong> · {{t.tipo}}<p>{{persona(t.usuarioId)}} · {{t.estado}} · {{tiempo(t)}}</p><span v-if="t.esperados.length>1">Atención: varios PLU en esta ubicación</span></button></div></article>
          <article v-if="tarea" class="card"><h2>{{tarea.ubicacion}} · {{tarea.tipo}}</h2><p>{{tiempo(tarea)}} · {{tarea.estado}}</p>
            <template v-if="tarea.usuarioId===me?.id && tarea.estado!=='COMPLETADA'">
              <form v-if="tarea.estado==='PENDIENTE'" @submit.prevent="accion('iniciar',{ubicacion})"><label>Escanea la ubicación<input v-model="ubicacion" autocomplete="off" required /></label><button :disabled="busy">Confirmar ubicación e iniciar</button></form>
              <template v-else-if="tarea.pausaInicio"><p>En pausa: {{tarea.pausaMotivo}}</p><button :disabled="busy" @click="accion('reanudar')">Reanudar conteo</button></template>
              <template v-else><div class="actions"><button :disabled="busy" @click="accion('pausar',{motivo:'ALIMENTACION'})">Alimentación</button><button :disabled="busy" @click="accion('pausar',{motivo:'FIN_TURNO'})">Finalizar turno</button></div>
                <form @submit.prevent="escanear"><label>Escanea el código de barras<input v-model="codigo" required autocomplete="off" @input="producto=null" /></label><button :disabled="busy">Consultar producto</button></form>
                <form v-if="producto" @submit.prevent="guardar"><h3>{{producto.plu}} · {{producto.descripcion}}</h3><fieldset :disabled="busy"><div class="fields"><label>Cajas master<input v-model.number="cajas" type="number" min="0" step="1" required /></label><label>Unidad de empaque<input v-model.number="empaque" type="number" min="1" step="1" required /></label><label>Reguero<input v-model.number="reguero" type="number" min="0" step="1" required /></label><label v-if="tarea.tipo==='RECONTEO'">Teórico actualizado NetSuite de esta ubicación<input v-model.number="teoricoActual" type="number" step="1" required /></label></div><p>Total físico: {{(cajas??0)*(empaque??0)+reguero}} unidades</p><button>Guardar conteo</button></fieldset></form>
                <h3>Productos esperados</h3><ul><li v-for="p in tarea.esperados" :key="p.plu">{{p.plu}} · {{p.descripcion}} <button v-if="tarea.tipo==='INICIAL'&&!tarea.registros.some((r:any)=>r.plu===p.plu)" :disabled="busy" @click="accion('ausente',{codigo:p.plu})">No está: registrar cero</button></li></ul>
                <button :disabled="busy||!!producto" @click="accion('terminar')">Terminar esta ubicación</button>
              </template>
            </template>
            <h3>Avances guardados</h3><ul><li v-for="r in tarea.registros" :key="r.id">{{r.plu}} · {{r.fisico}} unidades · {{r.estado}} {{r.inesperado?'· Producto inesperado':''}}</li></ul>
          </article>
          <article v-if="gestor && actual.casos.length" class="card"><h2>Verificación de diferencias</h2><section v-for="c in actual.casos" :key="c.id" class="case"><h3>{{c.plu}} · {{c.ubicacion}} · {{c.estado}}</h3><template v-if="c.estado==='ABIERTO' && actual.estado==='REVISION'"><label v-for="p in operarios" :key="p.id" class="check"><input type="checkbox" :checked="elegidos[c.id]?.includes(p.id)" @change="elegidos[c.id]=($event.target as HTMLInputElement).checked?[...(elegidos[c.id]??[]),p.id]:(elegidos[c.id]??[]).filter(id=>id!==p.id)" />{{p.name}}</label><button :disabled="busy||!elegidos[c.id]?.length" @click="accion('reconteo',{casoId:c.id,usuarios:elegidos[c.id]})">Asignar reconteo</button></template><ul><li v-for="t in c.tareas" :key="t.id">{{persona(t.usuarioId)}} · {{t.estado}}<label v-for="r in t.registros" :key="r.id" class="check"><input v-if="c.estado==='ABIERTO'" v-model="resultados[c.id]" type="radio" :name="c.id" :value="r.id" />NetSuite {{r.teoricoActual}} · Físico {{r.fisico}} · {{r.estado}} {{c.resultadoId===r.id?'· Validado por Carlos':''}}</label></li></ul><template v-if="c.estado==='ABIERTO' && c.tareas.length"><label>Observación de Carlos<textarea v-model="notas[c.id]" maxlength="2000" /></label><button :disabled="busy||!resultados[c.id]" @click="accion('resolver',{casoId:c.id,resultadoId:resultados[c.id],observacion:notas[c.id]})">Validar resultado y cerrar novedad</button></template></section></article>
        </template>
      </template>
    </template>
  </div>
</template>
<style scoped>
.inv-flow{display:grid;gap:18px;min-width:0;color:var(--ink)}h1{font-size:28px;margin:8px 0}h2{font-size:19px}h3{font-size:15px}p{color:var(--muted);line-height:1.5}.card{padding:20px;border:1px solid var(--border);border-radius:14px;background:var(--surface);min-width:0;text-align:left}.cards,.tasks{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.actions{display:flex;gap:10px;flex-wrap:wrap}label{display:grid;gap:7px;margin:12px 0;font-size:13px}input,select,textarea,button{font:inherit;padding:11px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--ink);min-width:0;max-width:100%;box-sizing:border-box}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button[aria-pressed=true]{background:var(--brand-tint);color:var(--brand-deep)}input[type=file]{width:100%}.check{display:flex;align-items:center;flex-wrap:wrap}.notice{padding:15px;border:1px solid var(--u-aviso);border-radius:9px}fieldset{border:0;padding:0;min-width:0}.case{padding:16px 0;border-top:1px solid var(--border)}li{margin:10px 0;overflow-wrap:anywhere}:focus-visible{outline:2px solid var(--brand);outline-offset:3px}@media(max-width:600px){.card{padding:14px}.fields{grid-template-columns:1fr}}
</style>

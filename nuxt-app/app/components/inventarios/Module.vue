<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { canSeeModule } from '~/utils/modulePermissions'

interface Resumen { total: number; repetidos: number; sinPlu: { fila: number; descripcion: string }[]; sinDescripcion: number; sinUpc: number; sinPrecio: number; upcCompartidos: number }
interface Version { id: string; numero: number; archivo: string; total: number; resumen: Resumen; autorNombre: string; createdAt: string }
interface Cronograma { id: string; nombre: string; fechaInicio: string; fechaFin: string; estado: string; versiones: Version[] }
interface Producto { plu: string; descripcion: string; upc: string; precio: string | number | null; proveedor: string; linea: string }
const { me } = useSessionState()
const permitido = computed(() => canSeeModule(me.value?.role, 'inventarios') && me.value?.can.gestionarInventarios)
const cronogramas = ref<Cronograma[]>([]), actual = ref<Cronograma | null>(null)
const cargando = ref(true), busy = ref(false), error = ref(''), mensaje = ref(''), formulario = ref(false)
const nombre = ref(''), inicio = ref(''), dias = ref(1), archivo = ref<File | null>(null)
const solicitudId = ref('')
const revision = ref<Resumen | null>(null), versionId = ref(''), buscar = ref('')
const productos = ref<Producto[]>([]), total = ref(0)
const fecha = (s: string) => new Date(s).toLocaleDateString('es-CO', { timeZone: 'UTC' })
const precio = (n: string | number | null) => n == null ? 'Sin precio' : Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })
function fallo(e: unknown) { error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'No se pudo completar la operación. Intenta nuevamente.' }
async function cargar(id?: string) {
  cronogramas.value = await $fetch<Cronograma[]>('/api/inventarios')
  if (id) actual.value = cronogramas.value.find(c => c.id === id) ?? null
}
function nuevo() { solicitudId.value = crypto.randomUUID(); actual.value = null; formulario.value = true; archivo.value = null; revision.value = null; error.value = ''; mensaje.value = ''; nombre.value = ''; inicio.value = ''; dias.value = 1 }
async function abrir(c: Cronograma) {
  actual.value = c; formulario.value = false; revision.value = null; archivo.value = null; buscar.value = ''; error.value = ''
  versionId.value = c.versiones[0]?.id ?? ''; await consultar()
}
function cambiarArchivo(e: Event) { archivo.value = (e.target as HTMLInputElement).files?.[0] ?? null; revision.value = null; error.value = '' }
async function enviar(accion: 'revisar' | 'guardar') {
  if (!archivo.value || busy.value) return
  busy.value = true; error.value = ''; mensaje.value = ''
  try {
    const body = new FormData()
    body.append('archivo', archivo.value); body.append('accion', accion)
    if (actual.value) { body.append('cronogramaId', actual.value.id); body.append('version', String(actual.value.versiones[0]?.numero ?? 0)) }
    else { body.append('solicitudId', solicitudId.value); body.append('nombre', nombre.value); body.append('inicio', inicio.value); body.append('dias', String(dias.value)) }
    if (accion === 'revisar') revision.value = (await $fetch<{ resumen: Resumen }>('/api/inventarios/guardar', { method: 'POST', body })).resumen
    else {
      const resultado = await $fetch<{ id: string; version: number }>('/api/inventarios/guardar', { method: 'POST', body })
      formulario.value = false; revision.value = null; archivo.value = null
      mensaje.value = `Maestro guardado como versión ${resultado.version}.`
      await cargar(resultado.id)
      if (actual.value) await abrir(actual.value)
    }
  } catch (e) { fallo(e) } finally { busy.value = false }
}
let consulta = 0
async function consultar() {
  const request = ++consulta
  productos.value = []; total.value = 0
  if (!versionId.value) return
  try {
    const data = await $fetch<{ total: number; productos: Producto[] }>('/api/inventarios/maestro', { query: { versionId: versionId.value, buscar: buscar.value } })
    if (request === consulta) { productos.value = data.productos; total.value = data.total }
  } catch (e) { if (request === consulta) fallo(e) }
}
onMounted(async () => { await ensureSession(); try { if (permitido.value) await cargar() } catch (e) { fallo(e) } finally { cargando.value = false } })
</script>

<template>
  <section class="inv-page">
    <header><p class="inv-kicker">CONTROL DE INVENTARIOS</p><h1>Inventarios</h1><p>Organiza los cronogramas y mantén actualizado el maestro de productos PVP.</p></header>
    <p v-if="cargando" role="status">Cargando cronogramas…</p>
    <p v-else-if="!permitido" role="alert">No tienes permiso para gestionar los cronogramas de inventarios.</p>
    <template v-else>
      <p v-if="error" role="alert" class="inv-alert">{{ error }}</p>
      <p v-if="mensaje" role="status" class="inv-note">{{ mensaje }}</p>
      <div class="inv-actions"><button :disabled="busy" @click="nuevo">Nuevo cronograma</button><button v-if="actual || formulario" :disabled="busy" @click="actual = null; formulario = false; revision = null">Volver a cronogramas</button></div>
      <article v-if="formulario" class="inv-card">
        <h2>{{ actual ? 'Actualizar maestro PVP' : 'Crear cronograma' }}</h2>
        <p>Carga el maestro completo. Cada actualización conserva las versiones anteriores.</p>
        <form @submit.prevent="enviar(revision ? 'guardar' : 'revisar')">
          <fieldset :disabled="busy">
            <div v-if="!actual" class="inv-fields">
              <label>Nombre del cronograma<input v-model="nombre" required maxlength="120" placeholder="Gourmet · Septiembre" /></label>
              <label>Fecha inicial<input v-model="inicio" type="date" required /></label>
              <label>Duración en días<input v-model.number="dias" type="number" min="1" max="366" step="1" required /></label>
            </div>
            <label>Maestro de productos PVP (.xlsx, máximo 10 MB)<input type="file" accept=".xlsx" required @change="cambiarArchivo" /></label>
            <div v-if="revision" class="inv-note" aria-live="polite">
              <strong>{{ revision.total.toLocaleString('es-CO') }} productos listos para guardar</strong>
              <p>{{ revision.sinDescripcion }} sin descripción · {{ revision.sinUpc }} sin UPC · {{ revision.sinPrecio }} sin precio · {{ revision.upcCompartidos }} UPC compartidos por varios PLU.</p>
              <p v-if="revision.repetidos">{{ revision.repetidos }} filas idénticas se consolidaron.</p>
              <template v-if="revision.sinPlu.length"><strong>{{ revision.sinPlu.length }} filas sin PLU se excluirán:</strong><ul><li v-for="fila in revision.sinPlu" :key="fila.fila">Fila {{ fila.fila }}: {{ fila.descripcion || 'Sin descripción' }}</li></ul></template>
              <p>Los datos faltantes se conservarán como pendientes; podrás completarlos cargando un maestro actualizado.</p>
            </div>
            <button class="primary" type="submit" :disabled="!archivo">{{ busy ? 'Procesando…' : revision ? 'Confirmar y guardar' : 'Revisar archivo' }}</button>
          </fieldset>
        </form>
      </article>
      <template v-else-if="actual">
        <article class="inv-card">
          <div class="inv-actions"><h2>{{ actual.nombre }}</h2><span class="inv-badge">{{ actual.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado' }}</span></div>
          <p>{{ fecha(actual.fechaInicio) }} — {{ fecha(actual.fechaFin) }}</p>
          <button v-if="actual.estado === 'ABIERTO'" @click="formulario = true; archivo = null; revision = null">Actualizar maestro PVP</button>
        </article>
        <article class="inv-card">
          <h2>Maestro e historial de versiones</h2>
          <label>Versión<select v-model="versionId" @change="consultar"><option v-for="v in actual.versiones" :key="v.id" :value="v.id">Versión {{ v.numero }} · {{ fecha(v.createdAt) }} · {{ v.autorNombre }} · {{ v.archivo }}</option></select></label>
          <form class="inv-actions" @submit.prevent="consultar"><label class="inv-search">Buscar PLU, UPC o descripción<input v-model="buscar" maxlength="100" placeholder="Escribe un producto" /></label><button type="submit">Buscar</button></form>
          <p>{{ total }} productos encontrados · mostrando hasta 50. Afina la búsqueda para localizar un producto.</p>
          <ul class="inv-products"><li v-for="p in productos" :key="p.plu"><div><strong>{{ p.plu }} · {{ p.descripcion || 'Sin descripción' }}</strong><p>UPC: {{ p.upc || 'Pendiente' }} · {{ p.proveedor || 'Sin proveedor' }} · {{ p.linea || 'Sin línea' }}</p></div><span>{{ precio(p.precio) }}</span></li></ul>
          <p v-if="!productos.length">No hay productos para esta búsqueda.</p>
        </article>
      </template>
      <template v-else>
        <p v-if="!cronogramas.length" class="inv-card">Todavía no hay cronogramas. Crea el primero y carga el maestro PVP.</p>
        <div class="inv-grid"><button v-for="c in cronogramas" :key="c.id" class="inv-card inv-schedule" @click="abrir(c)"><span class="inv-badge">{{ c.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado' }}</span><h2>{{ c.nombre }}</h2><p>{{ fecha(c.fechaInicio) }} — {{ fecha(c.fechaFin) }}</p><p>{{ c.versiones[0]?.total.toLocaleString('es-CO') ?? 0 }} productos · Versión {{ c.versiones[0]?.numero ?? 0 }}</p><strong>Ver cronograma →</strong></button></div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.inv-page{display:grid;gap:20px;color:var(--ink);min-width:0}.inv-page h1{font-size:30px;margin:4px 0}.inv-page h2{font-size:18px;margin:8px 0}.inv-page p{color:var(--muted);line-height:1.6;overflow-wrap:anywhere}.inv-kicker{font-size:11px;letter-spacing:.12em;color:var(--brand-deep)!important;font-weight:700}.inv-card{padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:16px;min-width:0}.inv-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.inv-fields,.inv-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.inv-page label{display:grid;gap:8px;font-size:13px;margin:12px 0}.inv-page input,.inv-page select,.inv-page button{font:inherit;border:1px solid var(--border-strong);border-radius:8px;padding:12px;background:var(--surface);color:var(--ink);max-width:100%;min-width:0;box-sizing:border-box}.inv-page input[type=file]{width:100%}.inv-page button{cursor:pointer}.inv-page .primary{background:var(--brand-tint);color:var(--brand-deep);font-weight:700}.inv-page button:disabled{opacity:.5;cursor:wait}.inv-page :focus-visible{outline:2px solid var(--brand);outline-offset:3px}.inv-page fieldset{padding:0;margin:0;border:0;min-width:0}.inv-note,.inv-alert{padding:16px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:10px;margin:12px 0}.inv-alert{border-color:var(--u-critico)}.inv-badge{display:inline-block;border-radius:20px;background:var(--brand-tint);color:var(--brand-deep);padding:5px 10px;font-size:12px}.inv-schedule{text-align:left!important}.inv-search{flex:1}.inv-products{padding:0;list-style:none}.inv-products li{display:flex;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--border);overflow-wrap:anywhere}.inv-products li>div{min-width:0}.inv-products li>span{flex-shrink:0}.inv-products p{font-size:12px;margin-bottom:0}@media(max-width:800px){.inv-grid,.inv-fields{grid-template-columns:1fr}.inv-card{padding:16px}.inv-products li{flex-direction:column}.inv-page h1{font-size:26px}}
</style>

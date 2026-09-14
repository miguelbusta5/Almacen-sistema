<script setup lang="ts">
// Catalogo de inspectores. NO son usuarios: el area comparte un solo login
// porque hay 2 PCs para ~5 personas, y esta lista es lo que dice de quien es
// cada tiempo.
//
// Se desactivan, nunca se borran: un inspector que se va sigue siendo el dueno
// de los tiempos que registro.
import { onMounted, ref } from 'vue'
import { Plus, Loader2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { API_ADMIN_MUEBLES, mensajeError, type Inspector } from '~/utils/muebles'

const { show } = useToast()
const inspectores = ref<Inspector[]>([])
const cargando = ref(true)
const guardando = ref(false)
const nombre = ref('')

async function cargar() {
  cargando.value = true
  try {
    inspectores.value = (await $fetch<{ data: Inspector[] }>(`${API_ADMIN_MUEBLES}/inspectores`)).data
  } catch (e) {
    show(mensajeError(e, 'No se pudieron cargar los inspectores'), true)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

async function crear() {
  if (nombre.value.trim().length < 2 || guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ data: Inspector }>(`${API_ADMIN_MUEBLES}/inspectores`, {
      method: 'POST', body: { nombre: nombre.value.trim() },
    })
    inspectores.value = [...inspectores.value, { ...res.data, activo: true }]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
    show(`${res.data.nombre} añadido`)
    nombre.value = ''
  } catch (e) {
    show(mensajeError(e, 'No se pudo crear el inspector'), true)
  } finally {
    guardando.value = false
  }
}

async function alternar(i: Inspector) {
  try {
    const res = await $fetch<{ data: Inspector }>(`${API_ADMIN_MUEBLES}/inspectores/${i.id}`, {
      method: 'PATCH', body: { activo: !i.activo },
    })
    i.activo = res.data.activo
    show(`${i.nombre} ${i.activo ? 'activo' : 'desactivado'}`)
  } catch (e) {
    show(mensajeError(e, 'No se pudo actualizar'), true)
  }
}
</script>

<template>
  <section>
    <form class="alta" @submit.prevent="crear">
      <label class="campo">
        <span class="campo-label">Nombre del inspector</span>
        <input v-model="nombre" class="input" type="text" placeholder="Nombre y apellido" :disabled="guardando">
      </label>
      <button class="btn btn-primary" type="submit" :disabled="nombre.trim().length < 2 || guardando">
        <Loader2 v-if="guardando" :size="15" class="spin" /><Plus v-else :size="15" />
        Añadir
      </button>
    </form>

    <p class="nota">
      No son usuarios del sistema: el área entra con un login compartido y esta lista es la que
      dice de quién es cada tiempo.
    </p>

    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>
    <p v-else-if="inspectores.length === 0" class="vacio">Todavía no hay inspectores.</p>

    <ul v-else class="lista">
      <li v-for="i in inspectores" :key="i.id" class="fila" :class="{ baja: !i.activo }">
        <strong>{{ i.nombre }}</strong>
        <button class="btn btn-sm" @click="alternar(i)">{{ i.activo ? 'Desactivar' : 'Activar' }}</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.alta { display: flex; align-items: flex-end; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.campo { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 220px; }
.campo-label { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.nota { margin: 0 0 16px; font-size: 12px; color: var(--muted); }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.fila.baja { opacity: .55; }
.fila strong { font-size: 14.5px; font-weight: 700; color: var(--ink); }
.cargando { display: flex; align-items: center; gap: 9px; padding: 24px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 26px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
</style>

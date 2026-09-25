<script setup lang="ts">
// Personas que cargan los camiones (catalogo). Solo ADMIN: agregar, corregir el
// nombre y activar / desactivar. No se borran: los camiones ya cargados las
// siguen nombrando.
import { ref, watch } from 'vue'
import { Users, Plus, Check, Pencil } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { API_CARGUE, type OperarioCargue } from '~/utils/cargueCamiones'

const props = defineProps<{ abierto: boolean }>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'cambio'): void }>()
const { show } = useToast()

const lista = ref<OperarioCargue[]>([])
const nuevo = ref('')
const editando = ref<string | null>(null)
const nombreEdit = ref('')
const guardando = ref(false)

async function cargar() {
  try {
    lista.value = (await $fetch<{ data: OperarioCargue[] }>(`${API_CARGUE}/operarios`, { query: { todos: '1' } })).data
  } catch (e) {
    show(apiErr(e, 'No se pudo cargar la lista'), true)
  }
}
watch(() => props.abierto, (a) => { if (a) { nuevo.value = ''; editando.value = null; void cargar() } })

async function guardar(fn: () => Promise<unknown>, exito: string) {
  if (guardando.value) return
  guardando.value = true
  try {
    await fn()
    show(exito)
    await cargar()
    emit('cambio')
  } catch (e) {
    show(apiErr(e, 'No se pudo guardar'), true)
  } finally {
    guardando.value = false
  }
}
function agregar() {
  const n = nuevo.value.trim()
  if (n.length < 3) return
  void guardar(() => $fetch(`${API_CARGUE}/operarios`, { method: 'POST', body: { nombre: n } }), `${n.toUpperCase()} agregado`).then(() => { nuevo.value = '' })
}
function renombrar(o: OperarioCargue) {
  const n = nombreEdit.value.trim()
  editando.value = null
  if (n.length < 3 || n.toUpperCase() === o.nombre) return
  void guardar(() => $fetch(`${API_CARGUE}/operarios/${o.id}`, { method: 'PATCH', body: { nombre: n } }), 'Nombre corregido')
}
function alternar(o: OperarioCargue) {
  void guardar(() => $fetch(`${API_CARGUE}/operarios/${o.id}`, { method: 'PATCH', body: { activo: !o.activo } }), o.activo ? `${o.nombre} desactivado` : `${o.nombre} activado`)
}
</script>

<template>
  <div v-if="abierto" class="ov" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="op-titulo">
      <h3 id="op-titulo" class="m-titulo"><Users :size="16" /> Personas que cargan</h3>
      <p class="m-desc">Aparecen al iniciar un camión. Las inactivas no se ofrecen, pero siguen en los camiones que ya cargaron.</p>

      <form class="nuevo" @submit.prevent="agregar">
        <input v-model="nuevo" class="field" maxlength="120" placeholder="Nombre completo" autocomplete="off">
        <button class="btn btn-primary" type="submit" :disabled="nuevo.trim().length < 3 || guardando"><Plus :size="14" /> Agregar</button>
      </form>

      <ul class="lista">
        <li v-for="o in lista" :key="o.id" :class="{ inactivo: !o.activo }">
          <template v-if="editando === o.id">
            <input v-model="nombreEdit" class="field" maxlength="120" autocomplete="off" @keyup.enter="renombrar(o)">
            <button class="btn btn-sm" @click="renombrar(o)"><Check :size="13" /> Listo</button>
          </template>
          <template v-else>
            <span class="nombre">{{ o.nombre }}</span>
            <button class="btn btn-ghost btn-sm" :disabled="guardando" @click="editando = o.id; nombreEdit = o.nombre"><Pencil :size="13" /></button>
            <button class="btn btn-sm" :disabled="guardando" @click="alternar(o)">{{ o.activo ? 'Desactivar' : 'Activar' }}</button>
          </template>
        </li>
      </ul>

      <footer class="m-pie"><button class="btn btn-ghost" @click="emit('cerrar')">Cerrar</button></footer>
    </div>
  </div>
</template>

<style scoped>
.ov { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 480px; max-height: calc(100vh - 36px); overflow: auto; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.m-titulo { display: flex; align-items: center; gap: 7px; margin: 0 0 4px; font-size: 17px; font-weight: 800; color: var(--ink); }
.m-titulo > svg { color: var(--brand); }
.m-desc { margin: 0 0 14px; font-size: 12.5px; color: var(--muted); }
.nuevo { display: flex; gap: 8px; margin-bottom: 12px; }
.nuevo .field { flex: 1; }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.lista li { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); }
.lista li.inactivo .nombre { color: var(--muted); text-decoration: line-through; }
.lista li .field { flex: 1; }
.nombre { flex: 1; font-size: 13px; font-weight: 600; color: var(--ink); }
.m-pie { display: flex; justify-content: flex-end; margin-top: 14px; }
</style>

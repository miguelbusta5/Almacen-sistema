<script setup lang="ts">
// Catalogo de equipos de altura. Sin capacidad: el area decidio no medir cuanto
// cabe en el Order Picker ni en el Genie; lo que se mide son los m3 por orden.
//
// Se desactivan, no se borran: un equipo dado de baja sigue siendo el que llevo
// las ordenes de meses pasados.
import { onMounted, ref } from 'vue'
import { Plus, Loader2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { API_ADMIN_MUEBLES, TIPO_EQUIPO_LABEL, mensajeError, type Equipo, type TipoEquipo } from '~/utils/muebles'

const { show } = useToast()
const equipos = ref<Equipo[]>([])
const cargando = ref(true)
const guardando = ref(false)
const codigo = ref('')
const tipo = ref<TipoEquipo>('ORDER_PICKER')

async function cargar() {
  cargando.value = true
  try {
    equipos.value = (await $fetch<{ data: Equipo[] }>(`${API_ADMIN_MUEBLES}/equipos`)).data
  } catch (e) {
    show(mensajeError(e, 'No se pudieron cargar los equipos'), true)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

async function crear() {
  if (!codigo.value.trim() || guardando.value) return
  guardando.value = true
  try {
    const res = await $fetch<{ data: Equipo }>(`${API_ADMIN_MUEBLES}/equipos`, {
      method: 'POST', body: { codigo: codigo.value.trim(), tipo: tipo.value },
    })
    equipos.value = [...equipos.value, res.data]
    show(`${res.data.codigo} creado`)
    codigo.value = ''
  } catch (e) {
    show(mensajeError(e, 'No se pudo crear el equipo'), true)
  } finally {
    guardando.value = false
  }
}

async function alternar(e: Equipo) {
  try {
    const res = await $fetch<{ data: Equipo }>(`${API_ADMIN_MUEBLES}/equipos/${e.id}`, {
      method: 'PATCH', body: { activo: !e.activo },
    })
    e.activo = res.data.activo
    show(`${e.codigo} ${e.activo ? 'activado' : 'desactivado'}`)
  } catch (err) {
    show(mensajeError(err, 'No se pudo actualizar'), true)
  }
}
</script>

<template>
  <section>
    <form class="alta" @submit.prevent="crear">
      <label class="campo">
        <span class="campo-label">Código</span>
        <input v-model="codigo" class="input" type="text" placeholder="Ej. OP-01" :disabled="guardando">
      </label>
      <label class="campo">
        <span class="campo-label">Tipo</span>
        <select v-model="tipo" class="input" :disabled="guardando">
          <option value="ORDER_PICKER">Order Picker</option>
          <option value="GENIE">Genie</option>
        </select>
      </label>
      <button class="btn btn-primary" type="submit" :disabled="!codigo.trim() || guardando">
        <Loader2 v-if="guardando" :size="15" class="spin" /><Plus v-else :size="15" />
        Dar de alta
      </button>
    </form>

    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>
    <p v-else-if="equipos.length === 0" class="vacio">Todavía no hay equipos. Da de alta el Order Picker y el Genie.</p>

    <ul v-else class="lista">
      <li v-for="e in equipos" :key="e.id" class="fila" :class="{ baja: !e.activo }">
        <div>
          <strong>{{ e.codigo }}</strong>
          <span class="tipo">{{ TIPO_EQUIPO_LABEL[e.tipo] }}</span>
        </div>
        <button class="btn btn-sm" @click="alternar(e)">{{ e.activo ? 'Desactivar' : 'Activar' }}</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.alta { display: flex; align-items: flex-end; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.campo { display: flex; flex-direction: column; gap: 4px; }
.campo-label { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.fila.baja { opacity: .55; }
.fila strong { font-size: 14.5px; font-weight: 700; color: var(--ink); }
.tipo { margin-left: 9px; font-size: 12px; color: var(--muted); }
.cargando { display: flex; align-items: center; gap: 9px; padding: 24px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 26px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
</style>

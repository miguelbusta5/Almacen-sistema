<script setup lang="ts">
// Pasar el PLU a un ayudante. Se muestra la carga pendiente de cada uno para
// que el operario reparta con criterio en vez de a ciegas.
import { ref, onMounted, computed } from 'vue'
import { UserPlus } from '@lucide/vue'
import { API_MONTACARGAS, type Ayudante, type Movimiento } from '~/utils/montacargas'

const props = defineProps<{ movimiento: Movimiento }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'traspasado', ayudante: string): void }>()

const ayudantes = ref<Ayudante[]>([])
const cargando = ref(true)
const enviando = ref('')
const error = ref('')

onMounted(async () => {
  try {
    const res = await $fetch<{ data: Ayudante[] }>(`${API_MONTACARGAS}/ayudantes`)
    ayudantes.value = res.data
  } catch (e) {
    error.value = apiErr(e, 'No se pudo cargar la lista de ayudantes')
  } finally {
    cargando.value = false
  }
})

const vacio = computed(() => !cargando.value && ayudantes.value.length === 0)

async function traspasar(a: Ayudante) {
  if (enviando.value) return
  enviando.value = a.id
  error.value = ''
  try {
    await $fetch(`${API_MONTACARGAS}/${props.movimiento.id}/traspasar`, {
      method: 'POST',
      body: { ayudanteId: a.id },
    })
    emit('traspasado', a.nombre)
  } catch (e) {
    error.value = apiErr(e, 'No se pudo pasar el PLU')
  } finally {
    enviando.value = ''
  }
}
</script>

<template>
  <ModalShell
    title="Pasar a un ayudante"
    :sub="`PLU ${movimiento.plu} · ${movimiento.cantidadTotal} unidades`"
    @close="emit('close')"
  >
    <p class="intro">
      Al pasarlo, tu tiempo se detiene y arranca el del ayudante.
    </p>

    <ListSkeleton v-if="cargando" />
    <EmptyState
      v-else-if="vacio" title="Sin ayudantes disponibles"
      description="No hay operarios de almacenamiento activos. Pide a un administrador que los cree."
    />

    <ul v-else class="lista">
      <li v-for="a in ayudantes" :key="a.id">
        <button class="fila" :disabled="Boolean(enviando)" @click="traspasar(a)">
          <span class="nombre">{{ a.nombre }}</span>
          <span class="carga" :class="{ libre: a.pendientes === 0 }">
            {{ a.pendientes === 0 ? 'sin pendientes' : `${a.pendientes} pendiente${a.pendientes !== 1 ? 's' : ''}` }}
          </span>
          <Spinner v-if="enviando === a.id" :size="14" />
          <UserPlus v-else :size="15" class="ic" />
        </button>
      </li>
    </ul>

    <p v-if="error" class="err">{{ error }}</p>

    <div class="acciones">
      <button type="button" class="btn" @click="emit('close')">Cancelar</button>
    </div>
  </ModalShell>
</template>

<style scoped>
.intro { margin: 0 0 12px; font-size: 12.5px; color: var(--muted); }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; max-height: 340px; overflow-y: auto; }
.fila {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 11px 13px; border: 1px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface); cursor: pointer; text-align: left;
  transition: border-color .15s, background .15s;
}
.fila:hover:not(:disabled) { border-color: color-mix(in srgb, var(--brand) 45%, var(--border)); background: var(--surface-2); }
.fila:disabled { opacity: .6; cursor: default; }
.nombre { flex: 1; font-size: 13.5px; font-weight: 600; color: var(--ink); }
.carga { font-size: 11.5px; font-weight: 700; color: var(--u-aviso); }
.carga.libre { color: var(--u-ok); }
.ic { color: var(--muted); flex-shrink: 0; }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 12px 0 0; }
.acciones { display: flex; justify-content: flex-end; margin-top: 14px; }
</style>

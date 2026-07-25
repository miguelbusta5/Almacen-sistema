<script setup lang="ts">
// Mover registros a otro país. Solo ADMIN (el servidor exige requireRole(['ADMIN'])).
import { ref, computed } from 'vue'
import { TriangleAlert } from '@lucide/vue'
import { PAISES_EXPORT_LIST, type PaisConfig } from '~/utils/exportaciones'

const props = defineProps<{ ids: string[]; cfg: PaisConfig }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'moved', n: number): void }>()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const destinos = computed(() => PAISES_EXPORT_LIST.filter((p) => p.pais !== props.cfg.pais))
const destino = ref(destinos.value[0]?.pais ?? '')
const motivo = ref('')
const saving = ref(false)
const error = ref('')

const puedeMover = computed(() => !saving.value && !!destino.value && motivo.value.trim().length >= 5)

async function submit() {
  if (!puedeMover.value) return
  saving.value = true
  error.value = ''
  try {
    const res = await $fetch<{ moved: number }>('/api/exportaciones/mover', {
      method: 'POST',
      body: { ids: props.ids, origenPais: props.cfg.pais, destinoPais: destino.value, motivo: motivo.value.trim() },
    })
    emit('moved', res.moved)
  } catch (e) {
    error.value = apiErr(e, 'No se pudieron mover los registros')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell
    title="Mover registros a otro país"
    :sub="`${ids.length} seleccionado${ids.length !== 1 ? 's' : ''} · desde ${cfg.paisLabel}`"
    @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <label class="f">
        <span class="lbl">País destino</span>
        <select v-model="destino" class="field">
          <option v-for="p in destinos" :key="p.pais" :value="p.pais">{{ p.label }}</option>
        </select>
      </label>

      <label class="f">
        <span class="lbl">Motivo</span>
        <textarea v-model="motivo" class="field" rows="3" placeholder="Por qué se mueven (mínimo 5 caracteres)" />
      </label>

      <p class="aviso">
        <TriangleAlert :size="14" />
        Los registros se copian al país destino y los originales quedan marcados como borrados.
        Se les asigna un id nuevo.
      </p>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="acciones">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!puedeMover">
          <Spinner v-if="saving" :size="14" />{{ saving ? 'Moviendo…' : 'Mover registros' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 13px; }
.f { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.aviso { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--ink-2); background: var(--u-aviso-tint); border-radius: var(--r-sm); padding: 10px 12px; margin: 0; }
.aviso :deep(svg) { color: var(--u-aviso); flex-shrink: 0; margin-top: 1px; }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 0; }
.acciones { display: flex; justify-content: flex-end; gap: 9px; margin-top: 4px; }
</style>

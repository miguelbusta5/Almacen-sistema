<script setup lang="ts">
// Confirmar el borrado de un pendiente, con justificante.
//
// En uno ya ubicado el motivo es obligatorio: es historia y cuenta en los
// indicadores del operario, asi que borrarlo tiene que quedar explicado. En
// los demas se puede dejar un motivo, pero no se exige.
import { computed, ref } from 'vue'
import { Trash2 } from '@lucide/vue'
import {
  exigeMotivoBorrado, MIN_MOTIVO_BORRADO, validarMotivoBorrado, type PendienteDTO,
} from '~/utils/resurtidoTareas'

const props = defineProps<{ pendiente: PendienteDTO; mensaje: string; guardando: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'confirm', motivo: string): void }>()

const motivo = ref('')
const exige = computed(() => exigeMotivoBorrado(props.pendiente.estado))
const error = computed(() => validarMotivoBorrado(props.pendiente.estado, motivo.value))
const faltan = computed(() => Math.max(0, MIN_MOTIVO_BORRADO - motivo.value.trim().length))

function confirmar() {
  if (error.value || props.guardando) return
  emit('confirm', motivo.value.trim())
}
</script>

<template>
  <ModalShell title="Borrar pendiente" :sub="`PLU ${pendiente.plu} · ${pendiente.descripcion}`" @close="emit('close')">
    <form class="bm" @submit.prevent="confirmar">
      <p class="msg">{{ mensaje }}</p>
      <label class="f">
        <span class="lbl">{{ exige ? 'Motivo del borrado (obligatorio)' : 'Motivo (opcional)' }}</span>
        <textarea
          v-model="motivo" class="field" rows="3" maxlength="500"
          :placeholder="exige ? 'Por qué se borra un pendiente que ya se ubicó' : 'Si quieres, deja el motivo'"
        />
        <span v-if="exige && faltan > 0" class="hint">Faltan {{ faltan }} caracteres</span>
      </label>
      <div class="acciones">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-danger" :disabled="!!error || guardando">
          <Spinner v-if="guardando" :size="14" /><Trash2 v-else :size="14" />
          {{ guardando ? 'Borrando…' : 'Borrar' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.bm { display: flex; flex-direction: column; gap: 14px; }
.msg { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--ink-2); }
.f { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.f textarea { resize: vertical; min-height: 70px; font-family: inherit; padding: 8px 10px; }
.hint { font-size: 11.5px; color: var(--muted); }
.acciones { display: flex; justify-content: flex-end; gap: 8px; }
</style>

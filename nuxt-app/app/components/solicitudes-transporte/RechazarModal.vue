<script setup lang="ts">
// El rechazo va en modal, no en un textarea suelto del panel: así el error de
// "mínimo 5 caracteres" sale junto al campo en vez de perderse en otra vista.
import { ref, computed, onMounted, nextTick } from 'vue'

const props = defineProps<{ saving: boolean; error: string; pedido: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'confirm', motivo: string): void }>()

const motivo = ref('')
const campo = ref<HTMLTextAreaElement | null>(null)

// ModalShell enfoca su primer elemento focusable, que es el botón de cerrar de la
// cabecera; el `autofocus` del textarea no llega a aplicarse. Se fuerza después.
onMounted(async () => { await nextTick(); campo.value?.focus() })
const touched = ref(false)
const corto = computed(() => motivo.value.trim().length < 5)
const puede = computed(() => !props.saving && !corto.value)
</script>

<template>
  <ModalShell title="Rechazar solicitud" :sub="pedido" @close="emit('close')">
    <form class="form" @submit.prevent="emit('confirm', motivo.trim())">
      <label class="f">
        <span class="lbl">Motivo del rechazo</span>
        <textarea
          ref="campo" v-model="motivo" class="field" rows="4"
          placeholder="Explica qué debe corregir el solicitante (mínimo 5 caracteres)"
          @blur="touched = true"
        />
        <span v-if="touched && corto" class="warn">El motivo debe tener al menos 5 caracteres.</span>
      </label>

      <p class="nota">El solicitante recibirá una notificación con este texto y podrá corregir y reenviar.</p>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="acc">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button class="btn btn-danger" :disabled="!puede">
          <Spinner v-if="saving" :size="14" />{{ saving ? 'Rechazando…' : 'Rechazar solicitud' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 13px; }
.f { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.warn { font-size: 12px; color: var(--u-aviso); }
.nota { margin: 0; font-size: 12px; color: var(--faint); }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 0; }
.acc { display: flex; justify-content: flex-end; gap: 9px; }
</style>

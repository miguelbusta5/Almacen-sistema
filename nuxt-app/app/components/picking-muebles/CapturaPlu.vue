<script setup lang="ts">
// Captura de un PLU, en los cuatro pasos que hace el operario de verdad:
//
//   1. escanea el PLU            -> arranca el reloj del PLU (llamada al servidor)
//   2. sale a NetSuite y pickea  -> la app solo se lo recuerda, no cronometra aparte
//   3. escanea la ubicacion + unidades
//   4. escanea el QR del rotulo  -> para el reloj y cierra la linea
//
// Cada campo es un input con foco automatico: el operario trabaja con pistola en
// modo teclado, que escribe el codigo y manda un Enter. Nada de camara.
import { computed, nextTick, ref, watch } from 'vue'
import { ScanLine, CornerDownLeft, Loader2 } from '@lucide/vue'
import { fmtKg, fmtM3, type Linea } from '~/utils/muebles'

const props = defineProps<{ lineaEnCurso: Linea | null; guardando: boolean }>()
const emit = defineEmits<{
  (e: 'escanear-plu', plu: string): void
  (e: 'cerrar-linea', datos: { ubicacion: string; unidades: number; numeroCaja: string }): void
}>()

const plu = ref('')
const ubicacion = ref('')
const unidades = ref<number | null>(null)
const numeroCaja = ref('')

const inputPlu = ref<HTMLInputElement | null>(null)
const inputUbicacion = ref<HTMLInputElement | null>(null)
const inputUnidades = ref<HTMLInputElement | null>(null)
const inputCaja = ref<HTMLInputElement | null>(null)

const enCurso = computed(() => props.lineaEnCurso != null)

// El foco salta solo al campo que toca: con la pistola en la mano, tocar la
// pantalla para enfocar es justo el gesto que hace lento el proceso.
watch(enCurso, async (hay) => {
  await nextTick()
  if (hay) inputUbicacion.value?.focus()
  else {
    ubicacion.value = ''
    unidades.value = null
    numeroCaja.value = ''
    inputPlu.value?.focus()
  }
})

function enviarPlu() {
  const v = plu.value.trim()
  if (!v || props.guardando) return
  emit('escanear-plu', v)
  plu.value = ''
}

function cerrar() {
  if (props.guardando) return
  if (!ubicacion.value.trim() || !unidades.value || !numeroCaja.value.trim()) return
  emit('cerrar-linea', {
    ubicacion: ubicacion.value.trim(),
    unidades: Number(unidades.value),
    numeroCaja: numeroCaja.value.trim(),
  })
}

const listoParaCerrar = computed(
  () => !!ubicacion.value.trim() && !!unidades.value && unidades.value > 0 && !!numeroCaja.value.trim(),
)

defineExpose({ enfocar: () => (enCurso.value ? inputUbicacion.value?.focus() : inputPlu.value?.focus()) })
</script>

<template>
  <section class="cap-box">
    <!-- Paso 1: sin PLU en curso, lo unico en pantalla es el escaneo del PLU. -->
    <template v-if="!enCurso">
      <label class="campo">
        <span class="campo-label"><ScanLine :size="13" /> Escanea el PLU</span>
        <input
          ref="inputPlu" v-model="plu" class="input scan" type="text" inputmode="text"
          autocomplete="off" autofocus placeholder="PLU" :disabled="guardando"
          @keyup.enter="enviarPlu"
        >
      </label>
      <button class="btn btn-primary" :disabled="!plu.trim() || guardando" @click="enviarPlu">
        <Loader2 v-if="guardando" :size="15" class="spin" />
        <CornerDownLeft v-else :size="15" />
        Iniciar PLU
      </button>
    </template>

    <!-- Pasos 2 a 4: el PLU ya corre. Primero el recordatorio de NetSuite, que es
         donde el operario pasa la mayor parte del tiempo. -->
    <template v-else>
      <div class="ficha">
        <div class="ficha-plu">
          <strong>{{ lineaEnCurso!.plu }}</strong>
          <span v-if="lineaEnCurso!.descripcion">{{ lineaEnCurso!.descripcion }}</span>
        </div>
        <dl class="ficha-datos">
          <div><dt>Partes</dt><dd>{{ lineaEnCurso!.partes ?? '—' }}</dd></div>
          <div><dt>Peso</dt><dd>{{ fmtKg(lineaEnCurso!.pesoUnitarioKg) }}</dd></div>
          <div><dt>Volumen</dt><dd>{{ fmtM3(lineaEnCurso!.volumenUnitarioM3) }}</dd></div>
        </dl>
        <p v-if="lineaEnCurso!.volumenUnitarioM3 == null" class="ficha-aviso">
          Este PLU no está medido en el maestro: no sumará al volumen de la orden.
        </p>
      </div>

      <p class="netsuite">Haz el picking en NetSuite y vuelve aquí para cerrar el PLU.</p>

      <div class="fila">
        <label class="campo">
          <span class="campo-label"><ScanLine :size="13" /> Ubicación</span>
          <input
            ref="inputUbicacion" v-model="ubicacion" class="input scan" type="text"
            autocomplete="off" placeholder="Escanea la ubicación" :disabled="guardando"
            @keyup.enter="inputUnidades?.focus()"
          >
        </label>

        <label class="campo corto">
          <span class="campo-label">Unidades</span>
          <input
            ref="inputUnidades" v-model.number="unidades" class="input scan" type="number"
            inputmode="numeric" min="1" placeholder="0" :disabled="guardando"
            @keyup.enter="inputCaja?.focus()"
          >
        </label>
      </div>

      <label class="campo">
        <span class="campo-label"><ScanLine :size="13" /> QR del rótulo</span>
        <input
          ref="inputCaja" v-model="numeroCaja" class="input scan" type="text"
          autocomplete="off" placeholder="Escanea el rótulo (ej. M123134)" :disabled="guardando"
          @keyup.enter="cerrar"
        >
      </label>

      <button class="btn btn-primary ancho" :disabled="!listoParaCerrar || guardando" @click="cerrar">
        <Loader2 v-if="guardando" :size="15" class="spin" />
        <CornerDownLeft v-else :size="15" />
        Finalizar PLU
      </button>
    </template>
  </section>
</template>

<style scoped>
.cap-box { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); margin-bottom: 18px; }
.campo { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
.campo.corto { flex: 0 0 120px; }
.campo-label { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.input.scan { font-size: 16px; font-weight: 600; letter-spacing: .02em; padding: 11px 13px; }
.fila { display: flex; gap: 12px; flex-wrap: wrap; }
.ancho { width: 100%; justify-content: center; }

.ficha { padding: 12px 14px; border-radius: var(--r-sm); background: var(--brand-tint); border: 1px solid color-mix(in srgb, var(--brand) 24%, transparent); }
.ficha-plu { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.ficha-plu strong { font-size: 18px; font-weight: 800; color: var(--ink); }
.ficha-plu span { font-size: 13px; color: var(--ink-2); }
.ficha-datos { display: flex; gap: 20px; margin: 9px 0 0; flex-wrap: wrap; }
.ficha-datos dt { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.ficha-datos dd { margin: 2px 0 0; font-size: 14px; font-weight: 700; color: var(--ink); }
.ficha-aviso { margin: 9px 0 0; font-size: 11.5px; font-weight: 600; color: var(--u-aviso); }

.netsuite { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

@media (max-width: 560px) {
  .campo.corto { flex: 1 1 100%; }
}
</style>

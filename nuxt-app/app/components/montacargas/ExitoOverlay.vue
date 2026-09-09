<script setup lang="ts">
// Confirmacion de "proceso exitoso" tras cerrar un registro. Pantalla completa y
// sin interaccion: el padre la muestra y la quita con un timer, y devuelve el
// foco a la captura para que el operario encadene el siguiente.
// Mismo formato que VeredictoOverlay de Cargue Gourmet - el operario de CEDI ya
// conoce ese lenguaje visual.
import { CheckCircle2 } from '@lucide/vue'
import { fmtTiempo, type Movimiento } from '~/utils/montacargas'

defineProps<{ movimiento: Movimiento | null }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="exito">
      <div v-if="movimiento" :key="movimiento.id" class="full">
        <CheckCircle2 :size="88" class="full-ic" />
        <div class="full-label">Registro completado</div>
        <div class="full-cod mono">{{ movimiento.ubicacionFinal }}</div>
        <div class="full-msg">
          PLU {{ movimiento.plu }} · {{ movimiento.cajas }} cajas
          <template v-if="movimiento.hayReguero"> + {{ movimiento.unidadesSueltas }} sueltas</template>
          · {{ movimiento.cantidadTotal }} unidades
        </div>
        <div class="full-tiempo">Tiempo: {{ fmtTiempo(movimiento.duracionSegundos) }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.full {
  position: fixed; inset: 0; z-index: 10000; pointer-events: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  padding: 24px; text-align: center;
  background: color-mix(in srgb, var(--u-ok) 88%, #000);
  color: #fff;
}
.full-ic { filter: drop-shadow(0 4px 18px rgba(0, 0, 0, .35)); }
.full-label { font-size: 30px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; }
.full-cod { font-size: 22px; font-weight: 700; background: rgba(0, 0, 0, .28); padding: 6px 16px; border-radius: var(--r-sm); }
.full-msg { font-size: 15px; opacity: .92; max-width: 480px; }
.full-tiempo { font-size: 14px; font-weight: 700; opacity: .85; }

.exito-enter-active { transition: opacity .12s ease; }
.exito-leave-active { transition: opacity .3s ease; }
.exito-enter-from, .exito-leave-to { opacity: 0; }
</style>

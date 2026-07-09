<script setup lang="ts">
import { CheckCircle2, TriangleAlert, XCircle, WifiOff } from '@lucide/vue'
import { RESULTADO_LABEL } from '~/utils/gourmet'

// Overlay de veredicto de escaneo — pantalla completa para TODOS los
// veredictos, con el mismo formato: verde para válida (más breve, pedido
// explícito del usuario: "la alerta de caja correcta debe ser como las
// otras"), amarillo/rojo para problemas y error de red. Puramente
// presentacional y sin interacción (pointer-events none): el padre
// controla cuándo aparece y lo limpia con un timer. Va por encima del
// overlay de la cámara (z-index mayor) para que el operario lo vea
// también en modo cámara.
const props = defineProps<{ v: { resultado: string; codigo: string; mensaje?: string } | null }>()

const ICONO: Record<string, unknown> = {
  VALIDO: CheckCircle2, DUPLICADO: TriangleAlert, CAJA_AJENA: XCircle,
  FORMATO_INVALIDO: TriangleAlert, EXCEDE_CANTIDAD: TriangleAlert, ERROR_RED: WifiOff,
}
const COLOR: Record<string, string> = {
  VALIDO: 'var(--u-ok)', DUPLICADO: 'var(--u-aviso)', CAJA_AJENA: 'var(--u-critico)',
  FORMATO_INVALIDO: 'var(--u-aviso)', EXCEDE_CANTIDAD: 'var(--u-aviso)', ERROR_RED: 'var(--u-critico)',
}
const LABEL: Record<string, string> = { ...RESULTADO_LABEL, ERROR_RED: 'Error de red — caja NO registrada' }
</script>

<template>
  <Teleport to="body">
    <Transition name="veredicto">
      <div v-if="v" :key="v.resultado + v.codigo" class="full" :style="{ '--c': COLOR[v.resultado] ?? 'var(--u-critico)' }">
        <component :is="ICONO[v.resultado] ?? TriangleAlert" :size="88" class="full-ic" />
        <div class="full-label">{{ LABEL[v.resultado] ?? v.resultado }}</div>
        <div class="full-cod mono">{{ v.codigo }}</div>
        <div v-if="v.mensaje" class="full-msg">{{ v.mensaje }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.full {
  position: fixed; inset: 0; z-index: 10000; pointer-events: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  padding: 24px; text-align: center;
  background: color-mix(in srgb, var(--c) 88%, #000);
  color: #fff;
}
.full-ic { filter: drop-shadow(0 4px 18px rgba(0, 0, 0, .35)); }
.full-label { font-size: 30px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; }
.full-cod { font-size: 22px; font-weight: 700; background: rgba(0, 0, 0, .28); padding: 6px 16px; border-radius: var(--r-sm); }
.full-msg { font-size: 15px; opacity: .92; max-width: 480px; }
.veredicto-enter-active { transition: opacity .12s ease; }
.veredicto-leave-active { transition: opacity .35s ease; }
.veredicto-enter-from, .veredicto-leave-to { opacity: 0; }
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { calcSla } from '~/utils/despacho'
import { fmtFecha } from '~/utils/guardado'

const props = defineProps<{ createdAt: string; fechaEntregaComprometida: string }>()

const sla = computed(() => calcSla(props.createdAt, props.fechaEntregaComprometida))

const FASE_LABEL: Record<string, string> = { ok: 'A tiempo', proximo: 'Por vencer', vencido: 'Vencida' }
const FASE_TONE: Record<string, string> = { ok: 'var(--u-ok)', proximo: 'var(--u-aviso)', vencido: 'var(--u-critico)' }
const tone = computed(() => FASE_TONE[sla.value.fase]!)
</script>

<template>
  <div class="meter" :class="sla.fase" :style="{ '--c': tone }">
    <div class="meter-head">
      <div>
        <div class="meter-kicker">Entrega comprometida</div>
        <div class="meter-amount mono">{{ FASE_LABEL[sla.fase] }}</div>
        <div class="meter-sub">
          <template v-if="sla.fase === 'vencido'">Vencida hace <b>{{ -sla.diasRestantes }}d</b> · {{ fmtFecha(fechaEntregaComprometida) }}</template>
          <template v-else>Faltan <b>{{ sla.diasRestantes }}d</b> · {{ fmtFecha(fechaEntregaComprometida) }}</template>
        </div>
      </div>
      <div class="meter-next">
        <div class="meter-next-label">Transcurrido</div>
        <div class="meter-next-val mono">{{ sla.diasTranscurridos }}/{{ sla.diasTotales }}d</div>
      </div>
    </div>

    <div class="track">
      <div class="tseg" :class="sla.fase">
        <span class="tseg-fill" :style="{ '--fill': sla.progreso }" />
        <span class="tseg-today" :style="{ left: `calc(${sla.progreso * 100}% - 1px)` }">
          <span class="today-dot" /><span class="today-tip">Hoy</span>
        </span>
      </div>
    </div>
    <div class="track-axis mono">
      <span>Creación · {{ fmtFecha(createdAt) }}</span>
      <span>Entrega · {{ fmtFecha(fechaEntregaComprometida) }}</span>
    </div>
  </div>
</template>

<style scoped>
.meter {
  border: 1px solid color-mix(in srgb, var(--c) 22%, var(--border));
  background:
    radial-gradient(120% 130% at 0% 0%, color-mix(in srgb, var(--c) 9%, transparent), transparent 55%),
    linear-gradient(180deg, color-mix(in srgb, var(--c) 4%, var(--surface)), var(--surface));
  border-radius: var(--r-md);
  padding: 17px 19px;
  box-shadow: var(--shadow-xs);
}
.meter-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.meter-kicker { font-size: 10.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--faint); }
.meter-amount { font-family: var(--display); font-size: 26px; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; color: var(--c); margin-top: 2px; }
.meter-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
.meter-sub b { color: var(--ink-2); }
.meter-next { text-align: right; flex-shrink: 0; padding: 9px 13px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--c) 12%, var(--surface)); border: 1px solid color-mix(in srgb, var(--c) 22%, transparent); }
.meter-next-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: color-mix(in srgb, var(--c) 75%, var(--ink)); }
.meter-next-val { font-size: 17px; font-weight: 800; color: color-mix(in srgb, var(--c) 75%, var(--ink)); }

.track { display: flex; gap: 5px; }
.tseg { position: relative; flex: 1; height: 38px; border-radius: var(--r-xs); background: var(--surface-3); overflow: visible; border: 1px solid var(--border); }
.tseg-fill { position: absolute; inset: 0; border-radius: inherit; transform-origin: left; transform: scaleX(var(--fill, 0)); animation: meterFillSla .7s cubic-bezier(.22,1,.36,1) both; overflow: hidden; background: linear-gradient(90deg, color-mix(in srgb, var(--c) 62%, white), var(--c)); }
@keyframes meterFillSla { from { transform: scaleX(0); } }
.tseg.vencido .tseg-fill { box-shadow: inset 0 1px 0 rgba(255,255,255,.35); }
.tseg.vencido .tseg-fill::after { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.4) 50%, transparent 65%); transform: translateX(-100%); animation: sheenSla 3.4s ease-in-out infinite; }
@keyframes sheenSla { 0%, 55% { transform: translateX(-120%); } 80%, 100% { transform: translateX(120%); } }
/* Marcador "hoy" */
.tseg-today { position: absolute; top: -7px; bottom: -7px; z-index: 3; width: 2px; background: var(--ink); border-radius: 2px; animation: auroraFade .5s .5s both; }
.today-dot { position: absolute; top: -4px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 3px var(--surface); }
.today-tip { position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); font-size: 9px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--ink); background: var(--surface); padding: 1px 5px; border-radius: 4px; box-shadow: var(--shadow-xs); }
.track-axis { display: flex; justify-content: space-between; margin-top: 12px; font-size: 10.5px; color: var(--faint); }
</style>

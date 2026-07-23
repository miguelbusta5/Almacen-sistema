<script setup lang="ts">
import { computed } from 'vue'
import { calcAlmacenaje, TARIFA_ALM } from '~/utils/almacenaje'
import { fmtCOP, fmtFecha } from '~/utils/guardado'

const props = defineProps<{
  fecha: string
  endDate?: string | null
  mode?: 'mini' | 'full'
  // Si el padre ya calculó calcAlmacenaje() para esta fila (p. ej. para
  // ordenar la tabla), se lo pasa aquí y evitamos recalcularlo.
  alm?: ReturnType<typeof calcAlmacenaje>
}>()

const alm = computed(() => props.alm ?? calcAlmacenaje(props.fecha, props.endDate ?? null))

interface Seg { kind: 'gracia' | 'charged' | 'current' | 'next'; fill: number; active?: boolean }

// Ya no hay bloques de 30 días: tras la gracia se acumula un solo segmento
// "cobro" que crece día a día. Se escala visualmente a una ventana de 60
// días cobrados (no limita el cobro real, solo la barra no sigue creciendo
// sin fin en pantalla).
const VENTANA_VISUAL_COBRO = 60

const segments = computed<Seg[]>(() => {
  const a = alm.value
  const segs: Seg[] = []
  segs.push({ kind: 'gracia', fill: Math.min(a.diasTranscurridos, 30) / 30, active: a.fase === 'gracia' })
  if (a.fase === 'gracia') {
    segs.push({ kind: 'next', fill: 0 })
  } else {
    segs.push({ kind: 'current', fill: Math.min(a.cobrosGenerados, VENTANA_VISUAL_COBRO) / VENTANA_VISUAL_COBRO, active: true })
  }
  return segs
})

const enGracia = computed(() => alm.value.fase === 'gracia')
</script>

<template>
  <!-- Mini: sólo la barra segmentada (para celdas de tabla) -->
  <div v-if="mode === 'mini'" class="meter-mini" :title="enGracia ? `En gracia · faltan ${alm.diasGraciaRestantes}d` : `${fmtCOP(alm.costoAcumulado)} · ${alm.cobrosGenerados}d cobrados`">
    <span
      v-for="(s, i) in segments" :key="i"
      class="seg" :class="s.kind"
      :style="{ '--fill': s.fill }"
    />
  </div>

  <!-- Full: medidor de ciclo completo (detalle) -->
  <div v-else class="meter" :class="{ gracia: enGracia }">
    <div class="meter-head">
      <div>
        <div class="meter-kicker">Ciclo de almacenaje</div>
        <div class="meter-amount mono" :class="{ billed: !enGracia }">
          {{ enGracia ? 'En gracia' : fmtCOP(alm.costoAcumulado) }}
        </div>
        <div class="meter-sub">
          <template v-if="enGracia">
            Gracia vence el {{ fmtFecha(alm.finGracia) }} · faltan <b>{{ alm.diasGraciaRestantes }}d</b>
          </template>
          <template v-else>
            {{ alm.cobrosGenerados }} día(s) cobrados a {{ fmtCOP(TARIFA_ALM) }}/día
          </template>
        </div>
      </div>
      <div class="meter-next">
        <div class="meter-next-label">Próximo día cobrado</div>
        <div class="meter-next-val mono">+{{ fmtCOP(TARIFA_ALM) }}</div>
        <div class="meter-next-when">en {{ alm.diasHastaProximoCobro }}d · {{ fmtFecha(alm.fechaProximoCobro) }}</div>
      </div>
    </div>

    <div class="track">
      <div
        v-for="(s, i) in segments" :key="i"
        class="tseg" :class="s.kind"
        :style="{ '--fill': s.fill }"
      >
        <span class="tseg-fill" />
        <span v-if="s.active" class="tseg-today" :style="{ left: `calc(${s.fill * 100}% - 1px)` }">
          <span class="today-dot" /><span class="today-tip">Hoy</span>
        </span>
        <span class="tseg-cap">
          <template v-if="s.kind === 'gracia'">Gracia · 30d</template>
          <template v-else-if="s.kind === 'current'">{{ alm.cobrosGenerados }}d cobrados</template>
          <template v-else>Desde el día 31</template>
        </span>
      </div>
    </div>
    <div class="track-axis mono">
      <span>Ingreso · {{ fmtFecha(fecha) }}</span>
      <span>{{ alm.diasTranscurridos }} días</span>
    </div>
  </div>
</template>

<style scoped>
/* ── Mini ── */
.meter-mini { display: flex; gap: 3px; width: 100%; max-width: 132px; }
.meter-mini .seg {
  position: relative; height: 7px; flex: 1; border-radius: 4px;
  background: var(--surface-3); overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(16,22,35,.03);
}
.meter-mini .seg::after {
  content: ''; position: absolute; inset: 0; border-radius: 4px;
  transform-origin: left; transform: scaleX(var(--fill, 0));
}
.meter-mini .seg.gracia::after { background: linear-gradient(90deg, color-mix(in srgb, var(--u-ok) 65%, white), var(--u-ok)); }
.meter-mini .seg.current::after { background: linear-gradient(90deg, var(--bill), color-mix(in srgb, var(--bill) 78%, white)); }
.meter-mini .seg.next::after { background: var(--border-strong); }

/* ── Full ── */
.meter {
  border: 1px solid color-mix(in srgb, var(--bill) 22%, var(--border));
  background:
    radial-gradient(120% 130% at 0% 0%, color-mix(in srgb, var(--bill) 9%, transparent), transparent 55%),
    linear-gradient(180deg, color-mix(in srgb, var(--bill) 4%, var(--surface)), var(--surface));
  border-radius: var(--r-md);
  padding: 17px 19px;
  box-shadow: var(--shadow-xs);
}
.meter.gracia {
  border-color: color-mix(in srgb, var(--u-ok) 26%, var(--border));
  background:
    radial-gradient(120% 130% at 0% 0%, color-mix(in srgb, var(--u-ok) 10%, transparent), transparent 55%),
    linear-gradient(180deg, color-mix(in srgb, var(--u-ok) 5%, var(--surface)), var(--surface));
}
.meter-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.meter-kicker { font-size: 10.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--faint); }
.meter-amount { font-family: var(--display); font-size: 32px; font-weight: 800; letter-spacing: -.035em; line-height: 1.1; color: var(--u-ok); margin-top: 2px; }
.meter-amount.billed { color: var(--bill-deep); }
.meter-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
.meter-sub b { color: var(--ink-2); }
.meter-next { text-align: right; flex-shrink: 0; padding: 9px 13px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--bill) 12%, var(--surface)); border: 1px solid color-mix(in srgb, var(--bill) 22%, transparent); }
.meter-next-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--bill-deep); }
.meter-next-val { font-size: 17px; font-weight: 800; color: var(--bill-deep); }
.meter-next-when { font-size: 10.5px; color: var(--muted); margin-top: 1px; }

.track { display: flex; gap: 5px; }
.tseg { position: relative; flex: 1; height: 38px; border-radius: var(--r-xs); background: var(--surface-3); overflow: visible; border: 1px solid var(--border); }
.tseg-fill { position: absolute; inset: 0; border-radius: inherit; transform-origin: left; transform: scaleX(var(--fill, 0)); animation: meterFill .7s cubic-bezier(.22,1,.36,1) both; overflow: hidden; }
@keyframes meterFill { from { transform: scaleX(0); } }
.tseg.gracia .tseg-fill { background: linear-gradient(90deg, color-mix(in srgb, var(--u-ok) 62%, white), var(--u-ok)); }
.tseg.current .tseg-fill { background: linear-gradient(180deg, color-mix(in srgb, var(--bill) 88%, white), var(--bill)); box-shadow: inset 0 1px 0 rgba(255,255,255,.35); }
.tseg.current .tseg-fill::after { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.4) 50%, transparent 65%); transform: translateX(-100%); animation: sheen 3.4s ease-in-out infinite; }
@keyframes sheen { 0%, 55% { transform: translateX(-120%); } 80%, 100% { transform: translateX(120%); } }
.tseg.next { border-style: dashed; }
.tseg-cap {
  position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center;
  font-size: 10.5px; font-weight: 700; font-family: var(--mono);
  color: var(--ink-2); text-shadow: 0 1px 2px rgba(255,255,255,.6);
}
.tseg.current .tseg-cap { color: white; text-shadow: 0 1px 3px rgba(0,0,0,.3); }
/* Marcador "hoy" */
.tseg-today { position: absolute; top: -7px; bottom: -7px; z-index: 3; width: 2px; background: var(--ink); border-radius: 2px; animation: auroraFade .5s .5s both; }
.today-dot { position: absolute; top: -4px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 3px var(--surface); }
.today-tip { position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); font-size: 9px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--ink); background: var(--surface); padding: 1px 5px; border-radius: 4px; box-shadow: var(--shadow-xs); }
.track-axis { display: flex; justify-content: space-between; margin-top: 12px; font-size: 10.5px; color: var(--faint); }
</style>

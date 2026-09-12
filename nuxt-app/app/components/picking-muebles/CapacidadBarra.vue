<script setup lang="ts">
// Capacidad ocupada del equipo asignado. Se muestra % y m3.
//
// Sin capacidad medida (el Order Picker y el Genie estan pendientes de medir) se
// muestran los m3 acumulados SIN porcentaje, en vez de inventarse un 0%: un dato
// falso es peor que un dato ausente cuando el operario decide si le cabe algo mas.
import { computed } from 'vue'
import { TIPO_EQUIPO_LABEL, TONO_CAPACIDAD, fmtKg, fmtM3, type Capacidad, type Equipo } from '~/utils/muebles'

const props = defineProps<{ equipo: Equipo | null; capacidad: Capacidad }>()

const tono = computed(() => TONO_CAPACIDAD[props.capacidad.tono])
const anchoPct = computed(() => {
  const p = props.capacidad.porcentaje
  if (p == null) return 0
  return Math.min(100, Math.max(0, p))
})
</script>

<template>
  <section class="cap" :style="{ '--c': tono }">
    <header class="cap-head">
      <div class="cap-equipo">
        <span class="cap-label">Equipo de hoy</span>
        <strong v-if="equipo" class="cap-codigo">
          {{ equipo.codigo }}
          <span class="cap-tipo">{{ TIPO_EQUIPO_LABEL[equipo.tipo] }}</span>
        </strong>
        <strong v-else class="cap-codigo sin">Sin equipo asignado</strong>
      </div>

      <div class="cap-cifras">
        <span class="cap-pct mono tnum">
          {{ capacidad.porcentaje == null ? '—' : `${capacidad.porcentaje}%` }}
        </span>
        <span class="cap-m3 mono tnum">
          {{ fmtM3(capacidad.ocupadoM3) }}
          <template v-if="capacidad.capacidadM3 != null"> / {{ fmtM3(capacidad.capacidadM3) }}</template>
        </span>
      </div>
    </header>

    <div class="cap-track" role="progressbar" :aria-valuenow="anchoPct" aria-valuemin="0" aria-valuemax="100">
      <div class="cap-fill" :style="{ width: `${anchoPct}%` }" />
    </div>

    <footer class="cap-pie">
      <span>{{ fmtKg(capacidad.pesoKg) }} cargados</span>

      <!-- Sin medida en el maestro el % va corto: decirlo evita que el operario
           confie en una barra que miente por debajo. -->
      <span v-if="capacidad.lineasSinMedida > 0" class="aviso">
        {{ capacidad.lineasSinMedida }} PLU sin medidas en el maestro: el porcentaje va corto
      </span>
      <span v-else-if="capacidad.capacidadM3 == null" class="aviso">
        Falta medir la capacidad del equipo para calcular el porcentaje
      </span>
      <span v-else-if="capacidad.tono === 'critico'" class="aviso">Equipo lleno: pasa la orden a inspección</span>
    </footer>
  </section>
</template>

<style scoped>
.cap {
  padding: 14px 16px; border-radius: var(--r-md);
  border: 1px solid color-mix(in srgb, var(--c) 30%, var(--border));
  background: color-mix(in srgb, var(--c) 6%, var(--surface));
  margin-bottom: 18px;
}
.cap-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.cap-label { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.cap-codigo { display: flex; align-items: baseline; gap: 8px; font-size: 17px; font-weight: 800; color: var(--ink); }
.cap-codigo.sin { color: var(--u-aviso); font-size: 15px; }
.cap-tipo { font-size: 12px; font-weight: 600; color: var(--muted); }
.cap-cifras { display: flex; align-items: baseline; gap: 12px; }
.cap-pct { font-size: 24px; font-weight: 800; color: var(--c); letter-spacing: -.02em; }
.cap-m3 { font-size: 12.5px; font-weight: 600; color: var(--muted); }

.cap-track { margin-top: 11px; height: 8px; border-radius: var(--r-pill); background: var(--surface-3); overflow: hidden; }
.cap-fill {
  height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--c) 55%, white), var(--c));
  transition: width .6s cubic-bezier(.22,1,.36,1);
}

.cap-pie { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; font-size: 11.5px; color: var(--muted); flex-wrap: wrap; }
.aviso { font-weight: 600; color: var(--u-aviso); }

@media (max-width: 620px) {
  .cap-head { align-items: flex-start; }
  .cap-pct { font-size: 20px; }
}
</style>

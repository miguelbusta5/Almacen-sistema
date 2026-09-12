<script setup lang="ts">
// Ordenes esperando inspeccion, en vinetas.
//
// Cada vineta dice quien la tiene asignada. Con un solo login compartido entre
// ~5 inspectores, ese chip es lo UNICO que evita que dos personas trabajen la
// misma orden a la vez.
import { ESTADO_ORDEN_LABEL, cronometro, type Orden } from '~/utils/muebles'

defineProps<{ ordenes: Orden[]; ahora: number }>()
defineEmits<{ (e: 'abrir', orden: Orden): void }>()
</script>

<template>
  <ul class="grid">
    <li v-for="o in ordenes" :key="o.id">
      <button class="vineta" :class="{ tomada: !!o.inspector }" @click="$emit('abrir', o)">
        <header class="v-head">
          <span class="v-tipo">{{ o.tipoOrden }}</span>
          <span class="v-reloj mono tnum">{{ cronometro(o.horaPasoInspeccion, ahora) }}</span>
        </header>

        <strong class="v-codigo">{{ o.codigo }}</strong>

        <p class="v-meta">
          {{ o.resumen.total }} PLU · {{ o.resumen.inspeccionadas }} listos
          <template v-if="o.resumen.enEbanisteria">
            · <span class="v-eban">{{ o.resumen.enEbanisteria }} en ebanistería</span>
          </template>
        </p>

        <div class="v-track"><div class="v-fill" :style="{ width: `${o.resumen.progreso}%` }" /></div>

        <footer class="v-pie">
          <span v-if="o.inspector" class="v-chip">{{ o.inspector.nombre }}</span>
          <span v-else class="v-chip libre">Sin asignar</span>
          <span class="v-estado">{{ ESTADO_ORDEN_LABEL[o.estado] }}</span>
        </footer>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.vineta {
  width: 100%; display: flex; flex-direction: column; gap: 7px; padding: 14px 15px; text-align: left;
  border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface);
  cursor: pointer; transition: border-color .14s, transform .14s, box-shadow .14s;
}
.vineta:hover { border-color: var(--brand); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.06); }
.vineta:focus-visible { outline: none; box-shadow: var(--ring); }
.vineta.tomada { background: color-mix(in srgb, var(--brand) 4%, var(--surface)); }

.v-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.v-tipo { padding: 2px 8px; border-radius: var(--r-pill); font-size: 10px; font-weight: 800; letter-spacing: .06em; color: var(--brand); background: var(--brand-tint); }
.v-reloj { font-size: 12px; font-weight: 700; color: var(--muted); }
.v-codigo { font-size: 17px; font-weight: 800; color: var(--ink); }
.v-meta { margin: 0; font-size: 11.5px; color: var(--muted); }
.v-eban { font-weight: 700; color: var(--u-aviso); }

.v-track { height: 5px; border-radius: var(--r-pill); background: var(--surface-3); overflow: hidden; }
.v-fill { height: 100%; border-radius: inherit; background: var(--brand); transition: width .5s cubic-bezier(.22,1,.36,1); }

.v-pie { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.v-chip { padding: 3px 9px; border-radius: var(--r-pill); font-size: 11px; font-weight: 700; color: var(--brand); background: var(--brand-tint); }
.v-chip.libre { color: var(--muted); background: var(--surface-3); }
.v-estado { font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
</style>

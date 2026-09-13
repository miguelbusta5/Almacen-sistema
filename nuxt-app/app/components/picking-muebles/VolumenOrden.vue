<script setup lang="ts">
// Lo que lleva la orden: equipo, quien la trabaja y los m3 / kg acumulados.
//
// Sin barra de progreso ni porcentaje: el area decidio no medir la capacidad del
// Order Picker ni del Genie. Una barra sin maximo real seria decorativa, y un
// porcentaje inventado peor que nada cuando el operario decide si le cabe algo
// mas. Queda la cifra, que es lo que pidieron.
import { TIPO_EQUIPO_LABEL, fmtKg, fmtM3, type Equipo, type Participante, type VolumenOrden } from '~/utils/muebles'

defineProps<{
  equipo: Equipo | null
  volumen: VolumenOrden
  participantes?: Participante[]
}>()
</script>

<template>
  <section class="vol">
    <div class="vol-equipo">
      <span class="vol-label">Equipo de hoy</span>
      <strong v-if="equipo" class="vol-codigo">
        {{ equipo.codigo }}
        <span class="vol-tipo">{{ TIPO_EQUIPO_LABEL[equipo.tipo] }}</span>
      </strong>
      <strong v-else class="vol-codigo sin">Sin equipo asignado</strong>

      <!-- Con dos operarios, saber quien mas esta en la orden evita que uno
           piense que la app se equivoco al mostrarle PLUs que el no bajo. -->
      <p v-if="participantes && participantes.length > 1" class="vol-equipo-gente">
        Orden compartida:
        <span v-for="(p, i) in participantes" :key="p.id">
          <template v-if="i > 0"> · </template>{{ p.nombre }}<template v-if="p.equipo"> ({{ p.equipo }})</template>
        </span>
      </p>
    </div>

    <div class="vol-cifras">
      <div class="vol-dato">
        <span class="vol-num mono tnum">{{ fmtM3(volumen.m3) }}</span>
        <span class="vol-pie">volumen de la orden</span>
      </div>
      <div class="vol-dato">
        <span class="vol-num mono tnum secundario">{{ fmtKg(volumen.kg) }}</span>
        <span class="vol-pie">peso</span>
      </div>
    </div>

    <!-- Decirlo es la unica forma de que el supervisor sepa que la cifra va
         corta; callarlo la haria parecer exacta. -->
    <p v-if="volumen.lineasSinMedida > 0" class="vol-aviso">
      {{ volumen.lineasSinMedida }} PLU sin medidas en el maestro: el volumen va corto
    </p>
  </section>
</template>

<style scoped>
.vol {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  padding: 14px 16px; margin-bottom: 18px;
  border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface);
}
.vol-label { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.vol-codigo { display: flex; align-items: baseline; gap: 8px; font-size: 17px; font-weight: 800; color: var(--ink); }
.vol-codigo.sin { color: var(--u-aviso); font-size: 15px; }
.vol-tipo { font-size: 12px; font-weight: 600; color: var(--muted); }
.vol-equipo-gente { margin: 5px 0 0; font-size: 11.5px; color: var(--muted); }

.vol-cifras { display: flex; gap: 22px; }
.vol-dato { display: flex; flex-direction: column; align-items: flex-end; }
.vol-num { font-size: 22px; font-weight: 800; color: var(--brand); letter-spacing: -.02em; }
.vol-num.secundario { font-size: 17px; color: var(--ink-2); }
.vol-pie { font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }

.vol-aviso { flex: 1 1 100%; margin: 4px 0 0; font-size: 11.5px; font-weight: 600; color: var(--u-aviso); }

@media (max-width: 620px) {
  .vol-cifras { gap: 16px; }
  .vol-num { font-size: 19px; }
}
</style>

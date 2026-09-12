<script setup lang="ts">
// PLUs de la orden. El de arriba puede estar corriendo: su cronometro usa el
// `ahora` que ticka el padre, un solo intervalo para toda la pantalla en vez de
// uno por fila (mismo criterio que la tabla de Exportaciones).
import {
  ESTADO_LINEA_LABEL, ESTADO_LINEA_TONE, cronometro, fmtM3, fmtMin, type Linea,
} from '~/utils/muebles'

defineProps<{ lineas: Linea[]; ahora: number }>()
</script>

<template>
  <div class="tabla-wrap">
    <table class="tabla">
      <colgroup>
        <col style="width: 22%"><col style="width: 12%"><col style="width: 16%">
        <col style="width: 10%"><col style="width: 14%"><col style="width: 13%"><col style="width: 13%">
      </colgroup>
      <thead>
        <tr>
          <th>PLU</th><th>Estado</th><th>Ubicación</th>
          <th class="num">Unid.</th><th>Rótulo</th><th class="num">Volumen</th><th class="num">Tiempo</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="l in lineas" :key="l.id" :style="{ '--row-color': ESTADO_LINEA_TONE[l.estado] }">
          <td>
            <strong class="plu">{{ l.plu }}</strong>
            <span v-if="l.descripcion" class="desc">{{ l.descripcion }}</span>
          </td>
          <td><span class="chip">{{ ESTADO_LINEA_LABEL[l.estado] }}</span></td>
          <td class="mono">{{ l.ubicacion || '—' }}</td>
          <td class="num tnum">{{ l.unidades || '—' }}</td>
          <td class="mono">{{ l.numeroCaja || '—' }}</td>
          <td class="num tnum">{{ fmtM3(l.volumenTotalM3) }}</td>
          <td class="num tnum">
            <!-- Corriendo: cronometro vivo. Cerrado: la duracion que calculo el
                 servidor, que es la que vale. -->
            <span v-if="l.estado === 'EN_PICKING'" class="vivo">{{ cronometro(l.horaInicio, ahora) }}</span>
            <span v-else>{{ fmtMin(l.duracionPickingMin) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.tabla-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.tabla { width: 100%; min-width: 720px; border-collapse: collapse; table-layout: fixed; font-size: 13px; }
.tabla th {
  padding: 10px 12px; text-align: left; font-size: 10.5px; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
  border-bottom: 1px solid var(--border); white-space: nowrap;
}
.tabla td { padding: 11px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
.tabla tbody tr:last-child td { border-bottom: none; }
.tabla tbody tr { box-shadow: inset 3px 0 0 var(--row-color); }
.num { text-align: right; }
.plu { display: block; font-weight: 700; color: var(--ink); }
.desc { display: block; margin-top: 2px; font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.chip {
  display: inline-block; padding: 3px 9px; border-radius: var(--r-pill);
  font-size: 11px; font-weight: 700; color: var(--row-color);
  background: color-mix(in srgb, var(--row-color) 13%, transparent);
  white-space: nowrap;
}
.vivo { font-weight: 700; color: var(--brand); }
</style>

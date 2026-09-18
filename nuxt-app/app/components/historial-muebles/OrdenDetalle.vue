<script setup lang="ts">
// Detalle de una orden en el historial: la cabecera con los relojes de la orden
// y, debajo, cada PLU con quién lo hizo y cuánto tardó en cada etapa.
import { computed, onMounted, ref } from 'vue'
import { X, Loader2, Pencil, MapPin, TriangleAlert, Hammer } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { ESTADO_LINEA_LABEL, ESTADO_ORDEN_LABEL, fmtKg, fmtM3, fmtMin, mensajeError, type Linea, type Orden } from '~/utils/muebles'

const props = defineProps<{ ordenId: string; puedeCorregir: boolean }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'actualizada', orden: Orden): void
}>()

interface Correccion { fecha: string; detalle: string | null; por: string }

const { show } = useToast()
const orden = ref<Orden | null>(null)
const correcciones = ref<Correccion[]>([])
const cargando = ref(true)
const corrigiendo = ref<Linea | null>(null)

onMounted(cargar)

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{ data: Orden; correcciones: Correccion[] }>(`/api/historial-muebles/${props.ordenId}`)
    orden.value = res.data
    correcciones.value = res.correcciones
  } catch (e) {
    show(mensajeError(e, 'No se pudo abrir la orden'), true)
    emit('cerrar')
  } finally {
    cargando.value = false
  }
}

function hora(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso))
}

const relojes = computed(() => {
  const o = orden.value
  if (!o) return []
  return [
    { label: 'Picking', valor: fmtMin(o.duracionPickingMin), desde: o.horaInicio, hasta: o.horaPasoInspeccion },
    { label: 'Inspección', valor: fmtMin(o.duracionInspeccionMin), desde: o.horaPasoInspeccion, hasta: o.horaFinInspeccion },
    { label: 'Lead time', valor: fmtMin(o.leadTimeMin), desde: o.horaInicio, hasta: o.entregadaTransporteAt },
  ]
})

async function corregido() {
  corrigiendo.value = null
  await cargar()
  if (orden.value) emit('actualizada', orden.value)
}
</script>

<template>
  <div class="overlay" @click.self="emit('cerrar')">
    <section class="panel" role="dialog" aria-modal="true" :aria-label="orden ? `Orden ${orden.codigo}` : 'Orden'">
      <header class="p-head">
        <div v-if="orden">
          <span class="p-tipo">{{ orden.tipoOrden }}</span>
          <h2 class="p-codigo">{{ orden.codigo }}</h2>
          <p class="p-meta">
            {{ ESTADO_ORDEN_LABEL[orden.estado] }}
            <span v-if="orden.ciudadEnvio"> · <MapPin :size="12" /> {{ orden.ciudadEnvio }}</span>
            <span v-if="orden.cliente"> · {{ orden.cliente }}</span>
            · {{ orden.resumen.total }} PLU
            · {{ fmtKg(orden.volumen.kg) }} · {{ fmtM3(orden.volumen.m3) }}
            <span v-if="orden.volumen.lineasSinMedida" class="p-sinmed">
              ({{ orden.volumen.lineasSinMedida }} sin medida)
            </span>
          </p>
        </div>
        <button class="icono" aria-label="Cerrar" @click="emit('cerrar')"><X :size="18" /></button>
      </header>

      <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

      <template v-else-if="orden">
        <div class="relojes">
          <div v-for="r in relojes" :key="r.label" class="reloj">
            <span class="r-valor mono tnum">{{ r.valor }}</span>
            <span class="r-label">{{ r.label }}</span>
            <span class="r-rango">{{ hora(r.desde) }} → {{ hora(r.hasta) }}</span>
          </div>
        </div>

        <p class="gente">
          <span>Pickeó: <strong>{{ orden.participantes.map((p) => p.nombre).join(', ') || orden.operario?.nombre || '—' }}</strong></span>
          <span>Inspeccionó: <strong>{{ orden.inspectores.map((i) => i.nombre).join(', ') || orden.inspector?.nombre || '—' }}</strong></span>
          <span v-if="orden.entregadaPor">Entregó: <strong>{{ orden.entregadaPor.nombre }}</strong></span>
        </p>

        <div class="tabla-wrap">
          <table class="tabla">
            <thead>
              <tr>
                <th>PLU</th>
                <th>Ubicación / rótulo</th>
                <th class="num">Und</th>
                <th class="num">Peso / m³</th>
                <th>Picking</th>
                <th>Inspección</th>
                <th>Estado</th>
                <th v-if="puedeCorregir" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in orden.lineas" :key="l.id">
                <td>
                  <strong class="plu">{{ l.plu }}</strong>
                  <span class="desc">{{ l.descripcion || 'Sin descripción en el maestro' }}</span>
                </td>
                <td>
                  <span class="mono">{{ l.ubicacion || '—' }}</span>
                  <span class="desc mono">{{ l.numeroCaja || '—' }}</span>
                </td>
                <td class="num">{{ l.unidades }}</td>
                <td class="num">
                  <strong class="tnum">{{ fmtKg(l.pesoTotalKg) }}</strong>
                  <span class="desc tnum">{{ fmtM3(l.volumenTotalM3) }}</span>
                </td>
                <td>
                  <strong class="tnum">{{ fmtMin(l.duracionPickingMin) }}</strong>
                  <span class="desc">{{ l.operario?.nombre ?? '—' }} · {{ hora(l.horaInicio) }}</span>
                </td>
                <td>
                  <strong class="tnum">{{ fmtMin(l.duracionInspeccionMin) }}</strong>
                  <span class="desc">{{ l.inspector?.nombre ?? '—' }}<template v-if="l.inspHoraInicio"> · {{ hora(l.inspHoraInicio) }}</template></span>
                  <span v-if="l.duracionEbanisteriaMin != null" class="marca"><Hammer :size="11" /> Ebanistería {{ fmtMin(l.duracionEbanisteriaMin) }}</span>
                  <span v-if="l.averiado" class="marca error"><TriangleAlert :size="11" /> Averiado{{ l.motivoAveria ? `: ${l.motivoAveria}` : '' }}</span>
                </td>
                <td><span class="estado">{{ ESTADO_LINEA_LABEL[l.estado] }}</span></td>
                <td v-if="puedeCorregir">
                  <button class="btn btn-sm" @click="corrigiendo = l"><Pencil :size="13" /> Corregir</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <section v-if="correcciones.length" class="correcciones">
          <h3 class="c-titulo">Correcciones hechas a mano</h3>
          <ul>
            <li v-for="(c, i) in correcciones" :key="i">
              <span class="c-fecha">{{ hora(c.fecha) }} · {{ c.por }}</span>
              <span class="c-detalle">{{ c.detalle }}</span>
            </li>
          </ul>
        </section>
      </template>
    </section>

    <HistorialMueblesCorregirModal
      v-if="corrigiendo && orden" :orden-id="orden.id" :linea="corrigiendo"
      @cerrar="corrigiendo = null" @corregido="corregido"
    />
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 50; display: flex; justify-content: flex-end; background: rgba(10,14,20,.45); }
.panel { width: min(1100px, 100%); height: 100%; overflow-y: auto; padding: 20px 22px 32px; background: var(--bg, var(--surface)); border-left: 1px solid var(--border); box-shadow: -18px 0 50px rgba(0,0,0,.18); }
.p-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.p-tipo { display: inline-block; padding: 2px 9px; border-radius: var(--r-pill); font-size: 10.5px; font-weight: 800; letter-spacing: .06em; color: var(--brand); background: var(--brand-tint); }
.p-codigo { margin: 6px 0 2px; font-size: 22px; font-weight: 800; color: var(--ink); }
.p-meta { margin: 0; font-size: 12.5px; color: var(--muted); }
.icono { display: grid; place-items: center; width: 34px; height: 34px; border: none; border-radius: var(--r-sm); background: transparent; color: var(--muted); cursor: pointer; }
.icono:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); color: var(--ink); }

.relojes { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 12px; }
.reloj { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.r-valor { font-size: 20px; font-weight: 800; color: var(--ink); }
.r-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.r-rango { font-size: 11px; color: var(--muted); }

.gente { display: flex; gap: 16px; flex-wrap: wrap; margin: 0 0 14px; font-size: 12.5px; color: var(--muted); }
.gente strong { color: var(--ink-2); }

.tabla-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.tabla { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tabla th { padding: 9px 12px; text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
.tabla td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--ink-2); vertical-align: top; }
.tabla tr:last-child td { border-bottom: none; }
.num { text-align: right !important; font-variant-numeric: tabular-nums; }
.plu { display: block; color: var(--ink); font-weight: 800; }
.desc { display: block; margin-top: 2px; font-size: 11.5px; color: var(--muted); }
.marca { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 11px; font-weight: 700; color: var(--u-aviso); }
.marca.error { color: var(--error); }
.estado { font-size: 11.5px; font-weight: 700; white-space: nowrap; }

.correcciones { margin-top: 18px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.c-titulo { margin: 0 0 8px; font-size: 13px; font-weight: 800; color: var(--ink); }
.correcciones ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.c-fecha { display: block; font-size: 11px; font-weight: 700; color: var(--muted); }
.c-detalle { display: block; font-size: 12px; color: var(--ink-2); }

.cargando { display: flex; align-items: center; gap: 9px; padding: 26px; justify-content: center; color: var(--muted); font-size: 13px; }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
.p-sinmed { color: var(--u-aviso); font-weight: 700; }
</style>

<script setup lang="ts">
// Indicadores de recepción: tiempos, unidades, referencias nuevas y novedades
// por tipo. Solo supervisión — son los números con los que se evalúa al equipo
// y al proveedor.
import { ref, computed, onMounted } from 'vue'
import { RefreshCw } from '@lucide/vue'
import {
  fmtTiempoRecepcion, TIPO_NOVEDAD_RECEPCION_LABEL, TIPOS_NOVEDAD_RECEPCION,
  API_RECEPCION,
} from '~/utils/recepcion'
import { hoyBogota, sumarDias } from '~/utils/exportaciones'
import { useToast } from '~/composables/useToast'

const { show: showToast } = useToast()

interface Resumen {
  recepciones: number; cerradas: number; enCurso: number
  unidades: number; cajas: number; estibas: number
  referenciasNuevas: number; unidadesNuevas: number
  segundos: number; promedioSeg: number | null; unidadesPorHora: number | null
}
interface FilaOperario {
  id: string; nombre: string; recepciones: number; unidades: number
  segundos: number; promedioSeg: number | null
}
interface FilaDescargador { id: string; nombre: string; recepciones: number; unidades: number }
interface FilaProveedor { nombre: string; recepciones: number; unidades: number; novedades: number }
type Novedades = Record<string, { lineas: number; unidades: number }>

const desde = ref(sumarDias(hoyBogota(), -6))
const hasta = ref(hoyBogota())
const cargando = ref(true)
const resumen = ref<Resumen | null>(null)
const novedades = ref<Novedades>({})
const operarios = ref<FilaOperario[]>([])
const descargadores = ref<FilaDescargador[]>([])
const proveedores = ref<FilaProveedor[]>([])

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{
      data: {
        resumen: Resumen; novedades: Novedades
        operarios: FilaOperario[]; descargadores: FilaDescargador[]; proveedores: FilaProveedor[]
      }
    }>(`${API_RECEPCION}/indicadores`, { query: { desde: desde.value, hasta: hasta.value } })
    resumen.value = res.data.resumen
    novedades.value = res.data.novedades
    operarios.value = res.data.operarios
    descargadores.value = res.data.descargadores
    proveedores.value = res.data.proveedores
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar los indicadores'), true)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

const vacio = computed(() => !cargando.value && (resumen.value?.recepciones ?? 0) === 0)

const kpis = computed(() => {
  const r = resumen.value
  if (!r) return []
  return [
    { label: 'Contenedores', valor: String(r.recepciones), hint: `${r.cerradas} cerrados` },
    { label: 'Unidades', valor: String(r.unidades), hint: `${r.cajas} cajas · ${r.estibas} estibas` },
    { label: 'Prom. por contenedor', valor: fmtTiempoRecepcion(r.promedioSeg), hint: 'de descarga' },
    {
      label: 'Referencias nuevas', valor: String(r.referenciasNuevas),
      hint: `${r.unidadesNuevas} unidades`,
    },
  ]
})

// Ritmo de descarga: la cifra con la que se compara un contenedor con otro,
// porque unidades sueltas o minutos sueltos no dicen si se fue rápido.
const ritmo = computed(() => resumen.value?.unidadesPorHora ?? null)
</script>

<template>
  <div class="ind">
    <div class="rango card">
      <label class="f">
        <span class="lbl">Desde</span>
        <input v-model="desde" class="field" type="date">
      </label>
      <label class="f">
        <span class="lbl">Hasta</span>
        <input v-model="hasta" class="field" type="date">
      </label>
      <button class="btn btn-sm" :disabled="cargando" @click="cargar">
        <Spinner v-if="cargando" :size="14" /><RefreshCw v-else :size="14" />
        Aplicar
      </button>
    </div>

    <ListSkeleton v-if="cargando" />

    <EmptyState
      v-else-if="vacio" title="Sin recepciones en el periodo"
      description="Ajusta el rango de fechas para ver la productividad."
    />

    <template v-else>
      <div class="rail">
        <div v-for="k in kpis" :key="k.label" class="kpi card">
          <span class="kpi-hint">{{ k.hint }}</span>
          <span class="kpi-valor tnum">{{ k.valor }}</span>
          <span class="kpi-label">{{ k.label }}</span>
        </div>
      </div>

      <p v-if="ritmo" class="ritmo card">
        Ritmo de descarga: <b class="tnum">{{ ritmo }}</b> unidades por hora
      </p>

      <section class="card tabla-card">
        <h3 class="titulo">Novedades reportadas</h3>
        <p class="sub">Líneas levantadas y unidades afectadas, por tipo.</p>
        <table class="table">
          <thead>
            <tr><th>Tipo</th><th class="num">Reportes</th><th class="num">Unidades</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in TIPOS_NOVEDAD_RECEPCION" :key="t">
              <td class="nom">{{ TIPO_NOVEDAD_RECEPCION_LABEL[t] }}</td>
              <td class="tnum">{{ novedades[t]?.lineas ?? 0 }}</td>
              <td class="tnum">{{ novedades[t]?.unidades ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card tabla-card">
        <h3 class="titulo">Operarios</h3>
        <p class="sub">Quien llevó la planilla, con su tiempo de descarga.</p>
        <table class="table">
          <thead>
            <tr>
              <th>Operario</th><th class="num">Contenedores</th><th class="num">Unidades</th>
              <th class="num">Tiempo</th><th class="num">Prom.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in operarios" :key="o.id">
              <td class="nom">{{ o.nombre }}</td>
              <td class="tnum">{{ o.recepciones }}</td>
              <td class="tnum strong">{{ o.unidades }}</td>
              <td class="tnum">{{ fmtTiempoRecepcion(o.segundos) }}</td>
              <td class="tnum">{{ fmtTiempoRecepcion(o.promedioSeg) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card tabla-card">
        <h3 class="titulo">Personas descargando</h3>
        <p class="sub">En cuántos contenedores participó cada uno.</p>
        <table v-if="descargadores.length" class="table">
          <thead>
            <tr><th>Persona</th><th class="num">Contenedores</th><th class="num">Unidades</th></tr>
          </thead>
          <tbody>
            <tr v-for="d in descargadores" :key="d.id">
              <td class="nom">{{ d.nombre }}</td>
              <td class="tnum">{{ d.recepciones }}</td>
              <td class="tnum">{{ d.unidades }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="vacio">Nadie registrado como descargador en este periodo.</p>
      </section>

      <section class="card tabla-card">
        <h3 class="titulo">Proveedores</h3>
        <p class="sub">Con cuántas novedades llega cada uno: es lo que sirve para reclamar.</p>
        <table class="table">
          <thead>
            <tr>
              <th>Proveedor</th><th class="num">Contenedores</th>
              <th class="num">Unidades</th><th class="num">Novedades</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in proveedores" :key="p.nombre">
              <td class="nom">{{ p.nombre }}</td>
              <td class="tnum">{{ p.recepciones }}</td>
              <td class="tnum">{{ p.unidades }}</td>
              <td class="tnum" :class="{ alerta: p.novedades > 0 }">{{ p.novedades }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ind { display: flex; flex-direction: column; gap: 16px; }

.rango { display: flex; align-items: flex-end; gap: 10px; padding: 13px 15px; flex-wrap: wrap; }
.f { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }

.rail { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kpi { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; }
.kpi-hint { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--faint); }
.kpi-valor { font-family: var(--display); font-size: 26px; font-weight: 800; letter-spacing: -.03em; color: var(--brand); line-height: 1.1; }
.kpi-label { font-size: 12px; font-weight: 600; color: var(--muted); }

.ritmo { padding: 12px 16px; margin: 0; font-size: 13px; color: var(--ink-2); }
.ritmo b { font-family: var(--display); font-size: 17px; color: var(--brand); }

.tabla-card { padding: 15px 0 0; overflow-x: auto; overflow-y: hidden; }
.titulo { margin: 0 16px 2px; font-size: 14px; font-weight: 700; color: var(--ink); }
.sub { margin: 0 16px 12px; font-size: 12px; color: var(--muted); }
.vacio { margin: 0 16px 16px; font-size: 12.5px; color: var(--faint); }

.table { width: 100%; min-width: 560px; border-collapse: separate; border-spacing: 0; }
.table th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--muted); padding: 10px 14px; white-space: nowrap;
  background: var(--surface-2);
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border-strong);
}
.table th.num { text-align: right; }
.table td {
  padding: 10px 14px; font-size: 13px; color: var(--ink-2); white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
.table td.tnum { text-align: right; }
.table tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--surface-2) 55%, transparent); }
.table tbody tr:hover td { background: var(--brand-tint); }
.table tbody tr:last-child td { border-bottom: none; }
.nom { font-weight: 600; color: var(--ink); }
.strong { font-weight: 600; color: var(--ink); }
.alerta { color: var(--u-aviso); font-weight: 700; }

@media (max-width: 900px) { .rail { grid-template-columns: repeat(2, 1fr); } }
</style>

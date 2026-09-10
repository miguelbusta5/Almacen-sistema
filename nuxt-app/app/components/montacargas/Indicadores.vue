<script setup lang="ts">
// Pestaña de indicadores. Productividad del periodo, separada por rol: el
// montacarguista responde por el tiempo hasta que pasó el PLU y el ayudante por
// el suyo desde ahí. Los tiempos NO incluyen las ventanas de novedad —
// verificar no se cronometra.
import { ref, computed, onMounted, watch } from 'vue'
import { RefreshCw } from '@lucide/vue'
import { API_MONTACARGAS, fmtTiempo, type TipoMovimiento } from '~/utils/montacargas'
// hoyBogota/sumarDias son genericas y ya viven en utils/exportaciones; duplicarlas
// en utils/montacargas provocaria un "Duplicated imports" en el auto-import de Nuxt.
import { hoyBogota, sumarDias } from '~/utils/exportaciones'
import { useToast } from '~/composables/useToast'

const props = defineProps<{ tipo: TipoMovimiento }>()

const { show: showToast } = useToast()

interface Resumen {
  registros: number
  cerrados: number
  unidades: number
  segundos: number
  promedioSeg: number | null
  traspasados: number
  conNovedadAbierta: number
  novedadesResueltas: number
}
interface FilaMontacarguista {
  id: string; nombre: string; registros: number; unidades: number
  cajas: number; sueltas: number; segundos: number; promedioSeg: number | null
}
interface FilaAyudante {
  id: string; nombre: string; recibidos: number; segundos: number; promedioSeg: number | null
}

const desde = ref(sumarDias(hoyBogota(), -6))
const hasta = ref(hoyBogota())
const cargando = ref(true)
const resumen = ref<Resumen | null>(null)
const montacarguistas = ref<FilaMontacarguista[]>([])
const ayudantes = ref<FilaAyudante[]>([])

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{
      data: { resumen: Resumen; montacarguistas: FilaMontacarguista[]; ayudantes: FilaAyudante[] }
    }>(`${API_MONTACARGAS}/indicadores`, {
      query: { tipo: props.tipo, desde: desde.value, hasta: hasta.value },
    })
    resumen.value = res.data.resumen
    montacarguistas.value = res.data.montacarguistas
    ayudantes.value = res.data.ayudantes
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar los indicadores'), true)
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
// Cambiar de pestaña (recepción ↔ movimientos) es cambiar de flujo entero.
watch(() => props.tipo, cargar)

const vacio = computed(() => !cargando.value && (resumen.value?.registros ?? 0) === 0)

const kpis = computed(() => {
  const r = resumen.value
  if (!r) return []
  return [
    { label: 'Registros', valor: String(r.registros), hint: `${r.cerrados} cerrados` },
    { label: 'Unidades', valor: String(r.unidades), hint: 'almacenadas' },
    {
      label: 'Prom. por registro',
      valor: fmtTiempo(r.promedioSeg),
      hint: 'sin contar novedades',
    },
    {
      label: 'Pasados a ayudante',
      valor: String(r.traspasados),
      hint: `${r.conNovedadAbierta} con novedad abierta`,
    },
  ]
})
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
      v-else-if="vacio" title="Sin registros en el periodo"
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

      <section class="card tabla-card">
        <h3 class="titulo">Montacarguistas</h3>
        <p class="sub">Tiempo hasta que pasaron el PLU o lo cerraron ellos mismos.</p>
        <table class="table">
          <thead>
            <tr>
              <th>Montacarguista</th><th class="num">Registros</th><th class="num">Cajas</th>
              <th class="num">Sueltas</th><th class="num">Unidades</th>
              <th class="num">Tiempo</th><th class="num">Prom.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in montacarguistas" :key="m.id">
              <td class="nom">{{ m.nombre }}</td>
              <td class="tnum">{{ m.registros }}</td>
              <td class="tnum">{{ m.cajas }}</td>
              <td class="tnum">{{ m.sueltas }}</td>
              <td class="tnum strong">{{ m.unidades }}</td>
              <td class="tnum">{{ fmtTiempo(m.segundos) }}</td>
              <td class="tnum">{{ fmtTiempo(m.promedioSeg) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card tabla-card">
        <h3 class="titulo">Ayudantes</h3>
        <p class="sub">Tiempo desde que recibieron el PLU hasta que lo ubicaron.</p>
        <table v-if="ayudantes.length" class="table">
          <thead>
            <tr>
              <th>Ayudante</th><th class="num">PLUs recibidos</th>
              <th class="num">Tiempo</th><th class="num">Prom. por PLU</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in ayudantes" :key="a.id">
              <td class="nom">{{ a.nombre }}</td>
              <td class="tnum">{{ a.recibidos }}</td>
              <td class="tnum">{{ fmtTiempo(a.segundos) }}</td>
              <td class="tnum">{{ fmtTiempo(a.promedioSeg) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="vacio">Ningún PLU se pasó a un ayudante en este periodo.</p>
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

.tabla-card { padding: 15px 0 0; overflow-x: auto; overflow-y: hidden; }
.titulo { margin: 0 16px 2px; font-size: 14px; font-weight: 700; color: var(--ink); }
.sub { margin: 0 16px 12px; font-size: 12px; color: var(--muted); }
.vacio { margin: 0 16px 16px; font-size: 12.5px; color: var(--faint); }

.table { width: 100%; min-width: 620px; border-collapse: separate; border-spacing: 0; }
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

@media (max-width: 900px) { .rail { grid-template-columns: repeat(2, 1fr); } }
</style>

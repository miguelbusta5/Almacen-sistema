<script setup lang="ts">
// Las pestañas de proceso del área de almacenamiento. Una sola consulta trae
// todos los procesos para el periodo (y el anterior, y la meta): cambiar de
// pestaña no recarga.
import { computed, ref, watch } from 'vue'
import { Download } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { fmtDiaCorto } from '~/utils/indicadores'
import { exportarExcel, type HojaExcel } from '~/utils/exportarExcel'
import { API_PROCESOS, fmtCifra, type PestanaProceso, type RespuestaProcesos } from '~/utils/procesos'

const props = defineProps<{ pestana: PestanaProceso; desde: string; hasta: string; usuarioId: string }>()
const { show } = useToast()

const datos = ref<RespuestaProcesos | null>(null)
const cargando = ref(false)
let pedido = 0

async function cargar() {
  if (!props.desde || !props.hasta) return
  const este = ++pedido
  cargando.value = true
  try {
    const res = await $fetch<RespuestaProcesos>(API_PROCESOS, {
      query: { desde: props.desde, hasta: props.hasta, usuarioId: props.usuarioId || undefined },
    })
    if (este === pedido) datos.value = res
  } catch (e) {
    if (este === pedido) show(apiErr(e, 'No se pudieron cargar los procesos'), true)
  } finally {
    if (este === pedido) cargando.value = false
  }
}
watch(() => [props.desde, props.hasta, props.usuarioId], cargar, { immediate: true })
defineExpose({ cargar })

const TITULO: Record<PestanaProceso, string> = {
  recepcion: 'Recepción de contenedores',
  movimientos: 'Movimientos',
  pendientes: 'Pendientes',
  resurtido: 'Resurtido',
  generales: 'Tareas generales',
}

const rango = (r: { desde: string; hasta: string }) => (r.desde === r.hasta ? fmtDiaCorto(r.desde) : `${fmtDiaCorto(r.desde)} – ${fmtDiaCorto(r.hasta)}`)

// Cada componente de proceso expone sus tablas para el Excel.
const vista = ref<{ hojas: () => HojaExcel[] } | null>(null)
const vistaNormal = ref<{ hojas: () => HojaExcel[] } | null>(null)
const vistaCapacidad = ref<{ hojas: () => HojaExcel[] } | null>(null)
const exportando = ref(false)
async function exportar() {
  if (!datos.value || exportando.value) return
  exportando.value = true
  try {
    const hojas = props.pestana === 'resurtido'
      ? [...(vistaNormal.value?.hojas() ?? []), ...(vistaCapacidad.value?.hojas() ?? [])]
      : [...(vista.value?.hojas() ?? [])]
    if (props.pestana === 'pendientes') {
      hojas.push({
        nombre: 'PLU más solicitados',
        columnas: [
          { key: 'plu', label: 'PLU' }, { key: 'descripcion', label: 'Descripción' },
          { key: 'veces', label: 'Veces solicitado', num: true }, { key: 'unidades', label: 'Unidades solicitadas', num: true },
        ],
        filas: datos.value.pendientes.solicitados.map((s) => ({ ...s })),
      })
    }
    await exportarExcel(`indicadores-${props.pestana}-${props.desde}_${props.hasta}`, hojas)
  } catch (e) {
    show(apiErr(e, 'No se pudo exportar'), true)
  } finally {
    exportando.value = false
  }
}

// Resurtido: normal y por capacidad lado a lado.
const comparaResurtido = computed(() => {
  const r = datos.value?.resurtido
  if (!r) return []
  return [
    { k: 'Normal', p: r.normal },
    { k: 'Por capacidad', p: r.capacidad },
    { k: 'Total', p: r.total },
  ].map(({ k, p }) => ({
    k,
    plus: fmtCifra(p.actual.personaDia.plus),
    und: fmtCifra(p.actual.personaDia.unidades),
    total: p.actual.total.plus,
    dias: p.actual.dias,
  }))
})
</script>

<template>
  <div class="procesos" :class="{ recargando: cargando && datos }">
    <header class="pr-head">
      <div>
        <h2 class="pr-titulo">{{ TITULO[pestana] }}</h2>
        <p v-if="datos" class="pr-sub">
          {{ rango(datos.rango) }} · se compara con {{ rango(datos.anterior) }}
          <template v-if="pestana !== 'recepcion' && pestana !== 'generales'">
            · meta = día típico del {{ rango(datos.metaVentana) }}
          </template>
        </p>
      </div>
      <button class="btn btn-sm" :disabled="!datos || exportando" @click="exportar">
        <Spinner v-if="exportando" :size="13" /><Download v-else :size="13" /> Exportar a Excel
      </button>
    </header>

    <ListSkeleton v-if="!datos" />

    <template v-else>
      <IndicadoresProcesoRecepcion v-if="pestana === 'recepcion'" ref="vista" :recepcion="datos.recepcion" />

      <IndicadoresProcesoPlu
        v-else-if="pestana === 'movimientos'" ref="vista" :proceso="datos.movimientos"
        titulo="Movimientos" que="movimientos"
      />

      <IndicadoresProcesoPlu
        v-else-if="pestana === 'pendientes'" ref="vista" :proceso="datos.pendientes"
        titulo="Pendientes" que="pendientes" :con-top="false"
      >
        <template #extra>
          <IndicadoresTarjeta titulo="PLU más solicitados" subtitulo="Pedidos como pendiente en el periodo, se hayan ubicado o no.">
            <div class="pr-tabla">
              <IndicadoresTabla
                :columnas="[
                  { key: 'plu', label: 'PLU' }, { key: 'descripcion', label: 'Descripción' },
                  { key: 'veces', label: 'Veces', num: true }, { key: 'unidades', label: 'Unidades', num: true },
                ]"
                :filas="datos.pendientes.solicitados.slice(0, 10).map((s) => ({ ...s }))" principal="plu"
              />
            </div>
            <template #tabla>
              <IndicadoresTabla
                :columnas="[
                  { key: 'plu', label: 'PLU' }, { key: 'descripcion', label: 'Descripción' },
                  { key: 'veces', label: 'Veces', num: true }, { key: 'unidades', label: 'Unidades', num: true },
                ]"
                :filas="datos.pendientes.solicitados.map((s) => ({ ...s }))" principal="plu"
              />
            </template>
          </IndicadoresTarjeta>
        </template>
      </IndicadoresProcesoPlu>

      <template v-else-if="pestana === 'resurtido'">
        <div class="pr-compara card">
          <div v-for="c in comparaResurtido" :key="c.k" class="pr-c">
            <span class="pr-c-k">{{ c.k }}</span>
            <span class="pr-c-v tnum">{{ c.plus }} <small>PLU</small> · {{ c.und }} <small>und</small></span>
            <span class="pr-c-h">por persona al día · {{ c.total }} PLU en {{ c.dias }} {{ c.dias === 1 ? 'día' : 'días' }}</span>
          </div>
        </div>
        <h3 class="pr-sec">Resurtido normal</h3>
        <IndicadoresProcesoPlu ref="vistaNormal" :proceso="datos.resurtido.normal" titulo="Resurtido" que="tareas" />
        <h3 class="pr-sec">Resurtido por capacidad</h3>
        <IndicadoresProcesoPlu ref="vistaCapacidad" :proceso="datos.resurtido.capacidad" titulo="Capacidad" que="tareas" />
      </template>

      <IndicadoresProcesoGenerales v-else-if="pestana === 'generales'" ref="vista" :generales="datos.generales" />
    </template>
  </div>
</template>

<style scoped>
.procesos { transition: opacity .15s; }
.procesos.recargando { opacity: .6; }
.pr-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.pr-titulo { margin: 0; font-size: 17px; font-weight: 800; color: var(--ink); }
.pr-sub { margin: 3px 0 0; font-size: 12.5px; color: var(--muted); }
.pr-tabla { margin: 0 -18px -18px; border-top: 1px solid var(--border); overflow-x: auto; }
.pr-compara { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0; margin-bottom: 18px; padding: 0; overflow: hidden; }
.pr-c { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-right: 1px solid var(--border); }
.pr-c:last-child { border-right: none; background: var(--surface-2); }
.pr-c-k { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.pr-c-v { font-size: 20px; font-weight: 800; color: var(--ink); }
.pr-c-v small { font-size: 12px; font-weight: 600; color: var(--muted); }
.pr-c-h { font-size: 12px; color: var(--muted); }
.pr-sec { margin: 6px 0 12px; font-size: 14px; font-weight: 800; color: var(--ink-2); }
</style>

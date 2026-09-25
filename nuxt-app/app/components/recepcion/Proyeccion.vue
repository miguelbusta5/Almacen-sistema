<script setup lang="ts">
// Cuánto cuesta un contenedor de punta a punta (descarga + almacenamiento) y
// cuántos caben por día, por tipo de contenedor. Solo supervisión.
//
// El almacenamiento sale de Control Montacargas: los PLU recibidos con el mismo
// número de pedido, que el montacarguista escribe desde el 24-09. Antes de esa
// fecha no hay con qué unir, así que la tarjeta lo dice en vez de mostrar ceros.
import { computed, onMounted, ref, watch } from 'vue'
import { Container, TriangleAlert, RotateCcw } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import type { ColumnaTabla } from '~/utils/indicadores'
import { fmtTiempoExacto } from '~/utils/procesos'
import {
  API_ALMACENAMIENTO_RECEPCION, TIPO_CONTENEDOR_LABEL,
  type RespuestaAlmacenamiento, type TipoContenedorRecepcion,
} from '~/utils/recepcion'

const { show } = useToast()
const datos = ref<RespuestaAlmacenamiento | null>(null)
const cargando = ref(false)
const horas = ref<number | string>('')
const montacarguistas = ref<number | string>('')

async function cargar(conPlantilla = false) {
  cargando.value = true
  try {
    const query: Record<string, string | number> = {}
    if (conPlantilla && Number(horas.value) > 0) query.horas = Number(horas.value)
    if (conPlantilla && Number(montacarguistas.value) > 0) query.montacarguistas = Number(montacarguistas.value)
    datos.value = await $fetch<RespuestaAlmacenamiento>(API_ALMACENAMIENTO_RECEPCION, { query })
    horas.value = datos.value.plantilla.horas
    montacarguistas.value = datos.value.plantilla.montacarguistas
  } catch (e) {
    show(apiErr(e, 'No se pudo cargar la proyección de contenedores'), true)
  } finally {
    cargando.value = false
  }
}
onMounted(() => cargar())

let espera: ReturnType<typeof setTimeout> | null = null
watch([horas, montacarguistas], ([h, m]) => {
  const p = datos.value?.plantilla
  if (!p || (Number(h) === p.horas && Number(m) === p.montacarguistas)) return
  if (!(Number(h) >= 1 && Number(h) <= 24 && Number(m) >= 1 && Number(m) <= 30)) return
  if (espera) clearTimeout(espera)
  espera = setTimeout(() => cargar(true), 450)
})

const tipo = (t: string) => TIPO_CONTENEDOR_LABEL[t as TipoContenedorRecepcion] ?? 'Sin tipo'
const entero = (v: number | null) => (v == null ? '—' : v.toLocaleString('es-CO'))
const dec = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 2 })

const conDatos = computed(() => datos.value?.contenedores.filter((c) => c.alm.movimientos > 0) ?? [])

const colsTipo: ColumnaTabla[] = [
  { key: 'tipo', label: 'Tipo' },
  { key: 'n', label: 'Contenedores', num: true },
  { key: 'plus', label: 'PLU', num: true },
  { key: 'und', label: 'Unidades', num: true },
  { key: 'm3', label: 'm³', num: true },
  { key: 'total', label: 'Tiempo de recepción', num: true },
  { key: 'descarga', label: 'Descarga', num: true },
  { key: 'cola', label: 'Almac. tras la descarga', num: true },
  { key: 'cap', label: 'Contenedores por día', num: true },
]
const filasTipo = computed(() => (datos.value?.porTipo ?? []).map((t) => ({
  tipo: tipo(t.tipoContenedor),
  n: t.contenedores,
  plus: dec(t.plus),
  und: entero(t.unidades),
  m3: dec(t.m3),
  total: fmtTiempoExacto(t.totalSeg),
  descarga: fmtTiempoExacto(t.descargaSeg),
  cola: fmtTiempoExacto(t.colaSeg),
  cap: t.capacidad == null ? '—' : `${t.capacidad}${t.cuello ? ` (limita ${t.cuello === 'descarga' ? 'la descarga' : 'el almacenamiento'})` : ''}`,
})))

const colsCont: ColumnaTabla[] = [
  { key: 'pedido', label: 'Pedido' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'plus', label: 'PLU', num: true },
  { key: 'und', label: 'Unidades', num: true },
  { key: 'm3', label: 'm³', num: true },
  { key: 'total', label: 'Tiempo de recepción', num: true },
  { key: 'descarga', label: 'Descarga', num: true },
  { key: 'cola', label: 'Almac. tras la descarga', num: true },
  { key: 'estado', label: 'Estado' },
]
const filasCont = computed(() => conDatos.value.map((c) => ({
  pedido: c.numeroPedido,
  tipo: tipo(c.tipoContenedor ?? ''),
  plus: c.alm.plus,
  und: entero(c.alm.unidades),
  m3: dec(c.alm.m3),
  total: fmtTiempoExacto(c.alm.totalSeg),
  descarga: fmtTiempoExacto(c.alm.descargaSeg),
  cola: fmtTiempoExacto(c.alm.colaSeg),
  estado: c.alm.completo ? 'Completo' : c.alm.abiertos ? `${c.alm.abiertos} PLU sin ubicar` : 'Descarga abierta',
})))

// Todas las variantes del tiempo de cada contenedor, al segundo (25-09).
const colsVar: ColumnaTabla[] = [
  { key: 'pedido', label: 'Pedido' },
  { key: 'total', label: 'Tiempo de recepción', num: true },
  { key: 'descarga', label: 'Descarga', num: true },
  { key: 'cola', label: 'Almac. tras la descarga', num: true },
  { key: 'ventana', label: 'Ventana de almacenamiento', num: true },
  { key: 'ubicando', label: 'Ubicando', num: true },
  { key: 'entre', label: 'Entre PLU', num: true },
  { key: 'promPlu', label: 'Prom. por PLU', num: true },
  { key: 'promEntre', label: 'Prom. entre PLU', num: true },
  { key: 'mayor', label: 'Mayor espera', num: true },
  { key: 'trabajo', label: 'Trabajo', num: true },
  { key: 'ciclo', label: 'Ciclo (con pausas)', num: true },
]
const filasVar = computed(() => conDatos.value.map((c) => {
  const d = c.alm.desglose
  return {
    pedido: c.numeroPedido,
    total: fmtTiempoExacto(c.alm.totalSeg),
    descarga: fmtTiempoExacto(c.alm.descargaSeg),
    cola: fmtTiempoExacto(c.alm.colaSeg),
    ventana: fmtTiempoExacto(d?.ventanaSeg),
    ubicando: fmtTiempoExacto(d?.ubicandoSeg),
    entre: fmtTiempoExacto(d?.entrePluSeg),
    promPlu: fmtTiempoExacto(d?.promPluSeg),
    promEntre: fmtTiempoExacto(d?.promEntrePluSeg),
    mayor: fmtTiempoExacto(d?.mayorHuecoSeg),
    trabajo: fmtTiempoExacto(c.alm.trabajoSeg),
    ciclo: fmtTiempoExacto(c.alm.cicloSeg),
  }
}))

// Cada montacarguista en cada contenedor: ubicando + entre PLU = su ventana.
const colsMont: ColumnaTabla[] = [
  { key: 'pedido', label: 'Pedido' },
  { key: 'nombre', label: 'Montacarguista' },
  { key: 'plus', label: 'PLU', num: true },
  { key: 'ventana', label: 'Ventana', num: true },
  { key: 'ubicando', label: 'Ubicando', num: true },
  { key: 'entre', label: 'Entre PLU', num: true },
  { key: 'promPlu', label: 'Prom. por PLU', num: true },
  { key: 'promEntre', label: 'Prom. entre PLU', num: true },
  { key: 'mayor', label: 'Mayor espera', num: true },
]
const filasMont = computed(() => conDatos.value.flatMap((c) => (c.alm.desglose?.porMontacarguista ?? []).map((m) => ({
  pedido: c.numeroPedido,
  nombre: m.nombre ?? '—',
  plus: m.plus,
  ventana: fmtTiempoExacto(m.ventanaSeg),
  ubicando: fmtTiempoExacto(m.ubicandoSeg),
  entre: fmtTiempoExacto(m.entrePluSeg),
  promPlu: fmtTiempoExacto(m.promPluSeg),
  promEntre: fmtTiempoExacto(m.promEntrePluSeg),
  mayor: fmtTiempoExacto(m.mayorHuecoSeg),
}))))
</script>

<template>
  <IndicadoresTarjeta
    titulo="Contenedores: tiempo y proyección"
    subtitulo="Descarga + almacenamiento de cada contenedor, uniendo la planilla con los PLU del montacarguista por número de pedido (desde el 24-09)."
  >
    <div v-if="cargando && !datos" class="pj-vacio">Cargando…</div>
    <template v-else-if="datos">
      <div class="pj-plantilla">
        <label class="pj-campo">
          <span class="pj-label">Horas de turno</span>
          <input v-model="horas" class="field tnum" type="number" min="1" max="24" inputmode="numeric">
        </label>
        <label class="pj-campo">
          <span class="pj-label">Montacarguistas en recepción</span>
          <input v-model="montacarguistas" class="field tnum" type="number" min="1" max="30" inputmode="numeric">
        </label>
        <p class="pj-nota">
          <template v-if="datos.montacarguistasObservados != null">
            En el periodo recibieron {{ dec(datos.montacarguistasObservados) }} montacarguistas por día.
          </template>
          Cámbialos para simular. Del {{ datos.rango.desde }} al {{ datos.rango.hasta }}.
          <button v-if="cargando" class="btn btn-sm btn-ghost" disabled><RotateCcw :size="12" /> Calculando…</button>
        </p>
      </div>

      <div v-if="datos.porTipo.length" class="pj-tipos">
        <div v-for="t in datos.porTipo" :key="t.tipoContenedor" class="pj-tipo">
          <span class="pj-t-label"><Container :size="12" /> {{ tipo(t.tipoContenedor) }} · {{ t.contenedores }} medidos</span>
          <span class="pj-t-num tnum">{{ entero(t.capacidad) }}</span>
          <span class="pj-t-hint">contenedores por día</span>
          <span class="pj-t-det">
            Recepción {{ fmtTiempoExacto(t.totalSeg) }}
            <template v-if="t.cuello"> · limita {{ t.cuello === 'descarga' ? 'la descarga' : 'el almacenamiento' }}</template>
          </span>
        </div>
      </div>
      <p v-else class="pj-vacio">
        Todavía no hay contenedores completos (planilla cerrada y todos sus PLU ubicados) con el número de pedido
        del montacarguista. Se llena desde el 24-09.
      </p>

      <p class="pj-regla">
        <b>Tiempo de recepción</b> = de abrir la descarga a dejar el último PLU ubicado, sin pausas, al segundo.
        Es la suma exacta de la <b>descarga</b> y el <b>almacenamiento tras la descarga</b> (lo que quedaba por ubicar
        al cerrar la planilla; 0 si ya estaba todo). Los contenedores por día se calculan con el tiempo de la
        descarga (un muelle) y el de los montacarguistas, repartido entre ellos.
      </p>

      <div v-if="datos.sinContenedor.length" class="pj-aviso" role="status">
        <TriangleAlert :size="15" />
        <div>
          <b>PLU con un pedido que no coincide con ninguna recepción</b> (¿mal escrito?). Corrígelo en Control Montacargas › Editar registro:
          <ul>
            <li v-for="h in datos.sinContenedor" :key="h.numeroPedido">
              <span class="mono">{{ h.numeroPedido }}</span> · {{ h.movimientos }} PLU
            </li>
          </ul>
        </div>
      </div>

      <template v-if="filasVar.length">
        <h3 class="pj-sub">Todas las variantes del tiempo, por contenedor</h3>
        <p class="pj-regla">
          <b>Ventana de almacenamiento</b> = del primer PLU al último ubicado = <b>ubicando</b> (algún montacarguista con PLU
          en la mano) + <b>entre PLU</b> (nadie con PLU en la mano). <b>Trabajo</b> = descarga + ubicando.
          <b>Ciclo</b> = de abrir la descarga al último PLU, contando pausas.
        </p>
        <div class="pj-sub-tabla"><IndicadoresTabla :columnas="colsVar" :filas="filasVar" principal="pedido" /></div>
        <h3 class="pj-sub">Montacarguistas por contenedor</h3>
        <div class="pj-sub-tabla"><IndicadoresTabla :columnas="colsMont" :filas="filasMont" principal="nombre" /></div>
        <h3 class="pj-sub">Contenedores</h3>
      </template>

      <div v-if="filasCont.length" class="pj-tabla">
        <IndicadoresTabla :columnas="colsCont" :filas="filasCont" principal="pedido" />
      </div>
    </template>

    <template #tabla>
      <IndicadoresTabla :columnas="colsTipo" :filas="filasTipo" principal="tipo" />
    </template>
  </IndicadoresTarjeta>
</template>

<style scoped>
.pj-plantilla { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.pj-campo { display: grid; gap: 5px; width: 170px; }
.pj-label { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.pj-nota { flex: 1 1 240px; margin: 0; font-size: 12px; color: var(--muted); }
.pj-tipos { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 12px; }
.pj-tipo { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--border); }
.pj-t-label { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.pj-t-num { font-size: 30px; font-weight: 800; letter-spacing: -.03em; color: var(--brand); }
.pj-t-hint { font-size: 12px; color: var(--muted); }
.pj-t-det { margin-top: 4px; font-size: 12px; color: var(--ink-2); }
.pj-vacio { margin: 0 0 12px; padding: 14px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); font-size: 12.5px; color: var(--muted); }
.pj-regla { margin: 0 0 12px; font-size: 12px; color: var(--muted); max-width: 95ch; }
.pj-regla b { color: var(--ink-2); }
.pj-aviso { display: flex; gap: 10px; align-items: flex-start; margin: 0 0 12px; padding: 12px 14px; border-radius: var(--r-md); font-size: 12.5px; color: var(--ink-2); background: color-mix(in srgb, var(--u-aviso) 10%, var(--surface)); border: 1px solid color-mix(in srgb, var(--u-aviso) 35%, transparent); }
.pj-aviso > svg { color: var(--u-aviso); flex-shrink: 0; margin-top: 2px; }
.pj-aviso ul { margin: 6px 0 0; padding-left: 18px; }
.pj-sub { margin: 16px 0 8px; font-size: 13px; font-weight: 800; color: var(--ink); }
.pj-sub-tabla { max-height: 360px; overflow: auto; margin-bottom: 12px; border: 1px solid var(--border); border-radius: var(--r-sm); }
.pj-tabla { max-height: 420px; overflow: auto; margin: 0 -18px -18px; border-top: 1px solid var(--border); }
</style>

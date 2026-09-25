<script setup lang="ts">
// El camion con el reloj corriendo. Una orden a la vez:
//   escribir la orden → ver lo que trae (tienda, cliente, ciudad, bultos) →
//   «Iniciar cargue» (arranca su reloj) → contar bultos → «Finalizar cargue del
//   pedido» → la siguiente, o «Finalizar cargue del camión».
import { computed, ref, watch, nextTick } from 'vue'
import { Timer, Users, Search, Play, CheckCircle2, X, Pencil, Truck, TriangleAlert, PackageCheck } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { cronometro, fmtMin } from '~/utils/muebles'
import {
  API_CARGUE, ORIGEN_CARGUE_LABEL, bultosCamion, codigoCargueValido, fmtHoraCargue, minutosCargue, normalizarCodigoCargueUi,
  type CamionCargue, type OrdenEncontradaCargue,
} from '~/utils/cargueCamiones'

const props = defineProps<{ camion: CamionCargue; ahora: number }>()
const emit = defineEmits<{
  (e: 'actualizado', c: CamionCargue): void
  (e: 'editar'): void
}>()
const { show } = useToast()

const c = computed(() => props.camion)
const enCurso = computed(() => c.value.ordenes.find((o) => !o.horaFin) ?? null)
const cargadas = computed(() => c.value.ordenes.filter((o) => o.horaFin))
const guardando = ref(false)

// ── Agregar orden ──
const codigo = ref('')
const buscando = ref(false)
const encontrada = ref<OrdenEncontradaCargue | null>(null)
const manual = ref({ tienda: '', cliente: '', ciudad: '' })
const inputCodigo = ref<HTMLInputElement | null>(null)
watch(codigo, () => { encontrada.value = null })

async function buscar() {
  if (!codigoCargueValido(codigo.value) || buscando.value) {
    if (codigo.value.trim()) show('La orden debe ser OVDM o TSDM seguida de números (ej. OVDM121831)', true)
    return
  }
  buscando.value = true
  try {
    const res = await $fetch<{ data: OrdenEncontradaCargue }>(`${API_CARGUE}/buscar`, { query: { codigo: normalizarCodigoCargueUi(codigo.value) } })
    encontrada.value = res.data
    manual.value = { tienda: '', cliente: '', ciudad: '' }
  } catch (e) {
    show(apiErr(e, 'No se pudo buscar la orden'), true)
  } finally {
    buscando.value = false
  }
}

const noSePuede = computed(() => {
  const o = encontrada.value
  if (!o) return null
  if (o.yaCargadaEn) return o.yaCargadaEn.cargueId === c.value.id ? 'Ya está en este camión' : `Ya se cargó en otro camión${o.yaCargadaEn.placa ? ` (${o.yaCargadaEn.placa})` : ''} el ${o.yaCargadaEn.fecha}`
  return o.bloqueo
})
const esManual = computed(() => encontrada.value?.origen === 'MANUAL')
const puedeIniciar = computed(() => !!encontrada.value && !noSePuede.value && (!esManual.value || !!manual.value.ciudad.trim()) && !guardando.value)

async function llamar(url: string, opts: { method: 'POST' | 'DELETE'; body?: unknown }, exito: string) {
  if (guardando.value) return false
  guardando.value = true
  try {
    const res = await $fetch<{ data: CamionCargue }>(url, opts as never)
    emit('actualizado', res.data)
    show(exito)
    return true
  } catch (e) {
    show(apiErr(e, 'No se pudo guardar'), true)
    return false
  } finally {
    guardando.value = false
  }
}

async function iniciarOrden() {
  if (!puedeIniciar.value || !encontrada.value) return
  const cod = encontrada.value.codigo
  const ok = await llamar(`${API_CARGUE}/${c.value.id}/ordenes`, {
    method: 'POST',
    body: { codigo: cod, ...(esManual.value && { tienda: manual.value.tienda || null, cliente: manual.value.cliente || null, ciudad: manual.value.ciudad }) },
  }, `Cargue de ${cod} iniciado`)
  if (ok) { codigo.value = ''; encontrada.value = null; bultos.value = ''; nota.value = '' }
}

// ── Finalizar la orden en cargue ──
const bultos = ref('')
const nota = ref('')
const inputBultos = ref<HTMLInputElement | null>(null)
watch(() => enCurso.value?.id, async (id) => {
  bultos.value = ''
  nota.value = ''
  await nextTick()
  if (id) inputBultos.value?.focus()
  else inputCodigo.value?.focus()
})
const bultosNum = computed(() => (bultos.value === '' ? null : Number(bultos.value)))
const diferencia = computed(() => {
  const o = enCurso.value
  if (!o || o.bultosDeclarados == null || bultosNum.value == null) return null
  return bultosNum.value - o.bultosDeclarados
})
const faltaFin = computed(() => {
  if (bultosNum.value == null || !Number.isInteger(bultosNum.value) || bultosNum.value < 0) return 'Escribe cuántos bultos se cargaron'
  if (diferencia.value && nota.value.trim().length < 5) return 'Los bultos no cuadran con lo declarado: escribe qué pasó'
  return null
})

function finalizarOrden() {
  const o = enCurso.value
  if (!o || faltaFin.value) return
  void llamar(`${API_CARGUE}/${c.value.id}/ordenes/${o.id}/finalizar`, {
    method: 'POST', body: { bultos: bultosNum.value, nota: nota.value.trim() || null },
  }, `${o.codigo} cargada: ${bultosNum.value} bultos`)
}
const confirmarQuitar = ref(false)
function quitarOrden() {
  const o = enCurso.value
  confirmarQuitar.value = false
  if (!o) return
  void llamar(`${API_CARGUE}/${c.value.id}/ordenes/${o.id}`, { method: 'DELETE' }, `${o.codigo} quitada del camión`)
}

// ── Finalizar el camion ──
const confirmarCierre = ref(false)
const faltaCierre = computed(() => {
  if (enCurso.value) return `Finaliza primero el cargue de ${enCurso.value.codigo}`
  if (!c.value.ordenes.length) return 'Agrega al menos una orden'
  return null
})
function cerrarCamion() {
  confirmarCierre.value = false
  void llamar(`${API_CARGUE}/${c.value.id}/cerrar`, { method: 'POST' }, 'Cargue del camión finalizado')
}

const duracion = (o: { horaInicio: string; horaFin: string | null }) => fmtMin(minutosCargue(o.horaInicio, o.horaFin))
</script>

<template>
  <section class="card pl">
    <header class="pl-cab">
      <span class="pulse" />
      <div class="pl-titulo">
        <b><Truck :size="15" /> {{ c.tipoVehiculo }}</b>
        <span>{{ c.transportadora }}<template v-if="c.placa"> · <span class="mono">{{ c.placa }}</span></template></span>
      </div>
      <div class="pl-der">
        <span class="crono tnum"><Timer :size="15" />{{ cronometro(c.horaInicio, ahora) }}</span>
        <button class="btn btn-ghost btn-sm" @click="emit('editar')"><Pencil :size="13" /> Editar</button>
      </div>
    </header>
    <p class="pl-personas"><Users :size="13" /> {{ c.operarios.map((o) => o.nombre).join(', ') || 'Sin personas' }}</p>
    <p v-if="c.observacion" class="pl-obs">{{ c.observacion }}</p>
    <p class="pl-resumen">
      Inició {{ fmtHoraCargue(c.horaInicio) }} · <b class="tnum">{{ cargadas.length }}</b> {{ cargadas.length === 1 ? 'orden cargada' : 'órdenes cargadas' }}
      · <b class="tnum">{{ bultosCamion(c) }}</b> bultos
    </p>

    <!-- Orden en cargue -->
    <section v-if="enCurso" class="curso">
      <header class="curso-cab">
        <div>
          <span class="chip-origen">{{ ORIGEN_CARGUE_LABEL[enCurso.origen] }}</span>
          <strong class="mono curso-cod">{{ enCurso.codigo }}</strong>
        </div>
        <span class="crono tnum"><Timer :size="15" />{{ cronometro(enCurso.horaInicio, ahora) }}</span>
      </header>
      <dl class="datos">
        <div><dt>Tienda</dt><dd>{{ enCurso.tienda ?? '—' }}</dd></div>
        <div><dt>Cliente</dt><dd>{{ enCurso.cliente ?? '—' }}</dd></div>
        <div><dt>Ciudad</dt><dd>{{ enCurso.ciudad ?? '—' }}</dd></div>
        <div>
          <dt>Bultos declarados</dt>
          <dd class="tnum">
            <b>{{ enCurso.bultosDeclarados ?? '—' }}</b>
            <span v-if="enCurso.bultosGourmet != null && enCurso.bultosMuebles != null" class="desc">
              (Gourmet {{ enCurso.bultosGourmet }} + Muebles {{ enCurso.bultosMuebles }})
            </span>
          </dd>
        </div>
      </dl>
      <div class="fin">
        <label class="campo">
          <span class="lbl">Bultos cargados</span>
          <input
            ref="inputBultos" v-model="bultos" class="field input-grande tnum" type="number" inputmode="numeric" min="0"
            placeholder="0" @keyup.enter="finalizarOrden"
          >
        </label>
        <p v-if="diferencia" class="dif"><TriangleAlert :size="14" /> {{ diferencia > 0 ? `${diferencia} ${diferencia === 1 ? 'bulto' : 'bultos'} de más` : (diferencia === -1 ? 'Falta 1 bulto' : `Faltan ${-diferencia} bultos`) }} frente a lo declarado</p>
        <label v-if="diferencia" class="campo">
          <span class="lbl">¿Qué pasó? (queda como novedad)</span>
          <input v-model="nota" class="field" maxlength="300" placeholder="Ej. una caja se devolvió a bodega" autocomplete="off">
        </label>
        <div class="fin-acciones">
          <button class="btn btn-ghost" :disabled="guardando" @click="confirmarQuitar = true"><X :size="14" /> Quitar orden</button>
          <button class="btn btn-primary" :disabled="!!faltaFin || guardando" :title="faltaFin ?? ''" @click="finalizarOrden">
            <CheckCircle2 :size="15" /> Finalizar cargue del pedido
          </button>
        </div>
      </div>
    </section>

    <!-- Agregar la siguiente orden -->
    <section v-else class="agregar">
      <form class="agregar-busca" @submit.prevent="buscar">
        <label class="campo">
          <span class="lbl">Agregar orden (OVDM / TSDM)</span>
          <input
            ref="inputCodigo" v-model="codigo" class="field input-grande mono" placeholder="OVDM121831" autocomplete="off"
            autocapitalize="characters" :disabled="guardando"
          >
        </label>
        <button class="btn" type="submit" :disabled="!codigo.trim() || buscando"><Search :size="15" /> {{ buscando ? 'Buscando…' : 'Buscar' }}</button>
      </form>

      <div v-if="encontrada" class="previa" :class="{ bloqueada: noSePuede }">
        <header class="curso-cab">
          <div>
            <span class="chip-origen" :class="{ manual: esManual }">{{ ORIGEN_CARGUE_LABEL[encontrada.origen] }}</span>
            <strong class="mono curso-cod">{{ encontrada.codigo }}</strong>
          </div>
        </header>
        <p v-if="noSePuede" class="dif"><TriangleAlert :size="14" /> {{ noSePuede }}</p>
        <template v-else-if="esManual">
          <p class="desc">No está en Cargue Gourmet ni en Muebles. Escribe lo que se sepa; la ciudad es obligatoria.</p>
          <div class="manual">
            <input v-model="manual.tienda" class="field" maxlength="255" placeholder="Tienda (opcional)">
            <input v-model="manual.cliente" class="field" maxlength="160" placeholder="Cliente (opcional)">
            <input v-model="manual.ciudad" class="field" maxlength="80" placeholder="Ciudad">
          </div>
        </template>
        <dl v-else class="datos">
          <div><dt>Tienda</dt><dd>{{ encontrada.tienda ?? '—' }}</dd></div>
          <div><dt>Cliente</dt><dd>{{ encontrada.cliente ?? '—' }}</dd></div>
          <div><dt>Ciudad</dt><dd>{{ encontrada.ciudad ?? '—' }}</dd></div>
          <div>
            <dt>Bultos declarados</dt>
            <dd class="tnum">
              <b>{{ encontrada.bultosDeclarados ?? '—' }}</b>
              <span v-if="encontrada.bultosGourmet != null" class="desc"> · Gourmet {{ encontrada.bultosGourmet }}</span>
              <span v-if="encontrada.bultosMuebles != null" class="desc"> · Muebles {{ encontrada.bultosMuebles }}</span>
            </dd>
          </div>
        </dl>
        <button v-if="!noSePuede" class="btn btn-primary" :disabled="!puedeIniciar" @click="iniciarOrden">
          <Play :size="15" /> Iniciar cargue
        </button>
      </div>
    </section>

    <!-- Lo ya cargado -->
    <div v-if="cargadas.length" class="tabla-wrap">
      <table class="tabla-c">
        <thead>
          <tr><th>Orden</th><th>Tienda / cliente</th><th>Ciudad</th><th class="num">Declarados</th><th class="num">Cargados</th><th class="num">Tiempo</th></tr>
        </thead>
        <tbody>
          <tr v-for="o in cargadas" :key="o.id">
            <td><b class="mono">{{ o.codigo }}</b><span class="desc">{{ ORIGEN_CARGUE_LABEL[o.origen] }}</span></td>
            <td>{{ o.tienda ?? o.cliente ?? '—' }}</td>
            <td>{{ o.ciudad ?? '—' }}</td>
            <td class="num tnum">{{ o.bultosDeclarados ?? '—' }}</td>
            <td class="num tnum">
              {{ o.bultosCargados }}
              <span v-if="o.notaDiferencia && o.bultosDeclarados != null && o.bultosCargados !== o.bultosDeclarados" class="nov" :title="o.notaDiferencia">
                <TriangleAlert :size="12" /> novedad
              </span>
            </td>
            <td class="num tnum">{{ duracion(o) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="pl-pie">
      <span v-if="faltaCierre" class="desc">{{ faltaCierre }}</span>
      <button class="btn btn-primary" :disabled="!!faltaCierre || guardando" @click="confirmarCierre = true">
        <PackageCheck :size="15" /> Finalizar cargue del camión
      </button>
    </footer>

    <ConfirmModal
      v-if="confirmarCierre" title="Finalizar cargue del camión"
      :message="`Se cierra el cargue con ${cargadas.length} ${cargadas.length === 1 ? 'orden' : 'órdenes'} y ${bultosCamion(c)} bultos. Después ya no se pueden agregar órdenes a este camión.`"
      confirm-label="Finalizar camión" :danger="false" :confirming="guardando"
      @close="confirmarCierre = false" @confirm="cerrarCamion"
    />
    <ConfirmModal
      v-if="confirmarQuitar && enCurso" title="Quitar orden"
      :message="`Se quita ${enCurso.codigo} de este camión (su reloj se descarta). Úsalo si se agregó por error.`"
      confirm-label="Quitar" :confirming="guardando"
      @close="confirmarQuitar = false" @confirm="quitarOrden"
    />
  </section>
</template>

<style scoped>
.pl { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; border-color: color-mix(in srgb, var(--brand) 35%, var(--border)); }
.pl-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pulse { width: 10px; height: 10px; border-radius: 50%; background: var(--brand); box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 60%, transparent); animation: pulso 1.8s infinite; }
@keyframes pulso { 70% { box-shadow: 0 0 0 9px transparent } 100% { box-shadow: 0 0 0 0 transparent } }
.pl-titulo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pl-titulo b { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; color: var(--ink); }
.pl-titulo span { font-size: 12.5px; color: var(--muted); }
.pl-der { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.crono { display: inline-flex; align-items: center; gap: 6px; font-size: 17px; font-weight: 800; color: var(--brand); }
.pl-personas { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; color: var(--ink-2); }
.pl-obs { margin: 0; font-size: 12.5px; color: var(--muted); font-style: italic; }
.pl-resumen { margin: 0; font-size: 12.5px; color: var(--muted); }
.curso, .agregar .previa { padding: 14px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 12px; }
.previa.bloqueada { border-color: color-mix(in srgb, var(--u-aviso) 50%, var(--border)); }
.curso-cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.curso-cod { margin-left: 8px; font-size: 18px; color: var(--ink); }
.chip-origen { padding: 3px 9px; border-radius: var(--r-pill); font-size: 11px; font-weight: 700; color: var(--brand); background: var(--brand-tint); }
.chip-origen.manual { color: var(--u-aviso); background: var(--u-aviso-tint); }
.datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin: 0; }
.datos dt { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.datos dd { margin: 2px 0 0; font-size: 13.5px; color: var(--ink); }
.desc { font-size: 12px; color: var(--muted); }
td .desc { display: block; }
.campo { display: flex; flex-direction: column; gap: 5px; flex: 1 1 220px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.input-grande { font-size: 18px; font-weight: 700; padding: 11px 13px; }
.fin { display: flex; flex-direction: column; gap: 10px; }
.fin-acciones, .pl-pie { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.pl-pie .desc { margin-right: auto; }
.dif { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13px; font-weight: 700; color: var(--u-aviso); }
.agregar { display: flex; flex-direction: column; gap: 12px; }
.agregar-busca { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
.manual { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
.tabla-wrap { overflow-x: auto; }
.tabla-c { width: 100%; border-collapse: collapse; font-size: 13px; }
.tabla-c th { text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: 8px 10px; border-bottom: 1px solid var(--border-strong); background: var(--surface-2); white-space: nowrap; }
.tabla-c td { padding: 8px 10px; border-bottom: 1px solid var(--border); color: var(--ink-2); }
.tabla-c .num { text-align: right; }
.nov { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; font-size: 11px; font-weight: 700; color: var(--u-aviso); }
@media (max-width: 560px) { .fin-acciones .btn, .pl-pie .btn, .agregar-busca .btn { width: 100%; justify-content: center; } }
</style>

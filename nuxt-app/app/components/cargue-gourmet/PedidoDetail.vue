<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ArrowLeft, Pencil, Trash2, Truck, PackagePlus, CheckCircle2, RotateCcw, ShieldAlert, TriangleAlert, XCircle,
} from '@lucide/vue'
import {
  ESTADO_LABEL, ESTADO_TONE, fmtFechaHora, rolPuedeTransicionarGourmet,
  puedeGourmet, puedeTransporte, puedeCierreManual, puedeEliminarGourmet,
  ESTADOS_INICIABLES_TRANSPORTE, ESTADOS_FINALIZABLES_TRANSPORTE, ESTADOS_CIERRE_MANUAL,
  validarCodigoCaja, type PedidoGourmet,
} from '~/utils/gourmet'

const RESULTADO_LABEL: Record<string, string> = {
  VALIDO: 'Caja válida', DUPLICADO: 'Caja duplicada', CAJA_AJENA: 'Caja ajena',
  FORMATO_INVALIDO: 'Formato inválido', EXCEDE_CANTIDAD: 'Excede cantidad esperada',
}
const RESULTADO_TONE: Record<string, string> = {
  VALIDO: 'var(--u-ok)', DUPLICADO: 'var(--u-aviso)', CAJA_AJENA: 'var(--u-critico)',
  FORMATO_INVALIDO: 'var(--muted)', EXCEDE_CANTIDAD: 'var(--u-aviso)',
}
const NOVEDAD_TIPO_LABEL: Record<string, string> = {
  CAJA_FALTANTE: 'Caja faltante', CAJA_DUPLICADA: 'Caja duplicada', CAJA_AJENA: 'Caja ajena',
  CIERRE_MANUAL: 'Cierre manual', DIFERENCIA_CANTIDAD: 'Diferencia de cantidad', OTRA: 'Otra',
}

const props = defineProps<{ p: PedidoGourmet; role: string; busy?: string | null; escaneando?: boolean; ultimoResultado?: { codigo: string; resultado: string } | null }>()
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'edit'): void
  (e: 'del'): void
  (e: 'asignarUbicacion'): void
  (e: 'iniciarCargue'): void
  (e: 'finalizar'): void
  (e: 'revertir'): void
  (e: 'cierreManual'): void
  (e: 'escanear', codigo: string, tieneParte2: boolean): void
}>()

const esMuebles = computed(() => props.p.tipoPedido === 'MUEBLES')
const tieneParte2 = ref(false)

const puedeIniciar = computed(() => puedeTransporte(props.role) && ESTADOS_INICIABLES_TRANSPORTE.includes(props.p.estado))
const puedeFinalizarCargue = computed(() => puedeTransporte(props.role) && ESTADOS_FINALIZABLES_TRANSPORTE.includes(props.p.estado))
const puedeCerrarManualmente = computed(() => puedeCierreManual(props.role) && ESTADOS_CIERRE_MANUAL.includes(props.p.estado))
const puedeRevertir = computed(() => puedeEliminarGourmet(props.role) && props.p.estado === 'EN_CARGUE')
const puedeEditar = computed(() => puedeGourmet(props.role))
const puedeBorrar = computed(() => puedeEliminarGourmet(props.role))
const enCargue = computed(() => props.p.estado === 'EN_CARGUE')

const cargueActivo = computed(() => props.p.cargues?.find((c) => c.estado === 'EN_CARGUE') ?? null)
const progreso = computed(() => cargueActivo.value ? { escaneados: cargueActivo.value.cantidadEscaneada, esperados: cargueActivo.value.cantidadEsperada } : null)
const completo = computed(() => !!progreso.value && progreso.value.esperados > 0 && progreso.value.escaneados === progreso.value.esperados)

const codigo = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
function submitEscaneo() {
  const v = codigo.value.trim()
  if (!v || props.escaneando) return
  emit('escanear', v, tieneParte2.value)
  codigo.value = ''
  tieneParte2.value = false
  inputRef.value?.focus()
}

// Rama alterna del flujo (novedad abierta, cierre manual o cancelado) —
// se muestra como tarjeta de severidad en vez del <Badge> plano, mismo
// patrón que Facturas Contado (DespachoDetail.vue).
const severidad = computed(() => {
  if (props.p.estado === 'CON_NOVEDAD') {
    const abierta = props.p.novedades?.find((n) => n.estado === 'ABIERTA')
    return {
      icono: TriangleAlert,
      titulo: 'Con novedad',
      mensaje: abierta?.descripcion ?? 'Hay una novedad registrada en el cargue.',
      fecha: abierta ? fmtFechaHora(abierta.createdAt) : null,
    }
  }
  if (props.p.estado === 'CARGUE_COMPLETO_MANUAL') {
    return {
      icono: ShieldAlert,
      titulo: 'Cerrado manualmente',
      mensaje: props.p.observacionCierreManual || `Cierre de contingencia — contadas manualmente: ${props.p.cantidadContadaManual ?? '—'}. Motivo: ${props.p.motivoCierreManual ?? '—'}.`,
      fecha: fmtFechaHora(props.p.cargueCompletadoAt ?? null),
    }
  }
  if (props.p.estado === 'CANCELADO') {
    return { icono: XCircle, titulo: 'Cancelado', mensaje: 'Este pedido fue cancelado.', fecha: null }
  }
  return null
})

const resumen = computed(() => [
  { label: 'Código tienda', value: props.p.codigoTienda },
  { label: 'Ciudad destino', value: props.p.ciudadDestino },
  { label: 'Cajas esperadas', value: String(props.p.cajasEsperadas) },
  { label: 'Estibas esperadas', value: String(props.p.estibasEsperadas) },
  { label: 'Creado por', value: props.p.creadoPorNombre ?? '—' },
  { label: 'Creado', value: fmtFechaHora(props.p.createdAt) },
  { label: 'Ubicación asignada', value: fmtFechaHora(props.p.ubicacionAsignadaAt ?? null) },
  { label: 'Cargue iniciado', value: fmtFechaHora(props.p.cargueIniciadoAt ?? null) },
  { label: 'Cargue completado', value: fmtFechaHora(props.p.cargueCompletadoAt ?? null) },
])
</script>

<template>
  <div class="detail fade-in">
    <button class="btn btn-ghost btn-sm back" @click="emit('back')"><ArrowLeft :size="15" /> Volver a la lista</button>

    <header class="dhead card">
      <div class="dhead-main">
        <div class="dtitle-row">
          <h1 class="mono">{{ p.tipoOrden }} {{ p.orden }}</h1>
          <Badge :label="ESTADO_LABEL[p.estado]" :tone="ESTADO_TONE[p.estado]" solid />
          <Badge v-if="esMuebles" label="Muebles" tone="var(--info)" />
          <span v-if="p.estado === 'CARGUE_COMPLETO_MANUAL'" title="Cierre de contingencia — cantidad contada manualmente" class="manual-ic">⚠</span>
        </div>
        <div class="dsub">{{ p.nombreTienda }} — {{ p.ciudadDestino }}</div>
      </div>
      <div class="dactions">
        <button v-if="puedeEditar" class="btn btn-sm" :disabled="!!busy" @click="emit('edit')"><Pencil :size="14" /> Editar</button>
        <button v-if="puedeEditar && p.estado === 'BORRADOR'" class="btn btn-sm" :disabled="!!busy" @click="emit('asignarUbicacion')"><PackagePlus :size="14" /> Asignar ubicación</button>
        <button v-if="puedeIniciar" class="btn btn-primary btn-sm" :disabled="!!busy" @click="emit('iniciarCargue')">
          <Spinner v-if="busy === 'iniciarCargue'" /><Truck v-else :size="14" />
          {{ busy === 'iniciarCargue' ? 'Iniciando…' : 'Iniciar cargue' }}
        </button>
        <button v-if="puedeFinalizarCargue" class="btn btn-primary btn-sm" :disabled="!!busy || !completo" :title="!completo ? 'El cargue solo puede finalizar cuando el conteo esté completo' : ''" @click="emit('finalizar')">
          <Spinner v-if="busy === 'finalizar'" /><CheckCircle2 v-else :size="14" />
          {{ busy === 'finalizar' ? 'Finalizando…' : 'Finalizar cargue' }}
        </button>
        <button v-if="puedeCerrarManualmente" class="btn btn-sm cierre" :disabled="!!busy" @click="emit('cierreManual')"><ShieldAlert :size="14" /> Cierre manual</button>
        <button v-if="puedeRevertir" class="btn btn-sm rev" :disabled="!!busy" @click="emit('revertir')">
          <Spinner v-if="busy === 'revertir'" /><RotateCcw v-else :size="14" />
          {{ busy === 'revertir' ? 'Revirtiendo…' : 'Revertir cargue' }}
        </button>
        <button v-if="puedeBorrar" class="btn btn-danger btn-sm" :disabled="!!busy" @click="emit('del')">
          <Spinner v-if="busy === 'del'" /><Trash2 v-else :size="14" />
        </button>
      </div>
    </header>

    <div class="grid">
      <div class="col">
        <div v-if="severidad" class="sev" :style="{ '--c': ESTADO_TONE[p.estado] }">
          <span class="sev-ic"><component :is="severidad.icono" :size="18" /></span>
          <div class="sev-body">
            <div class="sev-top">
              <span class="sev-title">{{ severidad.titulo }}</span>
              <span v-if="severidad.fecha" class="sev-date mono">{{ severidad.fecha }}</span>
            </div>
            <p class="sev-msg">{{ severidad.mensaje }}</p>
          </div>
        </div>

        <section class="sec card">
          <h3>Resumen del pedido</h3>
          <div class="dgrid">
            <div v-for="item in resumen" :key="item.label" class="ditem">
              <span class="dlabel">{{ item.label }}</span>
              <span class="dvalue">{{ item.value }}</span>
            </div>
          </div>
        </section>

        <section v-if="enCargue" class="sec card">
          <h3>Escaneo de cajas</h3>
          <div class="prog" :style="{ '--c': completo ? 'var(--u-ok)' : 'var(--u-critico)' }">
            <div class="prog-num mono">{{ progreso ? `${progreso.escaneados} / ${progreso.esperados}` : '—' }}</div>
            <Badge :label="completo ? 'Completo' : 'Incompleto'" :tone="completo ? 'var(--u-ok)' : 'var(--u-aviso)'" />
          </div>
          <form class="escan-form" @submit.prevent="submitEscaneo">
            <input ref="inputRef" v-model="codigo" class="field mono" placeholder="Escanea o escribe el código de la caja…" autofocus :disabled="escaneando">
            <button type="submit" class="btn btn-primary btn-sm" :disabled="escaneando || !codigo.trim()">{{ escaneando ? 'Registrando…' : 'Registrar' }}</button>
          </form>
          <label v-if="esMuebles" class="parte2">
            <input v-model="tieneParte2" type="checkbox">
            Esta caja tiene varias partes (marca esto en cada parte adicional — 2ª, 3ª, 4ª… — para repetir el número sin que quede como duplicado)
          </label>
          <div v-if="ultimoResultado" class="ultimo">
            <Badge :label="RESULTADO_LABEL[ultimoResultado.resultado] ?? ultimoResultado.resultado" :tone="RESULTADO_TONE[ultimoResultado.resultado] ?? 'var(--muted)'" />
            <span class="mono ultimo-cod">{{ ultimoResultado.codigo }}</span>
          </div>
          <div v-if="completo" class="completo-alerta">
            <span class="completo-txt">Escaneo completo ✓</span>
            <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="emit('finalizar')">
              <Spinner v-if="busy === 'finalizar'" />{{ busy === 'finalizar' ? 'Enviando…' : 'Enviar' }}
            </button>
          </div>
        </section>

        <section class="sec card">
          <h3>Ubicación / Estibas</h3>
          <div v-if="!p.estibas?.length" class="faint">Sin estibas registradas.</div>
          <div v-else class="estibas">
            <div v-for="e in [...(p.estibas ?? [])].sort((a, b) => a.secuencia - b.secuencia)" :key="e.id" class="estiba-row">
              <span><strong>Estiba {{ e.secuencia }}</strong> — {{ e.ubicacion || 'Sin ubicación asignada' }}
                <span v-if="e.observacion" class="faint"> ({{ e.observacion }})</span>
              </span>
              <span class="faint">{{ (p.cajas ?? []).filter((c) => c.estibaId === e.id).length }} cajas</span>
            </div>
          </div>
        </section>

        <section class="sec card">
          <h3>Cajas registradas</h3>
          <div v-if="!p.cajas?.length" class="faint">Sin cajas registradas.</div>
          <div v-else class="cajas">
            <div v-for="c in p.cajas" :key="c.id" class="mono caja-row">
              <strong v-if="c.numeroSecuencia != null">#{{ c.numeroSecuencia }}</strong>
              <span v-if="c.codigoCaja">{{ c.codigoCaja }}</span>
            </div>
          </div>
        </section>

        <section class="sec card">
          <h3>Cargues</h3>
          <div v-if="!p.cargues?.length" class="faint">Sin cargues registrados.</div>
          <div v-else class="cargues">
            <div v-for="c in p.cargues" :key="c.id" class="dgrid cargue-item">
              <div class="ditem"><span class="dlabel">Estado</span><span class="dvalue">{{ c.estado }}</span></div>
              <div class="ditem"><span class="dlabel">Esperada / Escaneada</span><span class="dvalue">{{ c.cantidadEsperada }} / {{ c.cantidadEscaneada }}</span></div>
              <div class="ditem"><span class="dlabel">Iniciado por</span><span class="dvalue">{{ c.iniciadoPorNombre ?? c.iniciadoPorId }}</span></div>
              <div class="ditem"><span class="dlabel">Finalizado por</span><span class="dvalue">{{ c.finalizadoPorNombre ?? c.finalizadoPorId ?? '—' }}</span></div>
              <div class="ditem"><span class="dlabel">Iniciado</span><span class="dvalue">{{ fmtFechaHora(c.iniciadoAt) }}</span></div>
              <div class="ditem"><span class="dlabel">Finalizado</span><span class="dvalue">{{ fmtFechaHora(c.finalizadoAt) }}</span></div>
            </div>
          </div>
        </section>

        <section v-if="p.cargues?.some((c) => c.escaneos.length)" class="sec card">
          <h3>Escaneos recientes</h3>
          <ul class="hist">
            <li v-for="e in p.cargues!.flatMap((c) => c.escaneos)" :key="e.id" class="hitem">
              <div class="hdot" :style="{ background: RESULTADO_TONE[e.resultado] ?? 'var(--muted)' }" />
              <div>
                <div class="haction mono">{{ e.codigoEscaneado }}</div>
                <div class="hmeta">{{ RESULTADO_LABEL[e.resultado] ?? e.resultado }}{{ e.escaneadoPorNombre ? ` · ${e.escaneadoPorNombre}` : '' }} · {{ fmtFechaHora(e.createdAt) }}</div>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <div class="col side card">
        <h3>Novedades</h3>
        <div v-if="!p.novedades?.length" class="faint">Sin novedades registradas.</div>
        <ul v-else class="novedades">
          <li v-for="n in p.novedades" :key="n.id" class="nitem">
            <div class="ntop">
              <Badge :label="NOVEDAD_TIPO_LABEL[n.tipo] ?? n.tipo" :tone="n.estado === 'ABIERTA' ? 'var(--u-critico)' : 'var(--u-ok)'" />
              <span class="nestado">{{ n.estado }}</span>
            </div>
            <p class="ndesc">{{ n.descripcion }}</p>
            <p class="nmeta">Registrada por {{ n.registradaPorNombre ?? n.registradaPorId }} · {{ fmtFechaHora(n.createdAt) }}
              <template v-if="n.resueltaPorId"> · Resuelta por {{ n.resueltaPorNombre ?? n.resueltaPorId }}</template>
            </p>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.back { margin-bottom: 14px; }
.dhead, .col > * { animation: dEnter .42s cubic-bezier(.16,1,.3,1) both; }
.dhead { animation-delay: .02s; }
.col:first-child > *:nth-child(1) { animation-delay: .06s; }
.col:first-child > *:nth-child(2) { animation-delay: .10s; }
.col:first-child > *:nth-child(3) { animation-delay: .14s; }
.col:first-child > *:nth-child(4) { animation-delay: .18s; }
.col:first-child > *:nth-child(5) { animation-delay: .22s; }
.col:first-child > *:nth-child(6) { animation-delay: .26s; }
.col:first-child > *:nth-child(7) { animation-delay: .30s; }
.col.side { animation-delay: .16s; }
@keyframes dEnter { from { opacity: 0; transform: translateY(12px); } }

/* Tarjeta de severidad (novedad / cierre manual / cancelado) — mismo
   patrón que Facturas Contado (DespachoDetail.vue). */
.sev {
  display: flex; gap: 13px; align-items: flex-start;
  padding: 14px 16px; border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--c) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--c) 28%, transparent);
  border-left: 3px solid var(--c);
  animation: sevEnter .4s cubic-bezier(.16,1,.3,1) both;
}
@keyframes sevEnter { from { opacity: 0; transform: translateX(-8px); } }
.sev-ic {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: grid; place-items: center; color: var(--c);
  background: color-mix(in srgb, var(--c) 14%, transparent);
}
.sev-body { flex: 1; min-width: 0; }
.sev-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.sev-title { font-size: 14px; font-weight: 800; color: color-mix(in srgb, var(--c) 75%, var(--ink)); }
.sev-date { font-size: 10.5px; color: var(--faint); flex-shrink: 0; }
.sev-msg { font-size: 13px; color: var(--ink-2); line-height: 1.5; margin: 5px 0 0; }
.dhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; margin-bottom: 16px; flex-wrap: wrap; }
.dtitle-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dhead h1 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
.manual-ic { font-size: 15px; }
.dsub { font-size: 13px; color: var(--muted); margin-top: 5px; }
.dactions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.rev { color: var(--u-aviso); border-color: var(--u-aviso); }
.cierre { color: var(--u-critico); border-color: var(--u-critico); }
.grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.sec { padding: 16px 18px; }
.side { padding: 18px 20px; }
.sec h3, .side h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 12px; }
.dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
.ditem { display: flex; flex-direction: column; gap: 3px; }
.dlabel { font-size: 11px; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: .04em; }
.dvalue { font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.faint { color: var(--faint); font-weight: 500; font-size: 13px; }

.prog { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid color-mix(in srgb, var(--c) 35%, var(--border)); margin-bottom: 10px; }
.prog-num { font-size: 18px; font-weight: 700; color: var(--ink); }
.escan-form { display: flex; gap: 8px; }
.escan-form .field { flex: 1; }
.parte2 { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; color: var(--muted); cursor: pointer; }
.ultimo { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.ultimo-cod { font-size: 12px; color: var(--muted); }
.completo-alerta { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding: 10px 12px; border-radius: var(--r-sm); background: var(--u-ok-tint); border: 1px solid color-mix(in srgb, var(--u-ok) 40%, transparent); }
.completo-txt { font-size: 13px; font-weight: 700; color: var(--u-ok); }

.estibas, .cajas, .cargues { display: flex; flex-direction: column; gap: 10px; }
.estiba-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 13px; padding: 8px 10px; border-radius: var(--r-sm); background: var(--surface-2); }
.caja-row { display: flex; gap: 8px; font-size: 13px; padding: 4px 0; }
.cargue-item { padding: 12px; border-radius: var(--r-sm); background: var(--surface-2); }

.hist, .novedades { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.hitem { display: flex; gap: 10px; }
.hdot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.haction { font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.hmeta, .nmeta { font-size: 11px; color: var(--faint); margin-top: 2px; }
.nitem { padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.nitem:last-child { border-bottom: none; padding-bottom: 0; }
.ntop { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.nestado { font-size: 11px; color: var(--muted); }
.ndesc { font-size: 13px; color: var(--ink-2); margin: 4px 0; }
@media (max-width: 940px) { .grid { grid-template-columns: 1fr; } }
</style>

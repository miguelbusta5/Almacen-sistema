<script setup lang="ts">
// Los pendientes que le tocan al operario.
//
// Se ejecutan como un movimiento de depósito: el reloj arranca al ESCANEAR EL
// PLU y se cierra al escribir la ubicación final. Al cerrarlo, el servidor avisa
// a quien lo pidió y a quien lo repartió — es justo el dato que estaban esperando.
import { ref, computed, nextTick } from 'vue'
import { ScanLine, ArrowDown, Package, CheckCircle2, TriangleAlert, UserPlus } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { sonarVeredicto } from '~/utils/escaneoFeedback'
import {
  API_MONTAJE, API_PENDIENTES, cronometroDesde, devuelveASolicitante, fmtDuracionTarea,
  NOVEDAD_PENDIENTE_LABEL, NOVEDADES_PENDIENTE, type NovedadPendiente, type PendienteDTO,
} from '~/utils/resurtidoTareas'
import { useSessionState } from '~/composables/useSession'

const props = defineProps<{ ahora: number }>()

const { show: showToast } = useToast()

const items = ref<PendienteDTO[]>([])
const loading = ref(true)
const guardando = ref<string | null>(null)
const abierto = ref<PendienteDTO | null>(null)

const escaneoPlu = ref('')
const unidades = ref('')
const ubicacionFinal = ref('')
const pluInput = ref<HTMLInputElement | null>(null)
const ubicInput = ref<HTMLInputElement | null>(null)

async function cargar() {
  loading.value = true
  try {
    const res = await $fetch<{ data: PendienteDTO[] }>(`${API_PENDIENTES}/mis-tareas`)
    items.value = res.data
    if (abierto.value) {
      abierto.value = items.value.find((p) => p.id === abierto.value!.id) ?? null
    }
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar tus pendientes'), true)
  } finally {
    loading.value = false
  }
}
defineExpose({ cargar })

function abrir(p: PendienteDTO) {
  abierto.value = p
  escaneoPlu.value = ''
  unidades.value = String(p.unidadesSolicitadas)
  ubicacionFinal.value = ''
  void nextTick(() => {
    if (p.horaInicio) ubicInput.value?.focus()
    else pluInput.value?.focus()
  })
}

const enCurso = computed(() => Boolean(abierto.value?.horaInicio))
const crono = computed(() =>
  abierto.value?.horaInicio ? cronometroDesde(abierto.value.horaInicio, props.ahora) : null)

async function iniciar() {
  const p = abierto.value
  if (!p || !escaneoPlu.value.trim()) return
  guardando.value = p.id
  try {
    const res = await $fetch<{ data: PendienteDTO }>(`${API_PENDIENTES}/${p.id}/iniciar`, {
      method: 'POST', body: { plu: escaneoPlu.value.trim() },
    })
    abierto.value = res.data
    sonarVeredicto('VALIDO')
    await nextTick()
    ubicInput.value?.focus()
  } catch (e) {
    sonarVeredicto('CAJA_AJENA')
    showToast(apiErr(e, 'No se pudo iniciar'), true)
  } finally {
    guardando.value = null
  }
}

const puedeCompletar = computed(() =>
  enCurso.value && Number(unidades.value) >= 1 && ubicacionFinal.value.trim().length > 0)

async function completar() {
  const p = abierto.value
  if (!p || !puedeCompletar.value) return
  guardando.value = p.id
  try {
    await $fetch(`${API_PENDIENTES}/${p.id}/completar`, {
      method: 'POST',
      body: {
        unidadesBajadas: Number(unidades.value),
        ubicacionFinal: ubicacionFinal.value.trim(),
      },
    })
    sonarVeredicto('VALIDO')
    showToast('Pendiente ubicado. Ya avisamos a quien lo pidió.')
    abierto.value = null
    await cargar()
  } catch (e) {
    sonarVeredicto('CAJA_AJENA')
    showToast(apiErr(e, 'No se pudo completar'), true)
  } finally {
    guardando.value = null
  }
}

// ── Reportar una novedad ───────────────────────────────────────────
// Solo el area de muebles vuelve a quien lo pidio: no es un problema del
// deposito, se pidio al area equivocada. El resto se queda en almacenamiento, en
// rojo, para que alguien decida. En los dos casos el reloj se descarta.
const reportando = ref(false)
const novedad = ref<NovedadPendiente>('SIN_EXISTENCIAS')

async function reportar() {
  const p = abierto.value
  if (!p) return
  guardando.value = p.id
  try {
    await $fetch(`${API_PENDIENTES}/${p.id}/novedad`, {
      method: 'POST', body: { tipo: novedad.value },
    })
    showToast(devuelveASolicitante(novedad.value)
      ? 'Devuelto a quien lo pidió.'
      : 'Novedad reportada. Almacenamiento decide qué hacer.')
    abierto.value = null
    reportando.value = false
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo reportar'), true)
  } finally {
    guardando.value = null
  }
}

// ── Pasar a un ayudante ────────────────────────────────────────────
// El reloj es de quien lo termina: arranca cuando el ayudante escanea el PLU.
const { me } = useSessionState()
const pasando = ref(false)
const ayudantes = ref<{ id: string; nombre: string }[]>([])
const ayudanteId = ref('')

async function abrirPaso() {
  pasando.value = true
  reportando.value = false
  if (ayudantes.value.length) return
  try {
    const res = await $fetch<{ data: { id: string; nombre: string }[] }>(`${API_MONTAJE}/operarios`)
    // Uno no se lo pasa a si mismo, y verse en la lista solo estorba.
    ayudantes.value = res.data.filter((o) => o.id !== me.value?.id)
  } catch { /* sin lista el boton se queda deshabilitado */ }
}

async function pasar() {
  const p = abierto.value
  if (!p || !ayudanteId.value) return
  guardando.value = p.id
  try {
    await $fetch(`${API_PENDIENTES}/${p.id}/traspasar`, {
      method: 'POST', body: { operarioId: ayudanteId.value },
    })
    const nombre = ayudantes.value.find((a) => a.id === ayudanteId.value)?.nombre ?? 'el ayudante'
    showToast(`Pasado a ${nombre}`)
    abierto.value = null
    pasando.value = false
    ayudanteId.value = ''
    await cargar()
  } catch (e) {
    showToast(apiErr(e, 'No se pudo pasar'), true)
  } finally {
    guardando.value = null
  }
}

cargar()
</script>

<template>
  <div class="pend">
    <ListSkeleton v-if="loading" />

    <EmptyState
      v-else-if="!items.length" title="Sin pendientes asignados"
      description="Cuando te asignen un pendiente de gourmet, aparecerá aquí."
    />

    <ol v-else class="lista">
      <li v-for="p in items" :key="p.id">
        <button class="tarea card" :class="{ activa: p.horaInicio }" @click="abrir(p)">
          <span class="t-cuerpo">
            <span class="t-plu mono">{{ p.plu }}</span>
            <span class="t-desc">{{ p.descripcion }}</span>
            <span class="t-meta">
              {{ p.unidadesSolicitadas }} und · pedido por {{ p.solicitadoPorNombre ?? 'gourmet' }}
            </span>
          </span>
          <span class="t-der">
            <span v-if="p.horaInicio" class="t-crono tnum">{{ cronometroDesde(p.horaInicio, ahora) }}</span>
            <span v-else class="t-espera tnum">esperando {{ fmtDuracionTarea(p.esperaSegundos) }}</span>
          </span>
        </button>
      </li>
    </ol>

    <div v-if="abierto" class="overlay" @click.self="abierto = null">
      <section class="card modal">
        <header class="m-head">
          <div>
            <h2 class="m-title mono">{{ abierto.plu }}</h2>
            <p class="m-sub">{{ abierto.descripcion }}</p>
          </div>
          <span v-if="crono" class="m-crono tnum">{{ crono }}</span>
          <button class="btn btn-sm" @click="abierto = null">Cerrar</button>
        </header>

        <div class="m-body">
          <!-- Paso 1: el PLU arranca el reloj, igual que en movimientos -->
          <section class="paso" :class="{ hecho: enCurso }">
            <h3 class="p-title"><Package :size="14" /> 1 · Escanea el producto</h3>
            <form v-if="!enCurso" class="p-form" @submit.prevent="iniciar">
              <input
                ref="pluInput" v-model="escaneoPlu" class="field mono grande"
                :placeholder="abierto.plu" autocomplete="off" inputmode="numeric"
                enterkeyhint="go" :disabled="guardando === abierto.id"
              >
              <button class="btn btn-primary" :disabled="!escaneoPlu.trim() || guardando === abierto.id">
                <Spinner v-if="guardando === abierto.id" :size="15" /><ScanLine v-else :size="15" />
                Empezar
              </button>
            </form>
            <p v-else class="p-ok"><CheckCircle2 :size="13" /> Producto confirmado, el reloj corre</p>
          </section>

          <!-- Paso 2: unidades y ubicación final -->
          <section class="paso" :class="{ off: !enCurso }">
            <h3 class="p-title"><ArrowDown :size="14" /> 2 · Baja y ubica</h3>
            <form class="p-grid" @submit.prevent="completar">
              <label class="f">
                <span class="lbl">Unidades que bajas</span>
                <input
                  v-model="unidades" class="field tnum" type="number" min="1" inputmode="numeric"
                  :disabled="!enCurso || guardando === abierto.id"
                >
                <span class="hint">Solicitadas: {{ abierto.unidadesSolicitadas }}</span>
              </label>
              <label class="f">
                <span class="lbl">Ubicación final</span>
                <input
                  ref="ubicInput" v-model="ubicacionFinal" class="field mono"
                  placeholder="05-B-25-03-01" autocomplete="off" autocapitalize="characters"
                  enterkeyhint="done" :disabled="!enCurso || guardando === abierto.id"
                >
              </label>
              <div class="f f-btn">
                <button class="btn btn-primary submit" :disabled="!puedeCompletar || guardando === abierto.id">
                  <Spinner v-if="guardando === abierto.id" :size="15" /><CheckCircle2 v-else :size="15" />
                  Ubicar y avisar
                </button>
              </div>
            </form>
            <p v-if="!enCurso" class="p-bloq">Escanea primero el producto.</p>
          </section>

          <!-- No lo puede bajar, o se lo pasa a otro. -->
          <section class="otras">
            <div v-if="!reportando && !pasando" class="otras-acc">
              <button class="dev-link" @click="reportando = true; pasando = false">
                <TriangleAlert :size="13" /> Reportar novedad
              </button>
              <button class="dev-link" @click="abrirPaso">
                <UserPlus :size="13" /> Pasar a un ayudante
              </button>
            </div>

            <template v-if="reportando">
              <h3 class="p-title"><TriangleAlert :size="14" /> ¿Qué encontraste?</h3>
              <div class="dev-motivos">
                <button
                  v-for="n in NOVEDADES_PENDIENTE" :key="n" type="button" class="dev-btn"
                  :class="{ on: novedad === n }" @click="novedad = n"
                >
                  {{ NOVEDAD_PENDIENTE_LABEL[n] }}
                  <span v-if="devuelveASolicitante(n)" class="dev-nota">vuelve a quien lo pidió</span>
                </button>
              </div>
              <div class="dev-acc">
                <button class="btn btn-sm" @click="reportando = false">Cancelar</button>
                <button class="btn btn-sm dev-ok" :disabled="guardando === abierto.id" @click="reportar">
                  <Spinner v-if="guardando === abierto.id" :size="13" /><TriangleAlert v-else :size="13" />
                  Reportar
                </button>
              </div>
            </template>

            <template v-if="pasando">
              <h3 class="p-title"><UserPlus :size="14" /> Pasar a un ayudante</h3>
              <select v-model="ayudanteId" class="field" :disabled="guardando === abierto.id">
                <option value="">Elige a quién</option>
                <option v-for="a in ayudantes" :key="a.id" :value="a.id">{{ a.nombre }}</option>
              </select>
              <p class="hint">Su reloj empieza cuando escanee el PLU.</p>
              <div class="dev-acc">
                <button class="btn btn-sm" @click="pasando = false">Cancelar</button>
                <button class="btn btn-sm btn-primary" :disabled="!ayudanteId || guardando === abierto.id" @click="pasar">
                  <Spinner v-if="guardando === abierto.id" :size="13" /><UserPlus v-else :size="13" />
                  Pasar
                </button>
              </div>
            </template>
          </section>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pend { display: flex; flex-direction: column; gap: 14px; }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.tarea {
  width: 100%; display: flex; align-items: center; gap: 13px; padding: 13px 15px;
  text-align: left; cursor: pointer; border: 1px solid var(--border);
  transition: transform .14s, border-color .14s, box-shadow .14s;
}
.tarea:hover { transform: translateY(-2px); border-color: var(--brand); box-shadow: var(--shadow-xs); }
.tarea.activa { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 10%, transparent); }
.t-cuerpo { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.t-plu { font-size: 15px; font-weight: 700; color: var(--ink); }
.t-desc { font-size: 12.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-meta { font-size: 11.5px; color: var(--faint); }
.t-der { flex-shrink: 0; text-align: right; }
.t-crono { font-family: var(--display); font-size: 15px; font-weight: 700; color: var(--brand); }
/* Lo que lleva esperando gourmet: en ambar, porque es deuda, no trabajo hecho. */
.t-espera { font-size: 11.5px; color: var(--u-aviso); }

.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: rgba(10,15,28,.55); backdrop-filter: blur(3px); }
.modal { width: min(560px, 100%); max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.m-head { display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--border); }
.m-head > div { flex: 1; min-width: 0; }
.m-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.m-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-crono { font-family: var(--display); font-size: 18px; font-weight: 800; color: var(--brand); }
.m-body { overflow-y: auto; padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 16px; }

.paso { padding: 14px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); }
.paso.hecho { border-color: color-mix(in srgb, var(--brand) 35%, var(--border)); background: var(--brand-tint); }
.paso.off { opacity: .55; }
.p-title { display: flex; align-items: center; gap: 7px; margin: 0 0 10px; font-size: 12.5px; font-weight: 700; color: var(--muted); }
.p-form { display: flex; gap: 10px; }
.p-form .field { flex: 1; }
.grande { height: 46px; font-size: 17px; }
.p-ok { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; font-weight: 600; color: var(--brand); }
.p-bloq { margin: 9px 0 0; font-size: 12px; color: var(--faint); }

.p-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.f-btn { grid-column: 1 / -1; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.hint { font-size: 11px; color: var(--faint); }
.submit { width: 100%; height: 44px; }

.otras { padding-top: 4px; border-top: 1px dashed var(--border-strong); }
.otras-acc { display: flex; flex-wrap: wrap; gap: 16px; }
.dev-nota { display: block; margin-top: 2px; font-size: 11px; font-weight: 500; color: var(--u-critico); }
.dev-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; background: none; border: none; padding: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; }
.dev-link:hover { color: var(--u-aviso); }
.dev-motivos { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.dev-btn { padding: 9px 12px; text-align: left; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; }
.dev-btn:hover:not(.on) { color: var(--ink-2); border-color: var(--faint); }
.dev-btn.on { background: var(--u-aviso-tint); border-color: var(--u-aviso); color: var(--ink); }
.dev-detalle { margin-bottom: 10px; }
.dev-acc { display: flex; gap: 9px; justify-content: flex-end; }
.dev-ok { border-color: var(--u-aviso); color: var(--u-aviso); }

@media (max-width: 560px) {
  .p-grid { grid-template-columns: 1fr; }
  .p-form { flex-direction: column; }
  .m-body :deep(.field) { height: 44px; font-size: 16px; }
}
</style>

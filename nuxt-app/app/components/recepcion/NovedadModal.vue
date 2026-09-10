<script setup lang="ts">
// Reportes del contenedor: faltantes/sobrantes, averías y mercancía maltratada.
//
// Se levantan DESPUÉS de cerrar y no cuentan tiempo. La descripción sale del
// maestro al escribir el PLU: escribirla a mano acabaría con tres formas
// distintas de nombrar el mismo producto en el mismo reporte.
import { ref, computed, watch, nextTick } from 'vue'
import { X, Plus, Camera, Trash2, TriangleAlert } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { useToast } from '~/composables/useToast'
import {
  exigeFoto, TIPO_NOVEDAD_RECEPCION_LABEL, TIPOS_NOVEDAD_RECEPCION,
  type Recepcion, type TipoNovedadRecepcion,
} from '~/utils/recepcion'

const props = defineProps<{ recepcion: Recepcion; guardando: boolean }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'agregar', payload: {
    tipo: TipoNovedadRecepcion; plu: string; cantidad: number
    fotoUrl: string | null; observacion: string | null
  }): void
  (e: 'quitar', novedadId: string): void
}>()

const { show: showToast } = useToast()

const tipo = ref<TipoNovedadRecepcion>('FALTANTE')
const plu = ref('')
const cantidad = ref('')
const observacion = ref('')
const fotoUrl = ref<string | null>(null)
const subiendo = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Lookup en el maestro, igual que en el resto de módulos: 350 ms de debounce
// para no disparar una consulta por tecla.
const descripcion = ref('')
const buscando = ref(false)
const buscar = useDebounceFn(async () => {
  const codigo = plu.value.trim()
  if (!codigo) { descripcion.value = ''; return }
  buscando.value = true
  try {
    const res = await $fetch<{ data: { descripcion: string | null } | null }>(
      '/api/productos-maestro/buscar', { query: { codigo } },
    )
    descripcion.value = res.data?.descripcion ?? ''
  } catch {
    descripcion.value = ''
  } finally {
    buscando.value = false
  }
}, 350)
watch(plu, () => { descripcion.value = ''; void buscar() })

// Al cambiar de tipo se limpia la foto: la de una avería no vale como prueba de
// un faltante, y arrastrarla sin querer falsearía el reporte.
watch(tipo, () => { fotoUrl.value = null })

const necesitaFoto = computed(() => exigeFoto(tipo.value))
const puedeAgregar = computed(() =>
  !props.guardando && !subiendo.value
  && plu.value.trim().length > 0
  && descripcion.value.length > 0
  && Number(cantidad.value) >= 1
  && (!necesitaFoto.value || Boolean(fotoUrl.value)),
)

async function subirFoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  subiendo.value = true
  try {
    const fd = new FormData()
    fd.append('foto', file)
    const res = await $fetch<{ url: string }>('/api/uploads/foto', { method: 'POST', body: fd })
    fotoUrl.value = res.url
  } catch (err) {
    showToast(apiErr(err, 'No se pudo subir la foto'), true)
  } finally {
    subiendo.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function agregar() {
  if (!puedeAgregar.value) return
  emit('agregar', {
    tipo: tipo.value,
    plu: plu.value.trim(),
    cantidad: Number(cantidad.value),
    fotoUrl: fotoUrl.value,
    observacion: observacion.value.trim() || null,
  })
  plu.value = ''
  cantidad.value = ''
  observacion.value = ''
  fotoUrl.value = ''
  fotoUrl.value = null
  descripcion.value = ''
  void nextTick(() => pluInput.value?.focus())
}

const pluInput = ref<HTMLInputElement | null>(null)

// Agrupadas por tipo: el operario piensa en "el reporte de averías", no en una
// lista plana de líneas sueltas.
const porTipo = computed(() =>
  TIPOS_NOVEDAD_RECEPCION.map((t) => ({
    tipo: t,
    lineas: props.recepcion.novedades.filter((n) => n.tipo === t),
  })).filter((g) => g.lineas.length > 0),
)
</script>

<template>
  <div class="overlay" @click.self="emit('cerrar')">
    <section class="modal card" role="dialog" aria-modal="true">
      <header class="head">
        <div>
          <h2 class="title">Reportes del contenedor</h2>
          <p class="sub mono">{{ recepcion.numeroPedido }} · {{ recepcion.proveedor }}</p>
        </div>
        <button class="x" aria-label="Cerrar" @click="emit('cerrar')"><X :size="18" /></button>
      </header>

      <div class="cuerpo">
        <!-- Alta de una línea -->
        <div class="alta">
          <div class="tipos">
            <button
              v-for="t in TIPOS_NOVEDAD_RECEPCION" :key="t" type="button" class="tipo-btn"
              :class="{ on: tipo === t }" @click="tipo = t"
            >
              {{ TIPO_NOVEDAD_RECEPCION_LABEL[t] }}
            </button>
          </div>

          <div class="campos">
            <label class="f f-plu">
              <span class="lbl">PLU</span>
              <input
                ref="pluInput" v-model="plu" class="field mono" placeholder="Escanea o escribe"
                autocomplete="off" inputmode="numeric" :disabled="guardando"
              >
            </label>
            <div class="f f-desc">
              <span class="lbl">Descripción</span>
              <div class="desc-box" :class="{ vacia: !descripcion }">
                <Spinner v-if="buscando" :size="13" />
                <span v-else-if="descripcion">{{ descripcion }}</span>
                <span v-else-if="plu.trim()">El PLU no existe en el maestro</span>
                <span v-else>Se completa sola</span>
              </div>
            </div>
            <label class="f f-cant">
              <span class="lbl">Cantidad</span>
              <input v-model="cantidad" class="field tnum" type="number" min="1" inputmode="numeric" :disabled="guardando">
            </label>
          </div>

          <div class="campos">
            <label class="f f-obs">
              <span class="lbl">Observación (opcional)</span>
              <input v-model="observacion" class="field" maxlength="500" :disabled="guardando">
            </label>

            <!-- La foto es la prueba con la que se le reclama al proveedor: sin
                 ella un reporte de avería no sirve para nada. -->
            <div v-if="necesitaFoto" class="f f-foto">
              <span class="lbl">Foto <b class="req">obligatoria</b></span>
              <div class="foto-row">
                <button type="button" class="btn btn-sm" :disabled="subiendo" @click="fileInput?.click()">
                  <Spinner v-if="subiendo" :size="13" /><Camera v-else :size="13" />
                  {{ fotoUrl ? 'Cambiar' : 'Tomar foto' }}
                </button>
                <a v-if="fotoUrl" :href="fotoUrl" target="_blank" rel="noopener" class="foto-link">Ver</a>
                <input
                  ref="fileInput" type="file" accept="image/*" capture="environment"
                  class="oculto" @change="subirFoto"
                >
              </div>
            </div>
          </div>

          <div class="alta-acc">
            <span v-if="necesitaFoto && !fotoUrl" class="aviso">
              <TriangleAlert :size="12" /> {{ TIPO_NOVEDAD_RECEPCION_LABEL[tipo] }} necesita foto
            </span>
            <button class="btn btn-primary" :disabled="!puedeAgregar" @click="agregar">
              <Spinner v-if="guardando" :size="14" /><Plus v-else :size="14" />
              Añadir al reporte
            </button>
          </div>
        </div>

        <!-- Lo ya reportado -->
        <div v-if="porTipo.length" class="listas">
          <section v-for="g in porTipo" :key="g.tipo" class="grupo">
            <h3 class="g-title">
              {{ TIPO_NOVEDAD_RECEPCION_LABEL[g.tipo] }}
              <span class="g-n tnum">{{ g.lineas.length }}</span>
            </h3>
            <ul class="lineas">
              <li v-for="l in g.lineas" :key="l.id" class="linea">
                <b class="mono l-plu">{{ l.plu }}</b>
                <span class="l-desc">{{ l.descripcion }}</span>
                <b class="tnum l-cant">{{ l.cantidad }}</b>
                <a v-if="l.fotoUrl" :href="l.fotoUrl" target="_blank" rel="noopener" class="l-foto">
                  <Camera :size="13" />
                </a>
                <button class="l-del" title="Quitar" @click="emit('quitar', l.id)">
                  <Trash2 :size="13" />
                </button>
              </li>
            </ul>
          </section>
        </div>
        <p v-else class="sin-nov">Este contenedor no tiene reportes todavía.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10, 15, 28, .55); backdrop-filter: blur(3px); }
.modal { width: min(760px, 100%); max-height: 88vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; }

.head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.title { margin: 0; font-family: var(--display); font-size: 17px; font-weight: 700; color: var(--ink); }
.sub { margin: 3px 0 0; font-size: 12px; color: var(--muted); }
.x { margin-left: auto; background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px; border-radius: var(--r-xs); }
.x:hover { background: var(--surface-3); color: var(--ink); }

.cuerpo { overflow-y: auto; padding: 16px 18px 18px; }

.alta { padding: 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); }
.tipos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 13px; }
.tipo-btn { padding: 6px 12px; border: 1px solid var(--border-strong); border-radius: var(--r-pill); background: var(--surface); font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; transition: background .14s, color .14s, border-color .14s; }
.tipo-btn:hover:not(.on) { color: var(--ink-2); border-color: var(--faint); }
.tipo-btn.on { background: var(--brand); border-color: transparent; color: var(--on-brand); }

.campos { display: grid; grid-template-columns: 130px 1fr 110px; gap: 11px; margin-bottom: 11px; }
.campos:last-of-type { grid-template-columns: 1fr auto; margin-bottom: 0; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.req { color: var(--u-aviso); }
.desc-box { display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 11px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); font-size: 13px; color: var(--ink-2); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.desc-box.vacia { color: var(--faint); }
.foto-row { display: flex; align-items: center; gap: 9px; height: 38px; }
.foto-link { font-size: 12.5px; color: var(--brand); }
.oculto { display: none; }

.alta-acc { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 13px; }
.aviso { display: inline-flex; align-items: center; gap: 5px; margin-right: auto; font-size: 12px; color: var(--u-aviso); }

.listas { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.g-title { display: flex; align-items: center; gap: 8px; margin: 0 0 7px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.g-n { padding: 1px 7px; border-radius: var(--r-pill); background: var(--surface-3); color: var(--ink-2); font-size: 11px; }
.lineas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.linea { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--r-sm); margin-bottom: 5px; background: var(--surface); }
.l-plu { font-size: 12.5px; color: var(--ink); flex-shrink: 0; }
.l-desc { flex: 1; font-size: 12.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.l-cant { font-size: 13px; color: var(--ink); flex-shrink: 0; }
.l-foto { color: var(--brand); display: inline-flex; flex-shrink: 0; }
.l-del { background: none; border: none; color: var(--muted); cursor: pointer; padding: 3px; border-radius: var(--r-xs); flex-shrink: 0; }
.l-del:hover { color: var(--u-critico); background: color-mix(in srgb, var(--u-critico) 10%, transparent); }
.sin-nov { margin: 16px 0 0; font-size: 12.5px; color: var(--faint); text-align: center; }

@media (max-width: 700px) {
  .campos, .campos:last-of-type { grid-template-columns: 1fr; }
  .modal { max-height: 94vh; }
}
</style>

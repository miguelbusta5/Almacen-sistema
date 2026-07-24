<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, Calendar, Pencil, Trash2, CheckCircle2, RotateCcw, Link2 } from '@lucide/vue'
import {
  alertaTier, ALERTA_TIER_LABEL, TIER_COLOR, parseEntrega, fmtFecha,
  type Guardado, type ContactoGuardado,
} from '~/utils/guardado'

const props = defineProps<{ g: Guardado; contactos: ContactoGuardado[]; canEdit?: boolean; canDelete?: boolean; busy?: string | null }>()
const emit = defineEmits<{
  (e: 'back'): void; (e: 'despachar'): void; (e: 'editFecha'): void
  (e: 'edit'): void; (e: 'del'): void; (e: 'revertir'): void; (e: 'nuevoContacto'): void
}>()

const despachado = computed(() => props.g.estado === 'DESPACHADO')
const entrega = computed(() => parseEntrega(props.g.nota))
const tier = computed(() => alertaTier(props.g))

const detalle = computed(() => [
  { label: 'Fecha ingreso', value: fmtFecha(props.g.fecha) },
  { label: 'Cliente', value: props.g.clienteNombre || '—' },
  { label: 'Documento cliente', value: props.g.clienteDocumento || '—' },
  { label: 'Tienda', value: props.g.codigoTienda ? `${props.g.codigoTienda} — ${props.g.nombreTienda}` : 'Sin asignar' },
  { label: 'Ciudad destino', value: props.g.ciudad || '—' },
  { label: 'Entrega comprometida', value: entrega.value ? fmtFecha(entrega.value) : 'Sin asignar' },
  { label: 'Fecha despacho', value: props.g.fechaDespacho ? fmtFecha(props.g.fechaDespacho) : '—' },
])
</script>

<template>
  <div class="detail fade-in">
    <button class="btn btn-ghost btn-sm back" @click="emit('back')"><ArrowLeft :size="15" /> Volver a la lista</button>

    <header class="dhead card">
      <div class="dhead-main">
        <div class="dtitle-row">
          <h1 class="mono">{{ g.documento }}</h1>
          <Badge
            :label="despachado ? 'Despachado' : ALERTA_TIER_LABEL[tier]"
            :tone="despachado ? 'var(--u-ok)' : TIER_COLOR[tier]" solid
          />
          <Badge :label="g.tipo === 'ECOMMERCE' ? 'Ecommerce' : 'Común'" :tone="g.tipo === 'ECOMMERCE' ? 'var(--info)' : 'var(--muted)'" />
        </div>
        <div class="dsub">{{ g.ubicacion }}</div>
      </div>
      <div class="dactions">
        <button v-if="!despachado" class="btn btn-sm" :disabled="!!busy" @click="emit('editFecha')"><Calendar :size="14" /> Fecha</button>
        <button v-if="canEdit" class="btn btn-sm" :disabled="!!busy" @click="emit('edit')"><Pencil :size="14" /> Editar</button>
        <button v-if="canDelete" class="btn btn-danger btn-sm" :disabled="!!busy" @click="emit('del')">
          <Spinner v-if="busy === 'del'" /><Trash2 v-else :size="14" />
        </button>
        <button v-if="!despachado" class="btn btn-primary" :disabled="!!busy" @click="emit('despachar')">
          <Spinner v-if="busy === 'despachar'" :size="15" /><CheckCircle2 v-else :size="15" />
          {{ busy === 'despachar' ? 'Enviando…' : 'Marcar como enviado' }}
        </button>
        <button v-else-if="canDelete" class="btn btn-sm rev" :disabled="!!busy" @click="emit('revertir')">
          <Spinner v-if="busy === 'revertir'" /><RotateCcw v-else :size="14" />
          {{ busy === 'revertir' ? 'Revirtiendo…' : 'Revertir' }}
        </button>
      </div>
    </header>

    <div class="grid">
      <div class="col">
        <StorageMeter :fecha="g.fecha" :end-date="despachado ? g.fechaDespacho : null" mode="full" />

        <section class="sec card">
          <h3>Detalle</h3>
          <div class="dgrid">
            <div v-for="d in detalle" :key="d.label" class="ditem">
              <span class="dlabel">{{ d.label }}</span>
              <span class="dvalue">{{ d.value }}</span>
            </div>
            <div class="ditem">
              <span class="dlabel">ID NetSuite</span>
              <span class="dvalue">
                <span v-if="g.netsuiteId" class="ns mono"><Link2 :size="12" /> NS:{{ g.netsuiteId }}</span>
                <span v-else class="faint">Sin vincular</span>
              </span>
            </div>
          </div>
        </section>

        <section v-if="g.nota" class="sec card">
          <h3>Nota</h3>
          <p class="nota">{{ g.nota }}</p>
        </section>
      </div>

      <div class="col side card">
        <ContactTimeline :contactos="contactos" @nuevo="emit('nuevoContacto')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.back { margin-bottom: 14px; }
/* Entrada escalonada de las piezas del detalle */
.dhead, .col > * { animation: dEnter .42s cubic-bezier(.16,1,.3,1) both; }
.dhead { animation-delay: .02s; }
.col:first-child > *:nth-child(1) { animation-delay: .08s; }
.col:first-child > *:nth-child(2) { animation-delay: .14s; }
.col:first-child > *:nth-child(3) { animation-delay: .20s; }
.col.side { animation-delay: .16s; }
@keyframes dEnter { from { opacity: 0; transform: translateY(12px); } }
.dhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; margin-bottom: 16px; flex-wrap: wrap; }
.dtitle-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dhead h1 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
.dsub { font-size: 13px; color: var(--muted); margin-top: 5px; }
.dactions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.rev { color: var(--u-aviso); border-color: var(--u-aviso); }
.grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.sec { padding: 16px 18px; }
.side { padding: 18px 20px; }
.sec h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 12px; }
.dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
.ditem { display: flex; flex-direction: column; gap: 3px; }
.dlabel { font-size: 11px; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: .04em; }
.dvalue { font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.ns { display: inline-flex; align-items: center; gap: 5px; color: var(--info); background: var(--info-tint); padding: 2px 8px; border-radius: var(--r-pill); font-size: 12px; }
.faint { color: var(--faint); font-weight: 500; }
.nota { font-size: 13px; color: var(--muted); line-height: 1.55; margin: 0; }
@media (max-width: 940px) { .grid { grid-template-columns: 1fr; } }
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, Pencil, Trash2, PackageCheck, Send, TriangleAlert, XCircle, RotateCcw, UserPlus, Link2 } from '@lucide/vue'
import {
  ESTADO_LABEL, ESTADO_TONE, FLUJO_ESTADOS, pasoEnFlujo, fmtFecha,
  rolPuedeTransicionar, puedeAsignarGuardado, puedeRevertir, type Despacho,
} from '~/utils/despacho'

interface HistorialEntry { action: string; details: string | null; userName: string | null; createdAt: string }

const props = defineProps<{ d: Despacho; historial: HistorialEntry[]; role: string; canDelete: boolean; busy?: string | null }>()
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'transicion', destino: string): void
  (e: 'rechazar'): void
  (e: 'novedad'): void
  (e: 'asignarGuardado'): void
  (e: 'revertir'): void
  (e: 'edit'): void
  (e: 'del'): void
}>()

const paso = computed(() => pasoEnFlujo(props.d.estado))
const esRechazado = computed(() => props.d.estado === 'RECHAZADO')
const esNovedad = computed(() => props.d.estado === 'CON_NOVEDAD')
// "En CEDI" = estado canónico ENTREGADO_CEDI o el legado RECOGIDO_TIENDA.
const enCedi = computed(() => props.d.estado === 'ENTREGADO_CEDI' || props.d.estado === 'RECOGIDO_TIENDA')

// Fecha del evento de la rama alternativa (rechazo o novedad).
const sevFecha = computed(() => {
  const iso = esRechazado.value ? props.d.rechazadoAt : esNovedad.value ? props.d.novedadAt : null
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
})

function puede(destino: string) { return rolPuedeTransicionar(props.role, props.d.estado, destino as any) }
// Spinner en el botón de transición que está en curso (busy = 'transicion:DESTINO').
function enCurso(destino: string) { return props.busy === `transicion:${destino}` }

const detalle = computed(() => [
  { label: 'Centro de costos', value: props.d.centroCostos },
  { label: 'Cliente', value: props.d.clienteNombre },
  { label: 'Documento cliente', value: props.d.clienteDocumento || '—' },
  { label: 'Teléfono cliente', value: props.d.clienteTelefono || '—' },
  { label: 'Ciudad destino', value: props.d.ciudad || '—' },
  { label: 'Dirección entrega', value: props.d.direccionEntrega || '—' },
  { label: 'Entrega comprometida', value: props.d.fechaEntregaComprometida ? fmtFecha(props.d.fechaEntregaComprometida) : 'Sin asignar' },
  { label: 'Cajas', value: String(props.d.numeroCajas ?? '—') },
])
</script>

<template>
  <div class="detail fade-in">
    <button class="btn btn-ghost btn-sm back" @click="emit('back')"><ArrowLeft :size="15" /> Volver a la lista</button>

    <header class="dhead card">
      <div class="dhead-main">
        <div class="dtitle-row">
          <h1 class="mono">{{ d.numeroDocumento }}</h1>
          <Badge :label="ESTADO_LABEL[d.estado]" :tone="ESTADO_TONE[d.estado]" solid />
        </div>
        <div class="dsub">{{ d.consecutivo }} · {{ d.centroCostos }}</div>
      </div>
      <div class="dactions">
        <button v-if="canDelete" class="btn btn-sm" :disabled="!!busy" @click="emit('edit')"><Pencil :size="14" /> Editar</button>
        <button v-if="canDelete" class="btn btn-danger btn-sm" :disabled="!!busy" @click="emit('del')">
          <Spinner v-if="busy === 'del'" /><Trash2 v-else :size="14" />
        </button>

        <button v-if="esRechazado && puede('CREADO_TIENDA')" class="btn btn-primary btn-sm" :disabled="!!busy" @click="emit('transicion', 'CREADO_TIENDA')">
          <Spinner v-if="enCurso('CREADO_TIENDA')" /><Send v-else :size="14" />
          {{ enCurso('CREADO_TIENDA') ? 'Reenviando…' : 'Reenviar' }}
        </button>
        <button v-if="d.estado === 'CREADO_TIENDA' && puede('ENTREGADO_CEDI')" class="btn btn-primary btn-sm" :disabled="!!busy" @click="emit('transicion', 'ENTREGADO_CEDI')">
          <Spinner v-if="enCurso('ENTREGADO_CEDI')" /><PackageCheck v-else :size="14" />
          {{ enCurso('ENTREGADO_CEDI') ? 'Guardando…' : 'Marcar en CEDI' }}
        </button>
        <button v-if="d.estado === 'CREADO_TIENDA' && puede('RECHAZADO')" class="btn btn-sm rej" :disabled="!!busy" @click="emit('rechazar')">
          <XCircle :size="14" /> Rechazar
        </button>
        <button v-if="enCedi && puede('ENVIADO_CLIENTE')" class="btn btn-primary btn-sm" :disabled="!!busy" @click="emit('transicion', 'ENVIADO_CLIENTE')">
          <Spinner v-if="enCurso('ENVIADO_CLIENTE')" /><Send v-else :size="14" />
          {{ enCurso('ENVIADO_CLIENTE') ? 'Enviando…' : 'Enviar al cliente' }}
        </button>
        <button v-if="enCedi && puedeAsignarGuardado(role) && !d.guardadoPendiente" class="btn btn-sm" :disabled="!!busy" @click="emit('asignarGuardado')">
          <UserPlus :size="14" /> Asignar guardado
        </button>
        <button v-if="!esNovedad && d.estado !== 'ENVIADO_CLIENTE' && rolPuedeTransicionar(role, d.estado, 'CON_NOVEDAD')" class="btn btn-sm nov" :disabled="!!busy" @click="emit('novedad')">
          <TriangleAlert :size="14" /> Marcar novedad
        </button>
        <button v-if="puedeRevertir(role) && d.estado !== 'CREADO_TIENDA' && !d.guardadoPendiente" class="btn btn-sm rev" :disabled="!!busy" @click="emit('revertir')">
          <Spinner v-if="busy === 'revertir'" /><RotateCcw v-else :size="14" />
          {{ busy === 'revertir' ? 'Revirtiendo…' : 'Revertir' }}
        </button>
      </div>
    </header>

    <div class="grid">
      <div class="col">
        <!-- Pipeline visual -->
        <section class="sec card">
          <h3>Flujo</h3>
          <div v-if="paso >= 0" class="flujo">
            <div v-for="(e, i) in FLUJO_ESTADOS" :key="e" class="fstep" :class="{ done: i < paso, active: i === paso }">
              <span class="fdot" />
              <span class="flabel-step">{{ ESTADO_LABEL[e] }}</span>
            </div>
          </div>
          <!-- Rama alternativa (rechazado / con novedad): tarjeta de severidad
               con la rampa de urgencia, en vez de badge + texto gris. -->
          <div v-else class="sev" :style="{ '--c': ESTADO_TONE[d.estado] }">
            <span class="sev-ic">
              <XCircle v-if="esRechazado" :size="18" />
              <TriangleAlert v-else :size="18" />
            </span>
            <div class="sev-body">
              <div class="sev-top">
                <span class="sev-title">{{ ESTADO_LABEL[d.estado] }}</span>
                <span v-if="sevFecha" class="sev-date mono">{{ sevFecha }}</span>
              </div>
              <p v-if="esRechazado && d.motivoRechazo" class="sev-msg">{{ d.motivoRechazo }}</p>
              <p v-else-if="esNovedad && d.novedad" class="sev-msg">{{ d.novedad }}</p>
              <p v-else class="sev-msg faint">Sin detalle registrado.</p>
              <span class="sev-hint">{{ esRechazado ? 'La tienda puede corregir y reenviar la factura.' : 'Resolver la novedad para retomar el flujo.' }}</span>
            </div>
          </div>
        </section>

        <section class="sec card">
          <h3>Detalle</h3>
          <div class="dgrid">
            <div v-for="item in detalle" :key="item.label" class="ditem">
              <span class="dlabel">{{ item.label }}</span>
              <span class="dvalue">{{ item.value }}</span>
            </div>
            <div class="ditem">
              <span class="dlabel">ID NetSuite</span>
              <span class="dvalue">
                <span v-if="d.netsuiteId" class="ns mono"><Link2 :size="12" /> NS:{{ d.netsuiteId }}</span>
                <span v-else class="faint">Sin vincular</span>
              </span>
            </div>
          </div>
        </section>

        <section v-if="d.plines.length" class="sec card">
          <h3>Productos</h3>
          <table class="plu-tbl">
            <thead><tr><th>PLU</th><th>Descripción</th><th>Unidades</th></tr></thead>
            <tbody>
              <tr v-for="p in d.plines" :key="p.id">
                <td class="mono">{{ p.plu }}</td>
                <td>{{ p.descripcion || '—' }}</td>
                <td>{{ p.unidades }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-if="d.notaEntrega" class="sec card">
          <h3>Nota</h3>
          <p class="nota">{{ d.notaEntrega }}</p>
        </section>

        <section v-if="d.guardadoPendiente" class="sec card">
          <h3>Guardado asignado</h3>
          <p class="nota">Asignado a <b>{{ d.guardadoPendiente.asignadoANombre }}</b> · estado {{ d.guardadoPendiente.estado }}</p>
        </section>
      </div>

      <div class="col side card">
        <h3>Historial</h3>
        <ul v-if="historial.length" class="hist">
          <li v-for="(h, i) in historial" :key="i" class="hitem">
            <div class="hdot" />
            <div>
              <div class="haction">{{ h.details || h.action }}</div>
              <div class="hmeta">{{ h.userName || 'Sistema' }} · {{ new Date(h.createdAt).toLocaleString('es-CO') }}</div>
            </div>
          </li>
        </ul>
        <p v-else class="faint">Sin actividad registrada aún.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.back { margin-bottom: 14px; }
.dhead, .col > * { animation: dEnter .42s cubic-bezier(.16,1,.3,1) both; }
.dhead { animation-delay: .02s; }
.col:first-child > *:nth-child(1) { animation-delay: .08s; }
.col:first-child > *:nth-child(2) { animation-delay: .14s; }
.col:first-child > *:nth-child(3) { animation-delay: .20s; }
.col:first-child > *:nth-child(4) { animation-delay: .26s; }
.col:first-child > *:nth-child(5) { animation-delay: .32s; }
.col.side { animation-delay: .16s; }
@keyframes dEnter { from { opacity: 0; transform: translateY(12px); } }
.dhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; margin-bottom: 16px; flex-wrap: wrap; }
.dtitle-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dhead h1 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
.dsub { font-size: 13px; color: var(--muted); margin-top: 5px; }
.dactions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.rev { color: var(--u-aviso); border-color: var(--u-aviso); }
.rej { color: var(--u-critico); border-color: var(--u-critico); }
.nov { color: var(--u-critico); border-color: var(--u-critico); }
.grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.sec { padding: 16px 18px; }
.side { padding: 18px 20px; }
.sec h3, .side h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 12px; }
.dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
.ditem { display: flex; flex-direction: column; gap: 3px; }
.dlabel { font-size: 11px; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: .04em; }
.dvalue { font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.ns { display: inline-flex; align-items: center; gap: 5px; color: var(--info); background: var(--info-tint); padding: 2px 8px; border-radius: var(--r-pill); font-size: 12px; }
.faint { color: var(--faint); font-weight: 500; }
.nota { font-size: 13px; color: var(--muted); line-height: 1.55; margin: 0; }

.flujo { display: flex; align-items: center; gap: 8px; }
.fstep { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; }
.fstep::before { content: ''; position: absolute; top: 5px; left: -50%; width: 100%; height: 2px; background: var(--border); z-index: 0; }
.fstep:first-child::before { display: none; }
.fstep.done::before { background: var(--u-ok); }
.fdot { width: 12px; height: 12px; border-radius: 50%; background: var(--border-strong); z-index: 1; }
.fstep.done .fdot { background: var(--u-ok); }
.fstep.active .fdot { background: var(--brand); box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 22%, transparent); }
.flabel-step { font-size: 10.5px; font-weight: 600; color: var(--muted); text-align: center; }
.fstep.active .flabel-step { color: var(--ink); font-weight: 700; }
/* Tarjeta de severidad (rechazado / con novedad) */
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
.sev-msg.faint { color: var(--faint); }
.sev-hint { display: block; font-size: 11.5px; color: var(--muted); margin-top: 7px; }

.plu-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.plu-tbl th { text-align: left; padding: 6px 8px; color: var(--faint); font-weight: 700; text-transform: uppercase; font-size: 10.5px; border-bottom: 1px solid var(--border); }
.plu-tbl td { padding: 7px 8px; border-bottom: 1px solid var(--border); }
.plu-tbl tr:last-child td { border-bottom: none; }

.hist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.hitem { display: flex; gap: 10px; }
.hdot { width: 8px; height: 8px; border-radius: 50%; background: var(--brand); margin-top: 5px; flex-shrink: 0; }
.haction { font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.hmeta { font-size: 11px; color: var(--faint); margin-top: 2px; }
@media (max-width: 940px) { .grid { grid-template-columns: 1fr; } }
</style>

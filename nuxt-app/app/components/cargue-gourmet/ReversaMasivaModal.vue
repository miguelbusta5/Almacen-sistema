<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, X } from '@lucide/vue'
import { ESTADO_LABEL, ESTADO_TONE, type PedidoGourmet } from '~/utils/gourmet'

// Reversa masiva (solo ADMIN): devuelve pedidos completados por error a un
// estado operativo anterior, a elección. Misma estructura de selección que
// CargueMasivoModal + un selector de estado destino.
const props = defineProps<{ items: PedidoGourmet[]; saving?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'confirm', ids: string[], destino: string): void }>()

const q = ref('')
const filtrados = computed(() => {
  const query = q.value.trim().toLowerCase()
  if (!query) return props.items
  return props.items.filter((p) => p.orden.toLowerCase().includes(query) || p.nombreTienda.toLowerCase().includes(query))
})

const seleccionados = ref<Set<string>>(new Set())
function toggle(id: string) {
  if (seleccionados.value.has(id)) seleccionados.value.delete(id)
  else seleccionados.value.add(id)
  // Set no es reactivo por referencia — se fuerza el trigger con una copia.
  seleccionados.value = new Set(seleccionados.value)
}
const todosSeleccionados = computed(() => filtrados.value.length > 0 && filtrados.value.every((p) => seleccionados.value.has(p.id)))
function toggleTodos() {
  const next = new Set(seleccionados.value)
  if (todosSeleccionados.value) filtrados.value.forEach((p) => next.delete(p.id))
  else filtrados.value.forEach((p) => next.add(p.id))
  seleccionados.value = next
}

const destino = ref<'EN_CARGUE' | 'ANTES_DEL_CARGUE' | 'BORRADOR'>('EN_CARGUE')
const DESTINOS = [
  {
    v: 'EN_CARGUE' as const,
    t: 'En cargue (reabrir el cargue)',
    d: 'Reabre el último cargue con todos sus escaneos intactos — como si nunca se hubiera finalizado. No se pierde nada.',
  },
  {
    v: 'ANTES_DEL_CARGUE' as const,
    t: 'Antes del cargue (ubicación asignada)',
    d: 'Descarta el cargue y sus escaneos (igual que "Revertir cargue"). El pedido vuelve a Ubicación asignada (o Enviado a transporte si pasó por ahí).',
  },
  {
    v: 'BORRADOR' as const,
    t: 'Borrador (sin ubicación)',
    d: 'Además de descartar el cargue, limpia la asignación de ubicación. Las estibas y cajas registradas se conservan para reasignar.',
  },
]

function submit() {
  if (props.saving || seleccionados.value.size === 0) return
  emit('confirm', Array.from(seleccionados.value), destino.value)
}
</script>

<template>
  <ModalShell
    title="Reversa masiva" sub="Devuelve pedidos completados por error a un estado anterior — solo ADMIN" wide @close="emit('close')"
  >
    <div class="form">
      <div class="advertencia">
        Esta acción <b>reversa pedidos ya completados</b>. Según el destino elegido puede descartar el historial de
        escaneo de esos cargues. Úsala solo para corregir cierres hechos por error.
      </div>

      <div class="search">
        <Search :size="15" class="search-ic" />
        <input v-model="q" class="field" placeholder="Buscar orden o tienda…">
        <button v-if="q" class="clr" aria-label="Borrar búsqueda" @click="q = ''"><X :size="14" /></button>
      </div>

      <div class="listhead">
        <label class="check-all">
          <input type="checkbox" :checked="todosSeleccionados" :disabled="!filtrados.length" @change="toggleTodos">
          Seleccionar {{ q ? 'resultados' : 'todos' }}
        </label>
        <span class="count mono">{{ seleccionados.size }} de {{ items.length }} seleccionado(s){{ q ? ` · ${filtrados.length} en la búsqueda` : '' }}</span>
      </div>

      <div v-if="!items.length" class="empty">No hay pedidos completados para reversar.</div>
      <div v-else-if="!filtrados.length" class="empty">Sin resultados para "{{ q }}".</div>
      <div v-else class="list">
        <label v-for="p in filtrados" :key="p.id" class="row" :class="{ on: seleccionados.has(p.id) }">
          <input type="checkbox" :checked="seleccionados.has(p.id)" @change="toggle(p.id)">
          <div class="info">
            <div class="doc mono">{{ p.orden }}</div>
            <div class="sub">{{ p.nombreTienda }}</div>
          </div>
          <Badge :label="ESTADO_LABEL[p.estado]" :tone="ESTADO_TONE[p.estado]" />
        </label>
      </div>

      <div class="destinos">
        <div class="destinos-title">Devolver a:</div>
        <label v-for="o in DESTINOS" :key="o.v" class="destino" :class="{ on: destino === o.v }">
          <input v-model="destino" type="radio" :value="o.v" name="destino-reversa">
          <div>
            <div class="destino-t">{{ o.t }}</div>
            <div class="destino-d">{{ o.d }}</div>
          </div>
        </label>
      </div>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="button" class="btn btn-danger" :disabled="saving || !seleccionados.size" @click="submit">
          <Spinner v-if="saving" />{{ saving ? 'Reversando…' : `Reversar ${seleccionados.size || ''} pedido(s)` }}
        </button>
      </div>
    </div>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.advertencia { font-size: 13px; color: var(--u-critico); background: var(--u-critico-tint); border: 1px solid var(--u-critico); border-radius: var(--r-sm); padding: 10px 12px; }
.search { position: relative; }
.search .search-ic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--faint); pointer-events: none; }
.search .field { padding-left: 38px; padding-right: 34px; }
.search:focus-within .search-ic { color: var(--brand); }
.clr {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  display: grid; place-items: center; width: 26px; height: 26px;
  border: none; background: transparent; border-radius: var(--r-xs);
  color: var(--faint); cursor: pointer; transition: color .12s, background .12s;
}
.clr:hover { color: var(--ink-2); background: var(--surface-3); }
.listhead { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.check-all { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
.count { font-size: 12px; color: var(--muted); }
.empty { font-size: 13px; color: var(--faint); text-align: center; padding: 20px 0; }
.list { display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; }
.row {
  display: flex; align-items: center; gap: 10px; padding: 9px 11px;
  border: 1px solid var(--border); border-radius: var(--r-sm); cursor: pointer;
  transition: border-color .14s, background .14s;
}
.row:hover { background: var(--surface-2); }
.row.on { border-color: color-mix(in srgb, var(--brand) 40%, var(--border)); background: var(--brand-tint); }
.info { flex: 1; min-width: 0; }
.doc { font-size: 13px; font-weight: 700; color: var(--ink); }
.sub { font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.destinos { display: flex; flex-direction: column; gap: 6px; }
.destinos-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.destino {
  display: flex; align-items: flex-start; gap: 10px; padding: 9px 11px;
  border: 1px solid var(--border); border-radius: var(--r-sm); cursor: pointer;
  transition: border-color .14s, background .14s;
}
.destino:hover { background: var(--surface-2); }
.destino.on { border-color: color-mix(in srgb, var(--brand) 45%, var(--border)); background: var(--brand-tint); }
.destino input { margin-top: 3px; }
.destino-t { font-size: 13px; font-weight: 700; color: var(--ink); }
.destino-d { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
</style>

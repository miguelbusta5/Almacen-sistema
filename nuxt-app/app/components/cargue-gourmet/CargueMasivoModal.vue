<script setup lang="ts">
import { ref, computed } from 'vue'
import { ESTADO_LABEL, ESTADO_TONE, type PedidoGourmet } from '~/utils/gourmet'

const props = defineProps<{ items: PedidoGourmet[]; saving?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'confirm', ids: string[]): void }>()

const seleccionados = ref<Set<string>>(new Set())
function toggle(id: string) {
  if (seleccionados.value.has(id)) seleccionados.value.delete(id)
  else seleccionados.value.add(id)
  // Set no es reactivo por referencia — se fuerza el trigger con una copia.
  seleccionados.value = new Set(seleccionados.value)
}
const todosSeleccionados = computed(() => props.items.length > 0 && seleccionados.value.size === props.items.length)
function toggleTodos() {
  seleccionados.value = todosSeleccionados.value ? new Set() : new Set(props.items.map((p) => p.id))
}

function submit() {
  if (props.saving || seleccionados.value.size === 0) return
  emit('confirm', Array.from(seleccionados.value))
}
</script>

<template>
  <ModalShell
    title="Cargue masivo" sub="Completa varios pedidos sin verificar cajas — solo ADMIN" wide @close="emit('close')"
  >
    <div class="form">
      <div class="advertencia">
        Esta acción marca los pedidos seleccionados como <b>Cargue completo (manual)</b> sin pasar por el escaneo de
        cajas. Úsala solo cuando la verificación física ya se hizo por fuera del sistema.
      </div>

      <div class="listhead">
        <label class="check-all">
          <input type="checkbox" :checked="todosSeleccionados" :disabled="!items.length" @change="toggleTodos">
          Seleccionar todos
        </label>
        <span class="count mono">{{ seleccionados.size }} de {{ items.length }} seleccionado(s)</span>
      </div>

      <div v-if="!items.length" class="empty">No hay pedidos pendientes de completar.</div>
      <div v-else class="list">
        <label v-for="p in items" :key="p.id" class="row" :class="{ on: seleccionados.has(p.id) }">
          <input type="checkbox" :checked="seleccionados.has(p.id)" @change="toggle(p.id)">
          <div class="info">
            <div class="doc mono">{{ p.orden }}</div>
            <div class="sub">{{ p.nombreTienda }}</div>
          </div>
          <Badge :label="ESTADO_LABEL[p.estado]" :tone="ESTADO_TONE[p.estado]" />
        </label>
      </div>

      <div class="factions">
        <button type="button" class="btn" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button type="button" class="btn btn-danger" :disabled="saving || !seleccionados.size" @click="submit">
          <Spinner v-if="saving" />{{ saving ? 'Completando…' : `Completar ${seleccionados.size || ''} pedido(s)` }}
        </button>
      </div>
    </div>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.advertencia { font-size: 13px; color: var(--u-aviso); background: var(--u-aviso-tint); border: 1px solid var(--u-aviso); border-radius: var(--r-sm); padding: 10px 12px; }
.listhead { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.check-all { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
.count { font-size: 12px; color: var(--muted); }
.empty { font-size: 13px; color: var(--faint); text-align: center; padding: 20px 0; }
.list { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; }
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
.factions { position: sticky; bottom: 0; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--surface) 40%); }
.factions .btn { justify-content: center; }
</style>

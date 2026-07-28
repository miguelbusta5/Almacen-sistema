<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { Pencil, KeyRound } from '@lucide/vue'
import { fmtFechaUsuario, labelRol, toneRol, type Usuario } from '~/utils/usuarios'

defineProps<{ items: Usuario[]; selfId?: string; hasFilters: boolean }>()
const emit = defineEmits<{ (e: 'editar', u: Usuario): void }>()

const esCompacto = useMediaQuery('(max-width: 760px)')
</script>

<template>
  <div class="card table-card">
    <table v-if="!esCompacto" class="table">
      <thead>
        <tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Alta</th><th /></tr>
      </thead>
      <tbody>
        <tr v-for="u in items" :key="u.id" :class="{ off: !u.active }">
          <td class="usr">
            <span class="nom">
              {{ u.name }}
              <span v-if="u.id === selfId" class="yo">tú</span>
            </span>
            <span class="mail">{{ u.email }}</span>
          </td>
          <td><Badge :label="labelRol(u.role)" :tone="toneRol(u.role)" /></td>
          <td>
            <Badge
              :label="u.active ? 'Activo' : 'Inactivo'"
              :tone="u.active ? 'var(--u-ok)' : 'var(--faint)'"
            />
            <span v-if="u.mustChangePassword" class="temp" title="Debe cambiar la contraseña en el próximo ingreso">
              <KeyRound :size="11" /> temporal
            </span>
          </td>
          <td class="muted tnum">{{ fmtFechaUsuario(u.createdAt) }}</td>
          <td class="acc">
            <button class="btn-icon" title="Editar" @click="emit('editar', u)"><Pencil :size="13" /></button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else class="cards">
      <article v-for="u in items" :key="u.id" class="rowcard" :class="{ off: !u.active }">
        <header class="rc-top">
          <span class="nom">{{ u.name }}<span v-if="u.id === selfId" class="yo">tú</span></span>
          <Badge :label="u.active ? 'Activo' : 'Inactivo'" :tone="u.active ? 'var(--u-ok)' : 'var(--faint)'" />
        </header>
        <p class="mail">{{ u.email }}</p>
        <div class="rc-bot">
          <Badge :label="labelRol(u.role)" :tone="toneRol(u.role)" />
          <button class="btn btn-sm" @click="emit('editar', u)"><Pencil :size="13" /> Editar</button>
        </div>
      </article>
    </div>

    <EmptyState
      v-if="items.length === 0"
      title="Sin usuarios"
      :description="hasFilters ? 'Ningún usuario con estos filtros.' : 'Crea la primera cuenta.'"
    />
  </div>
</template>

<style scoped>
.table-card { overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 12px 14px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.table td { padding: 11px 14px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--border); vertical-align: middle; }
.table tr:last-child td { border-bottom: none; }
/* Las cuentas desactivadas se atenúan: siguen listadas pero se distinguen de un vistazo. */
.off { opacity: .55; }
.usr { display: flex; flex-direction: column; gap: 1px; }
.nom { color: var(--ink); font-weight: 600; display: flex; align-items: center; gap: 6px; }
.yo { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--brand); background: var(--brand-tint); border-radius: var(--r-pill); padding: 1px 7px; }
.mail { font-size: 12px; color: var(--muted); }
.muted { color: var(--muted); }
.temp { display: inline-flex; align-items: center; gap: 3px; margin-left: 7px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--u-aviso); }
.acc { text-align: right; }
.btn-icon { display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border-radius: var(--r-xs); border: 1px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; font-size: 12px; }
.btn-icon:hover { background: var(--surface-3); color: var(--ink); }

.cards { display: flex; flex-direction: column; }
.rowcard { padding: 13px 14px; border-bottom: 1px solid var(--border); }
.rowcard:last-child { border-bottom: none; }
.rc-top { display: flex; align-items: center; justify-content: space-between; gap: 9px; }
.rc-bot { display: flex; align-items: center; justify-content: space-between; gap: 9px; margin-top: 10px; }
</style>

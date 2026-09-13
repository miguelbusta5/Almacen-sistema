<script setup lang="ts">
// La orden ya existe. No es un error: es el caso de la reasignacion.
//
// El Genie no pudo con un PLU y se lo pasaron verbalmente al del Order Picker,
// que viene a bajarlo. Si aqui solo dijeramos "esa orden ya existe", el operario
// quedaria bloqueado o —peor— se inventaria otro numero de orden, y el trabajo
// acabaria repartido en dos ordenes que nadie sabria juntar despues.
import { Users, X } from '@lucide/vue'

defineProps<{
  choque: { ordenId: string; orden: string; operario: string; equipo: string | null } | null
  guardando: boolean
}>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'unirse'): void }>()
</script>

<template>
  <div v-if="choque" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <header class="m-head">
        <span class="m-ic"><Users :size="17" /></span>
        <button class="m-x" aria-label="Cerrar" @click="emit('cerrar')"><X :size="16" /></button>
      </header>

      <h3 class="m-titulo">La orden {{ choque.orden }} ya está abierta</h3>
      <p class="m-desc">
        La trabaja <strong>{{ choque.operario }}</strong><template v-if="choque.equipo"> con {{ choque.equipo }}</template>.
      </p>

      <p class="m-pregunta">¿Traes PLUs reasignados de esa orden?</p>
      <p class="m-nota">
        Si entras, bajas tus PLUs en la misma orden y el tiempo de cada uno queda a tu nombre.
      </p>

      <footer class="m-pie">
        <button class="btn btn-ghost" :disabled="guardando" @click="emit('cerrar')">No, cancelar</button>
        <button class="btn btn-primary" :disabled="guardando" @click="emit('unirse')">
          Sí, unirme a la orden
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 420px; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.m-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.m-ic { display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--r-sm); color: var(--brand); background: var(--brand-tint); }
.m-x { border: none; background: none; color: var(--muted); cursor: pointer; padding: 4px; border-radius: var(--r-xs); }
.m-x:hover { background: var(--surface-3); color: var(--ink-2); }
.m-titulo { margin: 0 0 4px; font-size: 17px; font-weight: 800; color: var(--ink); }
.m-desc { margin: 0 0 14px; font-size: 13px; color: var(--ink-2); }
.m-pregunta { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: var(--ink); }
.m-nota { margin: 0; font-size: 12px; color: var(--muted); }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
</style>

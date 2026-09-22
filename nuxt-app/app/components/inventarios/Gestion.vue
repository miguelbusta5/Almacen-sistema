<script setup lang="ts">
// Lo que hace Carlos dentro de un cíclico: crearlo, repartir ubicaciones,
// lanzarlo, resolver las diferencias y cerrarlo.
//
// Vive aparte de Panel.vue porque el operario no ve nada de esto, y mezclarlo
// dejaba una sola pantalla con dos trabajos distintos encima.
import { computed, ref } from 'vue'
import { Play, FileDown, Users, TriangleAlert, Check } from '@lucide/vue'
import type { CicloDetalle } from '~/utils/inventario'

const props = defineProps<{
  ciclo: CicloDetalle
  operarios: Array<{ id: string; name: string }>
  guardando: boolean
}>()

const emit = defineEmits<{
  (e: 'accion', accion: string, extra?: Record<string, unknown>): void
  (e: 'descargar'): void
}>()

const asignado = ref('')
const seleccion = ref<string[]>([])
const buscaUbic = ref('')
const elegidos = ref<Record<string, string[]>>({})
const resultados = ref<Record<string, string>>({})
const notas = ref<Record<string, string>>({})

// Con miles de ubicaciones, repartir a ojo es imposible: se filtra y se marca
// lo visible.
const visibles = computed(() => {
  const q = buscaUbic.value.trim().toUpperCase()
  const lista = props.ciclo.ubicaciones
  return q ? lista.filter((t) => t.ubicacion.includes(q)) : lista
})
const varios = (ubicacion: string) => (props.ciclo.esperadosPorUbicacion?.[ubicacion]?.length ?? 0) > 1
const persona = (id: string | null) =>
  props.ciclo.personas.find((p) => p.id === id)?.name
  ?? props.operarios.find((p) => p.id === id)?.name
  ?? 'Sin asignar'

function marcarVisibles() {
  seleccion.value = [...new Set([...seleccion.value, ...visibles.value.map((t) => t.id)])]
}
</script>

<template>
  <div class="gestion">
    <section class="card cabecera">
      <div>
        <h2 class="c-titulo">{{ ciclo.nombre }}</h2>
        <p class="c-meta">
          {{ ciclo.estado }} · <b class="tnum">{{ ciclo.resumen.completadas }}</b> de
          <b class="tnum">{{ ciclo.resumen.total }}</b> ubicaciones terminadas
        </p>
      </div>
      <div class="c-acciones">
        <button v-if="ciclo.estado === 'BORRADOR'" class="btn btn-primary" :disabled="guardando" @click="emit('accion', 'lanzar')">
          <Play :size="14" /> Lanzar conteo
        </button>
        <button v-if="ciclo.estado === 'REVISION'" class="btn btn-primary" :disabled="guardando" @click="emit('accion', 'cerrar')">
          <Check :size="14" /> Cerrar cíclico
        </button>
        <button v-if="ciclo.estado === 'CERRADO'" class="btn" @click="emit('descargar')">
          <FileDown :size="14" /> Descargar informe
        </button>
      </div>
    </section>

    <section v-if="ciclo.avisos?.length" class="card avisos">
      <h3 class="s-titulo"><TriangleAlert :size="15" /> PLU excluidos del cíclico ({{ ciclo.avisos.length }})</h3>
      <p class="s-desc">Sin teórico en la hoja 2 y con disponible cero: no entran al conteo ni al cierre.</p>
      <ul class="lista">
        <li v-for="a in ciclo.avisos" :key="a.plu">
          <span class="mono">{{ a.plu }}</span>
          <span class="l-desc">{{ a.descripcion }}</span>
          <span class="l-extra">{{ a.ubicaciones?.join(', ') || 'Sin ubicación' }}</span>
        </li>
      </ul>
    </section>

    <section v-if="ciclo.estado === 'BORRADOR'" class="card">
      <h3 class="s-titulo"><Users :size="15" /> Asignar ubicaciones</h3>
      <p class="s-desc">Reparte las ubicaciones antes de lanzar: sin todas asignadas el conteo no arranca.</p>
      <div class="asignar">
        <label class="campo">
          <span class="campo-label">Operario</span>
          <select v-model="asignado" class="field">
            <option value="">Selecciona</option>
            <option v-for="p in operarios" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="campo">
          <span class="campo-label">Buscar ubicación</span>
          <input v-model="buscaUbic" class="field mono" type="search" placeholder="04-A-07">
        </label>
      </div>
      <div class="acciones">
        <span class="cuenta">{{ seleccion.length }} seleccionadas de {{ visibles.length }} visibles</span>
        <button class="btn btn-sm" @click="marcarVisibles">Marcar visibles</button>
        <button class="btn btn-sm" :disabled="!seleccion.length" @click="seleccion = []">Ninguna</button>
        <button
          class="btn btn-sm btn-primary" :disabled="guardando || !seleccion.length || !asignado"
          @click="emit('accion', 'asignar', { tareas: seleccion, usuarioId: asignado }); seleccion = []"
        >
          Asignar seleccionadas
        </button>
      </div>
      <ul class="checks">
        <li v-for="t in visibles.slice(0, 300)" :key="t.id">
          <label class="check">
            <input v-model="seleccion" type="checkbox" :value="t.id">
            <span class="mono">{{ t.ubicacion }}</span>
            <span class="l-extra">{{ persona(t.usuarioId) }}</span>
            <span v-if="varios(t.ubicacion)" class="l-ojo">Varios PLU</span>
          </label>
        </li>
      </ul>
      <p v-if="visibles.length > 300" class="s-desc">
        Se muestran 300 de {{ visibles.length }}: busca por ubicación para acotar.
      </p>
    </section>

    <section v-if="ciclo.casos?.length" class="card">
      <h3 class="s-titulo"><TriangleAlert :size="15" /> Verificación de diferencias</h3>
      <article v-for="c in ciclo.casos" :key="c.id" class="caso">
        <h4 class="caso-titulo"><span class="mono">{{ c.plu }}</span> · {{ c.ubicacion }} · {{ c.estado }}</h4>

        <template v-if="c.estado === 'ABIERTO' && ciclo.estado === 'REVISION'">
          <p class="s-desc">Manda el reconteo a uno o a los dos; cada uno cuenta sin ver lo del otro.</p>
          <div class="acciones">
            <label v-for="p in operarios" :key="p.id" class="check">
              <input
                type="checkbox" :checked="elegidos[c.id]?.includes(p.id)"
                @change="elegidos[c.id] = ($event.target as HTMLInputElement).checked
                  ? [...(elegidos[c.id] ?? []), p.id]
                  : (elegidos[c.id] ?? []).filter((id) => id !== p.id)"
              >
              {{ p.name }}
            </label>
            <button
              class="btn btn-sm btn-primary" :disabled="guardando || !elegidos[c.id]?.length"
              @click="emit('accion', 'reconteo', { casoId: c.id, usuarios: elegidos[c.id] })"
            >
              Asignar reconteo
            </button>
          </div>
        </template>

        <ul class="lista">
          <li v-for="t in c.tareas" :key="t.id" class="caso-tarea">
            <span class="l-extra">{{ persona(t.usuarioId) }} · {{ t.estado }}</span>
            <label v-for="r in t.registros" :key="r.id" class="check">
              <input v-if="c.estado === 'ABIERTO'" v-model="resultados[c.id]" type="radio" :name="c.id" :value="r.id">
              <span>NetSuite <b class="tnum">{{ r.teoricoActual }}</b> · Físico <b class="tnum">{{ r.fisico }}</b> · {{ r.estado }}</span>
              <span v-if="c.resultadoId === r.id" class="l-ojo">Validado</span>
            </label>
          </li>
        </ul>

        <template v-if="c.estado === 'ABIERTO' && c.tareas.length">
          <label class="campo">
            <span class="campo-label">Observación</span>
            <textarea v-model="notas[c.id]" class="field" rows="2" maxlength="2000" />
          </label>
          <button
            class="btn btn-sm btn-primary" :disabled="guardando || !resultados[c.id]"
            @click="emit('accion', 'resolver', { casoId: c.id, resultadoId: resultados[c.id], observacion: notas[c.id] })"
          >
            Validar resultado y cerrar novedad
          </button>
        </template>
      </article>
    </section>
  </div>
</template>

<style scoped>
.gestion { display: grid; gap: 14px; }
.card { padding: 18px; }
.cabecera { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.c-titulo { margin: 0 0 4px; font-size: 18px; font-weight: 800; color: var(--ink); }
.c-meta { margin: 0; font-size: 13px; color: var(--muted); }
.c-meta b { color: var(--ink); }
.c-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
.s-titulo { display: flex; align-items: center; gap: 7px; margin: 0 0 4px; font-size: 14px; font-weight: 800; color: var(--ink); }
.s-titulo > svg { color: var(--brand); }
.s-desc { margin: 0 0 12px; font-size: 12.5px; color: var(--muted); }
.asignar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; }
.campo { display: grid; gap: 6px; }
.campo-label { font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.acciones { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.cuenta { margin-right: auto; font-size: 12.5px; font-weight: 700; color: var(--ink-2); }
.checks { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; display: grid; gap: 4px; }
.check { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 7px 9px; border-radius: var(--r-sm); font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
.checks .check:hover { background: var(--surface-3); }
.lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.lista li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 10px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--ink) 4%, transparent); font-size: 12.5px; }
.l-desc { flex: 1 1 160px; color: var(--muted); }
.l-extra { color: var(--muted); }
.l-ojo { font-weight: 700; color: var(--u-aviso); }
.caso { padding-top: 12px; border-top: 1px solid var(--border); }
.caso + .caso { margin-top: 12px; }
.caso-titulo { margin: 0 0 6px; font-size: 13.5px; font-weight: 800; color: var(--ink); }
.caso-tarea { flex-direction: column; align-items: flex-start; }
</style>

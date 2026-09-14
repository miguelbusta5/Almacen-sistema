<script setup lang="ts">
// Asignación del día: quién lleva el Order Picker y quién el Genie.
//
// Es la pantalla que se toca primero cada mañana y la única que bloquea al área
// entera si falta: sin equipo asignado ningún operario puede abrir una orden.
// Por eso va como primera pestaña, con la fecha de hoy puesta y un aviso arriba
// de cuánta gente está sin equipo.
//
// La hacen tres roles (supervisor de almacenamiento, gerente y admin), no una
// sola persona: es la red de seguridad de haber elegido asignación controlada en
// vez de que el operario se autoasigne.
import { computed, onMounted, ref, watch } from 'vue'
import { CalendarDays, TriangleAlert, Loader2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import {
  API_ADMIN_MUEBLES, TIPO_EQUIPO_LABEL, mensajeError,
  type Equipo, type OperarioDelDia,
} from '~/utils/muebles'
import { hoyBogota } from '~/utils/exportaciones'

const { show } = useToast()

const fecha = ref(hoyBogota())
const operarios = ref<OperarioDelDia[]>([])
const equipos = ref<Equipo[]>([])
const cargando = ref(true)
const guardandoId = ref<string | null>(null)

const sinEquipo = computed(() => operarios.value.filter((o) => o.equipo == null).length)
const esHoy = computed(() => fecha.value === hoyBogota())

async function cargar() {
  cargando.value = true
  try {
    const [asig, eq] = await Promise.all([
      $fetch<{ data: { fecha: string; operarios: OperarioDelDia[] } }>(
        `${API_ADMIN_MUEBLES}/asignaciones`, { query: { fecha: fecha.value } },
      ),
      $fetch<{ data: Equipo[] }>(`${API_ADMIN_MUEBLES}/equipos`),
    ])
    operarios.value = asig.data.operarios
    equipos.value = eq.data.filter((e) => e.activo)
  } catch (e) {
    show(mensajeError(e, 'No se pudo cargar la asignación'), true)
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
watch(fecha, cargar)

async function asignar(operario: OperarioDelDia, equipoId: string) {
  guardandoId.value = operario.id
  try {
    const res = await $fetch<{ data: { equipo: Equipo | null } }>(
      `${API_ADMIN_MUEBLES}/asignaciones`,
      { method: 'POST', body: { usuarioId: operario.id, equipoId: equipoId || null, fecha: fecha.value } },
    )
    operario.equipo = res.data.equipo
    show(equipoId ? `${operario.nombre}: ${res.data.equipo?.codigo}` : `${operario.nombre} sin equipo`)
  } catch (e) {
    show(mensajeError(e, 'No se pudo asignar'), true)
    // Recarga: el select ya cambió en pantalla y quedaría mintiendo.
    cargar()
  } finally {
    guardandoId.value = null
  }
}
</script>

<template>
  <section>
    <header class="head">
      <label class="campo">
        <span class="campo-label"><CalendarDays :size="12" /> Día</span>
        <input v-model="fecha" class="input" type="date">
      </label>
      <p v-if="!esHoy" class="nota">
        Estás viendo otro día. Se puede dejar la asignación puesta la tarde anterior.
      </p>
    </header>

    <!-- Lo primero que tiene que ver el supervisor: a quién le falta equipo. -->
    <p v-if="!cargando && sinEquipo > 0" class="alerta">
      <TriangleAlert :size="15" />
      {{ sinEquipo }} {{ sinEquipo === 1 ? 'operario' : 'operarios' }} sin equipo:
      no {{ sinEquipo === 1 ? 'podrá' : 'podrán' }} abrir órdenes.
    </p>

    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

    <p v-else-if="operarios.length === 0" class="vacio">
      No hay usuarios con el rol de picking de muebles. Créalos desde Usuarios.
    </p>

    <p v-else-if="equipos.length === 0" class="vacio">
      No hay equipos activos. Da de alta el Order Picker y el Genie en la pestaña Equipos.
    </p>

    <ul v-else class="lista">
      <li v-for="o in operarios" :key="o.id" class="fila" :class="{ falta: o.equipo == null }">
        <div class="quien">
          <strong>{{ o.nombre }}</strong>
          <span v-if="o.equipo" class="tipo">{{ TIPO_EQUIPO_LABEL[o.equipo.tipo] }}</span>
          <span v-else class="tipo aviso">Sin equipo</span>
        </div>

        <div class="accion">
          <Loader2 v-if="guardandoId === o.id" :size="15" class="spin" />
          <select
            class="input" :value="o.equipo?.id ?? ''" :disabled="guardandoId === o.id"
            @change="asignar(o, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Sin equipo</option>
            <option v-for="e in equipos" :key="e.id" :value="e.id">
              {{ e.codigo }} — {{ TIPO_EQUIPO_LABEL[e.tipo] }}
            </option>
          </select>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
.campo { display: flex; flex-direction: column; gap: 4px; }
.campo-label { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.nota { margin: 0 0 4px; font-size: 12px; color: var(--muted); }

.alerta {
  display: flex; align-items: center; gap: 8px; margin: 0 0 14px; padding: 11px 14px;
  border-radius: var(--r-sm); font-size: 13px; font-weight: 600; color: var(--u-aviso);
  background: color-mix(in srgb, var(--u-aviso) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--u-aviso) 32%, transparent);
}

.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fila {
  display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
  padding: 12px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface);
  box-shadow: inset 3px 0 0 var(--u-ok);
}
.fila.falta { box-shadow: inset 3px 0 0 var(--u-aviso); }
.quien { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
.quien strong { font-size: 14.5px; font-weight: 700; color: var(--ink); }
.tipo { font-size: 12px; color: var(--muted); }
.tipo.aviso { font-weight: 700; color: var(--u-aviso); }
.accion { display: flex; align-items: center; gap: 8px; }
.accion .input { min-width: 210px; }

.cargando { display: flex; align-items: center; gap: 9px; padding: 24px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 26px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }

@media (max-width: 560px) {
  .fila { align-items: stretch; }
  .accion { width: 100%; }
  .accion .input { flex: 1; min-width: 0; }
}
</style>

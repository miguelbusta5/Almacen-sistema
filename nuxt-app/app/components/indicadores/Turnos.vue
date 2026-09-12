<script setup lang="ts">
// Cuadro de turnos: lo que convierte "trabajó 6 h" en "de 9 h 30 de turno,
// trabajó 6 h". Lo sube supervisión con el mismo Excel que arma operación.
//
// No se pisa nada al subir: cada cuadro vale para un rango de fechas y cada día
// usa el más reciente que lo cubra, así se puede corregir sin borrar.
import { computed, onMounted, ref } from 'vue'
import { CalendarClock, Trash2, Upload } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { hoyBogota } from '~/utils/exportaciones'
import {
  API_TURNOS, DIA_SEMANA_LABEL, fmtTurno, type CuadroTurnosDTO,
} from '~/utils/indicadores'

const emit = defineEmits<{ (e: 'actualizar'): void }>()
const { show: showToast } = useToast()

const cuadros = ref<CuadroTurnosDTO[]>([])
const cargando = ref(true)

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{ data: CuadroTurnosDTO[] }>(API_TURNOS)
    cuadros.value = res.data
  } catch (e) {
    showToast(apiErr(e, 'No se pudieron cargar los turnos'), true)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

// ── Subir ──────────────────────────────────────────────────────────
const archivo = ref<File | null>(null)
const desde = ref(hoyBogota())
const hasta = ref('')
const subiendo = ref(false)
const listo = computed(() => !!archivo.value && !!desde.value && !!hasta.value && desde.value <= hasta.value)

function elegir(e: Event) {
  archivo.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function subir() {
  if (!listo.value || subiendo.value) return
  subiendo.value = true
  try {
    const body = new FormData()
    body.append('archivo', archivo.value!)
    body.append('desde', desde.value)
    body.append('hasta', hasta.value)
    const res = await $fetch<{
      data: { personas: number; turnos: number; sinIdentificar: string[]; noMedidos: string[] }
    }>(API_TURNOS, { method: 'POST', body })
    const d = res.data
    showToast(`Cuadro cargado: ${d.personas} personas, ${d.turnos} turnos`)
    if (d.sinIdentificar.length) {
      showToast(`Sin identificar en el sistema: ${d.sinIdentificar.join(', ')}`, true)
    }
    archivo.value = null
    await cargar()
    emit('actualizar')
  } catch (e) {
    showToast(apiErr(e, 'No se pudo cargar el cuadro'), true)
  } finally {
    subiendo.value = false
  }
}

const quitando = ref<CuadroTurnosDTO | null>(null)
const quitandoGuardar = ref(false)
async function quitar() {
  if (!quitando.value) return
  quitandoGuardar.value = true
  try {
    await $fetch(`${API_TURNOS}/${quitando.value.id}`, { method: 'DELETE' })
    showToast('Cuadro quitado')
    quitando.value = null
    await cargar()
    emit('actualizar')
  } catch (e) {
    showToast(apiErr(e, 'No se pudo quitar el cuadro'), true)
  } finally {
    quitandoGuardar.value = false
  }
}

function resumenDias(dias: { dia: number; inicioMin: number; finMin: number }[]): string {
  // Los días con el mismo horario se agrupan: "Lun–Jue 6 am – 3 pm".
  return dias
    .map((d) => `${DIA_SEMANA_LABEL[d.dia]?.slice(0, 3)} ${fmtTurno(d)}`)
    .join(' · ')
}
</script>

<template>
  <div class="tn">
    <section class="subir card">
      <div class="subir-txt">
        <h3 class="titulo"><CalendarClock :size="15" /> Cargar el cuadro de turnos</h3>
        <p class="sub">
          El mismo Excel que arma operación: un bloque por turno, con la fila «OPERARIO» y los días,
          y «DESCANSO» donde no se trabaja. Con él, los indicadores dicen qué parte de la jornada
          fue trabajo registrado.
        </p>
      </div>
      <div class="subir-form">
        <label class="f f-archivo">
          <span class="lbl">Archivo</span>
          <input class="field" type="file" accept=".xlsx,.xls" :disabled="subiendo" @change="elegir">
        </label>
        <label class="f">
          <span class="lbl">Rige desde</span>
          <input v-model="desde" class="field" type="date" :max="hasta || undefined" :disabled="subiendo">
        </label>
        <label class="f">
          <span class="lbl">Hasta</span>
          <input v-model="hasta" class="field" type="date" :min="desde || undefined" :disabled="subiendo">
        </label>
        <button class="btn btn-primary" :disabled="!listo || subiendo" @click="subir">
          <Spinner v-if="subiendo" :size="14" /><Upload v-else :size="14" />
          {{ subiendo ? 'Cargando…' : 'Cargar' }}
        </button>
      </div>
    </section>

    <ListSkeleton v-if="cargando" />
    <EmptyState
      v-else-if="cuadros.length === 0" title="Sin cuadros de turno"
      description="Carga el Excel de horarios para medir la efectividad de cada turno."
    />

    <section v-for="c in cuadros" v-else :key="c.id" class="cuadro card">
      <header class="cab">
        <div>
          <h3 class="titulo">
            {{ c.desde }} a {{ c.hasta }}
            <span v-if="c.vigente" class="vig">Vigente</span>
          </h3>
          <p class="sub">
            {{ c.nombreArchivo }} · lo subió {{ c.subidoPor }} · {{ c.personas.length }} personas
          </p>
        </div>
        <button class="btn btn-sm btn-ghost" @click="quitando = c"><Trash2 :size="14" /> Quitar</button>
      </header>

      <ul class="personas">
        <li v-for="p in c.personas" :key="p.id">
          <b>{{ p.nombre }}</b>
          <span class="horario">{{ resumenDias(p.dias) }}</span>
        </li>
      </ul>

      <p v-if="c.sinTurno.length" class="falta">
        Sin turno en este cuadro (no se les puede medir la efectividad):
        {{ c.sinTurno.join(', ') }}
      </p>
    </section>

    <ConfirmModal
      v-if="quitando"
      title="Quitar cuadro de turnos"
      :message="`Los días del ${quitando.desde} al ${quitando.hasta} vuelven a medirse sin jornada, o con el cuadro anterior si alguno los cubre.`"
      confirm-label="Quitar" :confirming="quitandoGuardar"
      @close="quitando = null" @confirm="quitar"
    />
  </div>
</template>

<style scoped>
.tn { display: flex; flex-direction: column; gap: 16px; }
.titulo { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); }
.sub { margin: 4px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--muted); max-width: 720px; }

.subir { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px; }
.subir-form { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.f { display: flex; flex-direction: column; gap: 5px; }
.f-archivo { flex: 1 1 280px; min-width: 0; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.subir-form .field { height: 38px; }
.f-archivo .field { padding: 7px 10px; }

.cuadro { padding: 16px 18px; }
.cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.vig {
  margin-left: 8px; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
  background: var(--brand-tint); color: var(--brand-deep);
}
.personas { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 6px 18px; margin: 0; padding: 0; list-style: none; }
.personas li { display: flex; flex-direction: column; gap: 1px; padding: 6px 0; border-top: 1px solid var(--border); font-size: 12.5px; }
.personas b { color: var(--ink); }
.horario { color: var(--muted); font-size: 11.5px; }
.falta { margin: 12px 0 0; font-size: 12.5px; color: var(--u-aviso); }
</style>

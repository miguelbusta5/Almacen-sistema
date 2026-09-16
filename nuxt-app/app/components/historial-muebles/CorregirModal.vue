<script setup lang="ts">
// Corregir un PLU de una orden (solo admin). Se mandan SOLO los campos que se
// tocaron: así un reloj que nadie cambió no se reescribe por redondear segundos.
import { computed, ref } from 'vue'
import { useToast } from '~/composables/useToast'
import { mensajeError, type Linea } from '~/utils/muebles'

const props = defineProps<{ ordenId: string; linea: Linea }>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'corregido'): void }>()
const { show } = useToast()

/** ISO -> valor de <input type="datetime-local"> en hora de Colombia. */
function aLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000)
  return d.toISOString().slice(0, 19)
}
/** Valor del input (hora de Colombia) -> ISO con zona. */
function aIso(local: string): string | null {
  return local ? new Date(`${local.length === 16 ? `${local}:00` : local}-05:00`).toISOString() : null
}

const inicial = {
  plu: props.linea.plu,
  ubicacion: props.linea.ubicacion ?? '',
  numeroCaja: props.linea.numeroCaja ?? '',
  unidades: props.linea.unidades,
  horaInicio: aLocal(props.linea.horaInicio),
  horaFin: aLocal(props.linea.horaFin),
  inspHoraInicio: aLocal(props.linea.inspHoraInicio),
  inspHoraFin: aLocal(props.linea.inspHoraFin),
}
const f = ref({ ...inicial })
const motivo = ref('')
const guardando = ref(false)

const cambios = computed(() => {
  const c: Record<string, unknown> = {}
  if (f.value.plu.trim() !== inicial.plu) c.plu = f.value.plu.trim()
  if (f.value.ubicacion.trim() !== inicial.ubicacion) c.ubicacion = f.value.ubicacion.trim() || null
  if (f.value.numeroCaja.trim() !== inicial.numeroCaja) c.numeroCaja = f.value.numeroCaja.trim() || null
  if (Number(f.value.unidades) !== inicial.unidades) c.unidades = Number(f.value.unidades)
  for (const k of ['horaInicio', 'horaFin', 'inspHoraInicio', 'inspHoraFin'] as const) {
    if (f.value[k] !== inicial[k]) c[k] = aIso(f.value[k])
  }
  return c
})
const puedeGuardar = computed(() => Object.keys(cambios.value).length > 0 && motivo.value.trim().length >= 5 && !guardando.value)

async function guardar() {
  if (!puedeGuardar.value) return
  guardando.value = true
  try {
    await $fetch(`/api/historial-muebles/${props.ordenId}/linea/${props.linea.id}/corregir`, {
      method: 'POST',
      body: { ...cambios.value, motivo: motivo.value.trim() },
    })
    show('Corrección guardada')
    emit('corregido')
  } catch (e) {
    show(mensajeError(e, 'No se pudo corregir'), true)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="m-titulo">Corregir PLU {{ linea.plu }}</h3>
      <p class="m-desc">Cambia solo lo que quedó mal. El motivo es obligatorio y queda en Auditoría.</p>

      <div class="grid">
        <label class="campo">
          <span class="campo-label">PLU</span>
          <input v-model="f.plu" class="input mono" type="text" autocomplete="off">
          <span class="ayuda">Si cambia, se trae del maestro la descripción y las medidas.</span>
        </label>
        <label class="campo">
          <span class="campo-label">Unidades</span>
          <input v-model.number="f.unidades" class="input" type="number" min="1">
        </label>
        <label class="campo">
          <span class="campo-label">Ubicación</span>
          <input v-model="f.ubicacion" class="input mono" type="text" autocomplete="off">
        </label>
        <label class="campo">
          <span class="campo-label">Rótulo</span>
          <input v-model="f.numeroCaja" class="input mono" type="text" autocomplete="off">
        </label>
        <label class="campo">
          <span class="campo-label">Inicio picking</span>
          <input v-model="f.horaInicio" class="input" type="datetime-local" step="1">
        </label>
        <label class="campo">
          <span class="campo-label">Fin picking</span>
          <input v-model="f.horaFin" class="input" type="datetime-local" step="1">
        </label>
        <label class="campo">
          <span class="campo-label">Inicio inspección</span>
          <input v-model="f.inspHoraInicio" class="input" type="datetime-local" step="1">
        </label>
        <label class="campo">
          <span class="campo-label">Fin inspección</span>
          <input v-model="f.inspHoraFin" class="input" type="datetime-local" step="1">
        </label>
      </div>

      <label class="campo">
        <span class="campo-label">Motivo de la corrección</span>
        <textarea v-model="motivo" class="input" rows="2" maxlength="300" placeholder="Ej. el operario escaneó la ubicación en el campo del PLU" />
      </label>

      <footer class="m-pie">
        <span class="n-cambios">{{ Object.keys(cambios).length }} {{ Object.keys(cambios).length === 1 ? 'cambio' : 'cambios' }}</span>
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!puedeGuardar" @click="guardar">Guardar corrección</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 620px; max-height: 100%; overflow-y: auto; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.m-titulo { margin: 0 0 4px; font-size: 17px; font-weight: 800; color: var(--ink); }
.m-desc { margin: 0 0 14px; font-size: 12.5px; color: var(--muted); }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; }
.campo { display: block; margin-bottom: 12px; }
.campo-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.ayuda { display: block; margin-top: 3px; font-size: 11px; color: var(--muted); }
.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.m-pie { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.n-cambios { margin-right: auto; font-size: 12px; color: var(--muted); }
@media (max-width: 520px) { .grid { grid-template-columns: 1fr; } }
</style>

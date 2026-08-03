<script setup lang="ts">
// Flota: vehículos y conductores operativos. Alimenta el módulo Preoperacional —
// un usuario con rol TRANSPORTISTA necesita un conductor con vehículo asignado.
import { ref, computed } from 'vue'
import { Download, Plus, Truck, Upload } from '@lucide/vue'
import type { TransportistaOperativo, VehiculoOperativo } from '~/utils/usuarios'

const props = defineProps<{
  vehiculos: VehiculoOperativo[]
  transportistas: TransportistaOperativo[]
  loading: boolean
}>()
const emit = defineEmits<{ (e: 'reload'): void; (e: 'toast', msg: string, err?: boolean): void }>()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

// ── Vehículo nuevo ─────────────────────────────────────────
const placa = ref('')
const tipo = ref('CAMION')
const capacidad = ref('')
const savingVeh = ref(false)

async function crearVehiculo() {
  if (!placa.value.trim() || savingVeh.value) return
  savingVeh.value = true
  try {
    await $fetch('/api/users/vehiculos', {
      method: 'POST',
      body: {
        placa: placa.value.trim(),
        tipo: tipo.value.trim(),
        capacidadKg: capacidad.value ? Number(capacidad.value) : null,
      },
    })
    placa.value = ''; capacidad.value = ''
    emit('toast', 'Vehículo creado ✓')
    emit('reload')
  } catch (e) {
    emit('toast', apiErr(e, 'No se pudo crear el vehículo'), true)
  } finally {
    savingVeh.value = false
  }
}

// ── Conductor nuevo ────────────────────────────────────────
const nombre = ref('')
const telefono = ref('')
const vehiculoId = ref('')
const savingCond = ref(false)

async function crearTransportista() {
  if (!nombre.value.trim() || savingCond.value) return
  savingCond.value = true
  try {
    await $fetch('/api/users/transportistas-operativos', {
      method: 'POST',
      body: {
        nombre: nombre.value.trim(),
        telefono: telefono.value.trim() || null,
        vehiculoId: vehiculoId.value || null,
      },
    })
    nombre.value = ''; telefono.value = ''; vehiculoId.value = ''
    emit('toast', 'Conductor creado ✓')
    emit('reload')
  } catch (e) {
    emit('toast', apiErr(e, 'No se pudo crear el conductor'), true)
  } finally {
    savingCond.value = false
  }
}

// ── Reasignar vehículo / activar ───────────────────────────
const updatingId = ref<string | null>(null)
async function patch(id: string, body: Record<string, unknown>, msg: string) {
  updatingId.value = id
  try {
    await $fetch('/api/users/transportistas-operativos', { method: 'PATCH', body: { id, ...body } })
    emit('toast', msg)
    emit('reload')
  } catch (e) {
    emit('toast', apiErr(e, 'No se pudo actualizar'), true)
  } finally {
    updatingId.value = null
  }
}

// ── Importar maestro de productos ──────────────────────────
// OJO: usa `fetch` nativo a propósito, no `$fetch`. El endpoint sigue viviendo en
// la app Next (`/api/productos-maestro/importar`) porque ese módulo no está
// migrado, y `$fetch` le antepondría el baseURL '/dashboard/' mandándolo a Nitro,
// donde no existe. Cuando se migre productos-maestro, esto pasa a $fetch.
const importando = ref(false)
const resultadoImport = ref('')
async function importarMaestro(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importando.value = true
  resultadoImport.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/productos-maestro/importar', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || 'Error al importar')
    resultadoImport.value = `${json.importados ?? 0} nuevos · ${json.actualizados ?? 0} actualizados`
      + (json.ignorados ? ` · ${json.ignorados} ignorados` : '')
    emit('toast', 'Maestro importado ✓')
  } catch (e: any) {
    emit('toast', e?.message || 'No se pudo importar el maestro', true)
  } finally {
    importando.value = false
    input.value = ''
  }
}

// ── Descargar maestro de productos ─────────────────────────
// Mismo motivo que importarMaestro para usar `fetch` nativo: el endpoint
// sigue en la app Next (`/api/productos-maestro/export`).
const descargando = ref(false)
async function descargarMaestro() {
  descargando.value = true
  try {
    const res = await fetch('/api/productos-maestro/export')
    if (!res.ok) throw new Error('Error al descargar el maestro')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `maestro-productos-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    emit('toast', e?.message || 'No se pudo descargar el maestro', true)
  } finally {
    descargando.value = false
  }
}

const vehiculosLibres = computed(() => props.vehiculos)
</script>

<template>
  <div class="flota">
    <section class="card sec">
      <h3><Truck :size="14" /> Vehículos</h3>
      <div class="alta">
        <input v-model="placa" class="field" placeholder="Placa" style="text-transform: uppercase">
        <input v-model="tipo" class="field" placeholder="Tipo (CAMION, FURGON…)">
        <input v-model="capacidad" class="field tnum" type="number" min="1" placeholder="Capacidad kg">
        <button class="btn btn-primary btn-sm" :disabled="!placa.trim() || savingVeh" @click="crearVehiculo">
          <Spinner v-if="savingVeh" :size="13" /><Plus v-else :size="13" /> Añadir
        </button>
      </div>

      <ListSkeleton v-if="loading" :rows="3" />
      <table v-else-if="vehiculos.length" class="table">
        <thead><tr><th>Placa</th><th>Tipo</th><th>Capacidad</th><th>Estado</th><th>Conductores</th></tr></thead>
        <tbody>
          <tr v-for="v in vehiculos" :key="v.id">
            <td class="mono strong">{{ v.placa }}</td>
            <td>{{ v.tipo }}</td>
            <td class="tnum">{{ v.capacidadKg ? `${v.capacidadKg} kg` : '—' }}</td>
            <td>
              <Badge
                :label="v.estado" :tone="v.estado === 'ACTIVO' ? 'var(--u-ok)'
                  : v.estado === 'MANTENIMIENTO' ? 'var(--u-aviso)' : 'var(--faint)'"
              />
            </td>
            <td class="muted">{{ (v.transportistas ?? []).map((t) => t.nombre).join(', ') || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else title="Sin vehículos" description="Añade el primer vehículo de la flota." />
    </section>

    <section class="card sec">
      <h3>Conductores operativos</h3>
      <div class="alta">
        <input v-model="nombre" class="field" placeholder="Nombre del conductor">
        <input v-model="telefono" class="field" placeholder="Teléfono" inputmode="tel">
        <select v-model="vehiculoId" class="field">
          <option value="">Sin vehículo</option>
          <option v-for="v in vehiculosLibres" :key="v.id" :value="v.id">{{ v.placa }} · {{ v.tipo }}</option>
        </select>
        <button class="btn btn-primary btn-sm" :disabled="!nombre.trim() || savingCond" @click="crearTransportista">
          <Spinner v-if="savingCond" :size="13" /><Plus v-else :size="13" /> Añadir
        </button>
      </div>

      <ListSkeleton v-if="loading" :rows="3" />
      <table v-else-if="transportistas.length" class="table">
        <thead><tr><th>Conductor</th><th>Teléfono</th><th>Vehículo</th><th>Cuenta</th><th>Estado</th></tr></thead>
        <tbody>
          <tr v-for="t in transportistas" :key="t.id" :class="{ off: !t.activo }">
            <td class="strong">{{ t.nombre }}</td>
            <td class="muted">{{ t.telefono || '—' }}</td>
            <td>
              <select
                class="field mini" :value="t.vehiculo?.id ?? ''" :disabled="updatingId === t.id"
                @change="patch(t.id, { vehiculoId: ($event.target as HTMLSelectElement).value || null }, 'Vehículo asignado ✓')"
              >
                <option value="">Sin vehículo</option>
                <option v-for="v in vehiculos" :key="v.id" :value="v.id">{{ v.placa }}</option>
              </select>
            </td>
            <td class="muted">{{ t.user ? t.user.email : '—' }}</td>
            <td>
              <button
                class="btn btn-sm" :disabled="updatingId === t.id"
                @click="patch(t.id, { activo: !t.activo }, t.activo ? 'Conductor desactivado' : 'Conductor activado ✓')"
              >
                {{ t.activo ? 'Desactivar' : 'Activar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else title="Sin conductores" description="Añade el primer conductor operativo." />
    </section>

    <section class="card sec">
      <h3>Maestro de productos</h3>
      <p class="desc">
        Importa el archivo .xlsx del maestro. Los PLU existentes se actualizan y los nuevos se crean.
        Descarga el maestro actual para ver el formato exacto (mismas columnas) antes de editarlo.
      </p>
      <div class="alta">
        <button class="btn btn-sm" :disabled="descargando" @click="descargarMaestro">
          <Spinner v-if="descargando" :size="13" /><Download v-else :size="13" />
          {{ descargando ? 'Descargando…' : 'Descargar maestro actual' }}
        </button>
        <label class="btn btn-sm imp">
          <Spinner v-if="importando" :size="13" /><Upload v-else :size="13" />
          {{ importando ? 'Importando…' : 'Seleccionar archivo .xlsx' }}
          <input type="file" accept=".xlsx" hidden :disabled="importando" @change="importarMaestro">
        </label>
        <span v-if="resultadoImport" class="res">{{ resultadoImport }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.flota { display: flex; flex-direction: column; gap: 16px; }
.sec { padding: 15px 18px 17px; }
.sec h3 { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--modulo, var(--brand)); margin: 0 0 12px; }
.desc { font-size: 12.5px; color: var(--muted); margin: 0 0 12px; }
.alta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.alta .field { flex: 1 1 150px; min-width: 120px; }
.imp { cursor: pointer; }
.res { font-size: 12.5px; color: var(--u-ok); font-weight: 600; }

.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--faint); padding: 8px 10px; border-bottom: 1px solid var(--border); }
.table td { padding: 9px 10px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--border); vertical-align: middle; }
.table tr:last-child td { border-bottom: none; }
.off { opacity: .55; }
.strong { color: var(--ink); font-weight: 600; }
.muted { color: var(--muted); }
.mini { height: 30px; font-size: 12px; width: auto; min-width: 120px; }
@media (max-width: 760px) { .sec { overflow-x: auto; } .table { min-width: 560px; } }
</style>

<script setup lang="ts">
// Alta y edición de cuentas. El servidor revalida todo; esto solo evita viajes
// inútiles y explica las reglas antes de que el usuario choque con un 400.
import { ref, computed, watch, onMounted } from 'vue'
import { TriangleAlert } from '@lucide/vue'
import {
  ROLE_DESCRIPTION, USER_ROLES, labelRol,
  type TransportistaDisponible, type Usuario, type UserRole,
} from '~/utils/usuarios'

const props = defineProps<{ initial: Usuario | null; selfId?: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', msg: string): void }>()

function apiErr(e: any, fallback: string) {
  return e?.data?.error || e?.data?.statusMessage || e?.statusMessage || fallback
}

const esEdicion = computed(() => !!props.initial)
const esYoMismo = computed(() => !!props.initial && props.initial.id === props.selfId)

const name = ref(props.initial?.name ?? '')
const email = ref(props.initial?.email ?? '')
const password = ref('')
const role = ref<UserRole>(props.initial?.role ?? 'OPERADOR')
const active = ref(props.initial?.active ?? true)
const transportistaId = ref('')

const saving = ref(false)
const error = ref('')

// Un TRANSPORTISTA necesita un conductor con vehículo al que engancharse: sin eso
// el módulo Preoperacional no tiene sobre qué trabajar.
const disponibles = ref<TransportistaDisponible[]>([])
const cargandoDisp = ref(false)
async function cargarDisponibles() {
  cargandoDisp.value = true
  try {
    const res = await $fetch<{ data: TransportistaDisponible[] }>('/api/users/transportistas-disponibles')
    disponibles.value = res.data ?? []
  } catch { /* el select queda vacío y el submit avisará */ } finally {
    cargandoDisp.value = false
  }
}
onMounted(() => { if (role.value === 'TRANSPORTISTA' && !esEdicion.value) void cargarDisponibles() })
watch(role, (r) => {
  if (r === 'TRANSPORTISTA' && !esEdicion.value && !disponibles.value.length) void cargarDisponibles()
  if (r !== 'TRANSPORTISTA') transportistaId.value = ''
})

// El servidor rechaza que un ADMIN se desactive o se degrade a sí mismo; se
// bloquea también aquí para que el motivo sea visible antes de intentarlo.
const bloqueoPropio = computed(() =>
  esYoMismo.value && (!active.value || role.value !== 'ADMIN'))

const puedeGuardar = computed(() => {
  if (saving.value || bloqueoPropio.value) return false
  if (!name.value.trim()) return false
  if (!esEdicion.value) {
    if (!email.value.trim() || password.value.length < 8) return false
    if (role.value === 'TRANSPORTISTA' && !transportistaId.value) return false
  } else if (password.value && password.value.length < 8) return false
  return true
})

async function submit() {
  if (!puedeGuardar.value) return
  saving.value = true
  error.value = ''
  try {
    if (esEdicion.value) {
      const body: Record<string, unknown> = {
        name: name.value.trim(), role: role.value, active: active.value,
      }
      if (password.value) body.password = password.value
      await $fetch(`/api/users/${props.initial!.id}`, { method: 'PUT', body })
      emit('saved', password.value ? 'Contraseña restablecida ✓' : 'Usuario actualizado ✓')
    } else {
      await $fetch('/api/users', {
        method: 'POST',
        body: {
          name: name.value.trim(),
          email: email.value.trim(),
          password: password.value,
          role: role.value,
          ...(role.value === 'TRANSPORTISTA' ? { transportistaId: transportistaId.value } : {}),
        },
      })
      emit('saved', 'Usuario creado ✓')
    }
  } catch (e) {
    error.value = apiErr(e, 'No se pudo guardar')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell
    :title="esEdicion ? 'Editar usuario' : 'Nuevo usuario'"
    :sub="esEdicion ? initial!.email : 'La contraseña será temporal: deberá cambiarla al entrar'"
    wide @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <label class="f">
        <span class="lbl">Nombre</span>
        <input v-model="name" class="field" autocomplete="off">
      </label>

      <label v-if="!esEdicion" class="f">
        <span class="lbl">Correo</span>
        <input v-model="email" class="field" type="email" autocomplete="off">
        <span class="hint">Se normaliza a minúsculas.</span>
      </label>

      <label class="f">
        <span class="lbl">{{ esEdicion ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</span>
        <input v-model="password" class="field" type="password" autocomplete="new-password" minlength="8">
        <span class="hint">
          {{ esEdicion
            ? 'Déjala en blanco para no cambiarla. Si la cambias, será temporal.'
            : 'Mínimo 8 caracteres.' }}
        </span>
      </label>

      <label class="f">
        <span class="lbl">Rol</span>
        <select v-model="role" class="field">
          <option v-for="r in USER_ROLES" :key="r" :value="r">{{ labelRol(r) }}</option>
        </select>
        <span class="hint">{{ ROLE_DESCRIPTION[role] }}</span>
      </label>

      <label v-if="role === 'TRANSPORTISTA' && !esEdicion" class="f">
        <span class="lbl">Conductor a vincular</span>
        <select v-model="transportistaId" class="field" :disabled="cargandoDisp">
          <option value="">{{ cargandoDisp ? 'Cargando…' : 'Seleccionar' }}</option>
          <option v-for="t in disponibles" :key="t.id" :value="t.id">
            {{ t.nombre }}{{ t.vehiculo ? ` · ${t.vehiculo.placa}` : '' }}
          </option>
        </select>
        <span v-if="!cargandoDisp && !disponibles.length" class="warn">
          No hay conductores libres con vehículo asignado. Crea uno en Flota antes de dar de alta la cuenta.
        </span>
      </label>

      <label v-if="esEdicion" class="chk">
        <input v-model="active" type="checkbox">
        <span>Cuenta activa</span>
      </label>

      <p v-if="bloqueoPropio" class="warn bloque">
        <TriangleAlert :size="14" />
        No puedes desactivarte ni quitarte el rol de administrador a ti mismo.
      </p>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="acc">
        <button type="button" class="btn" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!puedeGuardar">
          <Spinner v-if="saving" :size="14" />
          {{ saving ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear usuario' }}
        </button>
      </div>
    </form>
  </ModalShell>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 13px; }
.f { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.hint { font-size: 11.5px; color: var(--faint); }
.warn { font-size: 12px; color: var(--u-aviso); margin: 0; }
.bloque { display: flex; align-items: center; gap: 7px; background: var(--u-aviso-tint); padding: 9px 11px; border-radius: var(--r-sm); }
.chk { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); }
.err { font-size: 12.5px; color: var(--error); background: var(--error-tint); padding: 9px 11px; border-radius: var(--r-sm); margin: 0; }
.acc { display: flex; justify-content: flex-end; gap: 9px; margin-top: 4px; }
</style>

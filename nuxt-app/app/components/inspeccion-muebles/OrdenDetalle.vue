<script setup lang="ts">
// Detalle de una orden en inspeccion: PLU por PLU, con su reloj y sus acciones.
//
// El boton "Salir de la orden" SOLO navega. No cierra relojes ni suelta la
// asignacion: todo el estado vive en la DB, asi que otro inspector puede entrar,
// hacer lo suyo, y quien estaba aqui encuentra la orden exactamente como la dejo.
// Esa es la garantia central del modulo, con 2 PCs para ~5 personas.
import { computed } from 'vue'
import { ArrowLeft, Play, Check, Hammer, PackageX, Undo2, Utensils, TriangleAlert, Plus, UserPlus, MapPin, Flag, CircleCheckBig } from '@lucide/vue'
import {
  ESTADO_LINEA_LABEL, ESTADO_LINEA_TONE, TIPO_ERROR_PICKING_LABEL, cronometro, fmtKg, fmtM3, fmtMin,
  type Linea, type Orden,
} from '~/utils/muebles'

// El catalogo de inspectores y quien usa esta PC no hacen falta aqui: el
// selector de nombre lo abre el padre cuando una accion lo necesita.
const props = defineProps<{
  orden: Orden
  ahora: number
  guardando: boolean
  /** Solo el administrador marca errores de picking y termina la orden con ellos. */
  esAdmin?: boolean
}>()

const emit = defineEmits<{
  (e: 'salir'): void
  (e: 'asignar'): void
  (e: 'iniciar', linea: Linea): void
  (e: 'completar', linea: Linea): void
  (e: 'ebanisteria', linea: Linea): void
  (e: 'recibir-ebanisteria', linea: Linea): void
  (e: 'faltante'): void
  (e: 'averia', linea: Linea): void
  (e: 'agregar-plu'): void
  (e: 'almuerzo', accion: 'iniciar' | 'terminar'): void
  (e: 'unirse'): void
  (e: 'ciudad'): void
  (e: 'error-picking', linea: Linea): void
  (e: 'terminar'): void
}>()

const conError = computed(() => props.orden.lineas.filter((l) => l.errorPicking).length)
// Espejo de validarTerminarConErrores: los PLU sin error tienen que estar listos.
const faltanSinError = computed(() => props.orden.lineas.filter((l) => !l.errorPicking && l.estado !== 'LISTO').length)

// La orden en almuerzo esta detenida: no corre ningun reloj suyo.
const enAlmuerzo = computed(() => props.orden.almuerzoInicio != null)

// Los botones NO se deshabilitan cuando esta PC aun no sabe quien la usa:
// pulsarlos abre el selector de nombre y luego ejecuta la accion. En una PC
// compartida, deshabilitarlos obligaria a un paso previo que no aporta nada — el
// nombre se pide igual, pero mas tarde y sin perder el gesto.
//
// El aviso solo sale mientras nadie ha tomado la orden: si ya tiene inspector,
// repetirlo confunde, porque el dueno se ve arriba.
const avisarSinDueno = computed(() => props.orden.inspector == null)

function reloj(l: Linea): string {
  if (l.estado === 'EN_INSPECCION') return cronometro(l.inspHoraInicio, props.ahora)
  if (l.estado === 'EN_EBANISTERIA') return cronometro(l.ebanisteriaInicio, props.ahora)
  return fmtMin(l.duracionInspeccionMin)
}
</script>

<template>
  <div>
    <header class="head">
      <button class="btn btn-ghost btn-sm" @click="emit('salir')">
        <ArrowLeft :size="15" /> Salir de la orden
      </button>
      <div class="head-acciones">
        <button
          v-if="esAdmin && conError > 0" class="btn btn-sm btn-primary"
          :disabled="guardando || faltanSinError > 0"
          :title="faltanSinError > 0 ? `Faltan ${faltanSinError} PLU sin error por inspeccionar` : 'Pasa a Entrega a Transporte'"
          @click="emit('terminar')"
        >
          <CircleCheckBig :size="14" /> Terminar orden ({{ conError }} {{ conError === 1 ? 'error' : 'errores' }})
        </button>
        <button class="btn btn-sm" :class="{ 'btn-primary': !orden.ciudadEnvio }" @click="emit('ciudad')">
          <MapPin :size="14" /> {{ orden.ciudadEnvio || 'Asignar ciudad' }}
        </button>
        <button class="btn btn-sm" :disabled="enAlmuerzo" @click="emit('agregar-plu')"><Plus :size="14" /> Agregar PLU</button>
        <button class="btn btn-sm" @click="emit('faltante')"><PackageX :size="14" /> Reportar faltante</button>
        <button class="btn btn-sm" @click="emit('unirse')"><UserPlus :size="14" /> Entrar a la orden</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': enAlmuerzo }" @click="emit('almuerzo', enAlmuerzo ? 'terminar' : 'iniciar')">
          <Utensils :size="14" /> {{ enAlmuerzo ? 'Terminar almuerzo' : 'Almuerzo' }}
        </button>
        <button class="btn btn-sm" @click="emit('asignar')">
          {{ orden.inspector ? `Inspector: ${orden.inspector.nombre}` : 'Tomar la orden' }}
        </button>
      </div>
    </header>

    <!-- Salir no pierde nada: decirlo en pantalla evita que el inspector se
         quede pegado a una PC por miedo a perder su trabajo. -->
    <p class="nota">
      Puedes salir cuando quieras: los tiempos siguen corriendo y la orden queda donde la dejaste.
    </p>

    <section class="orden-head">
      <div>
        <span class="orden-tipo">{{ orden.tipoOrden }}</span>
        <h2 class="orden-codigo">{{ orden.codigo }}</h2>
        <p class="orden-meta">
          {{ orden.resumen.inspeccionadas }} de {{ orden.resumen.total }} PLU listos ·
          en inspección hace <strong class="vivo">{{ cronometro(orden.horaPasoInspeccion, ahora) }}</strong>
        </p>
        <p class="orden-meta">
          {{ fmtKg(orden.volumen.kg) }} · {{ fmtM3(orden.volumen.m3) }}
          <template v-if="orden.volumen.lineasSinMedida">
            · {{ orden.volumen.lineasSinMedida }} PLU sin medidas en el maestro
          </template>
        </p>
        <p v-if="orden.tiendaOrigenNombre" class="orden-meta">De tienda: <strong>{{ orden.tiendaOrigenNombre }}</strong></p>
        <p v-if="orden.cliente" class="orden-meta">Cliente: {{ orden.cliente }}</p>
        <p v-if="orden.inspectores.length" class="orden-meta">
          En la orden: <span v-for="(i, n) in orden.inspectores" :key="i.id">{{ n ? ', ' : '' }}{{ i.nombre }}</span>
        </p>
      </div>
    </section>

    <!-- Sin ciudad no se puede empezar: es lo que agrupa la entrega. -->
    <p v-if="!orden.ciudadEnvio" class="aviso">
      Asigna la ciudad de envío para poder empezar a inspeccionar.
    </p>

    <p v-if="esAdmin && conError > 0 && faltanSinError > 0" class="aviso">
      Hay {{ conError }} {{ conError === 1 ? 'PLU con error' : 'PLU con error' }}. Para terminar la orden faltan
      {{ faltanSinError }} PLU sin error por inspeccionar.
    </p>

    <p v-if="enAlmuerzo" class="aviso">
      Orden en almuerzo. Los tiempos están detenidos hasta que lo termines.
    </p>

    <p v-if="avisarSinDueno" class="aviso">
      Nadie ha tomado esta orden todavía. Al empezar se te pedirá tu nombre.
    </p>

    <ul class="lineas">
      <li
        v-for="l in orden.lineas" :key="l.id" class="linea"
        :style="{ '--c': ESTADO_LINEA_TONE[l.estado] }"
      >
        <div class="l-info">
          <strong class="l-plu">{{ l.plu }}</strong>
          <span v-if="l.descripcion" class="l-desc">{{ l.descripcion }}</span>
          <p class="l-meta">
            {{ l.unidades }} unid. · caja {{ l.numeroCaja || '—' }} · {{ l.ubicacion || '—' }}
          </p>
          <p v-if="l.errorPicking" class="l-error">
            <Flag :size="13" /> Error de picking: {{ TIPO_ERROR_PICKING_LABEL[l.errorPicking.tipo] ?? l.errorPicking.tipo }}
            <span v-if="l.errorPicking.nota"> · {{ l.errorPicking.nota }}</span>
          </p>
          <p v-if="l.averiado" class="l-averia">
            <TriangleAlert :size="13" />
            {{ l.esperandoReposicion ? 'Averiado: esperando repuesto de picking' : 'Averiado: repuesto recibido, vuelve a inspeccionarlo' }}
            <span v-if="l.motivoAveria"> · {{ l.motivoAveria }}</span>
          </p>
          <p v-if="l.motivoEbanisteria" class="l-motivo">
            Ebanistería: {{ l.motivoEbanisteria }}
            <span v-if="l.enviadoEbanisteriaPor"> · envió {{ l.enviadoEbanisteriaPor.nombre }}</span>
          </p>
        </div>

        <div class="l-estado">
          <span class="l-chip">{{ ESTADO_LINEA_LABEL[l.estado] }}</span>
          <span class="l-reloj mono tnum" :class="{ vivo: l.estado === 'EN_INSPECCION' || l.estado === 'EN_EBANISTERIA' }">
            {{ reloj(l) }}
          </span>
          <span v-if="l.inspector" class="l-quien">{{ l.inspector.nombre }}</span>
        </div>

        <div class="l-acciones">
          <button
            v-if="l.estado === 'PICKEADA' && !l.esperandoReposicion" class="btn btn-sm btn-primary"
            :disabled="guardando || enAlmuerzo" @click="emit('iniciar', l)"
          >
            <Play :size="14" /> Iniciar
          </button>

          <span v-else-if="l.esperandoReposicion" class="l-espera">
            <TriangleAlert :size="14" /> Esperando repuesto
          </span>

          <template v-else-if="l.estado === 'EN_INSPECCION'">
            <button class="btn btn-sm btn-primary" :disabled="guardando || enAlmuerzo" @click="emit('completar', l)">
              <Check :size="14" /> Completar
            </button>
            <button class="btn btn-sm" :disabled="guardando" @click="emit('ebanisteria', l)">
              <Hammer :size="14" /> A ebanistería
            </button>
            <button class="btn btn-sm" :disabled="guardando" @click="emit('averia', l)">
              <TriangleAlert :size="14" /> Averiado
            </button>
          </template>

          <button
            v-else-if="l.estado === 'EN_EBANISTERIA'" class="btn btn-sm"
            :disabled="guardando" @click="emit('recibir-ebanisteria', l)"
          >
            <Undo2 :size="14" /> Entregado por ebanistería
          </button>

          <span v-else class="l-ok"><Check :size="14" /> Listo</span>

          <button
            v-if="esAdmin" class="btn btn-sm error-btn" :class="{ marcado: l.errorPicking }"
            :disabled="guardando" @click="emit('error-picking', l)"
          >
            <Flag :size="13" /> {{ l.errorPicking ? 'Editar error' : 'Error picking' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.head-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
.nota { margin: 0 0 16px; font-size: 12px; color: var(--muted); }

.orden-head { margin-bottom: 14px; }
.orden-tipo { display: inline-block; padding: 2px 9px; border-radius: var(--r-pill); font-size: 10.5px; font-weight: 800; letter-spacing: .06em; color: var(--brand); background: var(--brand-tint); }
.orden-codigo { margin: 6px 0 2px; font-size: 22px; font-weight: 800; color: var(--ink); }
.orden-meta { margin: 0; font-size: 12.5px; color: var(--muted); }
.vivo { color: var(--brand); font-weight: 700; }
.aviso { margin: 0 0 14px; padding: 10px 13px; border-radius: var(--r-sm); font-size: 12.5px; font-weight: 600; color: var(--u-aviso); background: color-mix(in srgb, var(--u-aviso) 10%, transparent); border: 1px solid color-mix(in srgb, var(--u-aviso) 30%, transparent); }

.lineas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.linea {
  display: flex; align-items: center; gap: 14px; padding: 13px 15px; flex-wrap: wrap;
  border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface);
  box-shadow: inset 3px 0 0 var(--c);
}
.l-info { flex: 1 1 240px; min-width: 0; }
.l-plu { font-size: 15px; font-weight: 800; color: var(--ink); }
.l-desc { margin-left: 8px; font-size: 12.5px; color: var(--ink-2); }
.l-meta { margin: 3px 0 0; font-size: 11.5px; color: var(--muted); }
.l-motivo { margin: 4px 0 0; font-size: 11.5px; font-weight: 600; color: var(--u-aviso); }
.l-error { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin: 4px 0 0; font-size: 11.5px; font-weight: 700; color: var(--error); }
.error-btn { color: var(--error); }
.error-btn.marcado { border-color: var(--error); background: var(--error-tint); }
.l-averia { display: flex; align-items: center; gap: 5px; margin: 4px 0 0; font-size: 11.5px; font-weight: 700; color: var(--error); }
.l-espera { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--error); }

.l-estado { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 120px; }
.l-chip { padding: 3px 9px; border-radius: var(--r-pill); font-size: 11px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 13%, transparent); }
.l-reloj { font-size: 12.5px; font-weight: 700; color: var(--muted); }
.l-reloj.vivo { color: var(--c); }
.l-quien { font-size: 11px; color: var(--muted); }

.l-acciones { display: flex; gap: 7px; flex-wrap: wrap; }
.l-ok { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--u-ok); }

@media (max-width: 640px) {
  .linea { align-items: flex-start; }
  .l-acciones { flex: 1 1 100%; }
  .l-acciones .btn { flex: 1; justify-content: center; }
}
</style>

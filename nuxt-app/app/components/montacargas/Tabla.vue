<script setup lang="ts">
// Tabla en escritorio, lista de cards por debajo de 760px (sin scroll horizontal).
// Mismas columnas que la planilla de montacargas, para que quien viene del
// Google Sheet reconozca la vista.
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Pencil, Trash2, TriangleAlert } from '@lucide/vue'
import {
  ESTADO_MOVIMIENTO_LABEL, ESTADO_MOVIMIENTO_TONE, esUbicacionCanonica, fmtTiempo,
  fmtFechaCorta, fmtHoraMovimiento, requiereUbicacionInicial,
  type Movimiento, type TipoMovimiento,
} from '~/utils/montacargas'

const props = defineProps<{
  items: Movimiento[]
  tipo: TipoMovimiento
  canManage: boolean
  userId?: string
}>()
const emit = defineEmits<{
  (e: 'editar', item: Movimiento): void
  (e: 'borrar', item: Movimiento): void
}>()

const esCompacto = useMediaQuery('(max-width: 760px)')
const muestraOrigen = computed(() => requiereUbicacionInicial(props.tipo))

// Editar: gestores cualquiera, el resto solo lo propio (espejo del gate de servidor).
function puedeEditar(item: Movimiento) {
  return props.canManage || item.creadoPorId === props.userId
}

function badge(item: Movimiento) {
  return {
    label: item.pausaId ? 'En pausa' : ESTADO_MOVIMIENTO_LABEL[item.estado],
    tone: ESTADO_MOVIMIENTO_TONE[item.estado],
  }
}

// Ubicacion fuera del formato canonico: se marca para que supervision pueda
// revisarla, no para bloquearla (INSPECCION, MUEBLES... son legitimas).
const librs = computed(
  () => new Set(
    props.items
      .filter((i) => i.ubicacionFinal && !esUbicacionCanonica(i.ubicacionFinal))
      .map((i) => i.id),
  ),
)
</script>

<template>
  <div class="card table-card">
    <!-- Escritorio -->
    <table v-if="!esCompacto" class="table">
      <thead>
        <tr>
          <th>Fecha</th><th>Montacarguista</th><th>PLU</th><th>Descripción</th>
          <th class="num">Cajas</th><th class="num">Und/caja</th><th class="num">Reguero</th>
          <th class="num">Total</th><th>Responsable</th>
          <th v-if="muestraOrigen">Ubic. inicial</th>
          <th>Depósito final</th><th>Inicio</th><th>Estado</th>
          <th class="num">T. montacarguista</th><th class="num">T. ayudante</th><th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td class="muted">{{ fmtFechaCorta(item.fecha) }}</td>
          <td class="op">{{ item.creadoPorNombre ?? '—' }}</td>
          <td class="mono strong">{{ item.plu }}</td>
          <td class="desc" :title="item.descripcion">
            {{ item.descripcion }}
            <!-- Es lo que no cupo en otra ubicacion: sin esto se lee como una
                 estiba nueva salida de la nada, con un total que no cuadra. -->
            <span v-if="item.origenId" class="chip-sob" title="Sobrante de otro registro">
              Sobrante
            </span>
          </td>
          <td class="tnum">{{ item.cajas }}</td>
          <td class="tnum">
            {{ item.unidadesPorCaja }}
            <span v-if="item.unidadesManuales" class="manual" title="Escrita a mano: el maestro no la tenía">·M</span>
          </td>
          <td class="tnum">
            <span v-if="item.hayReguero" class="reguero">{{ item.unidadesSueltas }}</span>
            <span v-else class="muted">—</span>
          </td>
          <td class="tnum strong">
            {{ item.cantidadTotal }}
            <span v-if="item.numeroPedido" class="pedido mono" :title="`Pedido ${item.numeroPedido}`">{{ item.numeroPedido }}</span>
          </td>
          <td class="op">{{ item.responsableNombre ?? '—' }}</td>
          <td v-if="muestraOrigen">
            <span v-if="item.ubicacionInicial" class="ubic">{{ item.ubicacionInicial }}</span>
            <span v-else class="muted">—</span>
          </td>
          <td>
            <template v-if="item.ubicacionFinal">
              <span class="ubic" :class="{ libre: librs.has(item.id) }">{{ item.ubicacionFinal }}</span>
              <TriangleAlert
                v-if="librs.has(item.id)" :size="11" class="ub-libre"
                aria-label="Ubicación fuera del formato canónico"
              />
            </template>
            <span v-else class="muted">—</span>
          </td>
          <td class="muted tnum">{{ fmtHoraMovimiento(item.horaInicio) }}</td>
          <td>
            <Badge v-bind="badge(item)" />
            <span v-if="item.horaFinalizacion" class="fin tnum">{{ fmtHoraMovimiento(item.horaFinalizacion) }}</span>
          </td>
          <!-- Dos tiempos separados: hasta el traspaso y desde el traspaso. Una
               sola cifra escondia quien hizo que parte del trabajo. -->
          <td class="tnum">{{ fmtTiempo(item.segundosMontacarguista) }}</td>
          <td class="tnum">
            <span v-if="item.segundosAyudante == null" class="muted" title="No se paso a un ayudante">—</span>
            <template v-else>{{ fmtTiempo(item.segundosAyudante) }}</template>
          </td>
          <td class="acciones">
            <button v-if="puedeEditar(item)" class="btn-icon" title="Editar" @click="emit('editar', item)">
              <Pencil :size="13" />
            </button>
            <button v-if="canManage" class="btn-icon danger" title="Borrar" @click="emit('borrar', item)">
              <Trash2 :size="13" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Movil -->
    <div v-else class="cards">
      <article v-for="item in items" :key="item.id" class="rowcard">
        <header class="rc-top">
          <span class="mono strong">{{ item.plu }}</span>
          <Badge v-bind="badge(item)" />
        </header>
        <p class="rc-desc">
          {{ item.descripcion }}
          <span v-if="item.origenId" class="chip-sob">Sobrante</span>
        </p>
        <dl class="rc-meta">
          <div><dt>Fecha</dt><dd>{{ fmtFechaCorta(item.fecha) }}</dd></div>
          <div><dt>Cajas</dt><dd class="tnum">{{ item.cajas }} × {{ item.unidadesPorCaja }}</dd></div>
          <div><dt>Reguero</dt><dd class="tnum">{{ item.hayReguero ? item.unidadesSueltas : '—' }}</dd></div>
          <div><dt>Total</dt><dd class="tnum strong">{{ item.cantidadTotal }}</dd></div>
          <div v-if="muestraOrigen"><dt>Inicial</dt><dd class="mono">{{ item.ubicacionInicial ?? '—' }}</dd></div>
          <div><dt>Final</dt><dd class="mono">{{ item.ubicacionFinal ?? '—' }}</dd></div>
          <div><dt>T. montacarg.</dt><dd class="tnum">{{ fmtTiempo(item.segundosMontacarguista) }}</dd></div>
          <div>
            <dt>T. ayudante</dt>
            <dd class="tnum">{{ item.segundosAyudante == null ? '—' : fmtTiempo(item.segundosAyudante) }}</dd>
          </div>
        </dl>
        <footer v-if="puedeEditar(item) || canManage" class="rc-acc">
          <button v-if="puedeEditar(item)" class="btn-icon" @click="emit('editar', item)"><Pencil :size="13" /> Editar</button>
          <button v-if="canManage" class="btn-icon danger" @click="emit('borrar', item)"><Trash2 :size="13" /> Borrar</button>
        </footer>
      </article>
    </div>

    <EmptyState
      v-if="items.length === 0"
      title="Sin registros" description="No hay registros que coincidan con los filtros."
    />
  </div>
</template>

<style scoped>
/* La tabla es mas ancha que la tarjeta en pantallas normales: con
   `overflow: hidden` las ultimas columnas (estado, tiempo, acciones) se
   recortaban y no habia forma de verlas. Scroll horizontal DENTRO de la
   tarjeta, nunca en el body de la pagina. */
.table-card { overflow-x: auto; overflow-y: visible; }
/* Ancho suficiente para que ninguna columna se comprima: con menos, los codigos
   de ubicacion (05-J-14-05-01) y las horas se partian en tres lineas y la fila
   crecia a 100px de alto. */
.table { width: 100%; min-width: 1480px; border-collapse: separate; border-spacing: 0; }

/* Cabecera fija dentro del scroll de la tarjeta: al desplazarse a la derecha o
   hacia abajo se sigue sabiendo que columna se esta mirando. */
.table thead th { position: sticky; top: 0; z-index: 1; }
.table th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--muted); padding: 11px 14px; white-space: nowrap;
  background: var(--surface-2); border-bottom: 1px solid var(--border-strong);
}
.table th.num { text-align: right; }

/* Una linea por celda: lo que rompia la tabla era el salto de linea, no el ancho. */
.table td {
  padding: 10px 14px; font-size: 13px; color: var(--ink-2); white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
.table td.tnum { text-align: right; }
.table tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--surface-2) 55%, transparent); }
.table tbody tr:hover td { background: var(--brand-tint); }
.table tbody tr:last-child td { border-bottom: none; }

.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--muted); }
.op { font-size: 12.5px; }
/* La unica columna que puede recortarse: el resto son cifras y codigos. */
.desc { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.fin { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; }
.manual { font-size: 10px; font-weight: 700; color: var(--u-aviso); }
.reguero { font-weight: 600; color: var(--u-aviso); }
.ub-libre { color: var(--u-aviso); vertical-align: -1px; margin-left: 3px; }

/* La ubicacion es una matricula, no una frase: se lee mejor como etiqueta. */
.ubic {
  display: inline-block; padding: 2px 7px; border-radius: var(--r-xs);
  background: var(--surface-3); border: 1px solid var(--border);
  font-family: var(--mono); font-size: 12px; font-variant-numeric: tabular-nums;
  letter-spacing: .01em; color: var(--ink-2);
}
.ubic.libre { border-color: color-mix(in srgb, var(--u-aviso) 45%, transparent); background: var(--u-aviso-tint); color: var(--ink); }
.acciones { display: flex; gap: 6px; }
.btn-icon { display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border-radius: var(--r-xs); border: 1px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; font-size: 12px; }
.btn-icon:hover { background: var(--surface-3); color: var(--ink); }
.btn-icon.danger:hover { color: var(--u-critico); border-color: color-mix(in srgb, var(--u-critico) 40%, transparent); }

.cards { display: flex; flex-direction: column; }
.rowcard { padding: 13px 14px; border-bottom: 1px solid var(--border); }
.rowcard:last-child { border-bottom: none; }
.rc-top { display: flex; align-items: center; gap: 9px; }
.rc-top .strong { font-size: 14px; }
.rc-desc { margin: 7px 0 10px; font-size: 12.5px; color: var(--ink-2); }
.rc-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px 12px; margin: 0; }
.rc-meta dt { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--faint); }
.rc-meta dd { margin: 1px 0 0; font-size: 12.5px; color: var(--ink-2); }
.rc-acc { display: flex; gap: 8px; margin-top: 11px; }
.chip-sob {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border: 1px solid var(--u-aviso);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .03em;
  text-transform: uppercase;
  color: var(--u-aviso);
  vertical-align: middle;
}
.pedido { display: block; font-size: 10.5px; font-weight: 600; color: var(--muted); }
</style>

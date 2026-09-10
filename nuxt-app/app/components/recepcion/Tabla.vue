<script setup lang="ts">
// Listado de recepciones. Mismas reglas que las tablas de montacargas: una línea
// por celda, cabecera fija y números a la derecha — los códigos y las cifras
// partidos en varias líneas hacían la tabla ilegible.
import { computed } from 'vue'
import { FileWarning, Trash2, Camera } from '@lucide/vue'
import {
  ESTADO_RECEPCION_LABEL, fmtFechaRecepcion, fmtHoraRecepcion, fmtTiempoRecepcion,
  TIPO_PRODUCTO_LABEL, TIPO_NOVEDAD_RECEPCION_LABEL,
  type Recepcion,
} from '~/utils/recepcion'

const props = defineProps<{
  items: Recepcion[]
  canManage: boolean
  userId: string | undefined
  esCompacto: boolean
}>()
const emit = defineEmits<{
  (e: 'novedades', item: Recepcion): void
  (e: 'borrar', item: Recepcion): void
}>()

function tono(item: Recepcion) {
  return item.estado === 'CERRADO' ? 'ok' : 'info'
}

// Resumen de novedades para la fila: "2 faltantes · 1 avería" dice más que un
// número suelto, que obliga a abrir el detalle para saber si es grave.
function resumenNovedades(item: Recepcion): string {
  if (!item.novedades.length) return ''
  const porTipo = new Map<string, number>()
  for (const n of item.novedades) porTipo.set(n.tipo, (porTipo.get(n.tipo) ?? 0) + 1)
  return [...porTipo.entries()]
    .map(([t, n]) => `${n} ${TIPO_NOVEDAD_RECEPCION_LABEL[t as keyof typeof TIPO_NOVEDAD_RECEPCION_LABEL]}`)
    .join(' · ')
}

const conFoto = computed(
  () => new Set(props.items.filter((i) => i.novedades.some((n) => n.fotoUrl)).map((i) => i.id)),
)
</script>

<template>
  <div class="card table-card">
    <table v-if="!esCompacto" class="table">
      <thead>
        <tr>
          <th>Fecha</th><th>Pedido</th><th>Proveedor</th><th>Tipo</th>
          <th class="num">Peso</th><th class="num">Refs.</th><th class="num">Cajas</th>
          <th class="num">Unidades</th><th class="num">Estibas</th>
          <th class="num">Refs. nuevas</th><th class="num">Und. nuevas</th>
          <th>Personas</th><th>Operario</th><th>Inicio</th><th>Estado</th>
          <th class="num">Duración</th><th>Novedades</th><th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td class="muted">{{ fmtFechaRecepcion(item.fecha) }}</td>
          <td class="mono strong">{{ item.numeroPedido }}</td>
          <td class="prov" :title="item.proveedor">{{ item.proveedor }}</td>
          <td>{{ TIPO_PRODUCTO_LABEL[item.tipoProducto] }}</td>
          <td class="tnum">{{ item.pesoKg }} kg</td>
          <td class="tnum">{{ item.referenciasEsperadas }}</td>
          <td class="tnum">{{ item.cajas }}</td>
          <td class="tnum strong">{{ item.unidades }}</td>
          <td class="tnum">{{ item.estibasUsadas ?? '—' }}</td>
          <td class="tnum">{{ item.referenciasNuevas ?? '—' }}</td>
          <td class="tnum">{{ item.unidadesNuevas ?? '—' }}</td>
          <td class="pers" :title="item.descargadores.map((d) => d.nombre).join(', ')">
            {{ item.descargadores.length }}
          </td>
          <td class="op">{{ item.creadoPorNombre ?? '—' }}</td>
          <td class="muted tnum">{{ fmtHoraRecepcion(item.horaInicio) }}</td>
          <td>
            <Badge :label="ESTADO_RECEPCION_LABEL[item.estado]" :tone="tono(item)" />
            <span v-if="item.horaFinalizacion" class="fin tnum">
              {{ fmtHoraRecepcion(item.horaFinalizacion) }}
            </span>
          </td>
          <td class="tnum">{{ fmtTiempoRecepcion(item.duracionSegundos) }}</td>
          <td class="nov" :title="resumenNovedades(item)">
            <template v-if="item.novedades.length">
              <span class="nov-txt">{{ resumenNovedades(item) }}</span>
              <Camera v-if="conFoto.has(item.id)" :size="12" class="nov-foto" />
            </template>
            <span v-else class="muted">—</span>
          </td>
          <td class="acciones">
            <button
              v-if="item.estado === 'CERRADO'" class="btn-icon"
              title="Reportes de novedad" @click="emit('novedades', item)"
            >
              <FileWarning :size="13" />
            </button>
            <button v-if="canManage" class="btn-icon danger" title="Borrar" @click="emit('borrar', item)">
              <Trash2 :size="13" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Móvil: la tabla de 18 columnas no cabe, así que cada fila es una tarjeta. -->
    <div v-else class="cards">
      <article v-for="item in items" :key="item.id" class="rowcard">
        <div class="rc-top">
          <b class="mono strong">{{ item.numeroPedido }}</b>
          <Badge :label="ESTADO_RECEPCION_LABEL[item.estado]" :tone="tono(item)" />
          <span class="rc-dur tnum">{{ fmtTiempoRecepcion(item.duracionSegundos) }}</span>
        </div>
        <p class="rc-prov">{{ item.proveedor }} · {{ TIPO_PRODUCTO_LABEL[item.tipoProducto] }}</p>
        <dl class="rc-meta">
          <div><dt>Unidades</dt><dd class="tnum">{{ item.unidades }}</dd></div>
          <div><dt>Cajas</dt><dd class="tnum">{{ item.cajas }}</dd></div>
          <div><dt>Estibas</dt><dd class="tnum">{{ item.estibasUsadas ?? '—' }}</dd></div>
          <div><dt>Refs. nuevas</dt><dd class="tnum">{{ item.referenciasNuevas ?? '—' }}</dd></div>
          <div><dt>Personas</dt><dd class="tnum">{{ item.descargadores.length }}</dd></div>
          <div><dt>Operario</dt><dd>{{ item.creadoPorNombre ?? '—' }}</dd></div>
        </dl>
        <p v-if="item.novedades.length" class="rc-nov">{{ resumenNovedades(item) }}</p>
        <div class="rc-acc">
          <button v-if="item.estado === 'CERRADO'" class="btn btn-sm" @click="emit('novedades', item)">
            <FileWarning :size="13" /> Reportes
          </button>
          <button v-if="canManage" class="btn btn-sm" @click="emit('borrar', item)">
            <Trash2 :size="13" /> Borrar
          </button>
        </div>
      </article>
    </div>

    <EmptyState
      v-if="items.length === 0"
      title="Sin recepciones" description="No hay contenedores que coincidan con los filtros."
    />
  </div>
</template>

<style scoped>
/* Scroll horizontal DENTRO de la tarjeta, nunca en el body de la página. */
.table-card { overflow-x: auto; overflow-y: visible; }
.table { width: 100%; min-width: 1600px; border-collapse: separate; border-spacing: 0; }

.table thead th { position: sticky; top: 0; z-index: 1; }
.table th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--muted); padding: 11px 14px; white-space: nowrap;
  background: var(--surface-2); border-bottom: 1px solid var(--border-strong);
}
.table th.num { text-align: right; }
/* Una línea por celda: lo que rompe una tabla ancha es el salto de línea. */
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
.op, .prov { font-size: 12.5px; }
/* Las dos únicas columnas que pueden recortarse: el resto son cifras. */
.prov { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
.nov { max-width: 210px; overflow: hidden; text-overflow: ellipsis; color: var(--u-aviso); }
.nov-txt { font-size: 12.5px; }
.nov-foto { vertical-align: -2px; margin-left: 4px; }
.pers { text-align: center; }
.fin { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; }
.acciones { display: flex; gap: 6px; }
.btn-icon { display: inline-flex; align-items: center; padding: 5px 9px; border-radius: var(--r-xs); border: 1px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; }
.btn-icon:hover { background: var(--surface-3); color: var(--ink); }
.btn-icon.danger:hover { color: var(--u-critico); border-color: color-mix(in srgb, var(--u-critico) 40%, transparent); }

.cards { display: flex; flex-direction: column; }
.rowcard { padding: 13px 14px; border-bottom: 1px solid var(--border); }
.rowcard:last-child { border-bottom: none; }
.rc-top { display: flex; align-items: center; gap: 9px; }
.rc-dur { margin-left: auto; font-size: 13px; color: var(--brand); font-weight: 700; }
.rc-prov { margin: 7px 0 10px; font-size: 12.5px; color: var(--ink-2); }
.rc-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px 12px; margin: 0; }
.rc-meta dt { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--faint); }
.rc-meta dd { margin: 1px 0 0; font-size: 12.5px; color: var(--ink-2); }
.rc-nov { margin: 10px 0 0; font-size: 12px; color: var(--u-aviso); }
.rc-acc { display: flex; gap: 8px; margin-top: 11px; }
</style>

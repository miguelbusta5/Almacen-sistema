<script setup lang="ts">
import { ref, computed } from 'vue'
import { CheckSquare, Package, Truck, Store, AlertTriangle, CheckCircle2, RefreshCw } from '@lucide/vue'
import { calcSla, diasRestantesSla, SLA_COLOR, SLA_LABEL, type SlaEstado } from '~/utils/sla'
import { urgencia } from '~/utils/guardado'
import { horasDesde } from '~/utils/despacho'
import { ensureSession, useSessionState } from '~/composables/useSession'
import { useAutoRefresh, formatLastUpdated } from '~/composables/useAutoRefresh'

definePageMeta({ title: 'Mis Tareas' })

const { me } = useSessionState()
const loading = ref(true)
const data = ref<MisTareas | null>(null)

interface TareaNovedad { id: string; plu: string; posicion: string; estado: string; fabricante: string | null; asignadoA: string | null; fechaCompromiso: string | null; esPropio: boolean }
interface TareaGuardado { id: string; clientId: string; documento: string; ubicacion: string; estado: string; fecha: string; nota: string | null; tipo: string | null }
interface TareaGuardadoTienda { id: string; despachoId: string; nota: string | null; createdAt: string; documento: string; clienteNombre: string; centroCostos: string; numeroCajas: number | null }
interface TareaDespacho { id: string; centroCostos: string; numeroDocumento: string; clienteNombre: string; estado: string; fechaCreacion: string; fechaEntregaComprometida: string | null; createdAt: string }
interface MisTareas { novedades: TareaNovedad[]; guardados: TareaGuardado[]; guardadosTiendaPendientes: TareaGuardadoTienda[]; despachosTienda: TareaDespacho[]; notifNoLeidas: number }

async function load() {
  try {
    const res = await $fetch<{ success: boolean; data: MisTareas }>('/api/mis-tareas')
    data.value = res.data
  } catch {
    data.value = null
  }
}

onMounted(async () => {
  ensureSession()
  await load()
  loading.value = false
})

const { refreshing, lastUpdatedAt, refreshNow } = useAutoRefresh({
  onRefresh: load,
})

async function refresh() {
  if (refreshing.value) return
  loading.value = true
  await load()
  loading.value = false
  void refreshNow()
}

const kpis = computed(() => {
  if (!data.value) return { total: 0, vencidas: 0, proximas: 0 }
  return {
    total: data.value.novedades.length + data.value.guardados.length + data.value.guardadosTiendaPendientes.length + data.value.despachosTienda.length,
    vencidas: data.value.novedades.filter((n) => calcSla(n.fechaCompromiso) === 'VENCIDO').length,
    proximas: [
      ...data.value.novedades.filter((n) => calcSla(n.fechaCompromiso) === 'PROXIMO'),
      ...data.value.guardados.filter((g) => { const u = urgencia(g); return u?.tipo === 'proxima' }),
      ...data.value.despachosTienda.filter((d) => { if (!d.fechaEntregaComprometida) return false; return calcSla(d.fechaEntregaComprometida) === 'PROXIMO' }),
    ].length,
  }
})

const hora = new Date().getHours()
const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'
const userName = computed(() => me.value?.name ?? '')

function fmtFecha(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
</script>

<template>
  <div class="page">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-left">
        <div class="hero-kicker">Bandeja personal</div>
        <h1 class="hero-title">Mis Tareas</h1>
        <p class="hero-desc">{{ saludo }}{{ userName ? `, ${userName}` : '' }} / {{ new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) }}</p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm refresh" :class="{ spin: refreshing || loading }" @click="refresh">
          <RefreshCw :size="14" />
          {{ refreshing || loading ? 'Actualizando…' : 'Actualizar' }}
        </button>
        <span class="hlp">{{ formatLastUpdated(lastUpdatedAt) }}</span>
      </div>
    </section>

    <!-- KPIs -->
    <div v-if="!loading && data" class="kpis">
      <div class="kpi">
        <div class="kpi-val">{{ kpis.total }}</div>
        <div class="kpi-lbl">Tareas pendientes</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" :class="{ err: kpis.vencidas > 0 }">{{ kpis.vencidas }}</div>
        <div class="kpi-lbl">SLA vencidas</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" :class="{ warn: kpis.proximas > 0 }">{{ kpis.proximas }}</div>
        <div class="kpi-lbl">Próximas a vencer</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="skels">
      <div v-for="i in 5" :key="i" class="skeleton" style="height:60px;border-radius:10px" />
    </div>

    <!-- Error -->
    <EmptyState v-else-if="!data" title="Error al cargar" description="Intenta actualizar.">
      <template #icon><CheckSquare :size="22" /></template>
    </EmptyState>

    <!-- Content -->
    <template v-else>
      <!-- Novedades -->
      <div v-if="data.novedades.length > 0" class="sec">
        <div class="sec-hd">
          <div class="sec-ic"><Package :size="15" /></div>
          <span class="sec-tt">Novedades asignadas</span>
          <span class="sec-cnt">{{ data.novedades.length }}</span>
        </div>
        <div class="sec-cards">
          <a v-for="n in data.novedades.slice(0, 10)" :key="n.id" href="/dashboard/inventario" class="card" :class="{ alerta: calcSla(n.fechaCompromiso) === 'VENCIDO' }">
            <AlertTriangle v-if="calcSla(n.fechaCompromiso) === 'VENCIDO'" :size="14" class="card-alert" />
            <div class="card-body">
              <div class="card-tit">PLU {{ n.plu }} / {{ n.posicion }}</div>
              <div v-if="n.fabricante" class="card-sub">{{ n.fabricante }}</div>
            </div>
            <div class="card-side">
              <span v-if="n.fechaCompromiso" class="card-bdg" :style="{ '--c': SLA_COLOR[calcSla(n.fechaCompromiso)] }">
                {{ (() => { const s = calcSla(n.fechaCompromiso); const d = diasRestantesSla(n.fechaCompromiso); return s === 'VENCIDO' ? `Vencido ${Math.abs(d!)}d` : s === 'PROXIMO' ? `${d}d restantes` : SLA_LABEL[s] })() }}
              </span>
              <span v-else class="card-bdg" :style="{ '--c': 'var(--muted)' }">{{ n.estado }}</span>
              <span class="card-tm">{{ n.esPropio ? 'mía' : n.asignadoA ?? '' }}</span>
            </div>
          </a>
          <div v-if="data.novedades.length > 10" class="sec-more">+{{ data.novedades.length - 10 }} más en <a href="/dashboard/inventario" class="sec-link">Novedades</a></div>
        </div>
      </div>

      <!-- Guardados pendientes -->
      <div v-if="data.guardados.length > 0" class="sec">
        <div class="sec-hd">
          <div class="sec-ic"><Truck :size="15" /></div>
          <span class="sec-tt">Guardados pendientes</span>
          <span class="sec-cnt">{{ data.guardados.length }}</span>
        </div>
        <div class="sec-cards">
          <a v-for="g in data.guardados.slice(0, 8)" :key="g.clientId" href="/dashboard/transporte" class="card" :class="{ alerta: urgencia(g)?.tipo === 'vencida' }">
            <AlertTriangle v-if="urgencia(g)?.tipo === 'vencida'" :size="14" class="card-alert" />
            <div class="card-body">
              <div class="card-tit">{{ g.documento }}</div>
              <div class="card-sub">{{ g.ubicacion }}{{ g.tipo ? ` / ${g.tipo}` : '' }}</div>
            </div>
            <div class="card-side">
              <span class="card-bdg" :style="{ '--c': urgencia(g)?.tipo === 'vencida' ? 'var(--error)' : urgencia(g)?.tipo === 'proxima' ? 'var(--warning)' : 'var(--muted)' }">
                {{ (() => { const u = urgencia(g); return u?.tipo === 'vencida' ? `Entrega vencida ${u.dias}d` : u?.tipo === 'proxima' ? `${u.dias}d para entrega` : 'Pendiente' })() }}
              </span>
              <span class="card-tm">{{ fmtFecha(g.fecha) }}</span>
            </div>
          </a>
          <div v-if="data.guardados.length > 8" class="sec-more">+{{ data.guardados.length - 8 }} más en <a href="/dashboard/transporte" class="sec-link">Transporte</a></div>
        </div>
      </div>

      <!-- Despachos tienda por guardar -->
      <div v-if="data.guardadosTiendaPendientes.length > 0" class="sec">
        <div class="sec-hd">
          <div class="sec-ic"><Truck :size="15" /></div>
          <span class="sec-tt">Despachos de tienda por guardar</span>
          <span class="sec-cnt">{{ data.guardadosTiendaPendientes.length }}</span>
        </div>
        <div class="sec-cards">
          <a v-for="p in data.guardadosTiendaPendientes.slice(0, 8)" :key="p.id" href="/dashboard/transporte" class="card">
            <div class="card-body">
              <div class="card-tit">{{ p.documento }} / {{ p.clienteNombre }}</div>
              <div class="card-sub">{{ p.centroCostos }}{{ p.numeroCajas ? ` / ${p.numeroCajas} cajas` : '' }}</div>
            </div>
            <div class="card-side">
              <span class="card-bdg" style="--c:var(--brand)">Pendiente por guardar</span>
              <span class="card-tm">{{ new Date(p.createdAt).toLocaleDateString('es-CO') }}</span>
            </div>
          </a>
          <div v-if="data.guardadosTiendaPendientes.length > 8" class="sec-more">+{{ data.guardadosTiendaPendientes.length - 8 }} más en <a href="/dashboard/transporte" class="sec-link">Transporte</a></div>
        </div>
      </div>

      <!-- Despachos tienda pendientes -->
      <div v-if="data.despachosTienda.length > 0" class="sec">
        <div class="sec-hd">
          <div class="sec-ic"><Store :size="15" /></div>
          <span class="sec-tt">Despachos tienda pendientes</span>
          <span class="sec-cnt">{{ data.despachosTienda.length }}</span>
        </div>
        <div class="sec-cards">
          <a v-for="d in data.despachosTienda.slice(0, 8)" :key="d.id" href="/dashboard/tienda" class="card" :class="{ alerta: horasDesde(d.createdAt) >= 24 || (d.fechaEntregaComprometida !== null && calcSla(d.fechaEntregaComprometida) === 'VENCIDO') }">
            <AlertTriangle v-if="horasDesde(d.createdAt) >= 24 || calcSla(d.fechaEntregaComprometida) === 'VENCIDO'" :size="14" class="card-alert" />
            <div class="card-body">
              <div class="card-tit">{{ d.numeroDocumento }} / {{ d.clienteNombre }}</div>
              <div class="card-sub">{{ d.centroCostos }} / {{ d.estado }}</div>
            </div>
            <div class="card-side">
              <span class="card-bdg" :style="{ '--c': horasDesde(d.createdAt) >= 24 ? 'var(--error)' : d.fechaEntregaComprometida ? SLA_COLOR[calcSla(d.fechaEntregaComprometida)] : 'var(--muted)' }">
                {{ horasDesde(d.createdAt) >= 24 ? `${horasDesde(d.createdAt)}h pendiente` : d.fechaEntregaComprometida ? SLA_LABEL[calcSla(d.fechaEntregaComprometida)] : d.estado }}
              </span>
              <span class="card-tm">{{ fmtFecha(d.fechaCreacion) }}</span>
            </div>
          </a>
          <div v-if="data.despachosTienda.length > 8" class="sec-more">+{{ data.despachosTienda.length - 8 }} más en <a href="/dashboard/tienda" class="sec-link">Tienda</a></div>
        </div>
      </div>

      <!-- Empty -->
      <EmptyState v-if="kpis.total === 0" title="Todo al día" description="No tienes tareas pendientes en este momento. Buen trabajo.">
        <template #icon><CheckSquare :size="22" /></template>
      </EmptyState>
    </template>
  </div>
</template>

<style scoped>
.page { max-width: 720px; }
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hero::before { content: ''; position: absolute; left: -40px; top: -30px; width: 260px; height: 120px; background: radial-gradient(closest-side, color-mix(in srgb, var(--brand) 16%, transparent), transparent); pointer-events: none; z-index: -1; }
.hero-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--brand-deep); }
.hero-kicker::before { content: ''; width: 14px; height: 2px; border-radius: 2px; background: var(--brand); }
.hero-title { font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 4px 0 0; }
.hero-desc { font-size: 13.5px; color: var(--muted); margin: 5px 0 0; }
.hero-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.hlp { font-size: 11px; color: var(--faint); font-weight: 500; }
.refresh.spin :deep(svg) { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* KPIs */
.kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-bottom: 28px; }
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
.kpi-val { font-size: 24px; font-weight: 800; font-family: var(--mono); letter-spacing: -.03em; color: var(--ink); }
.kpi-val.err { color: var(--error); }
.kpi-val.warn { color: var(--warning); }
.kpi-lbl { font-size: 12px; color: var(--muted); margin-top: 2px; font-weight: 500; }

/* Sections */
.sec { margin-bottom: 20px; }
.sec-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.sec-ic { width: 28px; height: 28px; border-radius: 7px; background: color-mix(in srgb, var(--brand) 14%, transparent); display: grid; place-items: center; color: var(--brand); }
.sec-tt { font-size: 13px; font-weight: 700; color: var(--ink); }
.sec-cnt { font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 20px; background: var(--surface-3); color: var(--muted); font-family: var(--mono); }
.sec-cards { display: flex; flex-direction: column; gap: 6px; }
.sec-more { font-size: 12px; color: var(--muted); text-align: center; padding: 8px 0; }
.sec-link { color: var(--brand); text-decoration: none; font-weight: 600; }
.sec-link:hover { text-decoration: underline; }

/* Card */
.card { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: box-shadow .12s; cursor: pointer; text-decoration: none; }
.card:hover { box-shadow: var(--shadow-md); }
.card.alerta { border-color: color-mix(in srgb, var(--error) 30%, transparent); }
.card-alert { flex-shrink: 0; margin-top: 2px; color: var(--error); }
.card-body { flex: 1; min-width: 0; }
.card-tit { font-size: 13px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
.card-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.card-bdg { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c); }
.card-tm { font-size: 10px; color: var(--faint); font-family: var(--mono); }

/* Loading */
.skels { display: flex; flex-direction: column; gap: 8px; }
</style>

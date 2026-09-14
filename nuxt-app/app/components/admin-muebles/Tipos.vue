<script setup lang="ts">
// Tipos de mercancia por PLU: la cola de revision de lo que dedujo la app.
//
// El filtro "solo por revisar" es lo util de esta pantalla: lista lo que la
// heuristica clasifico sola y nadie ha confirmado. Corregir uno lo marca MANUAL
// y la heuristica ya no lo vuelve a tocar — y el informe se recalcula hacia
// atras, porque el tipo no se sella en la linea.
import { computed, onMounted, ref } from 'vue'
import { Search, Loader2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { API_ADMIN_MUEBLES, TIPO_MERCANCIA_LABEL, mensajeError, type TipoPlu } from '~/utils/muebles'

const { show } = useToast()
const filas = ref<TipoPlu[]>([])
const cargando = ref(true)
const soloDerivados = ref(true)
const busqueda = ref('')
const guardandoPlu = ref<string | null>(null)

const TIPOS = Object.keys(TIPO_MERCANCIA_LABEL)
const porRevisar = computed(() => filas.value.filter((f) => f.origen === 'DERIVADO').length)

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{ data: TipoPlu[] }>(`${API_ADMIN_MUEBLES}/tipos`, {
      query: {
        soloDerivados: soloDerivados.value ? '1' : undefined,
        plu: busqueda.value.trim() || undefined,
      },
    })
    filas.value = res.data
  } catch (e) {
    show(mensajeError(e, 'No se pudieron cargar los tipos'), true)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

async function corregir(fila: TipoPlu, tipo: string) {
  guardandoPlu.value = fila.plu
  try {
    await $fetch(`${API_ADMIN_MUEBLES}/tipos`, { method: 'PATCH', body: { plu: fila.plu, tipo } })
    fila.tipo = tipo
    fila.origen = 'MANUAL'
    show(`${fila.plu} → ${TIPO_MERCANCIA_LABEL[tipo]}`)
  } catch (e) {
    show(mensajeError(e, 'No se pudo corregir'), true)
    cargar()
  } finally {
    guardandoPlu.value = null
  }
}
</script>

<template>
  <section>
    <header class="filtros">
      <label class="check">
        <input v-model="soloDerivados" type="checkbox" @change="cargar">
        Solo los que faltan por revisar
      </label>
      <label class="campo">
        <span class="campo-label"><Search :size="12" /> PLU</span>
        <input v-model="busqueda" class="input" type="text" placeholder="Buscar" @keyup.enter="cargar">
      </label>
      <button class="btn btn-sm" @click="cargar">Buscar</button>
    </header>

    <p class="nota">
      El tipo lo deduce la app de la descripción del maestro. Corregir uno lo deja fijo y
      <strong>recalcula también los informes ya pasados</strong>.
    </p>

    <div v-if="cargando" class="cargando"><Loader2 :size="18" class="spin" /> Cargando…</div>

    <p v-else-if="filas.length === 0" class="vacio">
      {{ soloDerivados ? 'No queda ningún PLU por revisar.' : 'Todavía no se ha clasificado ningún PLU.' }}
    </p>

    <template v-else>
      <p v-if="porRevisar > 0" class="cuenta">{{ porRevisar }} por revisar</p>
      <ul class="lista">
        <li v-for="f in filas" :key="f.plu" class="fila">
          <div class="info">
            <strong>{{ f.plu }}</strong>
            <span v-if="f.descripcion" class="desc">{{ f.descripcion }}</span>
            <span class="origen" :class="f.origen.toLowerCase()">
              {{ f.origen === 'MANUAL' ? 'Confirmado' : 'Deducido' }}
            </span>
          </div>
          <div class="accion">
            <Loader2 v-if="guardandoPlu === f.plu" :size="15" class="spin" />
            <select
              class="input" :value="f.tipo" :disabled="guardandoPlu === f.plu"
              @change="corregir(f, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="t in TIPOS" :key="t" :value="t">{{ TIPO_MERCANCIA_LABEL[t] }}</option>
            </select>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.filtros { display: flex; align-items: flex-end; gap: 14px; margin-bottom: 10px; flex-wrap: wrap; }
.check { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.campo { display: flex; flex-direction: column; gap: 4px; }
.campo-label { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.nota { margin: 0 0 14px; font-size: 12px; color: var(--muted); }
.cuenta { margin: 0 0 10px; font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--u-aviso); }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fila { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 12px 15px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.info { flex: 1 1 260px; min-width: 0; display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
.info strong { font-size: 14.5px; font-weight: 700; color: var(--ink); }
.desc { font-size: 12.5px; color: var(--ink-2); }
.origen { padding: 2px 8px; border-radius: var(--r-pill); font-size: 10.5px; font-weight: 700; }
.origen.derivado { color: var(--u-aviso); background: color-mix(in srgb, var(--u-aviso) 13%, transparent); }
.origen.manual { color: var(--u-ok); background: color-mix(in srgb, var(--u-ok) 13%, transparent); }
.accion { display: flex; align-items: center; gap: 8px; }
.accion .input { min-width: 160px; }
.cargando { display: flex; align-items: center; gap: 9px; padding: 24px; justify-content: center; color: var(--muted); font-size: 13px; }
.vacio { padding: 26px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--border-strong); border-radius: var(--r-md); }
.spin { animation: girar 1s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
</style>

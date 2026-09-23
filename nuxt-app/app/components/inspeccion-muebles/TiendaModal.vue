<script setup lang="ts">
// Crear una orden que llega DE TIENDA: ya tiene su OVDM/TSDM en NetSuite, pero
// la mercancía viene de una tienda y no se pickea en el CEDI.
//
// No es contado: hasta el 23-09 se metía como factura de contado
// ("CONTADO-OVDM121831") porque no había otra opción, y eso mezclaba las dos
// cosas en los indicadores. Nace directamente en inspección, igual que el
// contado, y los PLU se agregan dentro de la orden.
import { computed, ref, watch } from 'vue'
import { Store, Search } from '@lucide/vue'
import { normalizarCodigoOrden, validarCodigoOrdenTienda } from '~/utils/muebles'

interface TiendaOption { codigo: string; tienda: string; ciudad: string }

const props = defineProps<{ abierto: boolean }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'confirmar', datos: { orden: string; tiendaCodigo: string; cliente: string }): void
}>()

const orden = ref('')
const cliente = ref('')
const busca = ref('')
const tienda = ref<TiendaOption | null>(null)
const sugerencias = ref<TiendaOption[]>([])
const buscando = ref(false)
let espera: ReturnType<typeof setTimeout> | null = null

watch(() => props.abierto, (a) => {
  if (!a) return
  orden.value = ''; cliente.value = ''; busca.value = ''; tienda.value = null; sugerencias.value = []
})

function buscarTienda(valor: string) {
  busca.value = valor
  tienda.value = null
  if (espera) clearTimeout(espera)
  if (!valor.trim()) { sugerencias.value = []; return }
  espera = setTimeout(async () => {
    buscando.value = true
    try {
      const res = await $fetch<{ data: TiendaOption[] }>('/api/cargue-gourmet/maestro-tiendas', { query: { q: valor.trim() } })
      sugerencias.value = res.data ?? []
    } catch { sugerencias.value = [] }
    finally { buscando.value = false }
  }, 250)
}

function elegir(t: TiendaOption) {
  tienda.value = t
  busca.value = `${t.tienda} · ${t.ciudad}`
  sugerencias.value = []
}

const errorOrden = computed(() => (orden.value.trim() ? validarCodigoOrdenTienda(orden.value) : null))
const puede = computed(() => !!orden.value.trim() && !errorOrden.value && !!tienda.value)

function confirmar() {
  if (!puede.value || !tienda.value) return
  emit('confirmar', { orden: normalizarCodigoOrden(orden.value), tiendaCodigo: tienda.value.codigo, cliente: cliente.value.trim() })
}
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="emit('cerrar')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="tienda-titulo">
      <h3 id="tienda-titulo" class="m-titulo"><Store :size="16" /> Orden de tienda</h3>
      <p class="m-desc">
        Mercancía que llega de una tienda con su orden de NetSuite. No pasa por picking: se inspecciona directo.
      </p>

      <label class="campo">
        <span class="campo-label">Orden de NetSuite</span>
        <input
          v-model="orden" class="input mono" type="text" autocomplete="off" autocapitalize="characters"
          autofocus placeholder="OVDM121831"
        >
        <span v-if="errorOrden" class="campo-error">{{ errorOrden }}</span>
      </label>

      <div class="campo">
        <span class="campo-label">Tienda de origen</span>
        <div class="busca">
          <Search :size="14" class="busca-ic" />
          <input
            :value="busca" class="input busca-input" type="text" autocomplete="off"
            placeholder="Busca por nombre, código o ciudad"
            @input="buscarTienda(($event.target as HTMLInputElement).value)"
          >
        </div>
        <div v-if="busca && !tienda && (sugerencias.length || buscando)" class="sug" role="listbox">
          <p v-if="buscando" class="sug-vacio">Buscando…</p>
          <button
            v-for="t in sugerencias" :key="t.codigo" type="button" class="sug-item" role="option"
            @click="elegir(t)"
          >
            <span class="sug-nom">{{ t.tienda }}</span>
            <span class="sug-meta">{{ t.ciudad }} · {{ t.codigo }}</span>
          </button>
        </div>
        <p v-else-if="busca && !tienda && !buscando" class="campo-error">Ninguna tienda coincide.</p>
      </div>

      <label class="campo">
        <span class="campo-label">Cliente (opcional)</span>
        <input v-model="cliente" class="input" type="text" autocomplete="off" placeholder="Nombre del cliente">
      </label>

      <footer class="m-pie">
        <button class="btn btn-ghost" @click="emit('cerrar')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!puede" @click="confirmar">Crear e inspeccionar</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,14,20,.5); }
.modal { width: 100%; max-width: 440px; padding: 20px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(0,0,0,.2); }
.m-titulo { display: flex; align-items: center; gap: 7px; margin: 0 0 4px; font-size: 17px; font-weight: 800; color: var(--ink); }
.m-titulo > svg { color: var(--brand); }
.m-desc { margin: 0 0 14px; font-size: 12.5px; color: var(--muted); }
.campo { display: block; margin-bottom: 12px; position: relative; }
.campo-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 700; color: var(--ink-2); }
.campo-error { display: block; margin-top: 4px; font-size: 12px; color: var(--u-aviso); }
.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font-size: 13px; }
.busca { position: relative; }
.busca-ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); }
.busca-input { padding-left: 30px; }
.sug { position: absolute; z-index: 5; left: 0; right: 0; top: calc(100% + 4px); max-height: 220px; overflow: auto; padding: 5px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r-sm); box-shadow: var(--shadow-lg, 0 10px 30px rgba(0,0,0,.18)); }
.sug-item { display: flex; flex-direction: column; align-items: flex-start; width: 100%; padding: 7px 9px; border: none; border-radius: var(--r-xs); background: none; text-align: left; cursor: pointer; }
.sug-item:hover { background: var(--surface-3); }
.sug-nom { font-size: 13px; font-weight: 600; color: var(--ink); }
.sug-meta { font-size: 11.5px; color: var(--muted); }
.sug-vacio { margin: 0; padding: 8px; font-size: 12.5px; color: var(--muted); }
.m-pie { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
@media (max-width: 480px) { .m-pie, .m-pie .btn { width: 100%; } .m-pie .btn { justify-content: center; } }
</style>

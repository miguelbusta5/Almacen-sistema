<script setup lang="ts">
import { computed } from 'vue'
import { Phone, MessageCircle, Mail, MapPin, TriangleAlert, Plus, CalendarCheck } from '@lucide/vue'
import {
  TIPO_CONTACTO_LABEL, RESULTADO_CONTACTO_LABEL, fmtFecha,
  type ContactoGuardado, type TipoContacto, type ResultadoContacto,
} from '~/utils/guardado'

const props = defineProps<{ contactos: ContactoGuardado[] }>()
const emit = defineEmits<{ (e: 'nuevo'): void }>()

const ICON: Record<TipoContacto, any> = { LLAMADA: Phone, MENSAJE: MessageCircle, EMAIL: Mail, VISITA: MapPin, ESCALACION: TriangleAlert }
const RES_TONE: Record<ResultadoContacto, string> = {
  NO_CONTESTA: 'var(--u-aviso)', CONFIRMO_FECHA: 'var(--u-ok)', CANCELO: 'var(--u-critico)',
  ESCALADO: 'var(--bill)', OTRO: 'var(--muted)',
}

// Estado de seguimiento derivado del último contacto
const estado = computed(() => {
  if (!props.contactos.length) return { txt: 'Sin contacto', tone: 'var(--u-critico)' }
  const last = props.contactos[0]!
  if (last.resultado === 'CONFIRMO_FECHA') return { txt: 'Fecha comprometida', tone: 'var(--u-ok)' }
  if (last.resultado === 'ESCALADO') return { txt: 'Escalado', tone: 'var(--bill)' }
  if (last.resultado === 'CANCELO') return { txt: 'Canceló', tone: 'var(--u-critico)' }
  return { txt: 'En seguimiento', tone: 'var(--u-aviso)' }
})

const ultimo = computed(() => {
  if (!props.contactos.length) return null
  return new Date(props.contactos[0]!.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
})

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <section class="sec">
    <div class="sec-head">
      <div class="sec-title">
        <h3>Gestión de cliente</h3>
        <span class="count">{{ contactos.length }}</span>
      </div>
      <span class="status" :style="{ '--c': estado.tone }">
        <span class="status-dot" />{{ estado.txt }}
      </span>
    </div>
    <p v-if="ultimo" class="last-touch">Último contacto · <b>{{ ultimo }}</b></p>

    <ol v-if="contactos.length" class="timeline">
      <li v-for="c in contactos" :key="c.id" class="ev">
        <span class="ev-ic" :style="{ '--c': RES_TONE[c.resultado] }"><component :is="ICON[c.tipo]" :size="13" /></span>
        <div class="ev-body">
          <div class="ev-top">
            <span class="ev-tipo">{{ TIPO_CONTACTO_LABEL[c.tipo] }}</span>
            <span class="ev-date mono">{{ fecha(c.createdAt) }}</span>
          </div>
          <span class="ev-res" :style="{ '--c': RES_TONE[c.resultado] }">{{ RESULTADO_CONTACTO_LABEL[c.resultado] }}</span>
          <div v-if="c.fechaCompromiso" class="ev-comp"><CalendarCheck :size="12" /> Comprometido: {{ fmtFecha(c.fechaCompromiso) }}</div>
          <p v-if="c.nota" class="ev-nota">{{ c.nota }}</p>
          <div v-if="c.registradoPorNombre" class="ev-by">
            <span class="ev-avatar">{{ c.registradoPorNombre.slice(0, 1) }}</span>{{ c.registradoPorNombre }}
          </div>
        </div>
      </li>
    </ol>
    <div v-else class="no-contact">
      <span class="no-ic"><Phone :size="18" /></span>
      <p>Aún no se ha registrado contacto con el cliente.</p>
    </div>

    <button class="btn btn-primary btn-sm add" @click="emit('nuevo')"><Plus :size="14" /> Registrar contacto</button>
  </section>
</template>

<style scoped>
.sec { margin-top: 2px; }
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
.sec-title { display: flex; align-items: center; gap: 8px; }
.sec-title h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: var(--r-pill); background: var(--surface-3); color: var(--ink-2); font-size: 11px; font-weight: 800; }
.status { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: color-mix(in srgb, var(--c) 72%, var(--ink)); background: color-mix(in srgb, var(--c) 12%, transparent); border: 1px solid color-mix(in srgb, var(--c) 24%, transparent); padding: 3px 9px; border-radius: var(--r-pill); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c); }
.last-touch { font-size: 11.5px; color: var(--faint); margin: 0 0 14px; }
.last-touch b { color: var(--muted); }

.timeline { list-style: none; margin: 0 0 14px; padding: 0; position: relative; }
.timeline::before { content: ''; position: absolute; left: 13px; top: 8px; bottom: 14px; width: 2px; background: linear-gradient(180deg, var(--border-strong), var(--border) 80%, transparent); }
.ev { position: relative; display: flex; gap: 13px; padding: 2px 0 16px; }
.ev:last-child { padding-bottom: 0; }
.ev-ic { position: relative; z-index: 1; width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: color-mix(in srgb, var(--c) 14%, var(--surface)); color: var(--c); border: 1.5px solid color-mix(in srgb, var(--c) 42%, transparent); box-shadow: 0 0 0 3px var(--surface); }
.ev-body { flex: 1; min-width: 0; padding-top: 1px; }
.ev-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.ev-tipo { font-size: 12.5px; font-weight: 700; color: var(--ink); }
.ev-date { font-size: 10.5px; color: var(--faint); flex-shrink: 0; }
.ev-res { display: inline-block; margin-top: 4px; font-size: 11px; font-weight: 700; color: color-mix(in srgb, var(--c) 72%, var(--ink)); background: color-mix(in srgb, var(--c) 11%, transparent); padding: 2px 8px; border-radius: var(--r-pill); }
.ev-comp { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--u-ok); font-weight: 600; margin-top: 6px; }
.ev-nota { font-size: 12px; color: var(--muted); margin: 6px 0 0; line-height: 1.5; padding: 8px 10px; background: var(--surface-2); border-radius: var(--r-xs); border-left: 2px solid var(--border-strong); }
.ev-by { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--faint); margin-top: 7px; }
.ev-avatar { width: 17px; height: 17px; border-radius: 50%; background: var(--surface-3); color: var(--muted); display: grid; place-items: center; font-size: 9px; font-weight: 800; }

.no-contact { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 18px 8px 20px; }
.no-ic { width: 40px; height: 40px; border-radius: 50%; background: var(--surface-3); color: var(--faint); display: grid; place-items: center; }
.no-contact p { font-size: 12.5px; color: var(--muted); margin: 0; max-width: 200px; }
.add { width: 100%; justify-content: center; }
</style>

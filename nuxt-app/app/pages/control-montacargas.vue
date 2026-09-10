<script setup lang="ts">
// Pagina thin: la logica vive en components/montacargas/Module.vue.
//
// Solo Recepcion de contenedor. Movimientos de deposito se fue al modulo de
// Resurtido, que es donde el operario tiene el resto de sus tareas.
import { FLUJOS } from '~/utils/montacargas'

definePageMeta({ title: 'Control Montacargas' })
</script>

<template>
  <MontacargasModule
    titulo="Control Montacargas"
    kicker="Montacargas · Flujo CEDI"
    :flujos="[FLUJOS.RECEPCION]"
  />
</template>

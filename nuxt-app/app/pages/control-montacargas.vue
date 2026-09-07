<script setup lang="ts">
// Pagina thin: toda la logica vive en components/montacargas/Module.vue, que es
// el mismo para este modulo y para Resurtido.
import { FLUJOS_MONTACARGAS } from '~/utils/montacargas'

definePageMeta({ title: 'Control Montacargas' })
</script>

<template>
  <MontacargasModule
    titulo="Control Montacargas"
    kicker="Montacargas · Flujo CEDI"
    :flujos="FLUJOS_MONTACARGAS"
  />
</template>

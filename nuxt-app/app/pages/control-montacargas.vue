<script setup lang="ts">
// Pagina thin: la logica vive en components/montacargas/Module.vue.
//
// Recepcion de contenedor y Movimientos de deposito, como siempre. Movimientos
// tambien esta como pestana en Resurtido —es el mismo flujo y los mismos
// registros—, pero el montacarguista lo tiene aqui, que es donde lo busca.
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

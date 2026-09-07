<script setup lang="ts">
// Modulo aparte, mismo flujo que un movimiento de deposito: el operario saca
// mercancia de una ubicacion y la lleva a otra, con el reloj corriendo.
import { FLUJOS } from '~/utils/montacargas'

definePageMeta({ title: 'Resurtido' })
</script>

<template>
  <MontacargasModule
    titulo="Resurtido"
    kicker="Montacargas · Reposicion"
    :flujos="[FLUJOS.RESURTIDO]"
  />
</template>

<script setup lang="ts">
// Indicadores Muebles ahora es un área de Indicadores (23-09). Esta ruta queda
// para los enlaces y favoritos viejos: lleva al área Muebles.
definePageMeta({ title: 'Indicadores' })
await navigateTo({ path: '/indicadores', query: { area: 'muebles' } }, { replace: true })
</script>

<template>
  <div />
</template>

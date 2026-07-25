<script setup lang="ts">
// Página thin: la lógica vive en components/solicitudes-transporte/Module.vue.
// El nombre de este archivo ES el route.name que usa isActive() del sidebar.
definePageMeta({ title: 'Solicitudes Transporte' })
</script>

<template>
  <SolicitudesTransporteModule />
</template>

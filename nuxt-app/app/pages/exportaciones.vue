<script setup lang="ts">
// Página thin: toda la lógica vive en components/exportaciones/Module.vue, que es
// el mismo para los tres países. Una página por país (en vez de una ruta dinámica)
// para que cada uno tenga su propio route.name y el sidebar pueda resaltar el activo.
import { PAISES_EXPORT } from '~/utils/exportaciones'

definePageMeta({ title: 'Exportaciones Ecuador' })
</script>

<template>
  <ExportacionesModule :cfg="PAISES_EXPORT.ecuador" />
</template>

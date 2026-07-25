<script setup lang="ts">
import { PAISES_EXPORT } from '~/utils/exportaciones'

definePageMeta({ title: 'Exportaciones México' })
</script>

<template>
  <ExportacionesModule :cfg="PAISES_EXPORT.mexico" />
</template>

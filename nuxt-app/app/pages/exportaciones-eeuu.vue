<script setup lang="ts">
import { PAISES_EXPORT } from '~/utils/exportaciones'

definePageMeta({ title: 'Exportaciones EE.UU' })
</script>

<template>
  <ExportacionesModule :cfg="PAISES_EXPORT.eeuu" />
</template>

<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
defineProps<{ size?: number }>()
</script>

<template>
  <LoaderCircle :size="size ?? 14" class="spin-anim" />
</template>

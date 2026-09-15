<script setup lang="ts">
// Montaje de resurtido: subir el archivo y repartirlo. La logica vive en
// components/montaje/Module.vue.

definePageMeta({ title: 'Montaje Resurtido' })
const tab = ref('archivo')
const { me } = useSessionState()
onMounted(() => ensureSession())
</script>

<template>
  <div>
    <div v-if="me?.can.montarResurtido" class="picking-tabs" role="tablist" aria-label="Origen del resurtido">
      <button role="tab" :aria-selected="tab === 'archivo'" @click="tab = 'archivo'">Montaje por archivo</button>
      <button role="tab" :aria-selected="tab === 'capacidad'" @click="tab = 'capacidad'">Por capacidad picking</button>
    </div>
    <MontajeModule v-if="tab === 'archivo'" />
    <PickingTeorico v-else-if="me?.can.montarResurtido" />
  </div>
</template>
<style src="../components/picking/picking.css"></style>

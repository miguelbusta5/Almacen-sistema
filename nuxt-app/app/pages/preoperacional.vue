<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ensureSession, useSessionState } from '~/composables/useSession'

definePageMeta({ title: 'Preoperacional' })

const { me, sessionLoaded } = useSessionState()
onMounted(() => { ensureSession() })

const SUPERVISOR_ROLES = ['ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE']
const role = computed(() => me.value?.role ?? '')
</script>

<template>
  <div>
    <PreoperacionalSupervisorView v-if="SUPERVISOR_ROLES.includes(role)" :role="role" />
    <PreoperacionalConductorView v-else-if="role === 'TRANSPORTISTA'" />
    <ListSkeleton v-else-if="!sessionLoaded" />
    <EmptyState
      v-else title="Sin acceso"
      description="El preoperacional está disponible para transportistas y supervisores de transporte."
    />
  </div>
</template>

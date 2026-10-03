<script setup lang="ts">
import { Settings } from '@lucide/vue'
import { t } from '@/composables/useI18n'

defineEmits<{ open: [] }>()
</script>

<template>
  <button
    type="button"
    class="evr-settings-button"
    :title="t('settings.open')"
    :aria-label="t('settings.open')"
    @click="$emit('open')"
  >
    <Settings :size="15" aria-hidden="true" />
    <span>{{ t('settings.button') }}</span>
  </button>
</template>

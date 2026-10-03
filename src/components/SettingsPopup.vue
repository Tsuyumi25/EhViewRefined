<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Tags, X } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import {
  getShowAllTags, setShowAllTags, subscribeShowAllTags,
  getInfiniteScroll, setInfiniteScroll, subscribeInfiniteScroll,
} from '@/services/settings'

const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLElement | null>(null)
const showAllTags = ref(getShowAllTags())
const infiniteScroll = ref(getInfiniteScroll())

let unsubscribe: (() => void) | undefined
let unsubscribeInfiniteScroll: (() => void) | undefined
let restoreOverflow = ''

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  event.preventDefault()
  event.stopPropagation()
  emit('close')
}

function onToggle(event: Event) {
  const input = event.target as HTMLInputElement
  try {
    setShowAllTags(input.checked)
  } catch (error) {
    input.checked = showAllTags.value
    throw error
  }
}

function onToggleInfiniteScroll(event: Event) {
  const input = event.target as HTMLInputElement
  try {
    setInfiniteScroll(input.checked)
  } catch (error) {
    input.checked = infiniteScroll.value
    throw error
  }
}

onMounted(() => {
  unsubscribe = subscribeShowAllTags(value => {
    showAllTags.value = value
  })
  unsubscribeInfiniteScroll = subscribeInfiniteScroll(value => {
    infiniteScroll.value = value
  })
  document.addEventListener('keydown', onKeydown, true)
  restoreOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  dialog.value?.focus()
})

onBeforeUnmount(() => {
  unsubscribe?.()
  unsubscribeInfiniteScroll?.()
  document.removeEventListener('keydown', onKeydown, true)
  document.body.style.overflow = restoreOverflow
})
</script>

<template>
  <div class="evr-popup-overlay" @mousedown.self="emit('close')">
    <div
      ref="dialog"
      class="evr-popup"
      role="dialog"
      aria-modal="true"
      :aria-label="t('settings.open')"
      tabindex="-1"
    >
      <div class="evr-settings__header">
        <h3 class="evr-settings__title">{{ t('settings.title') }}</h3>
        <button
          type="button"
          class="evr-settings__close-btn"
          :aria-label="t('settings.close')"
          :title="t('settings.close')"
          @click="emit('close')"
        >
          <X :size="18" aria-hidden="true" />
        </button>
      </div>

      <div class="evr-settings__panel">
        <div class="evr-settings__panel-inner">
          <section class="evr-settings__section">
            <h4 class="evr-settings__subtitle">{{ t('settings.browsingSection') }}</h4>
            <label class="evr-settings__row">
              <span class="evr-switch">
                <input
                  class="evr-switch__input"
                  type="checkbox"
                  :checked="infiniteScroll"
                  @change="onToggleInfiniteScroll"
                />
                <span class="evr-switch__track"><span class="evr-switch__knob"></span></span>
              </span>
              <span class="evr-settings__label">{{ t('settings.infiniteScroll') }}</span>
            </label>
          </section>
          <section class="evr-settings__section">
            <h4 class="evr-settings__subtitle">
              <Tags :size="14" aria-hidden="true" />{{ t('settings.tagsSection') }}
            </h4>
            <label class="evr-settings__row">
              <span class="evr-switch">
                <input
                  class="evr-switch__input"
                  type="checkbox"
                  :checked="showAllTags"
                  @change="onToggle"
                />
                <span class="evr-switch__track"><span class="evr-switch__knob"></span></span>
              </span>
              <span class="evr-settings__label">{{ t('settings.showAllTags') }}</span>
            </label>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

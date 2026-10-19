<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { Languages, Tags, X } from '@lucide/vue'
import { locale, t } from '@/composables/useI18n'
import type { Locale } from '@/services/locale'
import {
  getAllMyTags, setAllMyTags, subscribeAllMyTags,
  getAllOtherTags, setAllOtherTags, subscribeAllOtherTags,
  getInfiniteScroll, setInfiniteScroll, subscribeInfiniteScroll,
  getGroupTags, setGroupTags, subscribeGroupTags,
  getUploaderTag, setUploaderTag, subscribeUploaderTag,
  setLocaleChoice,
} from '@/services/settings'

const emit = defineEmits<{ close: [] }>()

interface Toggle {
  label: Parameters<typeof t>[0]
  value: Ref<boolean>
  set: (value: boolean) => void
  subscribe: (listener: (value: boolean) => void) => () => void
}

function toggle(
  label: Toggle['label'],
  get: () => boolean,
  set: Toggle['set'],
  subscribe: Toggle['subscribe'],
): Toggle {
  return { label, value: ref(get()), set, subscribe }
}

const browsing = [toggle('settings.infiniteScroll', getInfiniteScroll, setInfiniteScroll, subscribeInfiniteScroll)]
const tags = [
  toggle('settings.groupTags', getGroupTags, setGroupTags, subscribeGroupTags),
  toggle('settings.uploaderTag', getUploaderTag, setUploaderTag, subscribeUploaderTag),
  toggle('settings.allMyTags', getAllMyTags, setAllMyTags, subscribeAllMyTags),
  toggle('settings.allOtherTags', getAllOtherTags, setAllOtherTags, subscribeAllOtherTags),
]

// Each language is named in itself: someone stuck in a language they cannot read still finds their own
const localeOptions: { value: Locale; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

const dialog = ref<HTMLElement | null>(null)
let unsubscribers: (() => void)[] = []
// body's inline overflow is one slot shared by the site and every script. Restoring what we found
// brings back a lock its owner has since released; clearing it removes a lock someone still holds.
// We mark only our own attribute and let settings.css do the locking
const scrollLockAttribute = 'data-evr-scroll-locked'

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  event.preventDefault()
  event.stopPropagation()
  emit('close')
}

function onToggle(entry: Toggle, event: Event) {
  const input = event.target as HTMLInputElement
  try {
    entry.set(input.checked)
  } catch (error) {
    input.checked = entry.value.value
    throw error
  }
}

onMounted(() => {
  unsubscribers = [...browsing, ...tags].map(entry => entry.subscribe(value => {
    entry.value.value = value
  }))
  document.addEventListener('keydown', onKeydown, true)
  document.documentElement.setAttribute(scrollLockAttribute, '')
  dialog.value?.focus()
})

onBeforeUnmount(() => {
  for (const unsubscribe of unsubscribers) unsubscribe()
  document.removeEventListener('keydown', onKeydown, true)
  document.documentElement.removeAttribute(scrollLockAttribute)
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
            <h4 class="evr-settings__subtitle">
              <Languages :size="14" aria-hidden="true" />{{ t('settings.language') }}
            </h4>
            <select
              class="evr-settings__select"
              :value="locale"
              :aria-label="t('settings.language')"
              @change="setLocaleChoice(($event.target as HTMLSelectElement).value as Locale)"
            >
              <option v-for="option in localeOptions" :key="option.value" :value="option.value" :lang="option.value">
                {{ option.label }}
              </option>
            </select>
          </section>
          <section class="evr-settings__section">
            <h4 class="evr-settings__subtitle">{{ t('settings.browsingSection') }}</h4>
            <label v-for="entry in browsing" :key="entry.label" class="evr-settings__row">
              <span class="evr-switch">
                <input class="evr-switch__input" type="checkbox" :checked="entry.value.value" @change="onToggle(entry, $event)" />
                <span class="evr-switch__track"><span class="evr-switch__knob"></span></span>
              </span>
              <span class="evr-settings__label">{{ t(entry.label) }}</span>
            </label>
          </section>
          <section class="evr-settings__section">
            <h4 class="evr-settings__subtitle">
              <Tags :size="14" aria-hidden="true" />{{ t('settings.tagsSection') }}
            </h4>
            <label v-for="entry in tags" :key="entry.label" class="evr-settings__row">
              <span class="evr-switch">
                <input class="evr-switch__input" type="checkbox" :checked="entry.value.value" @change="onToggle(entry, $event)" />
                <span class="evr-switch__track"><span class="evr-switch__knob"></span></span>
              </span>
              <span class="evr-settings__label">{{ t(entry.label) }}</span>
            </label>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

/**
 * ==================================================
 * ██╗     ██╗██╗   ██╗ █████╗ 
 * ██║     ██║╚██╗ ██╔╝██╔══██╗
 * ██║     ██║ ╚████╔╝ ███████║
 * ██║     ██║  ╚██╔╝  ██╔══██║
 * ███████╗██║   ██║   ██║  ██║
 * ╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝
 *        AI Assistant
 * ==================================================
 * Author / Creator : Mahmut Denizli (With help of LiyaAi)
 * License          : MIT
 * Connect          : liyalabs.com, info@liyalabs.com
 * ==================================================
 */
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ThemeConfig } from '../../types'
import { useChat } from '../../composables/useChat'
import { useFileUpload } from '../../composables/useFileUpload'
import { getConfig } from '../../api'
import MessageList from '../shared/MessageList.vue'
import ChatInput from '../shared/ChatInput.vue'

interface Props {
  position?: ThemeConfig['position']
  theme?: ThemeConfig
  welcomeMessage?: string
  placeholder?: string
  showBranding?: boolean
  showVoice?: boolean
  voiceEnabled?: boolean  // false for STANDARD users - shows disabled mic icon
  showFileUpload?: boolean
  offsetX?: number  // horizontal offset in pixels
  offsetY?: number  // vertical offset in pixels
  customIcon?: string  // custom icon URL or SVG
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom-right',
  welcomeMessage: 'Bu chat hizmeti Liya AI tarafından sağlanmaktadır. Size bugün nasıl yardımcı olabilirim?',
  placeholder: 'Mesajınızı yazın...',
  showBranding: true,
  showVoice: true,
  voiceEnabled: true,
  showFileUpload: true,
  offsetX: 20,
  offsetY: 20,
})

const pendingMessage = ref('')

const emit = defineEmits<{
  opened: []
  closed: []
  messageSent: [message: string]
  messageReceived: [message: string]
}>()

const isOpen = ref(false)
const config = getConfig()

const {
  messages,
  isLoading,
  currentSessionId,
  sendMessage,
  initFromStorage,
  loadHistory,
} = useChat()

const { uploadFiles, clearAll: clearFiles } = useFileUpload()

const assistantName = computed(() => config.assistantName || 'Assistant')

const positionClasses = computed(() => ({
  'liya-3d-avatar-widget-vuejs-widget--bottom-right': props.position === 'bottom-right',
  'liya-3d-avatar-widget-vuejs-widget--bottom-left': props.position === 'bottom-left',
  'liya-3d-avatar-widget-vuejs-widget--top-right': props.position === 'top-right',
  'liya-3d-avatar-widget-vuejs-widget--top-left': props.position === 'top-left',
}))

const cssVars = computed(() => {
  const theme = props.theme || {}
  return {
    '--liya-primary-color': theme.primaryColor || '#6366f1',
    '--liya-primary-hover': theme.primaryColor ? adjustColor(theme.primaryColor, -10) : '#4f46e5',
    '--liya-secondary-color': theme.secondaryColor || '#e5e7eb',
    '--liya-bg-color': theme.backgroundColor || '#ffffff',
    '--liya-bg-secondary': '#f3f4f6',
    '--liya-text-color': theme.textColor || '#374151',
    '--liya-text-muted': '#9ca3af',
    '--liya-border-color': '#e5e7eb',
    '--liya-border-radius': theme.borderRadius || '16px',
    '--liya-font-family': theme.fontFamily || 'system-ui, -apple-system, sans-serif',
    '--liya-z-index': theme.zIndex || 9999,
    '--liya-offset-x': `${props.offsetX}px`,
    '--liya-offset-y': `${props.offsetY}px`,
  }
})

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1)
}

function toggleWidget(): void {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    emit('opened')
  } else {
    emit('closed')
  }
}

async function handleSend(message: string, fileIds?: string[]): Promise<void> {
  if (!message.trim() && (!fileIds || fileIds.length === 0)) return

  // Upload pending files first if we have a session
  let uploadedFileIds = fileIds
  if (currentSessionId.value && fileIds && fileIds.length > 0) {
    const uploaded = await uploadFiles(currentSessionId.value)
    uploadedFileIds = uploaded.map(f => f.id)
  }

  emit('messageSent', message)
  
  const response = await sendMessage(message, uploadedFileIds)
  
  if (response?.assistant_message?.content || response?.response) {
    emit('messageReceived', response.assistant_message?.content || response.response || '')
  }
  
  clearFiles()
}

function handleSuggestionClick(suggestion: string): void {
  pendingMessage.value = suggestion
  // Trigger send with the suggestion
  handleSend(suggestion)
}

onMounted(() => {
  initFromStorage()
  
  // Load history if we have a stored session
  const storedSessionId = currentSessionId.value
  if (storedSessionId) {
    loadHistory(storedSessionId)
  }
})
</script>

<template>
  <div class="liya-3d-avatar-widget-vuejs-widget" :class="positionClasses" :style="cssVars">
    <!-- Toggle Button -->
    <button 
      class="liya-3d-avatar-widget-vuejs-widget__toggle"
      :class="{ 'liya-3d-avatar-widget-vuejs-widget__toggle--open': isOpen }"
      @click="toggleWidget"
      :aria-label="isOpen ? 'Sohbeti kapat' : 'Sohbeti aç'"
    >
      <svg v-if="!isOpen" viewBox="0 0 80 92" fill="none" width="28" height="28">
        <rect x="0" y="0" width="80" height="80" rx="18" fill="#6366F1"/>
        <path d="M22 80 L34 80 L28 92 Z" fill="#6366F1"/>
        <path d="M36 26 V58 H56" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
        <circle cx="36" cy="26" r="3" fill="#FFFFFF"/>
        <circle cx="36" cy="58" r="3" fill="#FFFFFF"/>
        <circle cx="56" cy="58" r="3" fill="#FFFFFF"/>
        <text x="40" y="52" font-size="12" font-weight="600" font-family="system-ui, sans-serif" fill="#FFFFFF">ai</text>
        <path d="M58 16 L60 20 L64 22 L60 24 L58 28 L56 24 L52 22 L56 20 Z" fill="#FFFFFF"/>
        <path d="M66 30 L67.5 33 L71 34.5 L67.5 36 L66 39 L64.5 36 L61 34.5 L64.5 33 Z" fill="#FFFFFF"/>
        <path d="M50 18 L51.5 21 L55 22.5 L51.5 24 L50 27 L48.5 24 L45 22.5 L48.5 21 Z" fill="#FFFFFF"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>

    <!-- Chat Panel -->
    <Transition name="liya-3d-avatar-widget-vuejs-slide">
      <div v-if="isOpen" class="liya-3d-avatar-widget-vuejs-widget__panel">
        <!-- Header -->
        <div class="liya-3d-avatar-widget-vuejs-widget__header">
          <div class="liya-3d-avatar-widget-vuejs-widget__header-info">
            <div class="liya-3d-avatar-widget-vuejs-widget__avatar">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <div class="liya-3d-avatar-widget-vuejs-widget__header-text">
              <h3 class="liya-3d-avatar-widget-vuejs-widget__title">{{ assistantName }}</h3>
              <span class="liya-3d-avatar-widget-vuejs-widget__status">Çevrimiçi</span>
            </div>
          </div>
          <button class="liya-3d-avatar-widget-vuejs-widget__close" @click="toggleWidget">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <!-- Messages -->
        <MessageList
          :messages="messages"
          :is-loading="isLoading"
          :assistant-name="assistantName"
          :welcome-message="welcomeMessage"
          @suggestion-click="handleSuggestionClick"
        />

        <!-- Input -->
        <ChatInput
          :placeholder="placeholder"
          :disabled="isLoading"
          :show-voice="showVoice"
          :voice-enabled="voiceEnabled"
          :show-file-upload="showFileUpload"
          :session-id="currentSessionId"
          @send="handleSend"
        />

        <!-- Branding -->
        <div v-if="showBranding" class="liya-3d-avatar-widget-vuejs-widget__branding">
          Powered by <a href="https://liyalabs.com" target="_blank" rel="noopener">Liya AI</a>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.liya-3d-avatar-widget-vuejs-widget {
  position: fixed;
  z-index: var(--liya-z-index, 9999);
  font-family: var(--liya-font-family);
}

.liya-3d-avatar-widget-vuejs-widget--bottom-right {
  bottom: var(--liya-offset-y, 20px);
  right: var(--liya-offset-x, 20px);
}

.liya-3d-avatar-widget-vuejs-widget--bottom-left {
  bottom: var(--liya-offset-y, 20px);
  left: var(--liya-offset-x, 20px);
}

.liya-3d-avatar-widget-vuejs-widget--top-right {
  top: var(--liya-offset-y, 20px);
  right: var(--liya-offset-x, 20px);
}

.liya-3d-avatar-widget-vuejs-widget--top-left {
  top: var(--liya-offset-y, 20px);
  left: var(--liya-offset-x, 20px);
}

.liya-3d-avatar-widget-vuejs-widget__toggle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  background: var(--liya-primary-color);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-widget__toggle:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.liya-3d-avatar-widget-vuejs-widget__toggle--open {
  background: var(--liya-text-muted);
}

.liya-3d-avatar-widget-vuejs-widget__panel {
  position: absolute;
  width: 380px;
  height: 550px;
  max-height: calc(100vh - 100px);
  background: var(--liya-bg-color);
  border-radius: var(--liya-border-radius);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.liya-3d-avatar-widget-vuejs-widget--bottom-right .liya-3d-avatar-widget-vuejs-widget__panel,
.liya-3d-avatar-widget-vuejs-widget--bottom-left .liya-3d-avatar-widget-vuejs-widget__panel {
  bottom: 70px;
}

.liya-3d-avatar-widget-vuejs-widget--top-right .liya-3d-avatar-widget-vuejs-widget__panel,
.liya-3d-avatar-widget-vuejs-widget--top-left .liya-3d-avatar-widget-vuejs-widget__panel {
  top: 70px;
}

.liya-3d-avatar-widget-vuejs-widget--bottom-right .liya-3d-avatar-widget-vuejs-widget__panel,
.liya-3d-avatar-widget-vuejs-widget--top-right .liya-3d-avatar-widget-vuejs-widget__panel {
  right: 0;
}

.liya-3d-avatar-widget-vuejs-widget--bottom-left .liya-3d-avatar-widget-vuejs-widget__panel,
.liya-3d-avatar-widget-vuejs-widget--top-left .liya-3d-avatar-widget-vuejs-widget__panel {
  left: 0;
}

.liya-3d-avatar-widget-vuejs-widget__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--liya-primary-color);
  color: white;
}

.liya-3d-avatar-widget-vuejs-widget__header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.liya-3d-avatar-widget-vuejs-widget__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.liya-3d-avatar-widget-vuejs-widget__header-text {
  display: flex;
  flex-direction: column;
}

.liya-3d-avatar-widget-vuejs-widget__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.liya-3d-avatar-widget-vuejs-widget__status {
  font-size: 12px;
  opacity: 0.9;
}

.liya-3d-avatar-widget-vuejs-widget__close {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.liya-3d-avatar-widget-vuejs-widget__close:hover {
  opacity: 1;
}

.liya-3d-avatar-widget-vuejs-widget__branding {
  padding: 8px;
  text-align: center;
  font-size: 11px;
  color: var(--liya-text-muted);
  border-top: 1px solid var(--liya-border-color);
}

.liya-3d-avatar-widget-vuejs-widget__branding a {
  color: var(--liya-primary-color);
  text-decoration: none;
}

.liya-3d-avatar-widget-vuejs-widget__branding a:hover {
  text-decoration: underline;
}

/* Transitions */
.liya-3d-avatar-widget-vuejs-slide-enter-active,
.liya-3d-avatar-widget-vuejs-slide-leave-active {
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-slide-enter-from,
.liya-3d-avatar-widget-vuejs-slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

/* Mobile responsive */
@media (max-width: 480px) {
  .liya-3d-avatar-widget-vuejs-widget__panel {
    width: calc(100vw - 40px);
    height: calc(100vh - 100px);
    max-height: none;
  }
  
  .liya-3d-avatar-widget-vuejs-widget--bottom-right,
  .liya-3d-avatar-widget-vuejs-widget--bottom-left {
    bottom: 10px;
    right: 10px;
    left: 10px;
  }
  
  .liya-3d-avatar-widget-vuejs-widget--bottom-right .liya-3d-avatar-widget-vuejs-widget__panel,
  .liya-3d-avatar-widget-vuejs-widget--bottom-left .liya-3d-avatar-widget-vuejs-widget__panel {
    right: 0;
    left: 0;
  }
}
</style>

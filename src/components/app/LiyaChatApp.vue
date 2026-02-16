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
import type { ThemeConfig, Session } from '../../types'
import { useChat } from '../../composables/useChat'
import { useSessions } from '../../composables/useSessions'
import { useFileUpload } from '../../composables/useFileUpload'
import { getConfig } from '../../api'
import SessionSidebar from './SessionSidebar.vue'
import MessageList from '../shared/MessageList.vue'
import ChatInput from '../shared/ChatInput.vue'

interface Props {
  theme?: ThemeConfig
  showSidebar?: boolean
  sidebarWidth?: string
  welcomeMessage?: string
  placeholder?: string
  showVoice?: boolean
  voiceEnabled?: boolean  // false for STANDARD users - shows disabled mic icon
  showFileUpload?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showSidebar: true,
  sidebarWidth: '300px',
  welcomeMessage: 'Merhaba! Size nasıl yardımcı olabilirim?',
  placeholder: 'Mesajınızı yazın...',
  showVoice: true,
  voiceEnabled: true,
  showFileUpload: true,
})

const emit = defineEmits<{
  sessionCreated: [session: Session]
  sessionSelected: [session: Session]
  sessionDeleted: [sessionId: string]
  messageSent: [message: string]
  messageReceived: [message: string]
}>()

const config = getConfig()
const isMobileSidebarOpen = ref(false)

const {
  messages,
  isLoading: isChatLoading,
  currentSessionId,
  sendMessage,
  loadHistory,
  clearMessages,
  setSessionId,
} = useChat()

const {
  sessions,
  currentSession,
  isLoading: isSessionsLoading,
  loadSessions,
  createSession,
  deleteSession,
  selectSession,
} = useSessions()

const { uploadFiles, clearAll: clearFiles } = useFileUpload()

const assistantName = computed(() => config.assistantName || 'Assistant')

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
    '--liya-border-radius': theme.borderRadius || '12px',
    '--liya-font-family': theme.fontFamily || 'system-ui, -apple-system, sans-serif',
    '--liya-sidebar-width': props.sidebarWidth,
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

async function handleSelectSession(session: Session): Promise<void> {
  selectSession(session)
  setSessionId(session.id)
  await loadHistory(session.id)
  isMobileSidebarOpen.value = false
  emit('sessionSelected', session)
}

async function handleCreateSession(): Promise<void> {
  const session = await createSession()
  if (session) {
    selectSession(session)
    setSessionId(session.id)
    clearMessages()
    isMobileSidebarOpen.value = false
    emit('sessionCreated', session)
  }
}

async function handleDeleteSession(sessionId: string): Promise<void> {
  const success = await deleteSession(sessionId)
  if (success) {
    if (currentSessionId.value === sessionId) {
      clearMessages()
      setSessionId(null)
      selectSession(null)
    }
    emit('sessionDeleted', sessionId)
  }
}

async function handleSend(message: string, fileIds?: string[]): Promise<void> {
  if (!message.trim() && (!fileIds || fileIds.length === 0)) return

  // Create session if none exists
  if (!currentSessionId.value) {
    const session = await createSession(message.substring(0, 30))
    if (session) {
      selectSession(session)
      setSessionId(session.id)
      emit('sessionCreated', session)
    }
  }

  // Upload pending files
  let uploadedIds = fileIds
  if (currentSessionId.value && fileIds && fileIds.length > 0) {
    const uploaded = await uploadFiles(currentSessionId.value)
    uploadedIds = uploaded.map(f => f.id)
  }

  emit('messageSent', message)
  
  const response = await sendMessage(message, uploadedIds)
  
  if (response?.assistant_message?.content || response?.response) {
    emit('messageReceived', response.assistant_message?.content || response.response || '')
  }
  
  clearFiles()
  
  // Refresh sessions list
  loadSessions()
}

function toggleMobileSidebar(): void {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value
}

function handleSuggestionClick(suggestion: string): void {
  handleSend(suggestion)
}

onMounted(async () => {
  await loadSessions()
})
</script>

<template>
  <div class="liya-3d-avatar-widget-vuejs-app" :style="cssVars">
    <!-- Mobile Header -->
    <div class="liya-3d-avatar-widget-vuejs-app__mobile-header">
      <button class="liya-3d-avatar-widget-vuejs-app__menu-btn" @click="toggleMobileSidebar">
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      </button>
      <span class="liya-3d-avatar-widget-vuejs-app__mobile-title">
        {{ currentSession?.session_name || assistantName }}
      </span>
      <button class="liya-3d-avatar-widget-vuejs-app__new-btn" @click="handleCreateSession">
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
    </div>

    <!-- Sidebar -->
    <aside 
      v-if="showSidebar" 
      class="liya-3d-avatar-widget-vuejs-app__sidebar"
      :class="{ 'liya-3d-avatar-widget-vuejs-app__sidebar--open': isMobileSidebarOpen }"
    >
      <SessionSidebar
        :sessions="sessions"
        :current-session-id="currentSessionId"
        :is-loading="isSessionsLoading"
        :assistant-name="assistantName"
        @select-session="handleSelectSession"
        @create-session="handleCreateSession"
        @delete-session="handleDeleteSession"
      />
    </aside>

    <!-- Overlay for mobile -->
    <div 
      v-if="isMobileSidebarOpen" 
      class="liya-3d-avatar-widget-vuejs-app__overlay"
      @click="isMobileSidebarOpen = false"
    ></div>

    <!-- Main Chat Area -->
    <main class="liya-3d-avatar-widget-vuejs-app__main">
      <!-- Chat Header -->
      <div class="liya-3d-avatar-widget-vuejs-app__header">
        <div class="liya-3d-avatar-widget-vuejs-app__header-info">
          <div class="liya-3d-avatar-widget-vuejs-app__avatar">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <div class="liya-3d-avatar-widget-vuejs-app__header-text">
            <h2 class="liya-3d-avatar-widget-vuejs-app__title">
              {{ currentSession?.session_name || assistantName }}
            </h2>
            <span class="liya-3d-avatar-widget-vuejs-app__status">
              {{ currentSession ? `${currentSession.message_count} mesaj` : 'Yeni sohbet başlatın' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <MessageList
        :messages="messages"
        :is-loading="isChatLoading"
        :assistant-name="assistantName"
        :welcome-message="welcomeMessage"
        @suggestion-click="handleSuggestionClick"
      />

      <!-- Input -->
      <ChatInput
        :placeholder="placeholder"
        :disabled="isChatLoading"
        :show-voice="showVoice"
        :voice-enabled="voiceEnabled"
        :show-file-upload="showFileUpload"
        :session-id="currentSessionId"
        @send="handleSend"
      />
    </main>
  </div>
</template>

<style scoped>
.liya-3d-avatar-widget-vuejs-app {
  display: flex;
  height: 100%;
  width: 100%;
  background: var(--liya-bg-color);
  font-family: var(--liya-font-family);
  position: relative;
  overflow: hidden;
}

.liya-3d-avatar-widget-vuejs-app__mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--liya-bg-color);
  border-bottom: 1px solid var(--liya-border-color);
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  z-index: 100;
}

.liya-3d-avatar-widget-vuejs-app__menu-btn,
.liya-3d-avatar-widget-vuejs-app__new-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--liya-text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.liya-3d-avatar-widget-vuejs-app__menu-btn:hover,
.liya-3d-avatar-widget-vuejs-app__new-btn:hover {
  background: var(--liya-bg-secondary);
}

.liya-3d-avatar-widget-vuejs-app__mobile-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--liya-text-color);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.liya-3d-avatar-widget-vuejs-app__sidebar {
  width: var(--liya-sidebar-width);
  flex-shrink: 0;
  height: 100%;
}

.liya-3d-avatar-widget-vuejs-app__overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 199;
}

.liya-3d-avatar-widget-vuejs-app__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}

.liya-3d-avatar-widget-vuejs-app__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--liya-border-color);
  background: var(--liya-bg-color);
}

.liya-3d-avatar-widget-vuejs-app__header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.liya-3d-avatar-widget-vuejs-app__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--liya-primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.liya-3d-avatar-widget-vuejs-app__header-text {
  display: flex;
  flex-direction: column;
}

.liya-3d-avatar-widget-vuejs-app__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--liya-text-color);
}

.liya-3d-avatar-widget-vuejs-app__status {
  font-size: 13px;
  color: var(--liya-text-muted);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .liya-3d-avatar-widget-vuejs-app__mobile-header {
    display: flex;
  }

  .liya-3d-avatar-widget-vuejs-app__sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 300px;
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  .liya-3d-avatar-widget-vuejs-app__sidebar--open {
    transform: translateX(0);
  }

  .liya-3d-avatar-widget-vuejs-app__overlay {
    display: block;
  }

  .liya-3d-avatar-widget-vuejs-app__main {
    padding-top: 56px;
  }

  .liya-3d-avatar-widget-vuejs-app__header {
    display: none;
  }
}
</style>

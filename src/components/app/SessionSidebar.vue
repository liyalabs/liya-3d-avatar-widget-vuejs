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
import type { Session } from '../../types'

interface Props {
  sessions: readonly Session[]
  currentSessionId?: string | null
  isLoading?: boolean
  assistantName?: string
}

withDefaults(defineProps<Props>(), {
  currentSessionId: null,
  isLoading: false,
  assistantName: 'Assistant',
})

const emit = defineEmits<{
  selectSession: [session: Session]
  createSession: []
  deleteSession: [sessionId: string]
}>()

function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return 'Dün'
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  } else {
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
</script>

<template>
  <div class="liya-3d-avatar-widget-vuejs-sidebar">
    <!-- Header -->
    <div class="liya-3d-avatar-widget-vuejs-sidebar__header">
      <div class="liya-3d-avatar-widget-vuejs-sidebar__logo">
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <span>{{ assistantName }}</span>
      </div>
      <button 
        class="liya-3d-avatar-widget-vuejs-sidebar__new-btn"
        @click="emit('createSession')"
        title="Yeni sohbet"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
    </div>

    <!-- Session List -->
    <div class="liya-3d-avatar-widget-vuejs-sidebar__list">
      <div v-if="isLoading" class="liya-3d-avatar-widget-vuejs-sidebar__loading">
        <div class="liya-3d-avatar-widget-vuejs-sidebar__spinner"></div>
        <span>Yükleniyor...</span>
      </div>

      <div v-else-if="sessions.length === 0" class="liya-3d-avatar-widget-vuejs-sidebar__empty">
        <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <p>Henüz sohbet yok</p>
        <button class="liya-3d-avatar-widget-vuejs-sidebar__start-btn" @click="emit('createSession')">
          Yeni Sohbet Başlat
        </button>
      </div>

      <div
        v-for="session in sessions"
        :key="session.id"
        class="liya-3d-avatar-widget-vuejs-sidebar__item"
        :class="{ 'liya-3d-avatar-widget-vuejs-sidebar__item--active': session.id === currentSessionId }"
        @click="emit('selectSession', session)"
      >
        <div class="liya-3d-avatar-widget-vuejs-sidebar__item-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
        </div>
        <div class="liya-3d-avatar-widget-vuejs-sidebar__item-content">
          <div class="liya-3d-avatar-widget-vuejs-sidebar__item-title">
            {{ truncateText(session.session_name, 28) }}
          </div>
          <div class="liya-3d-avatar-widget-vuejs-sidebar__item-meta">
            <span>{{ session.message_count }} mesaj</span>
            <span>{{ formatDate(session.last_message_at || session.created_at) }}</span>
          </div>
        </div>
        <button 
          class="liya-3d-avatar-widget-vuejs-sidebar__item-delete"
          @click.stop="emit('deleteSession', session.id)"
          title="Sohbeti sil"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.liya-3d-avatar-widget-vuejs-sidebar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--liya-bg-color, #ffffff);
  border-right: 1px solid var(--liya-border-color, #e5e7eb);
}

.liya-3d-avatar-widget-vuejs-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--liya-border-color, #e5e7eb);
}

.liya-3d-avatar-widget-vuejs-sidebar__logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 16px;
  color: var(--liya-text-color, #374151);
}

.liya-3d-avatar-widget-vuejs-sidebar__logo svg {
  color: var(--liya-primary-color, #6366f1);
}

.liya-3d-avatar-widget-vuejs-sidebar__new-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--liya-primary-color, #6366f1);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.liya-3d-avatar-widget-vuejs-sidebar__new-btn:hover {
  background: var(--liya-primary-hover, #4f46e5);
}

.liya-3d-avatar-widget-vuejs-sidebar__list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.liya-3d-avatar-widget-vuejs-sidebar__loading,
.liya-3d-avatar-widget-vuejs-sidebar__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--liya-text-muted, #9ca3af);
  text-align: center;
}

.liya-3d-avatar-widget-vuejs-sidebar__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--liya-border-color, #e5e7eb);
  border-top-color: var(--liya-primary-color, #6366f1);
  border-radius: 50%;
  animation: liya-3d-avatar-widget-vuejs-spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes liya-3d-avatar-widget-vuejs-spin {
  to { transform: rotate(360deg); }
}

.liya-3d-avatar-widget-vuejs-sidebar__empty svg {
  opacity: 0.3;
  margin-bottom: 12px;
}

.liya-3d-avatar-widget-vuejs-sidebar__empty p {
  margin: 0 0 16px 0;
  font-size: 14px;
}

.liya-3d-avatar-widget-vuejs-sidebar__start-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--liya-primary-color, #6366f1);
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.liya-3d-avatar-widget-vuejs-sidebar__start-btn:hover {
  background: var(--liya-primary-hover, #4f46e5);
}

.liya-3d-avatar-widget-vuejs-sidebar__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.liya-3d-avatar-widget-vuejs-sidebar__item:hover {
  background: var(--liya-bg-secondary, #f3f4f6);
}

.liya-3d-avatar-widget-vuejs-sidebar__item--active {
  background: var(--liya-bg-secondary, #f3f4f6);
}

.liya-3d-avatar-widget-vuejs-sidebar__item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  background: var(--liya-primary-color, #6366f1);
  border-radius: 0 2px 2px 0;
}

.liya-3d-avatar-widget-vuejs-sidebar__item-icon {
  flex-shrink: 0;
  color: var(--liya-text-muted, #9ca3af);
}

.liya-3d-avatar-widget-vuejs-sidebar__item-content {
  flex: 1;
  min-width: 0;
}

.liya-3d-avatar-widget-vuejs-sidebar__item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--liya-text-color, #374151);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.liya-3d-avatar-widget-vuejs-sidebar__item-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--liya-text-muted, #9ca3af);
  margin-top: 2px;
}

.liya-3d-avatar-widget-vuejs-sidebar__item-delete {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--liya-text-muted, #9ca3af);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s;
}

.liya-3d-avatar-widget-vuejs-sidebar__item:hover .liya-3d-avatar-widget-vuejs-sidebar__item-delete {
  opacity: 1;
}

.liya-3d-avatar-widget-vuejs-sidebar__item-delete:hover {
  background: #fef2f2;
  color: #dc2626;
}
</style>

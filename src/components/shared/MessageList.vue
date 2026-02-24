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
import { ref, watch, nextTick, onMounted } from 'vue'
import type { Message } from '../../types'
import MessageBubble from './MessageBubble.vue'

interface Props {
  messages: readonly Message[]
  isLoading?: boolean
  assistantName?: string
  welcomeMessage?: string
  welcomeSuggestions?: string[]
  preparingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  assistantName: 'Assistant',
  welcomeMessage: '',
  welcomeSuggestions: () => [],
  preparingText: '',
})

const emit = defineEmits<{
  (e: 'suggestion-click', suggestion: string): void
}>()

function handleSuggestionClick(suggestion: string): void {
  emit('suggestion-click', suggestion)
}

const containerRef = ref<HTMLElement | null>(null)

function scrollToBottom(): void {
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    }
  })
}

watch(() => props.messages.length, () => {
  scrollToBottom()
})

watch(() => props.isLoading, () => {
  scrollToBottom()
})

onMounted(() => {
  scrollToBottom()
})

defineExpose({ scrollToBottom })
</script>

<template>
  <div ref="containerRef" class="liya-3d-avatar-widget-vuejs-message-list">
    <!-- Welcome message -->
    <div v-if="messages.length === 0 && welcomeMessage" class="liya-3d-avatar-widget-vuejs-welcome">
      <div class="liya-3d-avatar-widget-vuejs-welcome__icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </div>
      <p class="liya-3d-avatar-widget-vuejs-welcome__text">{{ welcomeMessage }}</p>
      <div v-if="welcomeSuggestions && welcomeSuggestions.length > 0" class="liya-3d-avatar-widget-vuejs-welcome__suggestions">
        <button
          v-for="suggestion in welcomeSuggestions"
          :key="suggestion"
          class="liya-3d-avatar-widget-vuejs-welcome__suggestion-btn"
          @click="handleSuggestionClick(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
    </div>

    <!-- Messages -->
    <MessageBubble
      v-for="message in messages"
      :key="message.id"
      :message="message"
      :assistant-name="assistantName"
      @suggestion-click="handleSuggestionClick"
    />

    <!-- Welcome suggestions (shown when only a welcome message exists) -->
    <div
      v-if="messages.length === 1 && messages[0].id?.startsWith('welcome-') && welcomeSuggestions && welcomeSuggestions.length > 0"
      class="liya-3d-avatar-widget-vuejs-welcome__suggestions liya-3d-avatar-widget-vuejs-welcome__suggestions--inline"
    >
      <button
        v-for="suggestion in welcomeSuggestions"
        :key="suggestion"
        class="liya-3d-avatar-widget-vuejs-welcome__suggestion-btn"
        @click="handleSuggestionClick(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>

    <!-- Typing indicator -->
    <div v-if="isLoading" class="liya-3d-avatar-widget-vuejs-typing">
      <div class="liya-3d-avatar-widget-vuejs-typing__avatar">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>
      <div class="liya-3d-avatar-widget-vuejs-typing__content">
        <div class="liya-3d-avatar-widget-vuejs-typing__dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p v-if="preparingText" class="liya-3d-avatar-widget-vuejs-typing__text">{{ preparingText }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.liya-3d-avatar-widget-vuejs-message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.liya-3d-avatar-widget-vuejs-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  color: var(--liya-text-muted, #9ca3af);
}

.liya-3d-avatar-widget-vuejs-welcome__icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.liya-3d-avatar-widget-vuejs-welcome__text {
  font-size: 14px;
  max-width: 280px;
  line-height: 1.5;
}

.liya-3d-avatar-widget-vuejs-welcome__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  justify-content: center;
  max-width: 360px;
}

.liya-3d-avatar-widget-vuejs-welcome__suggestion-btn {
  padding: 8px 14px;
  border-radius: 18px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--liya-border-color, rgba(255,255,255,0.12));
  background: var(--liya-bg-secondary, rgba(255,255,255,0.06));
  color: var(--liya-text-secondary, #c5d0de);
  transition: all 0.2s ease;
  line-height: 1.3;
}

.liya-3d-avatar-widget-vuejs-welcome__suggestion-btn:hover {
  background: var(--liya-primary-color, #6366f1);
  border-color: var(--liya-primary-color, #6366f1);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.liya-3d-avatar-widget-vuejs-welcome__suggestions--inline {
  justify-content: flex-start;
  padding: 4px 0 8px 48px;
  max-width: 100%;
}

.liya-3d-avatar-widget-vuejs-typing {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.liya-3d-avatar-widget-vuejs-typing__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--liya-primary-color, #6366f1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.liya-3d-avatar-widget-vuejs-typing__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.liya-3d-avatar-widget-vuejs-typing__dots {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: var(--liya-bg-secondary, #f3f4f6);
  border-radius: 12px;
  border-bottom-left-radius: 4px;
}

.liya-3d-avatar-widget-vuejs-typing__text {
  font-size: 12px;
  color: var(--liya-text-muted, #9ca3af);
  margin: 0;
  padding-left: 4px;
}

.liya-3d-avatar-widget-vuejs-typing__dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--liya-text-muted, #9ca3af);
  animation: liya-3d-avatar-widget-vuejs-typing-bounce 1.4s infinite ease-in-out both;
}

.liya-3d-avatar-widget-vuejs-typing__dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.liya-3d-avatar-widget-vuejs-typing__dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes liya-3d-avatar-widget-vuejs-typing-bounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>

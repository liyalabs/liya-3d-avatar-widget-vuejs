<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVoice } from '../../composables/useVoice'
import { useI18n } from '../../i18n'

interface Props {
  placeholder?: string
  disabled?: boolean
  showVoice?: boolean
  voiceEnabled?: boolean  // false for STANDARD users - shows disabled mic icon
  maxLength?: number
  sessionId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  disabled: false,
  showVoice: true,
  voiceEnabled: true,  // Premium users have this enabled
  maxLength: 4000,
  sessionId: null,
})

const { t } = useI18n()
const placeholderText = computed(() => props.placeholder || t.value.chat.placeholder)

const emit = defineEmits<{
  send: [message: string, fileIds?: string[]]
}>()

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const { 
  isRecording, 
  fullTranscript, 
  isSupported: voiceSupported,
  startRecording, 
  stopRecording
} = useVoice()

const canSend = computed(() => {
  return inputText.value.trim().length > 0 && 
         !props.disabled
})

const characterCount = computed(() => inputText.value.length)

watch(fullTranscript, (newValue) => {
  if (newValue) {
    inputText.value = newValue
  }
})

function handleSend(): void {
  if (!canSend.value) return
  
  const message = inputText.value.trim()
  emit('send', message)
  
  inputText.value = ''
  adjustTextareaHeight()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

function adjustTextareaHeight(): void {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 150) + 'px'
  }
}

function handleVoiceClick(): void {
  if (isRecording.value) {
    const transcript = stopRecording()
    if (transcript) {
      inputText.value = transcript
    }
  } else {
    startRecording()
  }
}

</script>

<template>
  <div class="liya-3d-avatar-widget-vuejs-chat-input">
    <div class="liya-3d-avatar-widget-vuejs-chat-input__wrapper">
      <!-- Text input -->
      <textarea
        ref="textareaRef"
        v-model="inputText"
        :placeholder="placeholderText"
        :disabled="disabled"
        :maxlength="maxLength"
        class="liya-3d-avatar-widget-vuejs-chat-input__textarea"
        rows="1"
        @input="adjustTextareaHeight"
        @keydown="handleKeydown"
      ></textarea>

      <!-- Voice button -->
      <button
        v-if="showVoice && voiceSupported"
        type="button"
        class="liya-3d-avatar-widget-vuejs-chat-input__btn liya-3d-avatar-widget-vuejs-chat-input__btn--voice"
        :class="{ 
          'liya-3d-avatar-widget-vuejs-chat-input__btn--recording': isRecording,
          'liya-3d-avatar-widget-vuejs-chat-input__btn--voice-disabled': !voiceEnabled
        }"
        :disabled="disabled || !voiceEnabled"
        @click="voiceEnabled ? handleVoiceClick() : null"
        :title="!voiceEnabled ? t.voice.voiceNotSupported : (isRecording ? t.voice.stopRecording : t.voice.startRecording)"
      >
        <!-- Disabled mic icon (with slash) for STANDARD users -->
        <svg v-if="!voiceEnabled" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
        </svg>
        <!-- Normal mic icon -->
        <svg v-else-if="!isRecording" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
        </svg>
        <!-- Recording stop icon -->
        <svg v-else viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M6 6h12v12H6z"/>
        </svg>
      </button>

      <!-- Send button -->
      <button
        type="button"
        class="liya-3d-avatar-widget-vuejs-chat-input__btn liya-3d-avatar-widget-vuejs-chat-input__btn--send"
        :disabled="!canSend"
        @click="handleSend"
        :title="t.chat.send"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>

    <!-- Character count -->
    <div v-if="characterCount > maxLength * 0.8" class="liya-3d-avatar-widget-vuejs-chat-input__count">
      {{ characterCount }} / {{ maxLength }}
    </div>
  </div>
</template>

<style scoped>
.liya-3d-avatar-widget-vuejs-chat-input {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
  position: relative;
}

/* Subtle top glow line */
.liya-3d-avatar-widget-vuejs-chat-input::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 16px;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.4) 50%, transparent 100%);
}

.liya-3d-avatar-widget-vuejs-chat-input__files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.liya-3d-avatar-widget-vuejs-file-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  font-size: 12px;
  color: #e2e8f0;
}

.liya-3d-avatar-widget-vuejs-file-chip--error {
  background: rgba(220, 38, 38, 0.15);
  border-color: rgba(220, 38, 38, 0.3);
  color: #fca5a5;
}

.liya-3d-avatar-widget-vuejs-file-chip__icon {
  font-size: 14px;
}

.liya-3d-avatar-widget-vuejs-file-chip__name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.liya-3d-avatar-widget-vuejs-file-chip__size {
  color: rgba(148, 163, 184, 0.8);
}

.liya-3d-avatar-widget-vuejs-file-chip__remove {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: rgba(148, 163, 184, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.liya-3d-avatar-widget-vuejs-file-chip__remove:hover {
  color: #f1f5f9;
}

.liya-3d-avatar-widget-vuejs-chat-input__wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: linear-gradient(135deg, rgba(51, 65, 85, 0.5) 0%, rgba(30, 41, 59, 0.7) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 10px 14px;
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-chat-input__wrapper:focus-within {
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.2),
    0 0 20px rgba(99, 102, 241, 0.15);
}

.liya-3d-avatar-widget-vuejs-chat-input__file-input {
  display: none;
}

.liya-3d-avatar-widget-vuejs-chat-input__textarea {
  flex: 1;
  border: none;
  background: transparent;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  max-height: 150px;
  color: #f1f5f9;
  font-family: inherit;
}

.liya-3d-avatar-widget-vuejs-chat-input__textarea:focus {
  outline: none;
}

.liya-3d-avatar-widget-vuejs-chat-input__textarea::placeholder {
  color: rgba(148, 163, 184, 0.6);
}

.liya-3d-avatar-widget-vuejs-chat-input__btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(148, 163, 184, 0.8);
}

.liya-3d-avatar-widget-vuejs-chat-input__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #f1f5f9;
  transform: scale(1.05);
}

.liya-3d-avatar-widget-vuejs-chat-input__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.liya-3d-avatar-widget-vuejs-chat-input__btn--send {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(79, 70, 229, 0.9) 100%);
  border-color: rgba(99, 102, 241, 0.5);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.liya-3d-avatar-widget-vuejs-chat-input__btn--send:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(99, 102, 241, 1) 0%, rgba(79, 70, 229, 1) 100%);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
  color: white;
}

.liya-3d-avatar-widget-vuejs-chat-input__btn--voice {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
  color: rgba(165, 180, 252, 0.9);
}

.liya-3d-avatar-widget-vuejs-chat-input__btn--voice:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
  color: #a5b4fc;
}

.liya-3d-avatar-widget-vuejs-chat-input__btn--recording {
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.9) 0%, rgba(185, 28, 28, 0.9) 100%);
  border-color: rgba(220, 38, 38, 0.5);
  color: white;
  animation: liya-3d-avatar-widget-vuejs-recording-pulse 1.5s infinite;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.liya-3d-avatar-widget-vuejs-chat-input__btn--voice-disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: transparent;
  border-color: rgba(255, 255, 255, 0.05);
  color: rgba(148, 163, 184, 0.5);
}

.liya-3d-avatar-widget-vuejs-chat-input__btn--voice-disabled:hover {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.05);
  color: rgba(148, 163, 184, 0.5);
  transform: none;
}

@keyframes liya-3d-avatar-widget-vuejs-recording-pulse {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
  }
  50% {
    box-shadow: 0 4px 20px rgba(220, 38, 38, 0.5);
  }
}

.liya-3d-avatar-widget-vuejs-chat-input__count {
  text-align: right;
  font-size: 11px;
  color: rgba(148, 163, 184, 0.6);
  margin-top: 6px;
}
</style>

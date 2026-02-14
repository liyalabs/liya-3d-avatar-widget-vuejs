<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import AvatarScene from './AvatarScene.vue'
import { useChat } from '../../composables/useChat'
import { useVoice } from '../../composables/useVoice'
import { getConfig } from '../../api'
import { useI18n } from '../../i18n'

interface Props {
  isOpen: boolean
  modelUrl?: string
  assistantName?: string
  welcomeMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  modelUrl: '',
  assistantName: 'AI Assistant',
  welcomeMessage: 'Merhaba! Size nasıl yardımcı olabilirim?'
})

const emit = defineEmits<{
  close: []
  messageSent: [message: string]
  messageReceived: [message: string]
}>()

const config = getConfig()
const { t } = useI18n()

const {
  messages,
  sendMessage
} = useChat()

const {
  isRecording: isListening,
  isSupported: isVoiceSupported,
  transcript,
  startRecording: startListening,
  stopRecording: stopListening
} = useVoice()

// Avatar state
const isSpeaking = ref(false)
const currentVisemes = ref<Array<{ time: number; viseme: number; duration: number }>>([])
const audioCurrentTime = ref(0)
const currentMessage = ref('')
const isProcessing = ref(false)

// Rotating preparing messages
const preparingMessageIndex = ref(0)
const preparingStartTime = ref(0)
let preparingTimer: ReturnType<typeof setInterval> | null = null

watch(isProcessing, (processing) => {
  if (processing) {
    preparingMessageIndex.value = 0
    preparingStartTime.value = Date.now()
    preparingTimer = setInterval(() => {
      const elapsed = Date.now() - preparingStartTime.value
      if (elapsed > 8000) {
        preparingMessageIndex.value = 
          (preparingMessageIndex.value + 1) % t.value.preparingMessages.length
      }
    }, 4000)
  } else {
    if (preparingTimer) {
      clearInterval(preparingTimer)
      preparingTimer = null
    }
    preparingMessageIndex.value = 0
  }
})

const hintText = computed(() => {
  if (isListening.value) return t.value.voice.listening
  if (isProcessing.value) return t.value.preparingMessages[preparingMessageIndex.value]
  return t.value.voice.speakToMic
})

// Audio player
let audioContext: AudioContext | null = null
let audioSource: AudioBufferSourceNode | null = null
let startTime = 0

const assistantDisplayName = computed(() => props.assistantName || config.assistantName || 'AI Assistant')

// Watch for transcript changes (voice input)
watch(transcript, (newTranscript) => {
  if (newTranscript && !isListening.value) {
    handleSendMessage(newTranscript)
  }
})

async function handleSendMessage(message: string) {
  if (!message.trim() || isProcessing.value) return

  isProcessing.value = true
  currentMessage.value = message
  emit('messageSent', message)

  try {
    const response = await sendMessage(message)
    
    if (response?.assistant_message?.content || response?.response) {
      const responseText = response.assistant_message?.content || response.response || ''
      emit('messageReceived', responseText)
      
      // Generate avatar speech
      await speakWithAvatar(responseText)
    }
  } catch (error) { /* message send failed */ } finally {
    isProcessing.value = false
    currentMessage.value = ''
  }
}

async function speakWithAvatar(text: string) {
  try {
    // Call avatar speech API
    const apiUrl = config.apiUrl || ''
    const apiKey = config.apiKey || ''
    
    const response = await fetch(`${apiUrl}/api/v1/external/avatar/speech/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        text,
        voice: 'nova',
        speed: 1.0,
        include_audio: true
      })
    })

    if (!response.ok) {
      throw new Error('Failed to generate avatar speech')
    }

    const data = await response.json()
    
    if (data.status === 'success' && data.data) {
      currentVisemes.value = data.data.visemes || []
      
      // Play audio with viseme sync
      if (data.data.audio_base64) {
        await playAudioWithSync(data.data.audio_base64)
      }
    }
  } catch (error) {
    // Fallback: just show speaking animation without audio
    simulateSpeaking(text)
  }
}

async function playAudioWithSync(base64Audio: string) {
  try {
    // Decode base64 audio
    const binaryString = atob(base64Audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Create audio context
    if (!audioContext) {
      audioContext = new AudioContext()
    }

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer)

    // Stop any existing audio
    if (audioSource) {
      audioSource.stop()
      audioSource.disconnect()
    }

    // Create and play audio source
    audioSource = audioContext.createBufferSource()
    audioSource.buffer = audioBuffer
    audioSource.connect(audioContext.destination)

    isSpeaking.value = true
    startTime = audioContext.currentTime

    // Update current time for viseme sync
    const updateTime = () => {
      if (isSpeaking.value && audioContext) {
        audioCurrentTime.value = audioContext.currentTime - startTime
        requestAnimationFrame(updateTime)
      }
    }
    updateTime()

    audioSource.onended = () => {
      isSpeaking.value = false
      audioCurrentTime.value = 0
      currentVisemes.value = []
    }

    audioSource.start()
  } catch (error) {
    isSpeaking.value = false
  }
}

function simulateSpeaking(text: string) {
  // Generate simple visemes for fallback
  const duration = text.length * 0.05
  const visemes: Array<{ time: number; viseme: number; duration: number }> = []
  
  let time = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i].toLowerCase()
    let viseme = 0
    
    if ('aeiouäöü'.includes(char)) viseme = 10 + Math.floor(Math.random() * 5)
    else if ('bcdfghjklmnpqrstvwxyz'.includes(char)) viseme = 1 + Math.floor(Math.random() * 9)
    
    visemes.push({ time, viseme, duration: 0.05 })
    time += 0.05
  }

  currentVisemes.value = visemes
  isSpeaking.value = true
  audioCurrentTime.value = 0

  // Animate through visemes
  const startMs = Date.now()
  const animate = () => {
    const elapsed = (Date.now() - startMs) / 1000
    audioCurrentTime.value = elapsed
    
    if (elapsed < duration) {
      requestAnimationFrame(animate)
    } else {
      isSpeaking.value = false
      currentVisemes.value = []
    }
  }
  animate()
}

function toggleListening() {
  if (isListening.value) {
    stopListening()
  } else {
    startListening()
  }
}

function handleClose() {
  // Stop any playing audio
  if (audioSource) {
    audioSource.stop()
    audioSource.disconnect()
    audioSource = null
  }
  isSpeaking.value = false
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="liya-3d-avatar-widget-vuejs-avatar-modal">
      <div v-if="isOpen" class="liya-3d-avatar-widget-vuejs-avatar-modal-overlay" @click.self="handleClose">
        <div class="liya-3d-avatar-widget-vuejs-avatar-modal">
          <!-- Header -->
          <div class="liya-3d-avatar-widget-vuejs-avatar-modal__header">
            <div class="liya-3d-avatar-widget-vuejs-avatar-modal__title">
              <div class="liya-3d-avatar-widget-vuejs-avatar-modal__status" :class="{ 'liya-3d-avatar-widget-vuejs-avatar-modal__status--speaking': isSpeaking }"></div>
              <span>{{ assistantDisplayName }}</span>
            </div>
            <button class="liya-3d-avatar-widget-vuejs-avatar-modal__close" @click="handleClose" :aria-label="t.kiosk.close">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <!-- Avatar Scene -->
          <div class="liya-3d-avatar-widget-vuejs-avatar-modal__scene">
            <AvatarScene
              :model-url="modelUrl"
              :width="400"
              :height="450"
              :is-speaking="isSpeaking"
              :visemes="currentVisemes"
              :current-time="audioCurrentTime"
            />
          </div>

          <!-- Message Display -->
          <div class="liya-3d-avatar-widget-vuejs-avatar-modal__message">
            <div v-if="isProcessing" class="liya-3d-avatar-widget-vuejs-avatar-modal__thinking">
              <span class="liya-3d-avatar-widget-vuejs-avatar-modal__thinking-dot"></span>
              <span class="liya-3d-avatar-widget-vuejs-avatar-modal__thinking-dot"></span>
              <span class="liya-3d-avatar-widget-vuejs-avatar-modal__thinking-dot"></span>
            </div>
            <p v-else-if="currentMessage">{{ currentMessage }}</p>
            <p v-else-if="messages.length === 0" class="liya-3d-avatar-widget-vuejs-avatar-modal__welcome">
              {{ welcomeMessage }}
            </p>
            <p v-else-if="messages.length > 0">
              {{ messages[messages.length - 1]?.content }}
            </p>
          </div>

          <!-- Voice Control -->
          <div class="liya-3d-avatar-widget-vuejs-avatar-modal__controls">
            <button
              v-if="isVoiceSupported"
              class="liya-3d-avatar-widget-vuejs-avatar-modal__mic"
              :class="{ 
                'liya-3d-avatar-widget-vuejs-avatar-modal__mic--active': isListening,
                'liya-3d-avatar-widget-vuejs-avatar-modal__mic--disabled': isProcessing || isSpeaking
              }"
              :disabled="isProcessing || isSpeaking"
              @click="toggleListening"
              :aria-label="isListening ? t.voice.stopRecording : t.voice.startRecording"
            >
              <svg v-if="!isListening" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
            <p class="liya-3d-avatar-widget-vuejs-avatar-modal__hint">
              {{ hintText }}
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.liya-3d-avatar-widget-vuejs-avatar-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.liya-3d-avatar-widget-vuejs-avatar-modal {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 24px;
  width: 440px;
  max-width: 95vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.liya-3d-avatar-widget-vuejs-avatar-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.liya-3d-avatar-widget-vuejs-avatar-modal__title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__status--speaking {
  animation: liya-3d-avatar-widget-vuejs-pulse 1s ease-in-out infinite;
}

@keyframes liya-3d-avatar-widget-vuejs-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
}

.liya-3d-avatar-widget-vuejs-avatar-modal__close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 4px;
  display: flex;
  transition: color 0.2s;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__close:hover {
  color: #fff;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__scene {
  width: 100%;
  height: 450px;
  background: #1a1a2e;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__message {
  padding: 20px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__message p {
  color: #fff;
  font-size: 15px;
  line-height: 1.5;
  margin: 0;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__welcome {
  color: rgba(255, 255, 255, 0.7) !important;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__thinking {
  display: flex;
  gap: 6px;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__thinking-dot {
  width: 8px;
  height: 8px;
  background: #6366f1;
  border-radius: 50%;
  animation: liya-3d-avatar-widget-vuejs-bounce 1.4s infinite ease-in-out both;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__thinking-dot:nth-child(1) { animation-delay: -0.32s; }
.liya-3d-avatar-widget-vuejs-avatar-modal__thinking-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes liya-3d-avatar-widget-vuejs-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.liya-3d-avatar-widget-vuejs-avatar-modal__controls {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.liya-3d-avatar-widget-vuejs-avatar-modal__mic {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
}

.liya-3d-avatar-widget-vuejs-avatar-modal__mic:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
}

.liya-3d-avatar-widget-vuejs-avatar-modal__mic--active {
  background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
  animation: liya-3d-avatar-widget-vuejs-mic-pulse 1.5s ease-in-out infinite;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
}

@keyframes liya-3d-avatar-widget-vuejs-mic-pulse {
  0%, 100% { box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 4px 30px rgba(239, 68, 68, 0.6); }
}

.liya-3d-avatar-widget-vuejs-avatar-modal__mic--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.liya-3d-avatar-widget-vuejs-avatar-modal__hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  margin: 0;
}

/* Transitions */
.liya-3d-avatar-widget-vuejs-avatar-modal-enter-active,
.liya-3d-avatar-widget-vuejs-avatar-modal-leave-active {
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-avatar-modal-enter-from,
.liya-3d-avatar-widget-vuejs-avatar-modal-leave-to {
  opacity: 0;
}

.liya-3d-avatar-widget-vuejs-avatar-modal-enter-from .liya-3d-avatar-widget-vuejs-avatar-modal,
.liya-3d-avatar-widget-vuejs-avatar-modal-leave-to .liya-3d-avatar-widget-vuejs-avatar-modal {
  transform: scale(0.9) translateY(20px);
}
</style>

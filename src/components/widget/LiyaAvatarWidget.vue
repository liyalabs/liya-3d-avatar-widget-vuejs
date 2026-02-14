<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { ThemeConfig, LiyaWidgetMode } from '../../types'
import { useChat } from '../../composables/useChat'
import { useFileUpload } from '../../composables/useFileUpload'
import { useVoice } from '../../composables/useVoice'
import { getConfig, getAvatarModel, checkUserAccess } from '../../api'
import { useI18n } from '../../i18n'
import MessageList from '../shared/MessageList.vue'
import ChatInput from '../shared/ChatInput.vue'
import { AvatarScene } from '../avatar'

interface Props {
  position?: ThemeConfig['position']
  theme?: ThemeConfig
  welcomeMessage?: string
  welcomeSuggestions?: string[]
  placeholder?: string
  showBranding?: boolean
  showVoice?: boolean
  voiceEnabled?: boolean
  showFileUpload?: boolean
  showAvatarButton?: boolean
  avatarModelUrl?: string
  offsetX?: number
  offsetY?: number
  customIcon?: string
  autoSpeak?: boolean
  animateButton?: boolean // Enable attention-grabbing animation on toggle button
  viewOnPageStart?: boolean
  liyaWidgetMode?: LiyaWidgetMode
  closeButtonEnabled?: boolean
  locale?: string
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom-right',
  welcomeMessage: '',
  welcomeSuggestions: () => [],
  placeholder: '',
  showBranding: true,
  showVoice: true,
  voiceEnabled: true,
  showFileUpload: true,
  showAvatarButton: true,
  avatarModelUrl: '',
  offsetX: 20,
  offsetY: 20,
  autoSpeak: true,
  animateButton: true,
  viewOnPageStart: false,
  liyaWidgetMode: 'standard',
  closeButtonEnabled: true,
  locale: '',
})

const pendingMessage = ref('')
const isAvatarVisible = ref(true)
const lastVoiceTranscript = ref('')

const emit = defineEmits<{
  opened: []
  closed: []
  messageSent: [message: string]
  messageReceived: [message: string]
  avatarOpened: []
  avatarClosed: []
}>()

const isOpen = ref(props.liyaWidgetMode !== 'standard')
const config = getConfig()

// Initialize i18n
const { t, locale, initLocale, setLocale } = useI18n()
initLocale(props.locale || config.locale)

// Toggle language between TR and EN
function toggleLocale(): void {
  const newLocale = locale.value === 'tr' ? 'en' : 'tr'
  setLocale(newLocale)
}

// Computed translations with prop overrides
const welcomeMessageText = computed(() => props.welcomeMessage || t.value.chat.welcomeMessage)
const welcomeSuggestionsText = computed(() => 
  props.welcomeSuggestions && props.welcomeSuggestions.length > 0 
    ? props.welcomeSuggestions 
    : t.value.chat.welcomeSuggestions
)
const placeholderText = computed(() => props.placeholder || t.value.chat.placeholder)

// Avatar model URL from backend
const backendAvatarModelUrl = ref('')

// Access error state
const accessError = ref<{ code: string; message: string } | null>(null)
const isCheckingAccess = ref(true)

// Ensure URL uses HTTPS for security (Mixed Content fix)
function ensureHttps(url: string): string {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

// Resolve avatar model URL: prop > config > backend
const resolvedAvatarModelUrl = computed(() => {
  const url = props.avatarModelUrl || config.avatarModelUrl || backendAvatarModelUrl.value
  return ensureHttps(url)
})

// Check if there's an access error
const hasAccessError = computed(() => accessError.value !== null)

// Get localized error message
const accessErrorMessage = computed(() => {
  if (!accessError.value) return ''
  
  const code = accessError.value.code
  if (code === 'FEATURE_NOT_AVAILABLE' || code === 'UPGRADE_REQUIRED') {
    return t.value.errors.upgradeToPremium
  }
  if (code === 'PREMIUM_PLUS_REQUIRED') {
    return t.value.errors.upgradeToPremiumPlus
  }
  return accessError.value.message || t.value.errors.featureNotAvailable
})

// Check user access before loading any resources
async function checkAccess(): Promise<void> {
  isCheckingAccess.value = true
  try {
    const result = await checkUserAccess()
    if (!result.has_avatar_access) {
      accessError.value = {
        code: 'FEATURE_NOT_AVAILABLE',
        message: t.value.errors.upgradeToPremium
      }
    }
  } catch (error: any) {
    // If access check fails, assume no access
    accessError.value = {
      code: 'FEATURE_NOT_AVAILABLE',
      message: t.value.errors.upgradeToPremium
    }
  } finally {
    isCheckingAccess.value = false
  }
}

// Fetch avatar model URL from backend on mount
async function fetchAvatarModel(): Promise<void> {
  // Skip if already have URL from prop or config
  if (props.avatarModelUrl || config.avatarModelUrl) {
    return
  }
  
  try {
    const result = await getAvatarModel(config.assistantId)
    backendAvatarModelUrl.value = ensureHttps(result.model_url)
    accessError.value = null
  } catch (error: any) {
    // Check if it's an AvatarApiError with code
    const errorCode = error?.code || ''
    const errorMessage = error?.message || ''
    
    if (errorCode === 'FEATURE_NOT_AVAILABLE' || 
        errorCode === 'UPGRADE_REQUIRED' ||
        errorCode === 'PREMIUM_PLUS_REQUIRED' ||
        errorMessage.includes('Premium') ||
        errorMessage.includes('upgrade')) {
      accessError.value = {
        code: errorCode || 'FEATURE_NOT_AVAILABLE',
        message: errorMessage
      }
    }
    // Silent fail for other errors - avatar model fetch is optional
  }
}

// Avatar speech state
const isSpeaking = ref(false)
const isPreparingSpeech = ref(false)
const currentVisemes = ref<Array<{ time: number; viseme: number; duration: number }>>([])
const audioCurrentTime = ref(0)
const lastSpokenText = ref<string>('')
let pendingSpeechText = ''
let audioContext: AudioContext | null = null
let audioSource: AudioBufferSourceNode | null = null
let startTime = 0

// Debounce for speech buttons - prevent rapid clicking
let lastSpeechActionTime = 0
const SPEECH_ACTION_DEBOUNCE_MS = 3000 // 3 seconds debounce

const {
  messages,
  isLoading,
  currentSessionId,
  sendMessage,
  initFromStorage,
  loadHistory,
  addWelcomeMessage,
  updateWelcomeMessage,
} = useChat()

const { uploadFiles, clearAll: clearFiles } = useFileUpload()

const {
  isRecording,
  isSupported: isVoiceSupported,
  transcript,
  startRecording,
  stopRecording,
} = useVoice()

function handleVoiceTranscript(text: string): void {
  const normalized = text.trim()
  if (!normalized) return
  if (normalized === lastVoiceTranscript.value) return
  lastVoiceTranscript.value = normalized
  handleSend(normalized)
}

function toggleKioskListening(): void {
  if (!isVoiceSupported.value) return
  if (kioskMicDisabled.value) return
  
  if (isRecording.value) {
    stopRecording()
  } else {
    lastVoiceTranscript.value = ''
    startRecording()
  }
}

const assistantName = computed(() => config.assistantName || 'Assistant')

const isKioskMode = computed(() => props.liyaWidgetMode === 'kiosk')
const isModalKiosk = computed(() => props.liyaWidgetMode === 'modal_kiosk')
const isKioskLayout = computed(() => isKioskMode.value || isModalKiosk.value)

const kioskAvatarSize = ref({ width: 520, height: 620 })

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

// Parse suggestions from message content
function parseSuggestions(content: string): string[] {
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed?.suggestions)) {
      return parsed.suggestions
    }
  } catch {
    // Not JSON
  }
  return []
}

const kioskMessages = computed(() => {
  // Always show welcome message with suggestions when no messages
  if (messages.value.length === 0 && welcomeMessageText.value) {
    return [{ 
      role: 'assistant', 
      content: welcomeMessageText.value, 
      suggestions: welcomeSuggestionsText.value,
      isWelcome: true
    }]
  }

  // Map messages and add welcome suggestions to the first assistant message if it has no suggestions
  const mappedMessages = messages.value.slice(-4).map((message) => {
    const messageSuggestions = message.role === 'assistant' ? parseSuggestions(message.content) : []
    return {
      role: message.role,
      content: formatMessagePreview(message.content),
      suggestions: messageSuggestions,
      isWelcome: false
    }
  })

  // If there are messages but no suggestions in the last assistant message, show welcome suggestions
  const lastAssistantMsg = [...mappedMessages].reverse().find(m => m.role === 'assistant')
  if (lastAssistantMsg && lastAssistantMsg.suggestions.length === 0) {
    lastAssistantMsg.suggestions = welcomeSuggestionsText.value
  }

  return mappedMessages
})

// Handle kiosk suggestion click
function handleKioskSuggestionClick(suggestion: string): void {
  handleSend(suggestion)
}

const kioskMicDisabled = computed(() => isLoading.value || isSpeaking.value || isPreparingSpeech.value)

// Kiosk status indicator
type KioskStatus = 'idle' | 'listening' | 'preparing' | 'speaking'
const kioskStatus = computed<KioskStatus>(() => {
  if (isSpeaking.value) return 'speaking'
  if (isPreparingSpeech.value || isLoading.value) return 'preparing'
  if (isRecording.value) return 'listening'
  return 'idle'
})

// Rotating preparing messages
const preparingMessageIndex = ref(0)
const preparingStartTime = ref(0)
let preparingTimer: ReturnType<typeof setInterval> | null = null

watch([isLoading, isPreparingSpeech], ([loading, preparing]) => {
  if (loading || preparing) {
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

const kioskStatusText = computed(() => {
  switch (kioskStatus.value) {
    case 'listening': return t.value.kiosk.listening
    case 'preparing': return t.value.preparingMessages[preparingMessageIndex.value]
    case 'speaking': return t.value.kiosk.speaking
    default: return t.value.kiosk.ready
  }
})

function cancelCurrentAction(): void {
  const now = Date.now()
  if (now - lastSpeechActionTime < SPEECH_ACTION_DEBOUNCE_MS) return
  lastSpeechActionTime = now
  
  if (isRecording.value) {
    stopRecording()
  }
  if (isSpeaking.value && audioSource) {
    try {
      audioSource.stop()
    } catch (e) {
      // Ignore
    }
    isSpeaking.value = false
    audioCurrentTime.value = 0
    currentVisemes.value = []
  }
  isPreparingSpeech.value = false
}

function refreshKiosk(): void {
  const now = Date.now()
  if (now - lastSpeechActionTime < SPEECH_ACTION_DEBOUNCE_MS) return
  lastSpeechActionTime = now
  
  // Stop any current action first
  if (isRecording.value) {
    stopRecording()
  }
  if (isSpeaking.value && audioSource) {
    try {
      audioSource.stop()
    } catch (e) {
      // Ignore
    }
    isSpeaking.value = false
    audioCurrentTime.value = 0
    currentVisemes.value = []
  }
  isPreparingSpeech.value = false
  lastVoiceTranscript.value = ''
  
  // Replay last assistant message
  const lastAssistantMessage = messages.value
    .filter(m => m.role === 'assistant')
    .pop()
  
  if (lastAssistantMessage) {
    let textToSpeak = lastAssistantMessage.content
    try {
      const parsed = JSON.parse(lastAssistantMessage.content)
      if (parsed.response) {
        textToSpeak = parsed.response
      }
    } catch {
      // Not JSON, use as-is
    }
    speakWithAvatar(textToSpeak, true)
  }
}

// Debounced replay/stop handler for standard layout header button
function handleReplayOrStop(): void {
  const now = Date.now()
  if (now - lastSpeechActionTime < SPEECH_ACTION_DEBOUNCE_MS) return
  lastSpeechActionTime = now
  
  if (isSpeaking.value) {
    stopSpeaking()
  } else if (lastSpokenText.value) {
    speakWithAvatar(lastSpokenText.value, true)
  }
}

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

function formatMessagePreview(content: string): string {
  try {
    const parsed = JSON.parse(content)
    if (typeof parsed?.response === 'string') {
      return parsed.response
    }
  } catch {
    // Not JSON
  }

  return content
}

const hasPlayedWelcome = ref(false)

// Watch locale changes - update welcome message and re-speak
watch(locale, () => {
  // Update welcome message in messages array via composable
  updateWelcomeMessage(welcomeMessageText.value)
  // Stop current audio and re-speak welcome in new language
  stopSpeaking()
  if (hasPlayedWelcome.value && props.autoSpeak) {
    setTimeout(() => {
      speakWithAvatar(welcomeMessageText.value)
    }, 300)
  }
})

function openWidget(): void {
  if (!isOpen.value) {
    isOpen.value = true
    emit('opened')
  }

  // Play welcome message on first open if no messages exist
  if (!hasPlayedWelcome.value && messages.value.length === 0 && welcomeMessageText.value) {
    hasPlayedWelcome.value = true
    // Add welcome message to chat
    addWelcomeMessage(welcomeMessageText.value)
    // Speak the welcome message after a short delay
    setTimeout(() => {
      if (props.autoSpeak) {
        speakWithAvatar(welcomeMessageText.value)
      }
    }, 500)
  }
}

function closeWidget(): void {
  if (!isOpen.value) return
  if (isRecording.value) {
    stopRecording()
  }
  isOpen.value = false
  emit('closed')
}

function toggleWidget(): void {
  if (isKioskLayout.value) {
    closeWidget()
    return
  }

  if (isOpen.value) {
    closeWidget()
  } else {
    openWidget()
  }
}

function updateKioskAvatarSize(): void {
  if (typeof window === 'undefined') return

  const width = window.innerWidth
  const height = window.innerHeight
  const widthFactor = isModalKiosk.value ? 0.42 : 0.55
  const heightFactor = isModalKiosk.value ? 0.6 : 0.68
  kioskAvatarSize.value = {
    width: Math.min(Math.max(width * widthFactor, 320), 720),
    height: Math.min(Math.max(height * heightFactor, 360), 760),
  }
}


function stopSpeaking(): void {
  if (audioSource) {
    try {
      audioSource.stop()
      audioSource.disconnect()
    } catch (e) {
      // Ignore
    }
    audioSource = null
  }
  isSpeaking.value = false
  audioCurrentTime.value = 0
  currentVisemes.value = []
}

async function speakWithAvatar(text: string, isRepeat: boolean = false): Promise<void> {
  if (!isAvatarVisible.value) return
  // Don't attempt to speak if user doesn't have access
  if (hasAccessError.value) return
  
  isPreparingSpeech.value = true
  
  if (!isRepeat) {
    pendingSpeechText = text
  }
  
  try {
    const apiUrl = config.apiUrl || config.baseUrl || ''
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
      isPreparingSpeech.value = false
      return
    }

    const data = await response.json()
    
    if (data.status === 'success' && data.data) {
      currentVisemes.value = data.data.visemes || []
      
      if (data.data.audio_base64) {
        await playAudioWithSync(data.data.audio_base64)
        return
      }
    }

    isPreparingSpeech.value = false
  } catch (error) {
    isPreparingSpeech.value = false
  }
}

async function playAudioWithSync(base64Audio: string): Promise<void> {
  try {
    const binaryString = atob(base64Audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    if (!audioContext) {
      audioContext = new AudioContext()
    }

    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(0))

    // Save visemes before stopping (stopSpeaking clears them)
    const savedVisemes = [...currentVisemes.value]
    
    // Stop any existing audio (but don't clear visemes yet)
    if (audioSource) {
      try {
        audioSource.stop()
        audioSource.disconnect()
      } catch (e) {
        // Ignore
      }
      audioSource = null
    }

    // Restore visemes
    currentVisemes.value = savedVisemes

    audioSource = audioContext.createBufferSource()
    audioSource.buffer = audioBuffer
    audioSource.connect(audioContext.destination)

    isSpeaking.value = true
    isPreparingSpeech.value = false
    startTime = audioContext.currentTime
    
    if (pendingSpeechText) {
      lastSpokenText.value = pendingSpeechText
    }

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

async function handleSend(message: string, fileIds?: string[]): Promise<void> {
  // Don't allow sending messages if user doesn't have access
  if (hasAccessError.value) return
  if (!message.trim() && (!fileIds || fileIds.length === 0)) return

  let uploadedFileIds = fileIds
  if (currentSessionId.value && fileIds && fileIds.length > 0) {
    const uploaded = await uploadFiles(currentSessionId.value)
    uploadedFileIds = uploaded.map(f => f.id)
  }

  emit('messageSent', message)
  
  const response = await sendMessage(message, uploadedFileIds)
  
  if (response?.assistant_message?.content || response?.response) {
    const responseText = response.assistant_message?.content || response.response || ''
    emit('messageReceived', responseText)
    
    // Auto-speak response if avatar is visible and autoSpeak is enabled
    if (props.autoSpeak && isAvatarVisible.value) {
      // Extract text from JSON response if needed
      let textToSpeak = responseText
      try {
        const parsed = JSON.parse(responseText)
        if (parsed.response) {
          textToSpeak = parsed.response
        }
      } catch {
        // Not JSON, use as-is
      }
      await speakWithAvatar(textToSpeak)
    }
  }
  
  clearFiles()
}

function handleSuggestionClick(suggestion: string): void {
  pendingMessage.value = suggestion
  handleSend(suggestion)
}

onUnmounted(() => {
  stopSpeaking()
  if (preparingTimer) {
    clearInterval(preparingTimer)
    preparingTimer = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateKioskAvatarSize)
  }
})

// Watch for transcript changes - when recording stops, send the message
watch(
  () => ({ transcript: transcript.value, recording: isRecording.value }),
  (newVal, oldVal) => {
    if (!isKioskLayout.value) return
    
    // When recording just stopped and we have a transcript
    if (oldVal?.recording && !newVal.recording && newVal.transcript) {
      handleVoiceTranscript(newVal.transcript)
    }
  },
  { deep: true }
)

onMounted(async () => {
  initFromStorage()
  
  // First check user access before loading anything
  await checkAccess()
  
  // Only load avatar and chat history if user has access
  if (!hasAccessError.value) {
    await fetchAvatarModel()
    
    const storedSessionId = currentSessionId.value
    if (storedSessionId) {
      loadHistory(storedSessionId)
    }
  }

  if (isKioskLayout.value) {
    if (isOpen.value) {
      openWidget()
    }
  } else if (props.viewOnPageStart) {
    setTimeout(() => {
      openWidget()
    }, 0)
  }

  updateKioskAvatarSize()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateKioskAvatarSize)
  }
})
</script>

<template>
  <div v-if="!isKioskLayout" class="liya-3d-avatar-widget-vuejs-widget" :class="positionClasses" :style="cssVars">
    <!-- Toggle Button -->
    <button
      class="liya-3d-avatar-widget-vuejs-widget__toggle"
      :class="{
        'liya-3d-avatar-widget-vuejs-widget__toggle--open': isOpen,
        'liya-3d-avatar-widget-vuejs-widget__toggle--animated': animateButton && !isOpen
      }"
      @click="toggleWidget"
      :aria-label="isOpen ? t.widget.closeChat : t.widget.openChat"
    >
      <!-- Liya AI Icon - L with AI sparkles -->
      <div v-if="!isOpen" class="liya-3d-avatar-widget-vuejs-widget__toggle-icon">
        <svg viewBox="0 0 32 32" fill="none" width="28" height="28">
          <!-- L letter -->
          <path d="M10 6 L10 22 L22 22" stroke="rgba(255,255,255,0.95)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <!-- AI Sparkle 1 (top right - large) -->
          <path d="M24 4 L25.5 7.5 L29 9 L25.5 10.5 L24 14 L22.5 10.5 L19 9 L22.5 7.5 Z" fill="rgba(255,255,255,0.95)"/>
          <!-- AI Sparkle 2 (middle right - medium) -->
          <path d="M26 16 L27 18 L29 19 L27 20 L26 22 L25 20 L23 19 L25 18 Z" fill="rgba(255,255,255,0.8)"/>
          <!-- AI Sparkle 3 (top - small) -->
          <path d="M16 2 L16.8 4 L19 4.8 L16.8 5.6 L16 8 L15.2 5.6 L13 4.8 L15.2 4 Z" fill="rgba(255,255,255,0.7)"/>
        </svg>
        <!-- Sparkle effect -->
        <span class="liya-3d-avatar-widget-vuejs-widget__toggle-sparkle"></span>
      </div>
      <!-- Close icon -->
      <svg v-else viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>

    <!-- Chat Panel -->
    <Transition name="liya-3d-avatar-widget-vuejs-slide">
      <div v-if="isOpen" class="liya-3d-avatar-widget-vuejs-widget__panel">
        <!-- Upper Section: Avatar with Liquid Glass Header -->
        <div class="liya-3d-avatar-widget-vuejs-widget__upper">
          <!-- Loading state while checking access -->
          <div v-if="isCheckingAccess" class="liya-3d-avatar-widget-vuejs-widget__access-loading">
            <div class="liya-3d-avatar-widget-vuejs-widget__access-loading-spinner"></div>
          </div>
          <!-- Premium Required Overlay (when no access) -->
          <div v-else-if="hasAccessError" class="liya-3d-avatar-widget-vuejs-widget__premium-overlay">
            <div class="liya-3d-avatar-widget-vuejs-widget__premium-content">
              <div class="liya-3d-avatar-widget-vuejs-widget__premium-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                </svg>
              </div>
              <h3 class="liya-3d-avatar-widget-vuejs-widget__premium-title">
                {{ locale === 'tr' ? 'Premium Özellik' : 'Premium Feature' }}
              </h3>
              <p class="liya-3d-avatar-widget-vuejs-widget__premium-text">
                {{ accessErrorMessage }}
              </p>
              <a 
                href="https://liyalabs.com/pricing" 
                target="_blank" 
                rel="noopener" 
                class="liya-3d-avatar-widget-vuejs-widget__premium-btn"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
                {{ locale === 'tr' ? 'Planları İncele' : 'View Plans' }}
              </a>
            </div>
          </div>
          <!-- Avatar Scene (Full Area) - only show when has access -->
          <div v-else class="liya-3d-avatar-widget-vuejs-widget__avatar-container">
            <AvatarScene
              :model-url="resolvedAvatarModelUrl"
              :width="380"
              :height="240"
              :is-speaking="isSpeaking"
              :visemes="currentVisemes"
              :current-time="audioCurrentTime"
              background-color="transparent"
            />
          </div>
          
          <!-- Liquid Glass Header (Overlay) -->
          <div class="liya-3d-avatar-widget-vuejs-widget__header">
            <div class="liya-3d-avatar-widget-vuejs-widget__header-info">
              <div class="liya-3d-avatar-widget-vuejs-widget__header-avatar">
                <!-- Liya AI Icon - L with AI sparkles -->
                <svg viewBox="0 0 32 32" fill="none" width="20" height="20">
                  <path d="M8 5 L8 20 L20 20" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  <path d="M22 3 L23.2 6 L26 7.2 L23.2 8.4 L22 12 L20.8 8.4 L18 7.2 L20.8 6 Z" fill="currentColor"/>
                  <path d="M25 14 L25.8 16 L28 16.8 L25.8 17.6 L25 20 L24.2 17.6 L22 16.8 L24.2 16 Z" fill="currentColor" opacity="0.7"/>
                </svg>
              </div>
              <div class="liya-3d-avatar-widget-vuejs-widget__header-text">
                <h3 class="liya-3d-avatar-widget-vuejs-widget__title">{{ assistantName }}</h3>
                <span class="liya-3d-avatar-widget-vuejs-widget__status">
                  <span class="liya-3d-avatar-widget-vuejs-widget__status-dot" :class="{ 'liya-3d-avatar-widget-vuejs-widget__status-dot--loading': isPreparingSpeech }"></span>
                  {{ isPreparingSpeech ? t.widget.preparing : (isSpeaking ? t.widget.speaking : t.widget.online) }}
                </span>
              </div>
            </div>
            <!-- Replay/Cancel Button (hidden when no access) -->
            <button 
              v-if="!hasAccessError && (lastSpokenText || isSpeaking)"
              class="liya-3d-avatar-widget-vuejs-widget__replay-btn"
              :class="{ 'liya-3d-avatar-widget-vuejs-widget__replay-btn--cancel': isSpeaking }"
              @click="handleReplayOrStop"
              :title="isSpeaking ? t.avatar.stop : t.avatar.replay"
            >
              <!-- Cancel icon when speaking -->
              <svg v-if="isSpeaking" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M6 6h12v12H6z"/>
              </svg>
              <!-- Replay icon when not speaking -->
              <svg v-else viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
            </button>
            <!-- Language Toggle Button (hidden when no access) -->
            <button 
              v-if="!hasAccessError"
              class="liya-3d-avatar-widget-vuejs-widget__lang-btn"
              @click="toggleLocale"
              :title="locale === 'tr' ? 'Switch to English' : 'Türkçe\'ye geç'"
            >
              <span class="liya-3d-avatar-widget-vuejs-widget__lang-text">{{ locale === 'tr' ? 'EN' : 'TR' }}</span>
            </button>
            <button class="liya-3d-avatar-widget-vuejs-widget__close" @click="toggleWidget">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Lower Section: Chat -->
        <div class="liya-3d-avatar-widget-vuejs-widget__lower">
          <!-- Messages -->
          <MessageList
            :messages="messages"
            :is-loading="isLoading"
            :assistant-name="assistantName"
            :welcome-message="welcomeMessageText"
            :preparing-text="isLoading ? t.preparingMessages[preparingMessageIndex] : ''"
            @suggestion-click="handleSuggestionClick"
          />

          <!-- Input (disabled when no access) -->
          <ChatInput
            :placeholder="hasAccessError ? t.errors.featureNotAvailable : placeholderText"
            :disabled="isLoading || hasAccessError"
            :show-voice="showVoice && !hasAccessError"
            :voice-enabled="voiceEnabled && !hasAccessError"
            :show-file-upload="showFileUpload && !hasAccessError"
            :session-id="currentSessionId"
            @send="handleSend"
          />

          <!-- Branding -->
          <div v-if="showBranding" class="liya-3d-avatar-widget-vuejs-widget__branding">
            {{ t.branding.poweredBy }} <a href="https://liyalabs.com" target="_blank" rel="noopener">Liya AI</a>
          </div>
        </div>
      </div>
    </Transition>

  </div>

  <div v-else class="liya-3d-avatar-widget-vuejs-kiosk" :class="{ 'liya-3d-avatar-widget-vuejs-kiosk--modal': isModalKiosk }" :style="cssVars">
    <Transition name="liya-3d-avatar-widget-vuejs-kiosk-fade">
      <div v-if="isOpen" class="liya-3d-avatar-widget-vuejs-kiosk__content">
        <div v-if="isModalKiosk" class="liya-3d-avatar-widget-vuejs-kiosk__overlay"></div>
        <div class="liya-3d-avatar-widget-vuejs-kiosk__container">
          <button
            v-if="props.closeButtonEnabled"
            class="liya-3d-avatar-widget-vuejs-kiosk__close"
            @click="closeWidget"
            :aria-label="t.kiosk.close"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>

          <div class="liya-3d-avatar-widget-vuejs-kiosk__avatar">
            <!-- Loading state while checking access -->
            <div v-if="isCheckingAccess" class="liya-3d-avatar-widget-vuejs-widget__access-loading">
              <div class="liya-3d-avatar-widget-vuejs-widget__access-loading-spinner"></div>
            </div>
            <!-- Premium Required Overlay (when no access) -->
            <div v-else-if="hasAccessError" class="liya-3d-avatar-widget-vuejs-widget__premium-overlay">
              <div class="liya-3d-avatar-widget-vuejs-widget__premium-content">
                <div class="liya-3d-avatar-widget-vuejs-widget__premium-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                  </svg>
                </div>
                <h3 class="liya-3d-avatar-widget-vuejs-widget__premium-title">
                  {{ locale === 'tr' ? 'Premium Özellik' : 'Premium Feature' }}
                </h3>
                <p class="liya-3d-avatar-widget-vuejs-widget__premium-text">
                  {{ accessErrorMessage }}
                </p>
                <a 
                  href="https://liyalabs.com/pricing" 
                  target="_blank" 
                  rel="noopener" 
                  class="liya-3d-avatar-widget-vuejs-widget__premium-btn"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                  </svg>
                  {{ locale === 'tr' ? 'Planları İncele' : 'View Plans' }}
                </a>
              </div>
            </div>
            <!-- Avatar Scene - only show when has access -->
            <AvatarScene
              v-else
              :model-url="resolvedAvatarModelUrl"
              :width="kioskAvatarSize.width"
              :height="kioskAvatarSize.height"
              :is-speaking="isSpeaking"
              :visemes="currentVisemes"
              :current-time="audioCurrentTime"
              background-color="transparent"
            />
            
            <!-- Floating Status Indicator -->
            <div 
              class="liya-3d-avatar-widget-vuejs-kiosk__status"
              :class="`liya-3d-avatar-widget-vuejs-kiosk__status--${kioskStatus}`"
            >
              <span class="liya-3d-avatar-widget-vuejs-kiosk__status-dot"></span>
              <span class="liya-3d-avatar-widget-vuejs-kiosk__status-text">{{ kioskStatusText }}</span>
              <button 
                v-if="kioskStatus !== 'idle'"
                class="liya-3d-avatar-widget-vuejs-kiosk__status-btn"
                @click="cancelCurrentAction"
                :aria-label="t.kiosk.cancel"
                :title="t.kiosk.cancel"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
              <button 
                v-if="kioskStatus === 'idle'"
                class="liya-3d-avatar-widget-vuejs-kiosk__status-btn"
                @click="refreshKiosk"
                :aria-label="t.kiosk.refresh"
                :title="t.kiosk.refresh"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
              </button>
              <!-- Language Toggle Button -->
              <button 
                class="liya-3d-avatar-widget-vuejs-kiosk__status-btn liya-3d-avatar-widget-vuejs-kiosk__lang-btn"
                @click="toggleLocale"
                :title="locale === 'tr' ? 'Switch to English' : 'Türkçe\'ye geç'"
              >
                <span class="liya-3d-avatar-widget-vuejs-kiosk__lang-text">{{ locale === 'tr' ? 'EN' : 'TR' }}</span>
              </button>
            </div>
          </div>

          <div class="liya-3d-avatar-widget-vuejs-kiosk__controls">
            <div class="liya-3d-avatar-widget-vuejs-kiosk__messages">
              <template v-for="(message, index) in kioskMessages" :key="`kiosk-message-${index}`">
                <!-- User message: show content -->
                <p
                  v-if="message.role === 'user'"
                  class="liya-3d-avatar-widget-vuejs-kiosk__message liya-3d-avatar-widget-vuejs-kiosk__message--user"
                >
                  {{ message.content }}
                </p>
                <!-- Assistant message: show suggestions if available, otherwise show content -->
                <div
                  v-else
                  class="liya-3d-avatar-widget-vuejs-kiosk__message liya-3d-avatar-widget-vuejs-kiosk__message--assistant"
                >
                  <div v-if="message.suggestions && message.suggestions.length > 0" class="liya-3d-avatar-widget-vuejs-kiosk__suggestions">
                    <button
                      v-for="(suggestion, sIdx) in message.suggestions"
                      :key="`suggestion-${index}-${sIdx}`"
                      class="liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn"
                      :class="{ 'liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn--disabled': kioskMicDisabled }"
                      :disabled="kioskMicDisabled"
                      @click="handleKioskSuggestionClick(suggestion)"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                        <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z"/>
                      </svg>
                      <span>{{ suggestion }}</span>
                    </button>
                  </div>
                  <p v-else class="liya-3d-avatar-widget-vuejs-kiosk__message-text">{{ message.content }}</p>
                </div>
              </template>
            </div>

            <button
              v-if="isVoiceSupported"
              class="liya-3d-avatar-widget-vuejs-kiosk__mic"
              :class="{
                'liya-3d-avatar-widget-vuejs-kiosk__mic--active': isRecording,
                'liya-3d-avatar-widget-vuejs-kiosk__mic--disabled': kioskMicDisabled,
              }"
              :disabled="kioskMicDisabled"
              @click="toggleKioskListening"
              :aria-label="isRecording ? t.voice.stopRecording : t.voice.startRecording"
            >
              <svg v-if="!isRecording" viewBox="0 0 24 24" fill="currentColor" width="34" height="34">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor" width="34" height="34">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
            <p class="liya-3d-avatar-widget-vuejs-kiosk__hint">
              {{ isRecording ? t.voice.listening : isLoading ? t.voice.thinking : t.voice.speakToMic }}
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Access Error Banner */
.liya-3d-avatar-widget-vuejs-widget__error-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  text-align: center;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
}

.liya-3d-avatar-widget-vuejs-widget__error-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  margin-bottom: 16px;
}

.liya-3d-avatar-widget-vuejs-widget__error-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--liya-text-color, #374151);
  margin: 0 0 16px 0;
  max-width: 280px;
}

.liya-3d-avatar-widget-vuejs-widget__error-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.liya-3d-avatar-widget-vuejs-widget__error-link:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

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
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: var(--liya-primary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 4px 24px rgba(99, 102, 241, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset,
    0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: visible;
}

.liya-3d-avatar-widget-vuejs-widget__toggle::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%);
  z-index: -1;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-widget__toggle:hover {
  transform: scale(1.08);
  box-shadow: 
    0 8px 32px rgba(99, 102, 241, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.2) inset,
    0 4px 12px rgba(0, 0, 0, 0.15);
}

.liya-3d-avatar-widget-vuejs-widget__toggle:hover::before {
  opacity: 1;
}

.liya-3d-avatar-widget-vuejs-widget__toggle--open {
  background: linear-gradient(135deg, rgba(100, 100, 120, 0.9) 0%, rgba(80, 80, 100, 0.9) 100%);
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.liya-3d-avatar-widget-vuejs-widget__toggle-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.liya-3d-avatar-widget-vuejs-widget__toggle-sparkle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: #fff;
  border-radius: 50%;
  top: -2px;
  right: -2px;
  opacity: 0;
  animation: none;
}

/* Animated button state */
.liya-3d-avatar-widget-vuejs-widget__toggle--animated {
  animation: toggle-bounce 2s ease-in-out infinite;
}

.liya-3d-avatar-widget-vuejs-widget__toggle--animated .liya-3d-avatar-widget-vuejs-widget__toggle-sparkle {
  opacity: 1;
  animation: sparkle-pulse 1.5s ease-in-out infinite;
}

.liya-3d-avatar-widget-vuejs-widget__toggle--animated::after {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 2px solid rgba(99, 102, 241, 0.4);
  animation: ring-pulse 2s ease-out infinite;
}

@keyframes toggle-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  15% { transform: translateY(-8px) scale(1.05); }
  30% { transform: translateY(0) scale(1); }
  45% { transform: translateY(-4px) scale(1.02); }
  60% { transform: translateY(0) scale(1); }
}

@keyframes sparkle-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.5); }
}

@keyframes ring-pulse {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0; }
}

.liya-3d-avatar-widget-vuejs-widget__panel {
  position: absolute;
  width: 380px;
  height: 600px;
  max-height: calc(100vh - 100px);
  background: transparent;
  border-radius: var(--liya-border-radius);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Upper Section - Avatar Area */
.liya-3d-avatar-widget-vuejs-widget__upper {
  position: relative;
  height: 240px;
  min-height: 240px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-radius: var(--liya-border-radius) var(--liya-border-radius) 0 0;
  overflow: hidden;
}

.liya-3d-avatar-widget-vuejs-widget__avatar-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Lower Section - Chat Area */
.liya-3d-avatar-widget-vuejs-widget__lower {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--liya-bg-color);
  border-radius: 0 0 var(--liya-border-radius) var(--liya-border-radius);
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

/* Liquid Glass Header */
.liya-3d-avatar-widget-vuejs-widget__header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  color: white;
  z-index: 10;
}

.liya-3d-avatar-widget-vuejs-widget__header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.liya-3d-avatar-widget-vuejs-widget__header-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.liya-3d-avatar-widget-vuejs-widget__header-text {
  display: flex;
  flex-direction: column;
}

.liya-3d-avatar-widget-vuejs-widget__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.liya-3d-avatar-widget-vuejs-widget__status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  opacity: 0.9;
}

.liya-3d-avatar-widget-vuejs-widget__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: status-pulse 2s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.liya-3d-avatar-widget-vuejs-widget__status-dot--loading {
  background: #f59e0b;
  animation: status-loading 0.6s ease-in-out infinite;
}

@keyframes status-loading {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.3); }
}

.liya-3d-avatar-widget-vuejs-widget__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.liya-3d-avatar-widget-vuejs-widget__avatar-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.liya-3d-avatar-widget-vuejs-widget__avatar-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.liya-3d-avatar-widget-vuejs-widget__avatar-btn--active {
  background: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
}

.liya-3d-avatar-widget-vuejs-widget__replay-btn {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.liya-3d-avatar-widget-vuejs-widget__replay-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.liya-3d-avatar-widget-vuejs-widget__replay-btn--cancel {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.5);
}

.liya-3d-avatar-widget-vuejs-widget__replay-btn--cancel:hover {
  background: rgba(239, 68, 68, 0.5);
}

.liya-3d-avatar-widget-vuejs-widget__lang-btn {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  min-width: 32px;
}

.liya-3d-avatar-widget-vuejs-widget__lang-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.liya-3d-avatar-widget-vuejs-widget__lang-text {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.liya-3d-avatar-widget-vuejs-widget__close {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.liya-3d-avatar-widget-vuejs-widget__close:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
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

/* Kiosk Layout */
.liya-3d-avatar-widget-vuejs-kiosk {
  position: fixed;
  inset: 0;
  z-index: var(--liya-z-index, 9999);
  font-family: var(--liya-font-family);
  display: flex;
  align-items: center;
  justify-content: center;
}

.liya-3d-avatar-widget-vuejs-kiosk__content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

.liya-3d-avatar-widget-vuejs-kiosk__overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top, rgba(30, 41, 59, 0.4), rgba(8, 12, 24, 0.75));
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.liya-3d-avatar-widget-vuejs-kiosk__container {
  position: relative;
  width: min(960px, 100%);
  height: 100%;
  padding: 40px 24px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  z-index: 1;
}

.liya-3d-avatar-widget-vuejs-kiosk--modal .liya-3d-avatar-widget-vuejs-kiosk__container {
  width: min(50vw, 860px);
  height: 100%;
}

.liya-3d-avatar-widget-vuejs-kiosk__close {
  position: absolute;
  top: 24px;
  right: 24px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(12px);
  transition: all 0.2s ease;
  z-index: 100;
}

.liya-3d-avatar-widget-vuejs-kiosk__close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.liya-3d-avatar-widget-vuejs-kiosk__avatar {
  position: relative;
  width: min(720px, 90vw);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-top: 0;
  margin-top: 0;
  margin-bottom: 0;
  flex: 0 0 auto;
  height: calc(100vh - 380px);
  min-height: 300px;
  max-height: 480px;
  z-index: 2;
}

/* Floating Status Indicator */
.liya-3d-avatar-widget-vuejs-kiosk__status {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  z-index: 10;
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-kiosk__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-kiosk__status--idle .liya-3d-avatar-widget-vuejs-kiosk__status-dot {
  background: #22c55e;
}

.liya-3d-avatar-widget-vuejs-kiosk__status--listening .liya-3d-avatar-widget-vuejs-kiosk__status-dot {
  background: #3b82f6;
  animation: liya-3d-avatar-widget-vuejs-pulse 1s infinite;
}

.liya-3d-avatar-widget-vuejs-kiosk__status--preparing .liya-3d-avatar-widget-vuejs-kiosk__status-dot {
  background: #f59e0b;
  animation: liya-3d-avatar-widget-vuejs-pulse 0.8s infinite;
}

.liya-3d-avatar-widget-vuejs-kiosk__status--speaking .liya-3d-avatar-widget-vuejs-kiosk__status-dot {
  background: #8b5cf6;
  animation: liya-3d-avatar-widget-vuejs-pulse 0.5s infinite;
}

@keyframes liya-3d-avatar-widget-vuejs-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

.liya-3d-avatar-widget-vuejs-kiosk__status-text {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
}

.liya-3d-avatar-widget-vuejs-kiosk__status-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  margin-left: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.liya-3d-avatar-widget-vuejs-kiosk__status-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  transform: scale(1.1);
}

.liya-3d-avatar-widget-vuejs-kiosk__lang-btn {
  width: auto;
  padding: 0 8px;
  border-radius: 12px;
}

.liya-3d-avatar-widget-vuejs-kiosk__lang-text {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.liya-3d-avatar-widget-vuejs-kiosk__controls {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding-bottom: 24px;
  flex-shrink: 0;
}

.liya-3d-avatar-widget-vuejs-kiosk__messages {
  width: min(520px, 90vw);
  height: 180px;
  max-height: 180px;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8px;
  backdrop-filter: blur(20px);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 1;
}

.liya-3d-avatar-widget-vuejs-kiosk__message {
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 14px;
  border-radius: 12px;
  max-width: 85%;
  word-wrap: break-word;
  white-space: normal;
}

.liya-3d-avatar-widget-vuejs-kiosk__message--user {
  align-self: flex-end;
  background: rgba(99, 102, 241, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #ffffff;
  border: 1px solid rgba(99, 102, 241, 0.5);
  text-align: right;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.liya-3d-avatar-widget-vuejs-kiosk__message--assistant {
  align-self: flex-start;
  background: rgba(51, 65, 85, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.15);
  text-align: left;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.liya-3d-avatar-widget-vuejs-kiosk__message-text {
  margin: 0;
}

.liya-3d-avatar-widget-vuejs-kiosk__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  color: #a5b4fc;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-shadow: none;
}

.liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn:hover {
  background: rgba(99, 102, 241, 0.3);
  border-color: rgba(99, 102, 241, 0.6);
  color: #c7d2fe;
  transform: translateY(-1px);
}

.liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn svg {
  flex-shrink: 0;
  opacity: 0.8;
}

.liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn span {
  white-space: normal;
  word-wrap: break-word;
  text-align: left;
  line-height: 1.4;
}

.liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.liya-3d-avatar-widget-vuejs-kiosk__mic {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(139, 92, 246, 0.9));
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 18px 36px rgba(99, 102, 241, 0.35);
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-kiosk__mic:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 20px 40px rgba(99, 102, 241, 0.45);
}

.liya-3d-avatar-widget-vuejs-kiosk__mic--active {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(249, 115, 22, 0.9));
  animation: kiosk-mic-pulse 1.6s ease-in-out infinite;
  box-shadow: 0 20px 40px rgba(239, 68, 68, 0.4);
}

.liya-3d-avatar-widget-vuejs-kiosk__mic--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.liya-3d-avatar-widget-vuejs-kiosk__hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin: 0;
}

@keyframes kiosk-mic-pulse {
  0%, 100% { box-shadow: 0 16px 36px rgba(239, 68, 68, 0.35); }
  50% { box-shadow: 0 24px 48px rgba(239, 68, 68, 0.55); }
}

.liya-3d-avatar-widget-vuejs-kiosk-fade-enter-active,
.liya-3d-avatar-widget-vuejs-kiosk-fade-leave-active {
  transition: opacity 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-kiosk-fade-enter-from,
.liya-3d-avatar-widget-vuejs-kiosk-fade-leave-to {
  opacity: 0;
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
  
  .liya-3d-avatar-widget-vuejs-avatar-panel {
    display: none;
  }
}

@media (max-width: 768px) {
  .liya-3d-avatar-widget-vuejs-kiosk--modal .liya-3d-avatar-widget-vuejs-kiosk__container {
    width: 100%;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__container {
    padding: 32px 16px 28px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__avatar {
    width: min(520px, 92vw);
  }
}

/* Access Loading Styles */
.liya-3d-avatar-widget-vuejs-widget__access-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--liya-bg-color, #ffffff);
  z-index: 10;
}

.liya-3d-avatar-widget-vuejs-widget__access-loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--liya-border-color, #e5e7eb);
  border-top-color: var(--liya-primary-color, #6366f1);
  border-radius: 50%;
  animation: access-loading-spin 0.8s linear infinite;
}

@keyframes access-loading-spin {
  to { transform: rotate(360deg); }
}

/* Premium Overlay Styles */
.liya-3d-avatar-widget-vuejs-widget__premium-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.2) 100%);
  backdrop-filter: blur(8px);
  z-index: 10;
}

.liya-3d-avatar-widget-vuejs-widget__premium-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px;
  max-width: 280px;
}

.liya-3d-avatar-widget-vuejs-widget__premium-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4);
  color: white;
}

.liya-3d-avatar-widget-vuejs-widget__premium-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--liya-text-color, #374151);
  margin: 0 0 8px 0;
}

.liya-3d-avatar-widget-vuejs-widget__premium-text {
  font-size: 13px;
  color: var(--liya-text-muted, #9ca3af);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.liya-3d-avatar-widget-vuejs-widget__premium-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.liya-3d-avatar-widget-vuejs-widget__premium-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
}
</style>

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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { ThemeConfig, LiyaWidgetMode } from '../../types'
import { useChat } from '../../composables/useChat'
import { useFileUpload } from '../../composables/useFileUpload'
import { useVoice } from '../../composables/useVoice'
import { checkBrowserCompatibility } from '../../composables/useBrowserCompat'
import { useAvatarColors } from '../../composables/useAvatarColors'
import { getConfig, getAvatarModel, checkUserAccess } from '../../api'
import { useI18n } from '../../i18n'
import MessageList from '../shared/MessageList.vue'
import ChatInput from '../shared/ChatInput.vue'
import { AvatarScene } from '../avatar'
import { stripForTTS } from '../../utils/tts'

interface Props {
  position?: ThemeConfig['position']
  theme?: ThemeConfig
  assistantName?: string
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
  assistantName: '',
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
  searchResults: [data: { annotations: any[]; response: string; sessionId: string }]
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

// Browser compatibility state
const isBrowserSupported = ref(true)
const browserCompatReason = ref<string | undefined>(undefined)

// Microphone permission gate state
const isMicPermissionPending = ref(false)

// Message box visibility state (for kiosk/modal_kiosk)
const isMessageBoxVisible = ref(true)

// Settings panel visibility state
const isSettingsPanelOpen = ref(false)

// Avatar colors composable
const { colors: avatarColors, presets: colorPresets, currentPresetId, setPreset, setColor, reset: resetColors, init: initColors } = useAvatarColors()

// AvatarScene ref for color application
const avatarSceneRef = ref<InstanceType<typeof AvatarScene> | null>(null)

// Apply colors when avatar is loaded
function onAvatarLoaded(): void {
  applyCurrentColors()
}

// Apply current colors to avatar
function applyCurrentColors(): void {
  if (avatarSceneRef.value?.applyOutfitColors) {
    avatarSceneRef.value.applyOutfitColors({
      top: avatarColors.value.top,
      bottom: avatarColors.value.bottom,
      footwear: avatarColors.value.footwear
    })
  }
}

// Watch for color changes and apply them
watch(avatarColors, () => {
  applyCurrentColors()
}, { deep: true })

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
let audioSource: AudioBufferSourceNode | null = null
let startTime = 0
let audioSafetyTimeout: ReturnType<typeof setTimeout> | null = null
let contextCreationAttempts = 0
const MAX_CONTEXT_ATTEMPTS = 3

// Global AudioContext - stored on window to share across ALL widget instances
// This is critical for Safari which has issues with creating new contexts
// Using window object ensures the same context is used even when widgets are destroyed/recreated
declare global {
  interface Window {
    __liyaAvatarAudioContext?: AudioContext
  }
}

// ADIM 3.6: iOS WebView AudioContext warm-up - ilk kullanıcı etkileşiminde context'i hazırla
function warmUpAudioOnFirstInteraction(): void {
  if (typeof document === 'undefined') return
  
  const handler = () => {
    ensureAudioContext()
    document.removeEventListener('touchstart', handler)
    document.removeEventListener('click', handler)
  }
  document.addEventListener('touchstart', handler, { once: true, passive: true })
  document.addEventListener('click', handler, { once: true })
}

// iOS/Safari AudioContext helper - must be called after user interaction
async function ensureAudioContext(): Promise<AudioContext | null> {
  // Check if global context exists on window and is usable
  const existingContext = window.__liyaAvatarAudioContext
  if (existingContext && existingContext.state !== 'closed') {
    // If running, return immediately
    if (existingContext.state === 'running') {
      return existingContext
    }
    
    // If suspended, try to resume with shorter timeout for Safari
    if (existingContext.state === 'suspended') {
      try {
        const resumePromise = existingContext.resume()
        const timeoutPromise = new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('AudioContext resume timeout')), 2000)
        )
        await Promise.race([resumePromise, timeoutPromise])
      } catch (err) {
        // Safari fix: If resume fails, continue with suspended context
      }
    }
    
    return existingContext
  }
  
  // Safari fix: Limit context creation attempts to prevent memory leak
  if (contextCreationAttempts >= MAX_CONTEXT_ATTEMPTS) {
    console.warn('[LiyaAvatarWidget] Max AudioContext creation attempts reached')
    return null
  }
  
  // Create new global context on window
  contextCreationAttempts++
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  window.__liyaAvatarAudioContext = new AudioContextClass()
  
  // Try to resume if suspended
  if (window.__liyaAvatarAudioContext.state === 'suspended') {
    try {
      const resumePromise = window.__liyaAvatarAudioContext.resume()
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('AudioContext resume timeout')), 2000)
      )
      await Promise.race([resumePromise, timeoutPromise])
    } catch (err) {
      // Continue with suspended AudioContext
    }
  }
  
  return window.__liyaAvatarAudioContext
}

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
  clearMessages,
} = useChat()

const { uploadFiles, clearAll: clearFiles } = useFileUpload()

const {
  isRecording,
  isSupported: isVoiceSupported,
  transcript,
  startRecording,
  stopRecording,
  checkMicPermission,
  requestMicPermission,
} = useVoice()

function handleVoiceTranscript(text: string): void {
  const normalized = text.trim()
  if (!normalized) return
  if (normalized === lastVoiceTranscript.value) return
  lastVoiceTranscript.value = normalized
  handleSend(normalized)
}

function toggleKioskListening(): void {
  // Show message if voice not supported (iOS Safari)
  if (!isVoiceSupported.value) {
    showVoiceNotSupportedMessage()
    return
  }
  if (kioskMicDisabled.value) return
  
  if (isRecording.value) {
    stopRecording()
  } else {
    lastVoiceTranscript.value = ''
    startRecording()
  }
}

// Voice not supported message (for iOS)
const voiceNotSupportedVisible = ref(false)
function showVoiceNotSupportedMessage(): void {
  voiceNotSupportedVisible.value = true
  setTimeout(() => {
    voiceNotSupportedVisible.value = false
  }, 3000)
}

const assistantName = computed(() => props.assistantName || config.assistantName || 'Assistant')

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

function isDarkColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.5
}

const cssVars = computed(() => {
  const theme = props.theme || {}
  const bgColor = theme.backgroundColor || '#ffffff'
  const dark = isDarkColor(bgColor)
  return {
    '--liya-primary-color': theme.primaryColor || '#6366f1',
    '--liya-primary-hover': theme.primaryColor ? adjustColor(theme.primaryColor, -10) : '#4f46e5',
    '--liya-secondary-color': theme.secondaryColor || (dark ? '#334155' : '#e5e7eb'),
    '--liya-bg-color': bgColor,
    '--liya-bg-secondary': dark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
    '--liya-text-color': theme.textColor || (dark ? '#e2e8f0' : '#374151'),
    '--liya-text-secondary': dark ? '#cbd5e1' : '#6b7280',
    '--liya-text-muted': dark ? '#94a3b8' : '#9ca3af',
    '--liya-border-color': dark ? 'rgba(255,255,255,0.12)' : '#e5e7eb',
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

// Kiosk messages container ref — used to scroll to bottom when new messages arrive
const kioskMessagesRef = ref<HTMLElement | null>(null)
// Kiosk controls ref — used to measure actual height for avatar canvas sizing
const kioskControlsRef = ref<HTMLElement | null>(null)

function scrollKioskMessagesToBottom(): void {
  nextTick(() => {
    if (kioskMessagesRef.value) {
      kioskMessagesRef.value.scrollTop = kioskMessagesRef.value.scrollHeight
    }
  })
}

watch(kioskMessages, () => {
  scrollKioskMessagesToBottom()
  // Recalculate avatar canvas after messages expand/contract the controls area
  if (isKioskLayout.value) {
    nextTick(() => updateKioskAvatarSize())
  }
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

// Handle mic permission request
async function handleMicPermissionRequest(): Promise<void> {
  await requestMicPermission()
  isMicPermissionPending.value = false
}

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
  // Clear messages and session cache so next open starts fresh
  clearMessages()
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
  const isMobile = width <= 768
  const isSmallMobile = width <= 480

  // Effective container max-width — must mirror the CSS constraints for each mode
  // kiosk: min(960px, 100%)   modal_kiosk: min(50vw, 860px)
  const containerMaxW = isModalKiosk.value
    ? Math.min(width * 0.5, 860)
    : Math.min(width, 960)

  const widthFactor = isSmallMobile
    ? (isModalKiosk.value ? 0.9 : 0.95)
    : isMobile
      ? (isModalKiosk.value ? 0.8 : 0.9)
      : (isModalKiosk.value ? 0.42 : 0.55)

  // Measure actual controls height from DOM; fall back to estimates if ref not yet mounted
  const controlsHeight = kioskControlsRef.value
    ? kioskControlsRef.value.getBoundingClientRect().height
    : isMessageBoxVisible.value
      ? (isMobile ? 280 : 420)
      : (isMobile ? 140 : 170)

  // Container vertical padding (mirrors CSS padding-top / padding-bottom on __container)
  const containerPadTop = Math.min(Math.max(height * 0.03, 24), 60)
  const containerPadBot = Math.min(Math.max(height * 0.03, 24), 48)
  const avatarControlsGap = 16 // gap between avatar and controls sections

  // Available height for the avatar section = viewport − container pads − controls − gap
  const availableAvatarH = height - containerPadTop - containerPadBot - controlsHeight - avatarControlsGap

  const minHeight = isMobile ? 280 : 360
  // Never let canvas exceed 75 % of the viewport or 1100 px on very tall screens
  const canvasHeight = Math.max(Math.min(availableAvatarH, height * 0.75, 1100), minHeight)

  // Cap canvas width to the effective container width so large/4K screens don't
  // render an oversized Three.js canvas that overflows the container.
  const canvasWidth = Math.min(containerMaxW * widthFactor, containerMaxW)

  kioskAvatarSize.value = {
    width: Math.max(canvasWidth, 300),
    height: canvasHeight,
  }
}


function stopSpeaking(): void {
  // Clear safety timeout
  if (audioSafetyTimeout) {
    clearTimeout(audioSafetyTimeout)
    audioSafetyTimeout = null
  }
  
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
  if (!isAvatarVisible.value) {
    return
  }
  // Don't attempt to speak if user doesn't have access
  if (hasAccessError.value) {
    return
  }
  
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
    // Decode base64 to ArrayBuffer - iOS compatible method
    const binaryString = atob(base64Audio)
    const len = binaryString.length
    const arrayBuffer = new ArrayBuffer(len)
    const uint8Array = new Uint8Array(arrayBuffer)
    for (let i = 0; i < len; i++) {
      uint8Array[i] = binaryString.charCodeAt(i)
    }

    // Ensure AudioContext is ready (iOS/Safari fix)
    const ctx = await ensureAudioContext()
    
    // Safari fix: If context creation failed, skip audio playback
    if (!ctx) {
      isSpeaking.value = false
      isPreparingSpeech.value = false
      return
    }
    
    // iOS Safari requires callback-based decodeAudioData
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      ctx.decodeAudioData(
        arrayBuffer,
        (buffer) => resolve(buffer),
        (error) => reject(error || new Error('Audio decode failed'))
      )
    })

    // Save visemes before stopping (stopSpeaking clears them)
    const savedVisemes = [...currentVisemes.value]
    
    // Clear any existing safety timeout
    if (audioSafetyTimeout) {
      clearTimeout(audioSafetyTimeout)
      audioSafetyTimeout = null
    }
    
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

    audioSource = ctx.createBufferSource()
    audioSource.buffer = audioBuffer
    audioSource.connect(ctx.destination)

    isSpeaking.value = true
    isPreparingSpeech.value = false
    startTime = ctx.currentTime
    
    if (pendingSpeechText) {
      lastSpokenText.value = pendingSpeechText
    }

    const updateTime = () => {
      if (isSpeaking.value && ctx) {
        audioCurrentTime.value = ctx.currentTime - startTime
        requestAnimationFrame(updateTime)
      }
    }
    updateTime()

    // Safari fix: Safety timeout - onended sometimes doesn't fire in Safari
    const audioDurationMs = audioBuffer.duration * 1000
    audioSafetyTimeout = setTimeout(() => {
      if (isSpeaking.value) {
        isSpeaking.value = false
        audioCurrentTime.value = 0
        currentVisemes.value = []
      }
    }, audioDurationMs + 500)

    audioSource.onended = () => {
      // Clear safety timeout since onended fired properly
      if (audioSafetyTimeout) {
        clearTimeout(audioSafetyTimeout)
        audioSafetyTimeout = null
      }
      isSpeaking.value = false
      audioCurrentTime.value = 0
      currentVisemes.value = []
    }

    audioSource.start()
  } catch (error) {
    isSpeaking.value = false
    isPreparingSpeech.value = false
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
    
    // Emit search results if annotations are present (web search citations)
    if (response.annotations && response.annotations.length > 0) {
      emit('searchResults', {
        annotations: response.annotations,
        response: responseText,
        sessionId: response.session_id
      })
    }
    
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
      // Strip markdown, URLs, emojis for clean TTS speech
      await speakWithAvatar(stripForTTS(textToSpeak))
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
  
  // Safari fix: Clear all timers to prevent memory leak
  if (preparingTimer) {
    clearInterval(preparingTimer)
    preparingTimer = null
  }
  if (audioSafetyTimeout) {
    clearTimeout(audioSafetyTimeout)
    audioSafetyTimeout = null
  }
  
  // Don't close AudioContext - Safari has issues creating new ones after close
  // Just stop the audio source, context will be garbage collected
  if (audioSource) {
    try {
      audioSource.stop()
      audioSource.disconnect()
    } catch (e) {
      // Ignore
    }
    audioSource = null
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
  // Check browser compatibility first
  const compat = checkBrowserCompatibility()
  isBrowserSupported.value = compat.supported
  browserCompatReason.value = compat.reason
  
  if (!compat.supported) {
    isCheckingAccess.value = false
    return
  }
  
  // ADIM 3.6: iOS WebView AudioContext warm-up - ilk kullanıcı etkileşiminde context'i hazırla
  warmUpAudioOnFirstInteraction()
  
  initFromStorage()
  
  // Initialize avatar colors from localStorage
  initColors()
  
  // Request microphone permission early (before user clicks mic button)
  // iOS Safari dahil tüm platformlarda mic izni kontrol et — SpeechRecognition'dan bağımsız
  const micStatus = await checkMicPermission()
  if (micStatus === 'prompt') {
    isMicPermissionPending.value = true
  }
  
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

watch(isMessageBoxVisible, () => {
  if (isKioskLayout.value) {
    updateKioskAvatarSize()
  }
})
</script>

<template>
  <!-- Browser Not Supported Card -->
  <div v-if="!isBrowserSupported" class="liya-3d-avatar-widget-vuejs-unsupported" :style="cssVars">
    <div class="liya-3d-avatar-widget-vuejs-unsupported__card">
      <div class="liya-3d-avatar-widget-vuejs-unsupported__icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      </div>
      <h3 class="liya-3d-avatar-widget-vuejs-unsupported__title">{{ t.browser.unsupportedTitle }}</h3>
      <p class="liya-3d-avatar-widget-vuejs-unsupported__message">{{ t.browser.unsupportedMessage }}</p>
      <p class="liya-3d-avatar-widget-vuejs-unsupported__browsers">{{ t.browser.recommendedBrowsers }}</p>
    </div>
  </div>

  <div v-else-if="!isKioskLayout" class="liya-3d-avatar-widget-vuejs-widget" :class="positionClasses" :style="cssVars">
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
        <!-- Mic Permission Banner -->
        <div v-if="isMicPermissionPending" class="liya-3d-avatar-widget-vuejs-mic-permission">
          <div class="liya-3d-avatar-widget-vuejs-mic-permission__icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <div class="liya-3d-avatar-widget-vuejs-mic-permission__text">
            <span class="liya-3d-avatar-widget-vuejs-mic-permission__title">{{ t.mic.permissionRequired }}</span>
            <span class="liya-3d-avatar-widget-vuejs-mic-permission__desc">{{ t.mic.permissionMessage }}</span>
          </div>
          <button 
            class="liya-3d-avatar-widget-vuejs-mic-permission__btn"
            @click="handleMicPermissionRequest"
          >
            {{ t.mic.allowButton }}
          </button>
        </div>

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
              ref="avatarSceneRef"
              :model-url="resolvedAvatarModelUrl"
              :width="380"
              :height="240"
              :is-speaking="isSpeaking"
              :visemes="currentVisemes"
              :current-time="audioCurrentTime"
              background-color="transparent"
              @loaded="applyCurrentColors"
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
            <!-- Settings Button (hidden when no access) -->
            <button 
              v-if="!hasAccessError"
              class="liya-3d-avatar-widget-vuejs-widget__settings-btn"
              :class="{ 'liya-3d-avatar-widget-vuejs-widget__settings-btn--active': isSettingsPanelOpen }"
              @click="isSettingsPanelOpen = !isSettingsPanelOpen"
              :title="t.settings.title"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
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
          
          <!-- Settings Panel (Standard Widget Mode) -->
          <Transition name="liya-3d-avatar-widget-vuejs-settings-panel">
            <div v-if="isSettingsPanelOpen && !isKioskLayout" class="liya-3d-avatar-widget-vuejs-widget__settings-panel">
              <div class="liya-3d-avatar-widget-vuejs-widget__settings-panel-header">
                <h3 class="liya-3d-avatar-widget-vuejs-widget__settings-panel-title">{{ t.settings.outfitColors }}</h3>
                <button 
                  class="liya-3d-avatar-widget-vuejs-widget__settings-panel-close"
                  @click="isSettingsPanelOpen = false"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
              
              <!-- Presets -->
              <div class="liya-3d-avatar-widget-vuejs-widget__settings-panel-section">
                <label class="liya-3d-avatar-widget-vuejs-widget__settings-panel-label">{{ t.settings.presets }}</label>
                <div class="liya-3d-avatar-widget-vuejs-widget__settings-panel-presets">
                  <button
                    v-for="preset in colorPresets"
                    :key="preset.id"
                    class="liya-3d-avatar-widget-vuejs-widget__settings-panel-preset"
                    :class="{ 'liya-3d-avatar-widget-vuejs-widget__settings-panel-preset--active': currentPresetId === preset.id }"
                    :style="{ background: preset.top }"
                    :title="preset.name"
                    @click="setPreset(preset.id)"
                  ></button>
                </div>
              </div>
              
              <!-- Custom Colors -->
              <div class="liya-3d-avatar-widget-vuejs-widget__settings-panel-section">
                <label class="liya-3d-avatar-widget-vuejs-widget__settings-panel-label">{{ t.settings.customColor }}</label>
                <div class="liya-3d-avatar-widget-vuejs-widget__settings-panel-colors">
                  <div class="liya-3d-avatar-widget-vuejs-widget__settings-panel-color-row">
                    <span>{{ t.settings.top }}</span>
                    <input type="color" :value="avatarColors.top" @input="(e) => setColor('top', (e.target as HTMLInputElement).value)" />
                  </div>
                  <div class="liya-3d-avatar-widget-vuejs-widget__settings-panel-color-row">
                    <span>{{ t.settings.bottom }}</span>
                    <input type="color" :value="avatarColors.bottom" @input="(e) => setColor('bottom', (e.target as HTMLInputElement).value)" />
                  </div>
                  <div class="liya-3d-avatar-widget-vuejs-widget__settings-panel-color-row">
                    <span>{{ t.settings.footwear }}</span>
                    <input type="color" :value="avatarColors.footwear" @input="(e) => setColor('footwear', (e.target as HTMLInputElement).value)" />
                  </div>
                </div>
              </div>
              
              <!-- Reset Button -->
              <button 
                class="liya-3d-avatar-widget-vuejs-widget__settings-panel-reset"
                @click="resetColors"
              >
                {{ t.settings.reset }}
              </button>
            </div>
          </Transition>
        </div>

        <!-- Lower Section: Chat -->
        <div class="liya-3d-avatar-widget-vuejs-widget__lower">
          <!-- Messages -->
          <MessageList
            :messages="messages"
            :is-loading="isLoading"
            :assistant-name="assistantName"
            :welcome-message="welcomeMessageText"
            :welcome-suggestions="welcomeSuggestionsText"
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

  <div v-else-if="isBrowserSupported" class="liya-3d-avatar-widget-vuejs-kiosk" :class="{ 'liya-3d-avatar-widget-vuejs-kiosk--modal': isModalKiosk }" :style="cssVars">
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

          <!-- Mic Permission Banner (Kiosk) -->
          <Transition name="liya-3d-avatar-widget-vuejs-mic-permission">
            <div v-if="isMicPermissionPending" class="liya-3d-avatar-widget-vuejs-kiosk__mic-permission">
              <div class="liya-3d-avatar-widget-vuejs-kiosk__mic-permission-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </div>
              <div class="liya-3d-avatar-widget-vuejs-kiosk__mic-permission-text">
                <span class="liya-3d-avatar-widget-vuejs-kiosk__mic-permission-title">{{ t.mic.permissionRequired }}</span>
                <span class="liya-3d-avatar-widget-vuejs-kiosk__mic-permission-desc">{{ t.mic.permissionMessage }}</span>
              </div>
              <button 
                class="liya-3d-avatar-widget-vuejs-kiosk__mic-permission-btn"
                @click="handleMicPermissionRequest"
              >
                {{ t.mic.allowButton }}
              </button>
            </div>
          </Transition>

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
              ref="avatarSceneRef"
              :model-url="resolvedAvatarModelUrl"
              :width="kioskAvatarSize.width"
              :height="kioskAvatarSize.height"
              :is-speaking="isSpeaking"
              :visemes="currentVisemes"
              :current-time="audioCurrentTime"
              background-color="transparent"
              @loaded="onAvatarLoaded"
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
              <!-- Settings Button -->
              <button 
                class="liya-3d-avatar-widget-vuejs-kiosk__status-btn liya-3d-avatar-widget-vuejs-kiosk__settings-btn"
                @click="isSettingsPanelOpen = !isSettingsPanelOpen"
                :title="t.settings.title"
                :class="{ 'liya-3d-avatar-widget-vuejs-kiosk__settings-btn--active': isSettingsPanelOpen }"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                </svg>
              </button>
            </div>
            
            <!-- Settings Panel -->
            <Transition name="liya-3d-avatar-widget-vuejs-settings-panel">
              <div v-if="isSettingsPanelOpen" class="liya-3d-avatar-widget-vuejs-settings-panel">
                <div class="liya-3d-avatar-widget-vuejs-settings-panel__header">
                  <h3 class="liya-3d-avatar-widget-vuejs-settings-panel__title">{{ t.settings.outfitColors }}</h3>
                  <button 
                    class="liya-3d-avatar-widget-vuejs-settings-panel__close"
                    @click="isSettingsPanelOpen = false"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
                
                <!-- Presets -->
                <div class="liya-3d-avatar-widget-vuejs-settings-panel__section">
                  <label class="liya-3d-avatar-widget-vuejs-settings-panel__label">{{ t.settings.presets }}</label>
                  <div class="liya-3d-avatar-widget-vuejs-settings-panel__presets">
                    <button
                      v-for="preset in colorPresets"
                      :key="preset.id"
                      class="liya-3d-avatar-widget-vuejs-settings-panel__preset"
                      :class="{ 'liya-3d-avatar-widget-vuejs-settings-panel__preset--active': currentPresetId === preset.id }"
                      :style="{ background: preset.top }"
                      :title="preset.name"
                      @click="setPreset(preset.id)"
                    ></button>
                  </div>
                </div>
                
                <!-- Custom Colors -->
                <div class="liya-3d-avatar-widget-vuejs-settings-panel__section">
                  <label class="liya-3d-avatar-widget-vuejs-settings-panel__label">{{ t.settings.customColor }}</label>
                  <div class="liya-3d-avatar-widget-vuejs-settings-panel__colors">
                    <div class="liya-3d-avatar-widget-vuejs-settings-panel__color-row">
                      <span>{{ t.settings.top }}</span>
                      <input type="color" :value="avatarColors.top" @input="(e) => setColor('top', (e.target as HTMLInputElement).value)" />
                    </div>
                    <div class="liya-3d-avatar-widget-vuejs-settings-panel__color-row">
                      <span>{{ t.settings.bottom }}</span>
                      <input type="color" :value="avatarColors.bottom" @input="(e) => setColor('bottom', (e.target as HTMLInputElement).value)" />
                    </div>
                    <div class="liya-3d-avatar-widget-vuejs-settings-panel__color-row">
                      <span>{{ t.settings.footwear }}</span>
                      <input type="color" :value="avatarColors.footwear" @input="(e) => setColor('footwear', (e.target as HTMLInputElement).value)" />
                    </div>
                  </div>
                </div>
                
                <!-- Reset Button -->
                <button 
                  class="liya-3d-avatar-widget-vuejs-settings-panel__reset"
                  @click="resetColors"
                >
                  {{ t.settings.reset }}
                </button>
              </div>
            </Transition>
          </div>

          <div ref="kioskControlsRef" class="liya-3d-avatar-widget-vuejs-kiosk__controls">
            <Transition name="liya-3d-avatar-widget-vuejs-msg-toggle">
              <div v-show="isMessageBoxVisible" ref="kioskMessagesRef" class="liya-3d-avatar-widget-vuejs-kiosk__messages">
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
            </Transition>
            <!-- Message Box Toggle Button (below chatbox) -->
            <button 
              class="liya-3d-avatar-widget-vuejs-kiosk__toggle-msg-btn"
              @click="isMessageBoxVisible = !isMessageBoxVisible"
              :title="isMessageBoxVisible ? t.kiosk.hideMessages : t.kiosk.showMessages"
            >
              <!-- Eye icon (visible) -->
              <svg v-if="isMessageBoxVisible" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              <!-- Eye-off icon (hidden) -->
              <svg v-else viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
              </svg>
            </button>

            <button
              v-if="showVoice"
              class="liya-3d-avatar-widget-vuejs-kiosk__mic"
              :class="{
                'liya-3d-avatar-widget-vuejs-kiosk__mic--active': isRecording,
                'liya-3d-avatar-widget-vuejs-kiosk__mic--disabled': kioskMicDisabled,
                'liya-3d-avatar-widget-vuejs-kiosk__mic--not-supported': !isVoiceSupported,
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
            
            <!-- Voice Not Supported Toast (iOS) -->
            <Transition name="liya-3d-avatar-widget-vuejs-toast">
              <div 
                v-if="voiceNotSupportedVisible" 
                class="liya-3d-avatar-widget-vuejs-kiosk__toast"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span>{{ t.voice.notSupported }}</span>
              </div>
            </Transition>
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

/* ADIM 3.2: iOS safe area — bottom widget'lara safe area offset ekle */
.liya-3d-avatar-widget-vuejs-widget--bottom-right {
  bottom: calc(var(--liya-offset-y, 20px) + env(safe-area-inset-bottom, 0px));
  right: var(--liya-offset-x, 20px);
}

.liya-3d-avatar-widget-vuejs-widget--bottom-left {
  bottom: calc(var(--liya-offset-y, 20px) + env(safe-area-inset-bottom, 0px));
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
  /* ADIM 3.3: iOS 100vh fix — dvh fallback ile adres çubuğu sorununu çöz */
  max-height: calc(100vh - 100px);
  max-height: calc(100dvh - 100px); /* iOS 15.4+ */
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

.liya-3d-avatar-widget-vuejs-widget__settings-btn {
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

.liya-3d-avatar-widget-vuejs-widget__settings-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.liya-3d-avatar-widget-vuejs-widget__settings-btn--active {
  background: rgba(99, 102, 241, 0.3);
  border-color: rgba(99, 102, 241, 0.5);
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

/* Standard Widget Settings Panel */
.liya-3d-avatar-widget-vuejs-widget__settings-panel {
  position: absolute;
  top: 52px;
  right: 8px;
  width: 220px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-close {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-close:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-section {
  margin-bottom: 12px;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-label {
  display: block;
  font-size: 10px;
  font-weight: 500;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-preset {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-preset:hover {
  transform: scale(1.1);
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-preset--active {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-colors {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-color-row span {
  font-size: 11px;
  color: #cbd5e1;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-color-row input[type="color"] {
  width: 28px;
  height: 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-color-row input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-color-row input[type="color"]::-webkit-color-swatch {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-reset {
  width: 100%;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.liya-3d-avatar-widget-vuejs-widget__settings-panel-reset:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.2);
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
  /* ADIM 3.2: iOS safe area padding */
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  /* ADIM 3.4: iOS touch optimization */
  touch-action: manipulation;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
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
  -webkit-backdrop-filter: blur(10px);
  pointer-events: none !important;
  isolation: isolate;
}

.liya-3d-avatar-widget-vuejs-kiosk__container {
  position: relative;
  width: min(960px, 100%);
  height: 100%;
  padding: calc(clamp(24px, 3vh, 60px) + env(safe-area-inset-top, 0px)) clamp(16px, 2vw, 48px) clamp(24px, 3vh, 48px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
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

/* Kiosk Mic Permission Banner */
.liya-3d-avatar-widget-vuejs-kiosk__mic-permission {
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.85) 0%, rgba(79, 70, 229, 0.9) 100%);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
  z-index: 50;
  max-width: 90%;
}

.liya-3d-avatar-widget-vuejs-kiosk__mic-permission-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: white;
  flex-shrink: 0;
}

.liya-3d-avatar-widget-vuejs-kiosk__mic-permission-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.liya-3d-avatar-widget-vuejs-kiosk__mic-permission-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.liya-3d-avatar-widget-vuejs-kiosk__mic-permission-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.liya-3d-avatar-widget-vuejs-kiosk__mic-permission-btn {
  padding: 8px 16px;
  background: white;
  border: none;
  border-radius: 8px;
  color: #4f46e5;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.liya-3d-avatar-widget-vuejs-kiosk__mic-permission-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: scale(1.02);
}

/* Mic Permission Transition */
.liya-3d-avatar-widget-vuejs-mic-permission-enter-active,
.liya-3d-avatar-widget-vuejs-mic-permission-leave-active {
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-mic-permission-enter-from,
.liya-3d-avatar-widget-vuejs-mic-permission-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

.liya-3d-avatar-widget-vuejs-kiosk__avatar {
  position: relative;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-top: 0;
  margin: 0 auto;
  flex: 1 1 auto;
  min-height: 200px;
  /* Prevent the avatar section from growing excessively on tall viewports */
  max-height: clamp(400px, 75vh, 1100px);
  z-index: 2;
  overflow: hidden;
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
  position: relative;
  z-index: 3;
}

.liya-3d-avatar-widget-vuejs-kiosk__messages {
  width: clamp(320px, 40vw, 720px);
  /* Use max-height only (no fixed height) so short content doesn't create empty space */
  max-height: clamp(160px, 22vh, 320px);
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  /* flex-start + JS scroll-to-bottom: ensures padding-bottom is respected when overflowing */
  justify-content: flex-start;
  gap: 8px;
  backdrop-filter: blur(20px);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 1;
  /* Ensure bottom padding is respected during scroll */
  scroll-padding-bottom: 14px;
}

/* Spacer that guarantees bottom breathing room even under overflow */
.liya-3d-avatar-widget-vuejs-kiosk__messages::after {
  content: '';
  display: block;
  min-height: 6px;
  flex-shrink: 0;
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
  position: relative;
  z-index: 10;
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

.liya-3d-avatar-widget-vuejs-kiosk__mic--not-supported {
  opacity: 0.6;
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
  box-shadow: 0 8px 24px rgba(107, 114, 128, 0.3);
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
    /* ADIM 3.3: iOS 100vh fix — dvh fallback */
    height: calc(100vh - 100px);
    height: calc(100dvh - 100px); /* iOS 15.4+ */
    max-height: none;
  }
  
  /* ADIM 3.2: iOS safe area — mobilde de safe area offset ekle */
  .liya-3d-avatar-widget-vuejs-widget--bottom-right,
  .liya-3d-avatar-widget-vuejs-widget--bottom-left {
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
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
    padding: calc(48px + env(safe-area-inset-top, 0px)) 16px 24px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__avatar {
    width: 100%;
  }
}

/* Large screen optimizations (27"+ / 1080p+ monitors) */
@media (min-width: 1920px) {
  .liya-3d-avatar-widget-vuejs-kiosk__container {
    width: min(1280px, 92%);
  }

  .liya-3d-avatar-widget-vuejs-kiosk--modal .liya-3d-avatar-widget-vuejs-kiosk__container {
    width: min(55vw, 1100px);
  }

  .liya-3d-avatar-widget-vuejs-kiosk__messages {
    width: clamp(480px, 50vw, 1000px);
    max-height: clamp(160px, 20vh, 380px);
    font-size: 15px;
    border-radius: 24px;
    padding: 18px 20px;
    gap: 10px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__message {
    font-size: 15px;
    padding: 12px 16px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__mic {
    width: 84px;
    height: 84px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__hint {
    font-size: 14px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn {
    font-size: 14px;
    padding: 10px 18px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__avatar {
    max-height: clamp(500px, 72vh, 1100px);
  }
}

/* 4K / UHD screens (TV / large display) */
@media (min-width: 2560px) {
  .liya-3d-avatar-widget-vuejs-kiosk__container {
    width: min(1600px, 88%);
  }

  .liya-3d-avatar-widget-vuejs-kiosk--modal .liya-3d-avatar-widget-vuejs-kiosk__container {
    width: min(58vw, 1400px);
  }

  .liya-3d-avatar-widget-vuejs-kiosk__messages {
    width: clamp(560px, 48vw, 1200px);
    max-height: clamp(180px, 20vh, 460px);
    font-size: 18px;
    border-radius: 28px;
    padding: 22px 26px;
    gap: 12px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__message {
    font-size: 18px;
    padding: 14px 20px;
    border-radius: 16px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__mic {
    width: 104px;
    height: 104px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__hint {
    font-size: 17px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn {
    font-size: 16px;
    padding: 12px 22px;
    border-radius: 24px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__status {
    padding: 10px 18px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__status-text {
    font-size: 15px;
  }

  .liya-3d-avatar-widget-vuejs-kiosk__avatar {
    max-height: clamp(560px, 70vh, 1200px);
  }

  .liya-3d-avatar-widget-vuejs-kiosk__controls {
    gap: 24px;
    padding-bottom: 40px;
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

/* Voice Not Supported Toast */
.liya-3d-avatar-widget-vuejs-kiosk__toast {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(239, 68, 68, 0.95);
  color: white;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  z-index: 100;
  white-space: nowrap;
}

.liya-3d-avatar-widget-vuejs-toast-enter-active,
.liya-3d-avatar-widget-vuejs-toast-leave-active {
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-toast-enter-from,
.liya-3d-avatar-widget-vuejs-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* Browser Not Supported Card */
.liya-3d-avatar-widget-vuejs-unsupported {
  position: fixed;
  bottom: var(--liya-3d-avatar-widget-vuejs-offset-y, 20px);
  right: var(--liya-3d-avatar-widget-vuejs-offset-x, 20px);
  z-index: var(--liya-3d-avatar-widget-vuejs-z-index, 9999);
  font-family: var(--liya-3d-avatar-widget-vuejs-font-family);
}

.liya-3d-avatar-widget-vuejs-unsupported__card {
  width: 340px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  text-align: center;
}

.liya-3d-avatar-widget-vuejs-unsupported__icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
}

.liya-3d-avatar-widget-vuejs-unsupported__title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
}

.liya-3d-avatar-widget-vuejs-unsupported__message {
  margin: 0 0 12px 0;
  font-size: 13px;
  line-height: 1.5;
  color: #94a3b8;
}

.liya-3d-avatar-widget-vuejs-unsupported__browsers {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

/* Mic Permission Banner */
.liya-3d-avatar-widget-vuejs-mic-permission {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
  border-bottom: 1px solid rgba(99, 102, 241, 0.2);
}

.liya-3d-avatar-widget-vuejs-mic-permission__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a5b4fc;
  flex-shrink: 0;
}

.liya-3d-avatar-widget-vuejs-mic-permission__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.liya-3d-avatar-widget-vuejs-mic-permission__title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}

.liya-3d-avatar-widget-vuejs-mic-permission__desc {
  font-size: 11px;
  color: #94a3b8;
}

.liya-3d-avatar-widget-vuejs-mic-permission__btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.liya-3d-avatar-widget-vuejs-mic-permission__btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

/* Message Box Toggle Button */
.liya-3d-avatar-widget-vuejs-kiosk__toggle-msg-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
  align-self: flex-end;
}

.liya-3d-avatar-widget-vuejs-kiosk__toggle-msg-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  transform: scale(1.05);
}

/* Message Box Toggle Transition */
.liya-3d-avatar-widget-vuejs-msg-toggle-enter-active,
.liya-3d-avatar-widget-vuejs-msg-toggle-leave-active {
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-msg-toggle-enter-from,
.liya-3d-avatar-widget-vuejs-msg-toggle-leave-to {
  opacity: 0;
  transform: translateY(10px);
  max-height: 0;
  margin-bottom: 0;
  padding: 0;
  overflow: hidden;
}

/* Settings Button */
.liya-3d-avatar-widget-vuejs-kiosk__settings-btn--active {
  background: rgba(99, 102, 241, 0.3) !important;
  color: #a5b4fc !important;
}

/* Settings Panel */
.liya-3d-avatar-widget-vuejs-settings-panel {
  position: absolute;
  top: 80px;
  right: 24px;
  width: 280px;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.liya-3d-avatar-widget-vuejs-settings-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.liya-3d-avatar-widget-vuejs-settings-panel__title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.liya-3d-avatar-widget-vuejs-settings-panel__close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.liya-3d-avatar-widget-vuejs-settings-panel__close:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.liya-3d-avatar-widget-vuejs-settings-panel__section {
  margin-bottom: 16px;
}

.liya-3d-avatar-widget-vuejs-settings-panel__label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.liya-3d-avatar-widget-vuejs-settings-panel__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.liya-3d-avatar-widget-vuejs-settings-panel__preset {
  width: 28px;
  height: 28px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.liya-3d-avatar-widget-vuejs-settings-panel__preset:hover {
  transform: scale(1.1);
}

.liya-3d-avatar-widget-vuejs-settings-panel__preset--active {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

.liya-3d-avatar-widget-vuejs-settings-panel__colors {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.liya-3d-avatar-widget-vuejs-settings-panel__color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.liya-3d-avatar-widget-vuejs-settings-panel__color-row span {
  font-size: 12px;
  color: #cbd5e1;
}

.liya-3d-avatar-widget-vuejs-settings-panel__color-row input[type="color"] {
  width: 32px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
}

.liya-3d-avatar-widget-vuejs-settings-panel__color-row input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

.liya-3d-avatar-widget-vuejs-settings-panel__color-row input[type="color"]::-webkit-color-swatch {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.liya-3d-avatar-widget-vuejs-settings-panel__reset {
  width: 100%;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.liya-3d-avatar-widget-vuejs-settings-panel__reset:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.2);
}

/* Settings Panel Transition */
.liya-3d-avatar-widget-vuejs-settings-panel-enter-active,
.liya-3d-avatar-widget-vuejs-settings-panel-leave-active {
  transition: all 0.3s ease;
}

.liya-3d-avatar-widget-vuejs-settings-panel-enter-from,
.liya-3d-avatar-widget-vuejs-settings-panel-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

/* Mobile Responsive - Kiosk Mode */
@media (max-width: 768px) {
  .liya-3d-avatar-widget-vuejs-kiosk__close {
    top: calc(16px + env(safe-area-inset-top, 0px));
  }

  .liya-3d-avatar-widget-vuejs-kiosk__avatar {
    min-height: 180px;
  }
  
  .liya-3d-avatar-widget-vuejs-kiosk__messages {
    width: clamp(280px, 85vw, 720px);
    max-height: clamp(120px, 18vh, 260px);
    padding: 12px 14px;
  }
  
  .liya-3d-avatar-widget-vuejs-kiosk__controls {
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    gap: 14px;
  }
  
  .liya-3d-avatar-widget-vuejs-kiosk__status {
    top: calc(20px + env(safe-area-inset-top, 0px));
    padding: 6px 12px;
  }
  
  .liya-3d-avatar-widget-vuejs-kiosk__status-text {
    font-size: 12px;
  }
  
  .liya-3d-avatar-widget-vuejs-settings-panel {
    max-height: 70vh;
    overflow-y: auto;
    right: 10px;
    top: calc(70px + env(safe-area-inset-top, 0px));
  }
}

@media (max-width: 480px) {
  .liya-3d-avatar-widget-vuejs-kiosk__avatar {
    min-height: 150px;
  }
  
  .liya-3d-avatar-widget-vuejs-kiosk__messages {
    width: clamp(260px, 92vw, 720px);
    max-height: clamp(100px, 16vh, 220px);
    padding: 10px 12px;
    border-radius: 16px;
  }
  
  .liya-3d-avatar-widget-vuejs-kiosk__message {
    font-size: 12px;
    padding: 8px 12px;
  }
  
  .liya-3d-avatar-widget-vuejs-kiosk__controls {
    gap: 12px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  }
  
  .liya-3d-avatar-widget-vuejs-kiosk__suggestion-btn {
    font-size: 11px;
    padding: 6px 10px;
  }
  
  .liya-3d-avatar-widget-vuejs-settings-panel {
    width: calc(100vw - 20px);
    max-width: 300px;
    right: 10px;
  }
}

/* iOS Safe Area Support */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .liya-3d-avatar-widget-vuejs-kiosk__controls {
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  }
}
</style>

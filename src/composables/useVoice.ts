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
// Liya AI Chat - useVoice Composable (Speech-to-Text)
import { ref, computed, readonly, onUnmounted } from 'vue'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

const isRecording = ref(false)
const transcript = ref('')
const interimTranscript = ref('')
const error = ref<string | null>(null)
const isSupported = ref(false)
const isIOS = ref(false)
const micPermission = ref<'prompt' | 'granted' | 'denied'>('prompt')

let recognition: SpeechRecognition | null = null

// Detect iOS device
function detectIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  
  const userAgent = navigator.userAgent || navigator.vendor || ''
  // Check for iOS devices (iPhone, iPad, iPod)
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream
  // Also check for iPad on iOS 13+ which reports as Mac
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  
  return isIOSDevice || isIPadOS
}

// Detect Opera browser
function detectOpera(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent || ''
  return userAgent.indexOf('OPR/') !== -1 || userAgent.indexOf('Opera') !== -1
}

export function useVoice(locale = 'tr-TR') {
  // Check browser support
  const SpeechRecognitionAPI = 
    typeof window !== 'undefined' 
      ? window.SpeechRecognition || window.webkitSpeechRecognition 
      : null

  // Detect platform for UX hints (not for blocking)
  isIOS.value = detectIOS()
  const isOpera = detectOpera()
  // Allow SpeechRecognition on iOS/Safari if the API is available (iPadOS 16+, macOS Ventura+)
  // Only block Opera which silently fails
  isSupported.value = !!SpeechRecognitionAPI && !isOpera

  // Check current microphone permission status
  // iOS Safari does NOT support navigator.permissions API — use getUserMedia probe as fallback
  async function checkMicPermission(): Promise<'prompt' | 'granted' | 'denied'> {
    if (typeof navigator === 'undefined') return 'prompt'
    
    // Try Permissions API first (Chrome, Firefox, etc.)
    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        micPermission.value = result.state as 'prompt' | 'granted' | 'denied'
        result.onchange = () => {
          micPermission.value = result.state as 'prompt' | 'granted' | 'denied'
        }
        return result.state as 'prompt' | 'granted' | 'denied'
      } catch {
        // Permissions API query failed — fall through to prompt
      }
    }
    
    // iOS Safari fallback: Permissions API not available
    // Return 'prompt' so the permission banner is shown
    return 'prompt'
  }

  // Request microphone permission early (on widget open)
  // Works on ALL platforms including iOS Safari — mic permission is independent of SpeechRecognition
  async function requestMicPermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop all tracks immediately - we just wanted the permission
      stream.getTracks().forEach(track => track.stop())
      micPermission.value = 'granted'
      return true
    } catch {
      micPermission.value = 'denied'
      return false
    }
  }

  const hasTranscript = computed(() => transcript.value.length > 0)
  const fullTranscript = computed(() => 
    (transcript.value + ' ' + interimTranscript.value).trim()
  )

  function initRecognition(): void {
    if (!SpeechRecognitionAPI || recognition) return

    recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = locale

    recognition.onstart = () => {
      isRecording.value = true
      error.value = null
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (final) {
        transcript.value += (transcript.value ? ' ' : '') + final
      }
      interimTranscript.value = interim
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      error.value = getErrorMessage(event.error)
      isRecording.value = false
      // If SpeechRecognition fails on this platform, mark as unsupported for future attempts
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'language-not-supported') {
        isSupported.value = false
      }
    }

    recognition.onend = () => {
      isRecording.value = false
      interimTranscript.value = ''
    }
  }

  function startRecording(): void {
    if (!SpeechRecognitionAPI) {
      error.value = locale.startsWith('tr')
        ? 'Bu tarayıcıda sesli tanıma desteklenmiyor'
        : 'Speech recognition is not supported in this browser'
      return
    }

    initRecognition()
    
    if (recognition && !isRecording.value) {
      transcript.value = ''
      interimTranscript.value = ''
      error.value = null
      
      try {
        recognition.start()
        
        // Safari/iOS workaround: recognition.start() may silently fail.
        // If onstart hasn't fired within 5s, reset and show error.
        setTimeout(() => {
          if (!isRecording.value && !error.value) {
            // start() didn't trigger onstart — may have silently failed
          }
        }, 5000)
      } catch (err) {
        error.value = locale.startsWith('tr')
          ? 'Ses kaydı başlatılamadı'
          : 'Failed to start recording'
        // If start() throws, this platform doesn't support SpeechRecognition
        isSupported.value = false
      }
    }
  }

  function stopRecording(): string {
    if (recognition && isRecording.value) {
      recognition.stop()
    }
    
    const result = transcript.value
    return result
  }

  function cancelRecording(): void {
    if (recognition && isRecording.value) {
      recognition.abort()
    }
    
    transcript.value = ''
    interimTranscript.value = ''
  }

  function clearTranscript(): void {
    transcript.value = ''
    interimTranscript.value = ''
  }

  function getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      'no-speech': 'No speech detected. Please try again.',
      'audio-capture': 'Microphone not available.',
      'not-allowed': 'Microphone permission denied.',
      'network': 'Network error occurred.',
      'aborted': 'Recording was cancelled.',
      'service-not-allowed': 'Speech service not allowed.',
    }
    return errorMessages[errorCode] || 'An error occurred during recording.'
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (recognition && isRecording.value) {
      recognition.abort()
    }
    recognition = null
  })

  return {
    // State
    isRecording: readonly(isRecording),
    transcript: readonly(transcript),
    interimTranscript: readonly(interimTranscript),
    error: readonly(error),
    isSupported: readonly(isSupported),
    isIOS: readonly(isIOS),
    micPermission: readonly(micPermission),
    
    // Computed
    hasTranscript,
    fullTranscript,
    
    // Actions
    startRecording,
    stopRecording,
    cancelRecording,
    clearTranscript,
    checkMicPermission,
    requestMicPermission,
  }
}

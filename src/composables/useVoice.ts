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

  // iOS Safari does NOT support SpeechRecognition API
  isIOS.value = detectIOS()
  isSupported.value = !!SpeechRecognitionAPI && !isIOS.value

  // Check current microphone permission status
  async function checkMicPermission(): Promise<'prompt' | 'granted' | 'denied'> {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return 'prompt'
    }
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      micPermission.value = result.state as 'prompt' | 'granted' | 'denied'
      // Listen for permission changes
      result.onchange = () => {
        micPermission.value = result.state as 'prompt' | 'granted' | 'denied'
      }
      return result.state as 'prompt' | 'granted' | 'denied'
    } catch {
      return 'prompt'
    }
  }

  // Request microphone permission early (on widget open)
  async function requestMicPermission(): Promise<boolean> {
    if (!isSupported.value) {
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
    }

    recognition.onend = () => {
      isRecording.value = false
      interimTranscript.value = ''
    }
  }

  function startRecording(): void {
    if (!isSupported.value) {
      // Provide specific error message for iOS users
      if (isIOS.value) {
        error.value = 'Speech recognition is not supported on iOS Safari. Please use text input instead.'
      } else {
        error.value = 'Speech recognition is not supported in this browser'
      }
      return
    }

    initRecognition()
    
    if (recognition && !isRecording.value) {
      transcript.value = ''
      interimTranscript.value = ''
      error.value = null
      
      try {
        recognition.start()
        
        // Opera workaround: recognition.start() may silently fail.
        // If onstart hasn't fired within 3s, reset and show error.
        if (detectOpera()) {
          setTimeout(() => {
            if (!isRecording.value && !error.value) {
              error.value = 'Speech recognition failed to start. Please check microphone permissions in Opera settings.'
              try { recognition?.abort() } catch (_) { /* ignore */ }
            }
          }, 3000)
        }
      } catch (err) {
        error.value = 'Failed to start recording'
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

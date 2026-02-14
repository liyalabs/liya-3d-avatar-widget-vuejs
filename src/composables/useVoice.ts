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

let recognition: SpeechRecognition | null = null

export function useVoice(locale = 'tr-TR') {
  // Check browser support
  const SpeechRecognitionAPI = 
    typeof window !== 'undefined' 
      ? window.SpeechRecognition || window.webkitSpeechRecognition 
      : null

  isSupported.value = !!SpeechRecognitionAPI

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
      error.value = 'Speech recognition is not supported in this browser'
      return
    }

    initRecognition()
    
    if (recognition && !isRecording.value) {
      transcript.value = ''
      interimTranscript.value = ''
      error.value = null
      
      try {
        recognition.start()
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
    
    // Computed
    hasTranscript,
    fullTranscript,
    
    // Actions
    startRecording,
    stopRecording,
    cancelRecording,
    clearTranscript,
  }
}

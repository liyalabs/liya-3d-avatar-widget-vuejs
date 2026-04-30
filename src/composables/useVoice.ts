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
import { ref, computed, readonly, watch, isRef, onUnmounted, type Ref } from 'vue'
import { localeToBCP47 } from '../i18n/translations'

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

// ── Module-level singleton state ─────────────────────────────────────────────
const isRecording = ref(false)
const transcript = ref('')
const interimTranscript = ref('')
const error = ref<string | null>(null)
const isSupported = ref(false)
const isIOS = ref(false)
const micPermission = ref<'prompt' | 'granted' | 'denied'>('prompt')

let recognition: SpeechRecognition | null = null

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map i18n locale code → BCP-47 speech recognition language tag */
const localeToSpeechLang = localeToBCP47

/** Detect iOS device */
function detectIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent || navigator.vendor || ''
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isIOSDevice || isIPadOS
}

/** Detect Opera browser */
function detectOpera(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent || ''
  return userAgent.indexOf('OPR/') !== -1 || userAgent.indexOf('Opera') !== -1
}

/** Locale-aware error messages for SpeechRecognition error codes */
function getErrorMessage(errorCode: string, locale: string): string {
  type ErrorMap = Record<string, string>

  const messages: Record<string, ErrorMap> = {
    tr: {
      'no-speech': 'Ses algılanamadı. Lütfen tekrar deneyin.',
      'audio-capture': 'Mikrofon kullanılamıyor.',
      'not-allowed': 'Mikrofon izni reddedildi.',
      'network': 'Ağ hatası oluştu.',
      'aborted': 'Kayıt iptal edildi.',
      'service-not-allowed': 'Ses hizmetine izin verilmiyor.',
    },
    zh: {
      'no-speech': '未检测到语音，请重试。',
      'audio-capture': '麦克风不可用。',
      'not-allowed': '麦克风权限被拒绝。',
      'network': '发生网络错误。',
      'aborted': '录音已取消。',
      'service-not-allowed': '语音服务不被允许。',
    },
    en: {
      'no-speech': 'No speech detected. Please try again.',
      'audio-capture': 'Microphone not available.',
      'not-allowed': 'Microphone permission denied.',
      'network': 'Network error occurred.',
      'aborted': 'Recording was cancelled.',
      'service-not-allowed': 'Speech service not allowed.',
    },
  }

  // Determine which language bucket to use; fallback to English
  const lang = locale.startsWith('tr') ? 'tr'
    : locale.startsWith('zh') ? 'zh'
    : 'en'

  const bucket = messages[lang] ?? messages['en']
  return bucket[errorCode] ?? (
    lang === 'tr' ? 'Kayıt sırasında bir hata oluştu.'
    : lang === 'zh' ? '录音时发生错误。'
    : 'An error occurred during recording.'
  )
}

// ── Composable ───────────────────────────────────────────────────────────────

/**
 * @param localeRef  Reactive locale ref (e.g. from useI18n) or a plain locale
 *                   string such as 'tr', 'en', 'zh'. Defaults to 'tr'.
 *                   When the ref changes, recognition.lang is updated live and
 *                   an active recording session is restarted automatically.
 */
export function useVoice(localeRef: Ref<string> | string = 'tr') {
  // Normalise to a Ref so we can watch it uniformly
  const localeValue: Ref<string> = isRef(localeRef) ? localeRef : ref(localeRef as string)

  // Check browser support
  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null

  // Detect platform
  isIOS.value = detectIOS()
  const isOpera = detectOpera()
  // Allow SpeechRecognition on iOS/Safari if the API is available (iPadOS 16+, macOS Ventura+)
  // Only block Opera which silently fails
  isSupported.value = !!SpeechRecognitionAPI && !isOpera

  // ── Watch locale changes — update recognition.lang reactively ──────────────
  watch(localeValue, (newLocale) => {
    const speechLang = localeToSpeechLang(newLocale)
    if (recognition) {
      recognition.lang = speechLang
      // If currently recording, restart with the new language
      if (isRecording.value) {
        recognition.stop()
        // onend will fire; the caller can restart if desired, but here we
        // also restart automatically to keep a seamless UX in kiosk mode
        try {
          recognition.lang = speechLang
          recognition.start()
        } catch {
          // start() may throw if recognition is still stopping — safe to ignore
        }
      }
    }
  })

  // ── Microphone permission helpers ─────────────────────────────────────────

  /** Check current microphone permission status */
  async function checkMicPermission(): Promise<'prompt' | 'granted' | 'denied'> {
    if (typeof navigator === 'undefined') return 'prompt'

    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        micPermission.value = result.state as 'prompt' | 'granted' | 'denied'
        result.onchange = () => {
          micPermission.value = result.state as 'prompt' | 'granted' | 'denied'
        }
        return result.state as 'prompt' | 'granted' | 'denied'
      } catch {
        // Permissions API query failed — fall through
      }
    }

    // iOS Safari fallback
    return 'prompt'
  }

  /** Request microphone permission early (on widget open) */
  async function requestMicPermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      micPermission.value = 'granted'
      return true
    } catch {
      micPermission.value = 'denied'
      return false
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const hasTranscript = computed(() => transcript.value.length > 0)
  const fullTranscript = computed(() =>
    (transcript.value + ' ' + interimTranscript.value).trim()
  )

  // ── Recognition lifecycle ─────────────────────────────────────────────────

  function initRecognition(): void {
    if (!SpeechRecognitionAPI || recognition) return

    recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = localeToSpeechLang(localeValue.value)

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
      error.value = getErrorMessage(event.error, localeValue.value)
      isRecording.value = false
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed' ||
        event.error === 'language-not-supported'
      ) {
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
      const locale = localeValue.value
      error.value = locale.startsWith('tr')
        ? 'Bu tarayıcıda sesli tanıma desteklenmiyor'
        : locale.startsWith('zh')
          ? '此浏览器不支持语音识别'
          : 'Speech recognition is not supported in this browser'
      return
    }

    initRecognition()

    if (recognition && !isRecording.value) {
      transcript.value = ''
      interimTranscript.value = ''
      error.value = null

      // Always sync lang before starting (covers late locale changes)
      recognition.lang = localeToSpeechLang(localeValue.value)

      try {
        recognition.start()

        // Safari/iOS workaround: recognition.start() may silently fail.
        setTimeout(() => {
          if (!isRecording.value && !error.value) {
            // start() didn't trigger onstart — may have silently failed
          }
        }, 5000)
      } catch (err) {
        const locale = localeValue.value
        error.value = locale.startsWith('tr')
          ? 'Ses kaydı başlatılamadı'
          : locale.startsWith('zh')
            ? '无法开始录音'
            : 'Failed to start recording'
        isSupported.value = false
      }
    }
  }

  function stopRecording(): string {
    if (recognition && isRecording.value) {
      recognition.stop()
    }
    return transcript.value
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

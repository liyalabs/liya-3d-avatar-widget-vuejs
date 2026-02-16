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
// Liya 3D Avatar Widget - Browser Compatibility Check

export interface BrowserCompatibility {
  supported: boolean
  webgl: boolean
  speechApi: boolean
  audioContext: boolean
  reason?: string
}

export function checkBrowserCompatibility(): BrowserCompatibility {
  // Check for basic ES6+ support (Proxy as indicator)
  const hasES6 = typeof Proxy !== 'undefined'
  
  // Check for WebGL support (required for 3D avatar)
  let hasWebGL = false
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas')
      hasWebGL = !!(
        canvas.getContext('webgl2') || 
        canvas.getContext('webgl') || 
        canvas.getContext('experimental-webgl')
      )
    } catch (e) {
      hasWebGL = false
    }
  }
  
  // Check for Web Speech API (optional - voice can be disabled)
  const hasSpeechApi = typeof window !== 'undefined' && 
    !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition)
  
  // Check for AudioContext (required for TTS playback)
  const hasAudioContext = typeof window !== 'undefined' && 
    !!(window.AudioContext || (window as any).webkitAudioContext)
  
  // For 3D avatar widget, WebGL and AudioContext are required
  if (!hasES6) {
    return {
      supported: false,
      webgl: false,
      speechApi: false,
      audioContext: false,
      reason: 'ES6_NOT_SUPPORTED'
    }
  }
  
  if (!hasWebGL) {
    return {
      supported: false,
      webgl: false,
      speechApi: hasSpeechApi,
      audioContext: hasAudioContext,
      reason: 'WEBGL_NOT_SUPPORTED'
    }
  }
  
  if (!hasAudioContext) {
    return {
      supported: false,
      webgl: hasWebGL,
      speechApi: hasSpeechApi,
      audioContext: false,
      reason: 'AUDIO_NOT_SUPPORTED'
    }
  }
  
  return {
    supported: true,
    webgl: hasWebGL,
    speechApi: hasSpeechApi,
    audioContext: hasAudioContext
  }
}

export function useBrowserCompat() {
  const compat = checkBrowserCompatibility()
  
  return {
    isSupported: compat.supported,
    hasWebGL: compat.webgl,
    hasSpeechApi: compat.speechApi,
    hasAudioContext: compat.audioContext,
    reason: compat.reason
  }
}

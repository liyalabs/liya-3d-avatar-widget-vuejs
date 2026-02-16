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
// Liya AI Widget - Internationalization Translations

export type SupportedLocale = 'tr' | 'en'

export interface Translations {
  // Widget general
  widget: {
    openChat: string
    closeChat: string
    online: string
    preparing: string
    speaking: string
  }
  // Browser compatibility
  browser: {
    unsupportedTitle: string
    unsupportedMessage: string
    webglRequired: string
    recommendedBrowsers: string
    closeButton: string
  }
  // Microphone permission
  mic: {
    permissionRequired: string
    permissionMessage: string
    allowButton: string
    denied: string
  }
  // Chat
  chat: {
    placeholder: string
    send: string
    typing: string
    welcomeMessage: string
    welcomeSuggestions: string[]
  }
  // Voice
  voice: {
    startRecording: string
    stopRecording: string
    listening: string
    thinking: string
    speakToMic: string
    voiceNotSupported: string
    notSupported: string
  }
  // File upload
  file: {
    upload: string
    uploading: string
    uploadError: string
    maxSize: string
    invalidType: string
  }
  // Kiosk mode
  kiosk: {
    close: string
    cancel: string
    refresh: string
    ready: string
    listening: string
    preparing: string
    speaking: string
    hideMessages: string
    showMessages: string
  }
  // Rotating preparing messages (long processing)
  preparingMessages: string[]
  // Avatar
  avatar: {
    replay: string
    stop: string
  }
  // Branding
  branding: {
    poweredBy: string
  }
  // Errors
  errors: {
    connectionError: string
    sendError: string
    sessionError: string
    featureNotAvailable: string
    upgradeToPremium: string
    upgradeToPremiumPlus: string
  }
  // Settings
  settings: {
    title: string
    outfitColors: string
    top: string
    bottom: string
    footwear: string
    presets: string
    customColor: string
    reset: string
  }
}

export const translations: Record<SupportedLocale, Translations> = {
  tr: {
    widget: {
      openChat: 'Sohbeti aç',
      closeChat: 'Sohbeti kapat',
      online: 'Çevrimiçi',
      preparing: 'Hazırlanıyor...',
      speaking: 'Konuşuyor...',
    },
    browser: {
      unsupportedTitle: 'Tarayıcı Desteklenmiyor',
      unsupportedMessage: 'Bu widget tarayıcınızda çalışmıyor. 3D avatar için WebGL desteği gereklidir.',
      webglRequired: 'WebGL desteği gerekli',
      recommendedBrowsers: 'Önerilen: Chrome, Edge, Firefox, Safari',
      closeButton: 'Kapat',
    },
    mic: {
      permissionRequired: 'Mikrofon İzni Gerekli',
      permissionMessage: 'Sesli iletişim için mikrofon erişimine izin verin.',
      allowButton: 'İzin Ver',
      denied: 'Mikrofon izni reddedildi',
    },
    chat: {
      placeholder: 'Mesajınızı yazın...',
      send: 'Gönder',
      typing: 'Yazıyor...',
      welcomeMessage: 'Bu chat hizmeti Liya AI tarafından sağlanmaktadır. Size bugün nasıl yardımcı olabilirim?',
      welcomeSuggestions: [
        'Liya AI 3D Avatar Widget nedir?',
        'Liya AI hakkında bilgi ver',
        'Liyalabs şirketini tanıt'
      ],
    },
    voice: {
      startRecording: 'Konuşmaya başla',
      stopRecording: 'Dinlemeyi durdur',
      listening: 'Dinliyorum...',
      thinking: 'Düşünüyorum...',
      speakToMic: 'Konuşmak için mikrofona basın',
      voiceNotSupported: 'Ses tanıma desteklenmiyor',
      notSupported: 'Ses tanıma bu tarayıcıda desteklenmiyor',
    },
    file: {
      upload: 'Dosya yükle',
      uploading: 'Yükleniyor...',
      uploadError: 'Dosya yüklenirken hata oluştu',
      maxSize: 'Maksimum dosya boyutu: {size}MB',
      invalidType: 'Geçersiz dosya türü',
    },
    kiosk: {
      close: 'Kapat',
      cancel: 'İptal',
      refresh: 'Yenile',
      ready: 'Hazır',
      listening: 'Dinliyorum...',
      preparing: 'Hazırlanıyor...',
      speaking: 'Konuşuyor...',
      hideMessages: 'Mesajları gizle',
      showMessages: 'Mesajları göster',
    },
    preparingMessages: [
      'Hazırlanıyor...',
      'Düşünüyorum... 🤔',
      'Biraz daha bekleyin...',
      'Cevabı hazırlıyorum... ✍️',
      'Neredeyse bitti... ⏳',
      'Az kaldı, sabırlı olun... 😊',
      'Detaylı bir cevap geliyor...',
      'Hâlâ düşünüyorum... 🧠',
      'Bu güzel bir soru, biraz zaman alıyor...',
      'Son rötuşlar... ✨',
    ],
    avatar: {
      replay: 'Tekrar dinle',
      stop: 'Durdur',
    },
    branding: {
      poweredBy: 'Powered by',
    },
    errors: {
      connectionError: 'Bağlantı hatası oluştu',
      sendError: 'Mesaj gönderilemedi',
      sessionError: 'Oturum hatası',
      featureNotAvailable: 'Bu özellik mevcut planınızda kullanılamaz',
      upgradeToPremium: '3D Avatar Widget kullanmak için Premium veya Premium Plus planına yükseltin.',
      upgradeToPremiumPlus: 'Özel 3D avatar yüklemek için Premium Plus planına yükseltin.',
    },
    settings: {
      title: 'Ayarlar',
      outfitColors: 'Kıyafet Renkleri',
      top: 'Üst',
      bottom: 'Alt',
      footwear: 'Ayakkabı',
      presets: 'Hazır Renkler',
      customColor: 'Özel Renk',
      reset: 'Sıfırla',
    },
  },
  en: {
    widget: {
      openChat: 'Open chat',
      closeChat: 'Close chat',
      online: 'Online',
      preparing: 'Preparing...',
      speaking: 'Speaking...',
    },
    browser: {
      unsupportedTitle: 'Browser Not Supported',
      unsupportedMessage: 'This widget does not work in your browser. WebGL support is required for 3D avatar.',
      webglRequired: 'WebGL support required',
      recommendedBrowsers: 'Recommended: Chrome, Edge, Firefox, Safari',
      closeButton: 'Close',
    },
    mic: {
      permissionRequired: 'Microphone Permission Required',
      permissionMessage: 'Allow microphone access for voice communication.',
      allowButton: 'Allow',
      denied: 'Microphone permission denied',
    },
    chat: {
      placeholder: 'Type your message...',
      send: 'Send',
      typing: 'Typing...',
      welcomeMessage: 'This chat service is provided by Liya AI. How can I help you today?',
      welcomeSuggestions: [
        'What is Liya AI 3D Avatar Widget?',
        'Tell me about Liya AI',
        'Introduce Liyalabs company'
      ],
    },
    voice: {
      startRecording: 'Start speaking',
      stopRecording: 'Stop listening',
      listening: 'Listening...',
      thinking: 'Thinking...',
      speakToMic: 'Press the microphone to speak',
      voiceNotSupported: 'Voice recognition not supported',
      notSupported: 'Voice recognition is not supported in this browser',
    },
    file: {
      upload: 'Upload file',
      uploading: 'Uploading...',
      uploadError: 'Error uploading file',
      maxSize: 'Maximum file size: {size}MB',
      invalidType: 'Invalid file type',
    },
    kiosk: {
      close: 'Close',
      cancel: 'Cancel',
      refresh: 'Refresh',
      ready: 'Ready',
      listening: 'Listening...',
      preparing: 'Preparing...',
      speaking: 'Speaking...',
      hideMessages: 'Hide messages',
      showMessages: 'Show messages',
    },
    preparingMessages: [
      'Preparing...',
      'Thinking... 🤔',
      'Hold on a moment...',
      'Preparing the answer... ✍️',
      'Almost done... ⏳',
      'Just a bit more, please be patient... 😊',
      'A detailed answer is coming...',
      'Still thinking... 🧠',
      'Great question, it takes a moment...',
      'Final touches... ✨',
    ],
    avatar: {
      replay: 'Replay',
      stop: 'Stop',
    },
    branding: {
      poweredBy: 'Powered by',
    },
    errors: {
      connectionError: 'Connection error occurred',
      sendError: 'Failed to send message',
      sessionError: 'Session error',
      featureNotAvailable: 'This feature is not available in your current plan',
      upgradeToPremium: 'Upgrade to Premium or Premium Plus to use the 3D Avatar Widget.',
      upgradeToPremiumPlus: 'Upgrade to Premium Plus to upload custom 3D avatars.',
    },
    settings: {
      title: 'Settings',
      outfitColors: 'Outfit Colors',
      top: 'Top',
      bottom: 'Bottom',
      footwear: 'Footwear',
      presets: 'Presets',
      customColor: 'Custom Color',
      reset: 'Reset',
    },
  },
}

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale === 'tr' || locale === 'en'
}

export function detectBrowserLocale(): SupportedLocale {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'tr'
  }
  
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || ''
  const langCode = browserLang.split('-')[0].toLowerCase()
  
  if (isSupportedLocale(langCode)) {
    return langCode
  }
  
  return 'tr'
}

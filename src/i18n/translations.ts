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
  },
  en: {
    widget: {
      openChat: 'Open chat',
      closeChat: 'Close chat',
      online: 'Online',
      preparing: 'Preparing...',
      speaking: 'Speaking...',
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

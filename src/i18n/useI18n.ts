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
import { ref, computed, readonly } from 'vue'
import { translations, detectBrowserLocale, isSupportedLocale, type SupportedLocale, type Translations } from './translations'

const currentLocale = ref<SupportedLocale>('tr')

export function useI18n() {
  const locale = computed(() => currentLocale.value)
  
  const t = computed<Translations>(() => translations[currentLocale.value])
  
  function setLocale(newLocale: string): void {
    if (isSupportedLocale(newLocale)) {
      currentLocale.value = newLocale
    } else {
      // Fallback to Turkish for unsupported locales
      currentLocale.value = 'tr'
    }
  }
  
  function initLocale(configLocale?: string): void {
    if (configLocale && isSupportedLocale(configLocale)) {
      currentLocale.value = configLocale
    } else if (configLocale) {
      // Unsupported locale, fallback to Turkish
      currentLocale.value = 'tr'
    } else {
      // No config locale, detect from browser
      currentLocale.value = detectBrowserLocale()
    }
  }
  
  return {
    locale: readonly(locale),
    t,
    setLocale,
    initLocale,
    isSupportedLocale,
  }
}

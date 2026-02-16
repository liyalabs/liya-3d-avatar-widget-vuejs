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
import { ref, readonly } from 'vue'

export interface AvatarColorPreset {
  id: string
  name: string
  top: string
  bottom: string
  footwear: string
}

export interface AvatarColors {
  top: string
  bottom: string
  footwear: string
}

const STORAGE_KEY = 'liya-avatar-colors'

const DEFAULT_COLORS: AvatarColors = {
  top: '#F8FAFC',
  bottom: '#E2E8F0',
  footwear: '#CBD5E1'
}

const COLOR_PRESETS: AvatarColorPreset[] = [
  { id: 'classic-blue', name: 'Klasik Mavi', top: '#3B82F6', bottom: '#1E293B', footwear: '#374151' },
  { id: 'red-energy', name: 'Kırmızı', top: '#EF4444', bottom: '#1E293B', footwear: '#374151' },
  { id: 'green-nature', name: 'Yeşil', top: '#10B981', bottom: '#1E293B', footwear: '#374151' },
  { id: 'purple-royal', name: 'Mor', top: '#8B5CF6', bottom: '#1E293B', footwear: '#374151' },
  { id: 'orange-warm', name: 'Turuncu', top: '#F97316', bottom: '#1E293B', footwear: '#374151' },
  { id: 'pink-soft', name: 'Pembe', top: '#EC4899', bottom: '#F3E8FF', footwear: '#9333EA' },
  { id: 'dark-elegant', name: 'Koyu Zarif', top: '#1E293B', bottom: '#0F172A', footwear: '#1E293B' },
  { id: 'white-clean', name: 'Beyaz Sade', top: '#F8FAFC', bottom: '#E2E8F0', footwear: '#CBD5E1' }
]

const colors = ref<AvatarColors>({ ...DEFAULT_COLORS })
const currentPresetId = ref<string | null>('white-clean')

function loadFromStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.colors) {
        colors.value = { ...DEFAULT_COLORS, ...parsed.colors }
      }
      if (parsed.presetId) {
        currentPresetId.value = parsed.presetId
      }
    }
  } catch {
    // Ignore parse errors
  }
}

function saveToStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      colors: colors.value,
      presetId: currentPresetId.value
    }))
  } catch {
    // Ignore storage errors
  }
}

function setPreset(presetId: string): void {
  const preset = COLOR_PRESETS.find(p => p.id === presetId)
  if (preset) {
    colors.value = {
      top: preset.top,
      bottom: preset.bottom,
      footwear: preset.footwear
    }
    currentPresetId.value = presetId
    saveToStorage()
  }
}

function setColor(part: 'top' | 'bottom' | 'footwear', color: string): void {
  colors.value[part] = color
  currentPresetId.value = null // Custom color, no preset
  saveToStorage()
}

function setColors(newColors: Partial<AvatarColors>): void {
  colors.value = { ...colors.value, ...newColors }
  currentPresetId.value = null
  saveToStorage()
}

function reset(): void {
  colors.value = { ...DEFAULT_COLORS }
  currentPresetId.value = 'white-clean'
  saveToStorage()
}

function init(): void {
  loadFromStorage()
}

export function useAvatarColors() {
  return {
    // State
    colors: readonly(colors),
    currentPresetId: readonly(currentPresetId),
    
    // Constants
    presets: COLOR_PRESETS,
    defaultColors: DEFAULT_COLORS,
    
    // Actions
    setPreset,
    setColor,
    setColors,
    reset,
    init
  }
}

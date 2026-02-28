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
// Liya 3D Avatar Widget - Main Entry Point
// Vue.js 3D Talking Avatar Widget with AI Chat & Lip-Sync

// Styles
import './styles/variables.css'

// Plugin
export { LiyaChatPlugin, default } from './plugin'
export type { LiyaChatPluginOptions } from './plugin'

// Components - Only 3D Avatar Widget
export { LiyaAvatarWidget } from './components/widget'
export { AvatarScene } from './components/avatar'

// Composables
export { useChat } from './composables/useChat'
export { useFileUpload } from './composables/useFileUpload'

// i18n
export { useI18n, translations, isSupportedLocale, detectBrowserLocale } from './i18n'
export type { SupportedLocale, Translations } from './i18n'

// API
export {
  initializeClient,
  getClient,
  getConfig,
  isInitialized,
  sendMessage,
  getSessionHistory,
  uploadFile,
  getTaskStatus,
  pollTaskStatus,
  createTaskPoller,
} from './api'

// Task Types
export type { TaskStatus, TaskStatusResponse } from './api'

// Types
export type {
  LiyaChatConfig,
  LiyaWidgetMode,
  ThemeConfig,
  Message,
  MessageRole,
  SendMessageRequest,
  SendMessageResponse,
  SessionHistoryResponse,
  FileAttachment,
} from './types'

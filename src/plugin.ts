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
// Liya 3D Avatar Widget - Vue Plugin
import type { App } from 'vue'
import type { LiyaChatConfig } from './types'
import { initializeClient } from './api'
import { LiyaAvatarWidget } from './components/widget'

export interface LiyaChatPluginOptions extends LiyaChatConfig {}

export const LiyaChatPlugin = {
  install(app: App, options: LiyaChatPluginOptions) {
    // Validate required options
    if (!options.apiKey) {
      console.error('[Liya3DAvatar] apiKey is required')
      return
    }
    if (!options.baseUrl) {
      console.error('[Liya3DAvatar] baseUrl is required')
      return
    }
    if (!options.assistantId) {
      console.error('[Liya3DAvatar] assistantId is required')
      return
    }

    // Initialize API client
    initializeClient(options)

    // Register 3D Avatar Widget component globally
    app.component('Liya3dAvatarWidgetVuejs', LiyaAvatarWidget)

    // Provide config globally
    app.provide('liya-3d-avatar-widget-vuejs-config', options)

    // Add global properties
    app.config.globalProperties.$liya3dAvatarWidgetVuejs = {
      config: options,
    }
  },
}

export default LiyaChatPlugin

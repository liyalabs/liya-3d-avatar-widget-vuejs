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
// Liya AI Chat - HTTP Client
import axios, { AxiosInstance, AxiosError } from 'axios'
import type { ApiResponse, LiyaChatConfig } from '../types'

let apiClient: AxiosInstance | null = null
let currentConfig: LiyaChatConfig | null = null

export function initializeClient(config: LiyaChatConfig): AxiosInstance {
  currentConfig = config
  
  apiClient = axios.create({
    baseURL: config.baseUrl,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
    },
  })

  // Request interceptor
  apiClient.interceptors.request.use(
    (requestConfig) => {
      // Add timestamp for cache busting if needed
      return requestConfig
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Response interceptor
  apiClient.interceptors.response.use(
    (response) => {
      return response
    },
    (error: AxiosError<ApiResponse>) => {
      const errorMessage = error.response?.data?.message || error.message || 'An error occurred'
      return Promise.reject(new Error(errorMessage))
    }
  )

  return apiClient
}

export function getClient(): AxiosInstance {
  if (!apiClient) {
    throw new Error('[LiyaChat] API client not initialized. Call initializeClient first.')
  }
  return apiClient
}

export function getConfig(): LiyaChatConfig {
  if (!currentConfig) {
    throw new Error('[LiyaChat] Config not set. Initialize the plugin first.')
  }
  return currentConfig
}

export function isInitialized(): boolean {
  return apiClient !== null && currentConfig !== null
}

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
// Liya AI Chat - useChat Composable
import { ref, computed, readonly } from 'vue'
import type { Message, SendMessageResponse } from '../types'
import { sendMessage as apiSendMessage, getSessionHistory } from '../api'

const messages = ref<Message[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const currentSessionId = ref<string | null>(null)

export function useChat() {
  const hasMessages = computed(() => messages.value.length > 0)
  const lastMessage = computed(() => messages.value[messages.value.length - 1] || null)

  async function sendMessage(
    content: string,
    fileIds?: string[]
  ): Promise<SendMessageResponse | null> {
    if (!content.trim()) return null

    isLoading.value = true
    error.value = null

    // Optimistic update - add user message immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      content: content.trim(),
      role: 'user',
      created_at: new Date().toISOString(),
    }
    messages.value.push(tempUserMessage)

    try {
      const response = await apiSendMessage(
        content.trim(),
        currentSessionId.value || undefined,
        fileIds
      )

      // Update session ID if new session was created
      if (response.session_id) {
        currentSessionId.value = response.session_id
        // Persist to localStorage
        saveSessionToStorage(response.session_id)
      }

      // Replace temp message with real one if available
      if (response.user_message) {
        const tempIndex = messages.value.findIndex((m) => m.id === tempUserMessage.id)
        if (tempIndex !== -1) {
          messages.value[tempIndex] = response.user_message
        }
      }

      // Add assistant message
      if (response.assistant_message) {
        // Enrich with suggestions from response if backend parsed them separately
        if (response.suggestions && response.suggestions.length > 0) {
          try {
            const contentObj = JSON.parse(response.assistant_message.content)
            if (!contentObj.suggestions) {
              contentObj.suggestions = response.suggestions
            }
            response.assistant_message.content = JSON.stringify(contentObj)
          } catch {
            // Content is plain text — wrap it with suggestions
            response.assistant_message.content = JSON.stringify({
              response: response.assistant_message.content,
              suggestions: response.suggestions
            })
          }
        }
        messages.value.push(response.assistant_message)
      } else if (response.response) {
        // Build message content: if suggestions exist, wrap as JSON for frontend parsing
        let messageContent = response.response
        if (response.suggestions && response.suggestions.length > 0) {
          messageContent = JSON.stringify({
            response: response.response,
            suggestions: response.suggestions
          })
        }
        messages.value.push({
          id: response.message_id || `msg-${Date.now()}`,
          content: messageContent,
          role: 'assistant',
          created_at: new Date().toISOString(),
          response_time: response.response_time,
        })
      }

      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to send message'
      // Remove temp message on error
      messages.value = messages.value.filter((m) => m.id !== tempUserMessage.id)
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function loadHistory(sessionId: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await getSessionHistory(sessionId)
      messages.value = response.messages
      currentSessionId.value = sessionId
      saveSessionToStorage(sessionId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load history'
      // Clear stale session so next message creates a fresh one
      currentSessionId.value = null
      clearSessionFromStorage()
    } finally {
      isLoading.value = false
    }
  }

  function clearMessages(): void {
    messages.value = []
    currentSessionId.value = null
    clearSessionFromStorage()
  }

  function addWelcomeMessage(welcomeText: string): void {
    // Only add if no messages exist
    if (messages.value.length === 0) {
      messages.value.push({
        id: `welcome-${Date.now()}`,
        content: welcomeText,
        role: 'assistant',
        created_at: new Date().toISOString(),
      })
    }
  }

  function updateWelcomeMessage(newText: string): void {
    if (messages.value.length > 0 && messages.value[0].id.startsWith('welcome-')) {
      messages.value[0] = { ...messages.value[0], content: newText }
    }
  }

  function setSessionId(sessionId: string | null): void {
    currentSessionId.value = sessionId
    if (sessionId) {
      saveSessionToStorage(sessionId)
    } else {
      clearSessionFromStorage()
    }
  }

  // LocalStorage helpers
  const storageKey = 'liya-3d-avatar-widget-vuejs-session-id'
  const timestampKey = 'liya-3d-avatar-widget-vuejs-session-timestamp'
  const SESSION_CACHE_DURATION_MS = 60 * 60 * 1000 // 60 minutes in milliseconds

  function saveSessionToStorage(sessionId: string): void {
    try {
      localStorage.setItem(storageKey, sessionId)
      localStorage.setItem(timestampKey, Date.now().toString())
    } catch {
      // localStorage not available
    }
  }

  function clearSessionFromStorage(): void {
    try {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(timestampKey)
    } catch {
      // localStorage not available
    }
  }

  function getStoredSessionId(): string | null {
    try {
      const sessionId = localStorage.getItem(storageKey)
      const timestamp = localStorage.getItem(timestampKey)
      
      if (!sessionId || !timestamp) {
        return null
      }
      
      // Check if session has expired (60 minutes)
      const sessionAge = Date.now() - parseInt(timestamp, 10)
      if (sessionAge > SESSION_CACHE_DURATION_MS) {
        // Session expired, clear it
        clearSessionFromStorage()
        return null
      }
      
      return sessionId
    } catch {
      return null
    }
  }

  function isSessionValid(): boolean {
    try {
      const timestamp = localStorage.getItem(timestampKey)
      if (!timestamp) return false
      
      const sessionAge = Date.now() - parseInt(timestamp, 10)
      return sessionAge <= SESSION_CACHE_DURATION_MS
    } catch {
      return false
    }
  }

  // Initialize from storage
  function initFromStorage(): void {
    const storedSessionId = getStoredSessionId()
    if (storedSessionId) {
      currentSessionId.value = storedSessionId
    }
  }

  return {
    // State
    messages: readonly(messages),
    isLoading: readonly(isLoading),
    error: readonly(error),
    currentSessionId: readonly(currentSessionId),
    
    // Computed
    hasMessages,
    lastMessage,
    
    // Actions
    sendMessage,
    loadHistory,
    clearMessages,
    addWelcomeMessage,
    updateWelcomeMessage,
    setSessionId,
    initFromStorage,
    getStoredSessionId,
    isSessionValid,
  }
}

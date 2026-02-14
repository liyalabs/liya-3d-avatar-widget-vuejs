// Liya AI Chat - useSessions Composable
import { ref, computed, readonly } from 'vue'
import type { Session } from '../types'
import {
  getSessions as apiGetSessions,
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
} from '../api'

const sessions = ref<Session[]>([])
const currentSession = ref<Session | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const totalSessions = ref(0)

export function useSessions() {
  const hasSessions = computed(() => sessions.value.length > 0)

  async function loadSessions(limit = 20, offset = 0): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiGetSessions(limit, offset)
      sessions.value = response.sessions
      totalSessions.value = response.total
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load sessions'
    } finally {
      isLoading.value = false
    }
  }

  async function createSession(sessionName?: string): Promise<Session | null> {
    isLoading.value = true
    error.value = null

    try {
      const session = await apiCreateSession(sessionName)
      sessions.value.unshift(session)
      currentSession.value = session
      return session
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create session'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function deleteSession(sessionId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      await apiDeleteSession(sessionId)
      sessions.value = sessions.value.filter((s) => s.id !== sessionId)
      
      if (currentSession.value?.id === sessionId) {
        currentSession.value = null
      }
      
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete session'
      return false
    } finally {
      isLoading.value = false
    }
  }

  function selectSession(session: Session | null): void {
    currentSession.value = session
  }

  function findSessionById(sessionId: string): Session | undefined {
    return sessions.value.find((s) => s.id === sessionId)
  }

  function clearSessions(): void {
    sessions.value = []
    currentSession.value = null
    totalSessions.value = 0
  }

  return {
    // State
    sessions: readonly(sessions),
    currentSession: readonly(currentSession),
    isLoading: readonly(isLoading),
    error: readonly(error),
    totalSessions: readonly(totalSessions),
    
    // Computed
    hasSessions,
    
    // Actions
    loadSessions,
    createSession,
    deleteSession,
    selectSession,
    findSessionById,
    clearSessions,
  }
}

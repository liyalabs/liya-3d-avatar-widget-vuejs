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
// Liya AI - Async Task Status API (for image/video generation polling)

import { getClient } from './client'

/**
 * Task status values
 */
export type TaskStatus = 'pending' | 'submitted' | 'processing' | 'completed' | 'failed' | 'cancelled'

/**
 * Task status response from backend
 */
export interface TaskStatusResponse {
  task_id: string
  status: TaskStatus
  task_type: string
  result_urls: string[]
  error_code?: string
  error_message?: string
  created_at?: string
  completed_at?: string
}

/**
 * Get async task status (for image/video generation)
 * 
 * @param taskId - The task UUID to check
 * @returns Task status or null if not found
 * 
 * @example
 * ```ts
 * const status = await getTaskStatus('e41e3e23-dbf4-4c74-9e02-56eee0152dde')
 * if (status?.status === 'completed') {
 *   console.log('Result URLs:', status.result_urls)
 * }
 * ```
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse | null> {
  try {
    const client = getClient()
    const response = await client.get(`/api/v1/external/tasks/${taskId}/status/`)
    
    if (response.data.status === 'success') {
      return response.data.data as TaskStatusResponse
    }
    return null
  } catch (e) {
    console.warn('[LiyaChat] getTaskStatus error:', e)
    return null
  }
}

/**
 * Poll task status until completion or failure
 * 
 * @param taskId - The task UUID to poll
 * @param options - Polling options
 * @returns Final task status or null if polling stopped
 * 
 * @example
 * ```ts
 * const result = await pollTaskStatus('task-uuid', {
 *   intervalMs: 2000,
 *   maxAttempts: 60,
 *   onProgress: (status) => console.log('Status:', status.status)
 * })
 * ```
 */
export async function pollTaskStatus(
  taskId: string,
  options: {
    intervalMs?: number
    maxAttempts?: number
    onProgress?: (status: TaskStatusResponse) => void
    signal?: AbortSignal
  } = {}
): Promise<TaskStatusResponse | null> {
  const { intervalMs = 2000, maxAttempts = 60, onProgress, signal } = options
  
  let attempts = 0
  
  while (attempts < maxAttempts) {
    // Check if aborted
    if (signal?.aborted) {
      return null
    }
    
    const status = await getTaskStatus(taskId)
    
    if (!status) {
      return null
    }
    
    // Notify progress
    onProgress?.(status)
    
    // Check terminal states
    if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
      return status
    }
    
    // Wait before next poll
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, intervalMs)
      signal?.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new Error('Polling aborted'))
      }, { once: true })
    }).catch(() => null)
    
    attempts++
  }
  
  console.warn('[LiyaChat] pollTaskStatus: max attempts reached')
  return null
}

/**
 * Create a task poller that can be started/stopped
 * 
 * @example
 * ```ts
 * const poller = createTaskPoller('task-uuid', {
 *   onComplete: (status) => console.log('Done!', status.result_urls),
 *   onError: (status) => console.error('Failed:', status.error_message)
 * })
 * 
 * poller.start()
 * // Later...
 * poller.stop()
 * ```
 */
export function createTaskPoller(
  taskId: string,
  callbacks: {
    onProgress?: (status: TaskStatusResponse) => void
    onComplete?: (status: TaskStatusResponse) => void
    onError?: (status: TaskStatusResponse) => void
  },
  options: {
    intervalMs?: number
    maxAttempts?: number
  } = {}
) {
  let abortController: AbortController | null = null
  let isRunning = false
  
  return {
    start() {
      if (isRunning) return
      
      isRunning = true
      abortController = new AbortController()
      
      pollTaskStatus(taskId, {
        ...options,
        signal: abortController.signal,
        onProgress: callbacks.onProgress
      }).then((status) => {
        isRunning = false
        if (!status) return
        
        if (status.status === 'completed') {
          callbacks.onComplete?.(status)
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          callbacks.onError?.(status)
        }
      })
    },
    
    stop() {
      if (abortController) {
        abortController.abort()
        abortController = null
      }
      isRunning = false
    },
    
    get isRunning() {
      return isRunning
    }
  }
}

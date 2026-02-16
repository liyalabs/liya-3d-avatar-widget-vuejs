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
// Liya AI Chat - Assistants API
import { getClient } from './client'
import type { ApiResponse, Assistant } from '../types'

export async function getAssistants(): Promise<Assistant[]> {
  const client = getClient()

  const response = await client.get<ApiResponse<Assistant[]>>(
    '/api/v1/external/assistants/'
  )

  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Failed to get assistants')
  }

  return response.data.data!
}

export async function getAssistant(assistantId: string): Promise<Assistant | null> {
  const assistants = await getAssistants()
  return assistants.find((a) => a.id === assistantId) || null
}

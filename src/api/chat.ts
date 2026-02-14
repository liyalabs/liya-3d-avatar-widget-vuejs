// Liya AI Chat - Chat API
import { getClient, getConfig } from './client'
import type {
  ApiResponse,
  SendMessageRequest,
  SendMessageResponse,
  SessionHistoryResponse,
} from '../types'

export async function sendMessage(
  message: string,
  sessionId?: string,
  fileIds?: string[]
): Promise<SendMessageResponse> {
  const client = getClient()
  const config = getConfig()

  const endpoint = fileIds && fileIds.length > 0 
    ? '/api/v1/external/chat/with-files/' 
    : '/api/v1/external/chat/'

  const payload: SendMessageRequest = {
    assistant_id: config.assistantId,
    message,
    session_id: sessionId,
    file_ids: fileIds,
  }

  const response = await client.post<ApiResponse<SendMessageResponse>>(endpoint, payload)
  
  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Failed to send message')
  }

  return response.data.data!
}

export async function getSessionHistory(
  sessionId: string,
  limit = 50,
  offset = 0
): Promise<SessionHistoryResponse> {
  const client = getClient()

  const response = await client.get<ApiResponse<SessionHistoryResponse>>(
    `/api/v1/external/sessions/${sessionId}/history/`,
    {
      params: { limit, offset },
    }
  )

  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Failed to get session history')
  }

  return response.data.data!
}

// Liya AI Chat - Sessions API
import { getClient, getConfig } from './client'
import type {
  ApiResponse,
  Session,
  SessionListResponse,
  CreateSessionRequest,
} from '../types'

export async function getSessions(
  limit = 20,
  offset = 0
): Promise<SessionListResponse> {
  const client = getClient()
  const config = getConfig()

  const response = await client.get<ApiResponse<SessionListResponse>>(
    '/api/v1/external/sessions/',
    {
      params: {
        assistant_id: config.assistantId,
        limit,
        offset,
      },
    }
  )

  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Failed to get sessions')
  }

  return response.data.data!
}

export async function createSession(
  sessionName?: string,
  externalSessionId?: string
): Promise<Session> {
  const client = getClient()
  const config = getConfig()

  const payload: CreateSessionRequest = {
    assistant_id: config.assistantId,
    session_name: sessionName || 'Yeni Sohbet',
    external_session_id: externalSessionId,
  }

  const response = await client.post<ApiResponse<Session>>(
    '/api/v1/external/sessions/',
    payload
  )

  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Failed to create session')
  }

  return response.data.data!
}

export async function getSession(sessionId: string): Promise<Session> {
  const client = getClient()

  const response = await client.get<ApiResponse<Session>>(
    `/api/v1/external/sessions/${sessionId}/`
  )

  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Failed to get session')
  }

  return response.data.data!
}

export async function deleteSession(sessionId: string): Promise<void> {
  const client = getClient()

  const response = await client.delete<ApiResponse>(
    `/api/v1/external/sessions/${sessionId}/`
  )

  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Failed to delete session')
  }
}

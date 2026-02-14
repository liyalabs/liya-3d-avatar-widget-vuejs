// Liya 3D Avatar Widget - Avatar API
import { getClient, getConfig } from './client'
import type { ApiResponse } from '../types'

export interface VisemeData {
  time: number
  viseme: number
  duration: number
}

export interface AvatarSpeechResponse {
  visemes: VisemeData[]
  duration: number
  text: string
  audio_base64?: string
  audio_format?: string
  audio_mime?: string
}

export interface TextToSpeechOptions {
  voice?: string
  speed?: number
}

/**
 * Generate avatar speech with viseme timing data for lip-sync
 */
export async function generateAvatarSpeech(
  text: string,
  options: TextToSpeechOptions = {}
): Promise<AvatarSpeechResponse> {
  const client = getClient()
  
  const payload = {
    text,
    voice: options.voice || 'nova',
    speed: options.speed || 1.0,
    include_audio: true
  }

  const response = await client.post<ApiResponse<AvatarSpeechResponse>>(
    '/api/v1/external/avatar/speech/',
    payload
  )
  
  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Failed to generate avatar speech')
  }

  return response.data.data!
}

/**
 * Generate text-to-speech audio only (no visemes)
 */
export async function textToSpeech(
  text: string,
  options: TextToSpeechOptions = {}
): Promise<Blob> {
  const config = getConfig()
  const apiUrl = config.apiUrl || ''
  const apiKey = config.apiKey || ''

  const response = await fetch(`${apiUrl}/api/v1/external/tts/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({
      text,
      voice: options.voice || 'nova',
      speed: options.speed || 1.0
    })
  })

  if (!response.ok) {
    throw new Error('Failed to generate speech audio')
  }

  return response.blob()
}

/**
 * Decode base64 audio to AudioBuffer
 */
export async function decodeAudioBase64(
  base64Audio: string,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const binaryString = atob(base64Audio)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return audioContext.decodeAudioData(bytes.buffer)
}

export interface AvatarModelResponse {
  model_url: string
  model_type: string
  source: 'default' | 'assistant'
}

/**
 * Custom error class to preserve error code from API
 */
export class AvatarApiError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
    this.name = 'AvatarApiError'
  }
}

export interface UserAccessResponse {
  has_avatar_access: boolean
  account_type: 'standard' | 'premium' | 'premium_plus' | 'system_admin'
  can_use_custom_avatar: boolean
}

/**
 * Check if user has access to 3D Avatar features
 * This should be called before loading avatar model
 */
export async function checkUserAccess(): Promise<UserAccessResponse> {
  const client = getClient()
  
  try {
    const response = await client.get<ApiResponse<UserAccessResponse>>(
      '/api/v1/external/user/access/'
    )
    
    if (response.data.status === 'error') {
      throw new AvatarApiError(response.data.message || 'Failed to check user access', 'UNKNOWN_ERROR')
    }

    return response.data.data!
  } catch (error: any) {
    if (error.response?.data) {
      const data = error.response.data
      throw new AvatarApiError(
        data.message || 'Failed to check user access',
        data.code || 'UNKNOWN_ERROR'
      )
    }
    throw error
  }
}

/**
 * Get avatar model URL from backend
 * Returns default avatar or assistant-specific avatar if available
 */
export async function getAvatarModel(
  assistantId?: string
): Promise<AvatarModelResponse> {
  const client = getClient()
  
  const params = assistantId ? { assistant_id: assistantId } : {}
  
  try {
    const response = await client.get<ApiResponse<AvatarModelResponse>>(
      '/api/v1/external/avatar/model/',
      { params }
    )
    
    if (response.data.status === 'error') {
      const code = (response.data as any).code || 'UNKNOWN_ERROR'
      throw new AvatarApiError(response.data.message || 'Failed to get avatar model', code)
    }

    return response.data.data!
  } catch (error: any) {
    // Handle axios error response
    if (error.response?.data) {
      const data = error.response.data
      throw new AvatarApiError(
        data.message || 'Failed to get avatar model',
        data.code || 'UNKNOWN_ERROR'
      )
    }
    throw error
  }
}

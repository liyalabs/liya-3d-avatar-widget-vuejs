// Liya AI Chat - Files API
import { getClient } from './client'
import type { ApiResponse, FileAttachment } from '../types'

export async function uploadFile(
  sessionId: string,
  file: File
): Promise<FileAttachment> {
  const client = getClient()

  const formData = new FormData()
  formData.append('session_id', sessionId)
  formData.append('file', file)

  const response = await client.post<ApiResponse<FileAttachment>>(
    '/api/v1/external/files/',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )

  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Failed to upload file')
  }

  return response.data.data!
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function isValidFileType(file: File, allowedTypes?: string[]): boolean {
  if (!allowedTypes || allowedTypes.length === 0) {
    return true
  }
  
  return allowedTypes.some((type) => {
    if (type.endsWith('/*')) {
      const category = type.replace('/*', '')
      return file.type.startsWith(category)
    }
    return file.type === type
  })
}

export const DEFAULT_ALLOWED_FILE_TYPES = [
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/pdf',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/*',
]

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

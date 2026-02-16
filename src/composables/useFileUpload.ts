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
// Liya AI Chat - useFileUpload Composable
import { ref, computed, readonly } from 'vue'
import type { FileAttachment } from '../types'
import { 
  uploadFile as apiUploadFile, 
  formatFileSize, 
  isValidFileType,
  DEFAULT_ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE 
} from '../api'

interface PendingFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  attachment?: FileAttachment
}

const pendingFiles = ref<PendingFile[]>([])
const uploadedFiles = ref<FileAttachment[]>([])
const isUploading = ref(false)
const error = ref<string | null>(null)

export function useFileUpload(allowedTypes = DEFAULT_ALLOWED_FILE_TYPES) {
  const hasPendingFiles = computed(() => pendingFiles.value.length > 0)
  const hasUploadedFiles = computed(() => uploadedFiles.value.length > 0)
  const uploadedFileIds = computed(() => uploadedFiles.value.map((f) => f.id))

  function addFiles(files: FileList | File[]): void {
    error.value = null
    
    const fileArray = Array.from(files)
    
    for (const file of fileArray) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        error.value = `File "${file.name}" exceeds maximum size of ${formatFileSize(MAX_FILE_SIZE)}`
        continue
      }
      
      // Validate file type
      if (!isValidFileType(file, allowedTypes)) {
        error.value = `File type "${file.type}" is not allowed`
        continue
      }
      
      // Add to pending files
      pendingFiles.value.push({
        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        progress: 0,
        status: 'pending',
      })
    }
  }

  async function uploadFiles(sessionId: string): Promise<FileAttachment[]> {
    if (pendingFiles.value.length === 0) return []
    
    isUploading.value = true
    error.value = null
    const uploaded: FileAttachment[] = []

    for (const pending of pendingFiles.value) {
      if (pending.status === 'completed') continue
      
      pending.status = 'uploading'
      pending.progress = 0

      try {
        const attachment = await apiUploadFile(sessionId, pending.file)
        pending.status = 'completed'
        pending.progress = 100
        pending.attachment = attachment
        uploaded.push(attachment)
        uploadedFiles.value.push(attachment)
      } catch (err) {
        pending.status = 'error'
        pending.error = err instanceof Error ? err.message : 'Upload failed'
      }
    }

    // Remove completed files from pending
    pendingFiles.value = pendingFiles.value.filter(
      (f) => f.status !== 'completed'
    )

    isUploading.value = false
    return uploaded
  }

  function removePendingFile(fileId: string): void {
    pendingFiles.value = pendingFiles.value.filter((f) => f.id !== fileId)
  }

  function removeUploadedFile(fileId: string): void {
    uploadedFiles.value = uploadedFiles.value.filter((f) => f.id !== fileId)
  }

  function clearPendingFiles(): void {
    pendingFiles.value = []
  }

  function clearUploadedFiles(): void {
    uploadedFiles.value = []
  }

  function clearAll(): void {
    pendingFiles.value = []
    uploadedFiles.value = []
    error.value = null
  }

  function getFileIcon(fileType: string): string {
    if (fileType.startsWith('image/')) return '🖼️'
    if (fileType.startsWith('video/')) return '🎬'
    if (fileType.startsWith('audio/')) return '🎵'
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊'
    if (fileType.includes('json')) return '📋'
    if (fileType.startsWith('text/')) return '📃'
    return '📎'
  }

  return {
    // State
    pendingFiles: readonly(pendingFiles),
    uploadedFiles: readonly(uploadedFiles),
    isUploading: readonly(isUploading),
    error: readonly(error),
    
    // Computed
    hasPendingFiles,
    hasUploadedFiles,
    uploadedFileIds,
    
    // Actions
    addFiles,
    uploadFiles,
    removePendingFile,
    removeUploadedFile,
    clearPendingFiles,
    clearUploadedFiles,
    clearAll,
    
    // Helpers
    formatFileSize,
    getFileIcon,
  }
}

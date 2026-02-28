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
// Liya 3D Avatar Widget - API Module Exports
export { initializeClient, getClient, getConfig, isInitialized } from './client'
export { sendMessage, getSessionHistory } from './chat'
export { getSessions, createSession, getSession, deleteSession } from './sessions'
export { uploadFile, formatFileSize, isValidFileType, DEFAULT_ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from './files'
export { getAssistants, getAssistant } from './assistants'
export { generateAvatarSpeech, textToSpeech, decodeAudioBase64, getAvatarModel, checkUserAccess } from './avatar'
export type { VisemeData, AvatarSpeechResponse, TextToSpeechOptions, AvatarModelResponse, UserAccessResponse } from './avatar'
export { getTaskStatus, pollTaskStatus, createTaskPoller } from './tasks'
export type { TaskStatus, TaskStatusResponse } from './tasks'

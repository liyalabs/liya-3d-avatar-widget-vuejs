<script setup lang="ts">
import { computed } from 'vue'
import type { Message, ParsedResponse } from '../../types'

interface Props {
  message: Message
  showAvatar?: boolean
  assistantName?: string
}

const props = withDefaults(defineProps<Props>(), {
  showAvatar: true,
  assistantName: 'Assistant',
})

const emit = defineEmits<{
  (e: 'suggestion-click', suggestion: string): void
  (e: 'suggestion-edit', suggestion: string): void
}>()

const isUser = props.message.role === 'user'

// Fields to exclude from preview
const excludedPreviewFields = ['metadata', 'source', 'sources', 'raw_response', 'id', 'created_at', 'updated_at', 'session_id', 'message_id']

// Check if content is JSON
function isJsonContent(content: string | null | undefined): boolean {
  if (!content || typeof content !== 'string') return false
  const trimmed = content.trim()
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return true
    } catch {
      return false
    }
  }
  return false
}

// Parse JSON content
function parseJsonContent(content: string | null | undefined): any {
  if (!content || typeof content !== 'string') return null
  try {
    return JSON.parse(content.trim())
  } catch {
    return null
  }
}

// Check if value is an array of objects (table data)
function isTableData(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null
}

// Get object keys for table headers
function getTableHeaders(arr: any[]): string[] {
  if (!arr.length) return []
  return Object.keys(arr[0])
}

// Format cell value
function formatCellValue(value: any): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString('tr-TR')
    return value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır'
  return String(value)
}

// Filter object to remove excluded fields
function filterPreviewData(data: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!excludedPreviewFields.includes(key.toLowerCase())) {
      filtered[key] = value
    }
  }
  return filtered
}

// Get plain text from item (for suggestions)
function getItemText(item: any): string {
  if (typeof item === 'object') return JSON.stringify(item)
  return String(item)
}

// Parse JSON response if available
const parsedResponse = computed<ParsedResponse | null>(() => {
  if (isUser) return null
  
  const content = props.message.raw_response || props.message.content
  if (!content) return null
  
  try {
    let jsonStr = content.trim()
    
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }
    
    const parsed = JSON.parse(jsonStr)
    
    if (parsed && typeof parsed.response === 'string') {
      return parsed as ParsedResponse
    }
    return null
  } catch {
    return null
  }
})

// Check if message has JSON content for preview
const hasJsonContent = computed(() => {
  if (isUser) return false
  // If message has parsedResponse format, don't show JSON preview
  if (parsedResponse.value) return false
  // Null check before calling isJsonContent
  if (!props.message.content || typeof props.message.content !== 'string') return false
  return isJsonContent(props.message.content)
})

// Get parsed JSON data
const jsonData = computed(() => {
  if (!hasJsonContent.value) return null
  if (!props.message.content || typeof props.message.content !== 'string') return null
  return parseJsonContent(props.message.content)
})

// Get display content - either parsed response text or original content
const displayContent = computed(() => {
  if (parsedResponse.value) {
    return parsedResponse.value.response
  }
  return props.message.content
})

// Get suggestions from parsed response - convert to strings
const suggestions = computed(() => {
  const rawSuggestions = parsedResponse.value?.suggestions || []
  return rawSuggestions.map((s: any) => typeof s === 'object' ? JSON.stringify(s) : String(s))
})

function handleSuggestionClick(suggestion: string): void {
  emit('suggestion-click', suggestion)
}

function handleSuggestionEdit(suggestion: string): void {
  emit('suggestion-edit', suggestion)
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div 
    class="liya-3d-avatar-widget-vuejs-message" 
    :class="{ 'liya-3d-avatar-widget-vuejs-message--user': isUser, 'liya-3d-avatar-widget-vuejs-message--assistant': !isUser }"
  >
    <div v-if="showAvatar && !isUser" class="liya-3d-avatar-widget-vuejs-message__avatar">
      <div class="liya-3d-avatar-widget-vuejs-avatar liya-3d-avatar-widget-vuejs-avatar--assistant">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>
    </div>
    
    <div class="liya-3d-avatar-widget-vuejs-message__content">
      <div class="liya-3d-avatar-widget-vuejs-message__bubble">
        <!-- JSON Preview for assistant messages -->
        <div v-if="hasJsonContent && jsonData" class="liya-3d-avatar-widget-vuejs-json-preview">
          <!-- Array of objects - render as table -->
          <template v-if="Array.isArray(jsonData)">
            <div v-if="isTableData(jsonData)" class="liya-3d-avatar-widget-vuejs-table-container">
              <table class="liya-3d-avatar-widget-vuejs-table">
                <thead>
                  <tr>
                    <th v-for="header in getTableHeaders(jsonData)" :key="header">
                      {{ header }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in jsonData" :key="idx">
                    <td v-for="header in getTableHeaders(jsonData)" :key="header">
                      {{ formatCellValue(row[header]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- Simple array as clickable suggestions -->
            <div v-else class="liya-3d-avatar-widget-vuejs-suggestions-grid">
              <div v-for="(item, idx) in jsonData" :key="idx" class="liya-3d-avatar-widget-vuejs-suggestion-item">
                <button class="liya-3d-avatar-widget-vuejs-suggestion-btn" @click="handleSuggestionClick(getItemText(item))">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                    <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z"/>
                  </svg>
                  <span>{{ getItemText(item) }}</span>
                </button>
                <button class="liya-3d-avatar-widget-vuejs-edit-btn" @click="handleSuggestionEdit(getItemText(item))">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </button>
              </div>
            </div>
          </template>
          
          <!-- Object - render as key-value cards -->
          <template v-else-if="typeof jsonData === 'object' && jsonData !== null">
            <div class="liya-3d-avatar-widget-vuejs-cards-container">
              <template v-for="(value, key) in filterPreviewData(jsonData)" :key="key">
                <!-- Nested array (table data) -->
                <div v-if="isTableData(value)" class="liya-3d-avatar-widget-vuejs-card">
                  <div class="liya-3d-avatar-widget-vuejs-card__header">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                      <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h2v2H7V7zm0 4h2v2H7v-2zm0 4h2v2H7v-2zm4-8h6v2h-6V7zm0 4h6v2h-6v-2zm0 4h6v2h-6v-2z"/>
                    </svg>
                    <span>{{ key }}</span>
                  </div>
                  <div class="liya-3d-avatar-widget-vuejs-table-container">
                    <table class="liya-3d-avatar-widget-vuejs-table">
                      <thead>
                        <tr>
                          <th v-for="header in getTableHeaders(value)" :key="header">
                            {{ header }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(row, idx) in value" :key="idx">
                          <td v-for="header in getTableHeaders(value)" :key="header">
                            {{ formatCellValue(row[header]) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <!-- Simple array as clickable suggestions -->
                <div v-else-if="Array.isArray(value)" class="liya-3d-avatar-widget-vuejs-card">
                  <div class="liya-3d-avatar-widget-vuejs-suggestions-grid">
                    <div v-for="(item, idx) in value" :key="idx" class="liya-3d-avatar-widget-vuejs-suggestion-item">
                      <button class="liya-3d-avatar-widget-vuejs-suggestion-btn" @click="handleSuggestionClick(getItemText(item))">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                          <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z"/>
                        </svg>
                        <span>{{ getItemText(item) }}</span>
                      </button>
                      <button class="liya-3d-avatar-widget-vuejs-edit-btn" @click="handleSuggestionEdit(getItemText(item))">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- Nested object -->
                <div v-else-if="typeof value === 'object' && value !== null" class="liya-3d-avatar-widget-vuejs-card">
                  <div class="liya-3d-avatar-widget-vuejs-card__header">{{ key }}</div>
                  <div class="liya-3d-avatar-widget-vuejs-card__grid">
                    <div v-for="(subVal, subKey) in value" :key="subKey" class="liya-3d-avatar-widget-vuejs-card__item">
                      <div class="liya-3d-avatar-widget-vuejs-card__label">{{ subKey }}</div>
                      <div class="liya-3d-avatar-widget-vuejs-card__value">{{ formatCellValue(subVal) }}</div>
                    </div>
                  </div>
                </div>
                
                <!-- Simple key-value -->
                <div v-else class="liya-3d-avatar-widget-vuejs-card liya-3d-avatar-widget-vuejs-card--simple">
                  <div class="liya-3d-avatar-widget-vuejs-card__text">{{ formatCellValue(value) }}</div>
                </div>
              </template>
            </div>
          </template>
        </div>
        
        <!-- Regular text content -->
        <div v-else class="liya-3d-avatar-widget-vuejs-message__text" v-html="displayContent"></div>
      </div>
      
      <!-- Suggestions from parsed response -->
      <div v-if="suggestions.length > 0" class="liya-3d-avatar-widget-vuejs-message__suggestions">
        <button
          v-for="(suggestion, index) in suggestions"
          :key="index"
          class="liya-3d-avatar-widget-vuejs-suggestion"
          @click="handleSuggestionClick(suggestion)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z"/>
          </svg>
          {{ suggestion }}
        </button>
      </div>
      
      <div class="liya-3d-avatar-widget-vuejs-message__meta">
        <span class="liya-3d-avatar-widget-vuejs-message__time">{{ formatTime(message.created_at) }}</span>
        <span v-if="message.response_time" class="liya-3d-avatar-widget-vuejs-message__response-time">
          {{ message.response_time.toFixed(1) }}s
        </span>
      </div>
    </div>
    
    <div v-if="showAvatar && isUser" class="liya-3d-avatar-widget-vuejs-message__avatar">
      <div class="liya-3d-avatar-widget-vuejs-avatar liya-3d-avatar-widget-vuejs-avatar--user">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.liya-3d-avatar-widget-vuejs-message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  max-width: 85%;
}

.liya-3d-avatar-widget-vuejs-message--user {
  margin-left: auto;
  flex-direction: row-reverse;
}

.liya-3d-avatar-widget-vuejs-message--assistant {
  margin-right: auto;
}

.liya-3d-avatar-widget-vuejs-message__avatar {
  flex-shrink: 0;
}

.liya-3d-avatar-widget-vuejs-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.liya-3d-avatar-widget-vuejs-avatar--assistant {
  background: var(--liya-primary-color, #6366f1);
  color: white;
}

.liya-3d-avatar-widget-vuejs-avatar--user {
  background: var(--liya-secondary-color, #e5e7eb);
  color: var(--liya-text-color, #374151);
}

.liya-3d-avatar-widget-vuejs-message__content {
  flex: 1;
  min-width: 0;
}

.liya-3d-avatar-widget-vuejs-message__bubble {
  padding: 12px 16px;
  border-radius: var(--liya-border-radius, 12px);
  word-wrap: break-word;
}

.liya-3d-avatar-widget-vuejs-message--user .liya-3d-avatar-widget-vuejs-message__bubble {
  background: var(--liya-primary-color, #6366f1);
  color: white;
  border-bottom-right-radius: 4px;
}

.liya-3d-avatar-widget-vuejs-message--assistant .liya-3d-avatar-widget-vuejs-message__bubble {
  background: var(--liya-bg-secondary, #f3f4f6);
  color: var(--liya-text-color, #374151);
  border-bottom-left-radius: 4px;
}

.liya-3d-avatar-widget-vuejs-message__text {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.liya-3d-avatar-widget-vuejs-message__text :deep(p) {
  margin: 0 0 8px 0;
}

.liya-3d-avatar-widget-vuejs-message__text :deep(p:last-child) {
  margin-bottom: 0;
}

.liya-3d-avatar-widget-vuejs-message__text :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
}

.liya-3d-avatar-widget-vuejs-message__text :deep(pre) {
  background: rgba(0, 0, 0, 0.1);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}

.liya-3d-avatar-widget-vuejs-message__text :deep(pre code) {
  background: none;
  padding: 0;
}

.liya-3d-avatar-widget-vuejs-message__meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--liya-text-muted, #9ca3af);
}

.liya-3d-avatar-widget-vuejs-message--user .liya-3d-avatar-widget-vuejs-message__meta {
  justify-content: flex-end;
}

.liya-3d-avatar-widget-vuejs-message__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.liya-3d-avatar-widget-vuejs-suggestion {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  color: var(--liya-primary-color, #6366f1);
  background: transparent;
  border: 1px solid var(--liya-primary-color, #6366f1);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.liya-3d-avatar-widget-vuejs-suggestion:hover {
  background: var(--liya-primary-color, #6366f1);
  color: white;
}

.liya-3d-avatar-widget-vuejs-suggestion svg {
  flex-shrink: 0;
}

/* JSON Preview Styles */
.liya-3d-avatar-widget-vuejs-json-preview {
  width: 100%;
}

.liya-3d-avatar-widget-vuejs-table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--liya-border-color, #e5e7eb);
}

.liya-3d-avatar-widget-vuejs-table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}

.liya-3d-avatar-widget-vuejs-table thead {
  background: rgba(0, 0, 0, 0.05);
}

.liya-3d-avatar-widget-vuejs-table th {
  padding: 10px 12px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--liya-text-muted, #6b7280);
}

.liya-3d-avatar-widget-vuejs-table td {
  padding: 10px 12px;
  border-top: 1px solid var(--liya-border-color, #e5e7eb);
  color: var(--liya-text-color, #374151);
}

.liya-3d-avatar-widget-vuejs-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

.liya-3d-avatar-widget-vuejs-cards-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.liya-3d-avatar-widget-vuejs-card {
  border-radius: 8px;
  border: 1px solid var(--liya-border-color, #e5e7eb);
  overflow: hidden;
}

.liya-3d-avatar-widget-vuejs-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(99, 102, 241, 0.1);
  border-bottom: 1px solid var(--liya-border-color, #e5e7eb);
  font-size: 13px;
  font-weight: 600;
  color: var(--liya-primary-color, #6366f1);
}

.liya-3d-avatar-widget-vuejs-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  padding: 12px;
}

.liya-3d-avatar-widget-vuejs-card__item {
  padding: 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.03);
}

.liya-3d-avatar-widget-vuejs-card__label {
  font-size: 11px;
  color: var(--liya-text-muted, #6b7280);
  margin-bottom: 4px;
}

.liya-3d-avatar-widget-vuejs-card__value {
  font-size: 13px;
  font-weight: 500;
  color: var(--liya-text-color, #374151);
}

.liya-3d-avatar-widget-vuejs-card--simple {
  padding: 12px;
}

.liya-3d-avatar-widget-vuejs-card__text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--liya-text-color, #374151);
}

.liya-3d-avatar-widget-vuejs-suggestions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
}

.liya-3d-avatar-widget-vuejs-suggestion-item {
  display: flex;
  align-items: center;
  border-radius: 20px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  background: rgba(99, 102, 241, 0.05);
  overflow: hidden;
}

.liya-3d-avatar-widget-vuejs-suggestion-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  color: var(--liya-primary-color, #6366f1);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease;
}

.liya-3d-avatar-widget-vuejs-suggestion-btn:hover {
  background: rgba(99, 102, 241, 0.1);
}

.liya-3d-avatar-widget-vuejs-suggestion-btn span {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.liya-3d-avatar-widget-vuejs-edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  color: rgba(99, 102, 241, 0.6);
  background: transparent;
  border: none;
  border-left: 1px solid rgba(99, 102, 241, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;
}

.liya-3d-avatar-widget-vuejs-edit-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  color: var(--liya-primary-color, #6366f1);
}
</style>

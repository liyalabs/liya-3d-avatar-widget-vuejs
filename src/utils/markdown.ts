/**
 * Lightweight markdown → HTML converter for chat bubbles.
 * Supports: links, bold, italic, inline code, headings, lists, line breaks.
 * No external dependencies.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderMarkdown(text: string): string {
  if (!text) return ''

  let html = escapeHtml(text)

  // Markdown links: [text](url) → <a> tag
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="liya-3d-avatar-widget-vuejs-link">$1</a>'
  )

  // Bold: **text** or __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>')

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="liya-3d-avatar-widget-vuejs-code">$1</code>')

  // Headings: ### text
  html = html.replace(/^### (.+)$/gm, '<strong>$1</strong>')
  html = html.replace(/^## (.+)$/gm, '<strong>$1</strong>')
  html = html.replace(/^# (.+)$/gm, '<strong>$1</strong>')

  // Unordered list items: - text or * text
  html = html.replace(/^[-*] (.+)$/gm, '• $1')

  // Bare URLs that aren't already in <a> tags
  html = html.replace(
    /(?<!href="|">)(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="liya-3d-avatar-widget-vuejs-link">$1</a>'
  )

  // Line breaks
  html = html.replace(/\n/g, '<br>')

  return html
}

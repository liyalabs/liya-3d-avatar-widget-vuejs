/**
 * TTS (Text-to-Speech) için metin temizleme utility'leri.
 * Markdown, URL, emoji ve özel karakterleri sesli okuma için temizler.
 */

/**
 * Markdown linklerden sadece link metnini çıkarır, URL'yi atar.
 * [Dosya Adı](https://...) → "Dosya Adı"
 */
function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

/**
 * Çıplak URL'leri kaldırır (http/https ile başlayanlar).
 */
function stripBareUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s)>\]]+/g, '')
}

/**
 * Markdown formatlama işaretlerini kaldırır (bold, italic, heading, list markers).
 */
function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, '')       // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1')     // italic
    .replace(/__([^_]+)__/g, '$1')     // bold alt
    .replace(/_([^_]+)_/g, '$1')       // italic alt
    .replace(/~~([^~]+)~~/g, '$1')     // strikethrough
    .replace(/`([^`]+)`/g, '$1')       // inline code
    .replace(/^[-*+]\s+/gm, '')        // list markers
    .replace(/^\d+\.\s+/gm, '')        // numbered list
}

/**
 * Emoji'leri kaldırır.
 */
function stripEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{FE0F}]/gu, '')
}

/**
 * Metin içindeki fazla boşlukları temizler.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

/**
 * TTS'e gönderilecek metni tamamen temizler.
 * Markdown linkleri → sadece link metni
 * Çıplak URL'ler → kaldırılır
 * Markdown formatlama → kaldırılır
 * Emoji → kaldırılır
 * Fazla boşluk → normalize edilir
 */
export function stripForTTS(text: string): string {
  if (!text) return ''
  
  let clean = text
  clean = stripMarkdownLinks(clean)   // [name](url) → name
  clean = stripBareUrls(clean)        // https://... → ''
  clean = stripMarkdownFormatting(clean)
  clean = stripEmojis(clean)
  clean = normalizeWhitespace(clean)
  
  return clean
}

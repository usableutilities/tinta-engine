import { DECODE, MONO, fallingChar } from './fx-decode'
import { textPx, wrapText } from './glow'
import { escapeXml } from './svg'

/**
 * Fosforo's streaming reply, laid over the app's own text: the newest
 * characters get phosphor glyphs falling onto them, the letters themselves
 * always the app's Markdown underneath (same font, size, weight and line
 * breaks, nothing redrawn), so when the glyphs are gone nothing changes.
 * The text's geometry is the app's: 15 px type on 21 px lines, paragraphs
 * 10 px apart (.epitaxy-markdown's gap), lines broken as the app breaks
 * them (glow.tsx's measured model). Prose only: lists, quotes, headings and
 * code are left to the app alone.
 */

/** The app's Markdown: line height and the gap between paragraphs, CSS px. */
export const DECODE_LINE = 21
export const DECODE_GAP = 10

/** Whether a reply is plain prose the overlay can follow (no list, quote, heading, code or table syntax). */
export const isPlainProse = (text: string): boolean =>
  !/^\s*([-*+]\s|\d+[.)]\s|>|#|```|\|)/m.test(text) && !/[*_`[\]]/.test(text)

/** The overlay's drawing: as wide as the text's room, as tall as the app's paragraphs; none when nothing falls. */
export const decodeOverlay = (text: string, width: number, glyphColor: string, tail = DECODE.window): { source: string; width: number; height: number } | undefined => {
  const paragraphs = text.trim().split(/\n\s*\n/)
  type Line = { text: string; top: number }
  const lines: Line[] = []
  let top = 0
  paragraphs.forEach((paragraph, p) => {
    if (p > 0) top += DECODE_GAP
    for (const raw of paragraph.split('\n')) {
      for (const line of wrapText(raw, width)) {
        lines.push({ text: line, top })
        top += DECODE_LINE
      }
    }
  })
  const height = Math.max(DECODE_LINE, top)
  const total = lines.reduce((n, line) => n + [...line.text].length, 0)
  const first = Math.max(0, total - tail)
  let at = 0
  let glyphs = ''
  for (const line of lines) {
    const chars = [...line.text]
    // the baseline where the app's 15 px text sits on its 21 px line
    const baseline = line.top + DECODE_LINE / 2 + DECODE.fontSize * 0.35
    chars.forEach((ch, k) => {
      const g = at + k
      if (g < first || ch.trim() === '') return
      const age = total - 1 - g
      const begin = -(age / tail) * (DECODE.fall + DECODE.cool)
      const before = chars.slice(0, k).join('')
      const cx = textPx(before) + textPx(ch) / 2
      glyphs += fallingChar(ch, g, cx, baseline, begin, { color: '#000000', glyphColor, drop: DECODE_LINE * DECODE.drop }).glyphs
    })
    at += chars.length
  }
  if (glyphs === '') return undefined
  const w = Math.max(1, Math.ceil(width))
  const defs = `<filter id="dc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}"><defs>${defs}</defs><g font-family="${escapeXml(MONO)}" font-size="${DECODE.fontSize}" fill="${glyphColor}" text-anchor="middle" filter="url(#dc-glow)">${glyphs}</g></svg>`,
    width: w,
    height,
  }
}

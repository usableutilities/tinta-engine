import { DECODE_GAP, DECODE_LINE } from './decodifica'
import { textPx, wrapText } from './glow'
import type { Drawing } from './svg'

/**
 * Reading along with the voice: what the reply shows while the face's voice
 * reads it. Two ways, each its own switch (comando.json "reading", the
 * app's Voce card):
 * - "segno": a small mark of our own at the end of the reply being read,
 *   a few rounded bars rising and falling in the theme's heading colours;
 * - "evidenza": the sentence being heard, a soft tint of the theme laid
 *   over the app's own text (the same geometry Fosforo's decode follows).
 * The voice (volto/parla.ts) says which sentence plays: the raw Markdown it
 * was cut from, matched back into the reply's text here.
 */

export type ReadingMode = 'segno' | 'evidenza' | 'entrambi' | 'spento'
export const READING_MODES: readonly ReadingMode[] = ['segno', 'evidenza', 'entrambi', 'spento']
/** Until the person chooses in the app. */
export const READING_DEFAULT: ReadingMode = 'entrambi'

/** What the voice is reading now: the sentence's raw text ('' none) and the way to show it. */
export type Reading = { text: string; mode: ReadingMode }

export const readingModeOf = (value: unknown): ReadingMode | undefined => (READING_MODES as readonly unknown[]).includes(value) ? (value as ReadingMode) : undefined
export const showsMark = (mode: ReadingMode) => mode === 'segno' || mode === 'entrambi'
export const showsHighlight = (mode: ReadingMode) => mode === 'evidenza' || mode === 'entrambi'

const words = (text: string) => text.split(/\s+/).filter(Boolean)

/**
 * Where `snippet` (a sentence's raw Markdown as the voice cut it) sits in
 * `text`, whitespace aside: [start, end) in `text`. The voice's text may
 * open with an exclamation the reply does not show (the «Tono»): its
 * leading words go one by one until the rest is found, never under three.
 */
export const findSpan = (text: string, snippet: string): { start: number; end: number } | undefined => {
  const all = words(snippet)
  for (let drop = 0; drop === 0 || all.length - drop >= 3; drop++) {
    const rest = all.slice(drop)
    if (rest.length === 0) return undefined
    const pattern = new RegExp(rest.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'))
    const m = pattern.exec(text)
    if (m) return { start: m.index, end: m.index + m[0].length }
    if (drop > 4) return undefined
  }

  return undefined
}

/** Whether the voice reads this text now (the mark's test). */
export const isReading = (text: string, reading: Reading | undefined): boolean =>
  reading !== undefined && reading.text.trim() !== '' && findSpan(text, reading.text) !== undefined

// ── the mark ────────────────────────────────────────────────────────────────

/** The mark's bars: count, width, gap, the drawing's height, CSS px; one loop, s. */
export const MARK = { bars: 4, width: 3, gap: 2.5, height: 14, loop: 1.1 } as const
/** Each bar's heights through the loop (share of the height), out of step with its neighbours. */
export const MARK_FRAMES: readonly (readonly number[])[] = [
  [0.3, 0.85, 0.45, 0.3],
  [0.6, 0.35, 1, 0.6],
  [0.95, 0.5, 0.7, 0.95],
  [0.4, 0.75, 0.3, 0.4],
]

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * The reading mark: MARK.bars rounded bars side by side, centred on the
 * line, each rising and falling through its row of MARK_FRAMES (eased, out
 * of step, like a tiny level meter), filled left to right with `colors`
 * (the theme's heading ink). Still at its middle frame without `motion`.
 */
export const readingMarkDrawing = (colors: readonly string[], motion = true): Drawing => {
  const { bars, width, gap, height, loop } = MARK
  const w = Math.ceil(bars * width + (bars - 1) * gap)
  const list = colors.length >= 2 ? colors : [colors[0] ?? '#A970FF', colors[0] ?? '#A970FF']
  const stops = list.map((hex, i) => `<stop offset="${r2(i / (list.length - 1))}" stop-color="${hex}"/>`).join('')
  const ease = 'calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"'
  const body = Array.from({ length: bars }, (_, i) => {
    const frames = MARK_FRAMES[i % MARK_FRAMES.length] as readonly number[]
    const x = r2(i * (width + gap))
    const hs = frames.map(f => r2(Math.max(width, f * height)))
    const ys = hs.map(h => r2((height - h) / 2))
    const still = hs[1] as number
    const anim = motion
      ? `<animate attributeName="height" values="${hs.join(';')}" keyTimes="0;0.33;0.66;1" dur="${loop}s" repeatCount="indefinite" ${ease}/>` +
        `<animate attributeName="y" values="${ys.join(';')}" keyTimes="0;0.33;0.66;1" dur="${loop}s" repeatCount="indefinite" ${ease}/>`
      : ''

    return `<rect x="${x}" y="${r2((height - still) / 2)}" width="${width}" height="${still}" rx="${width / 2}" fill="url(#rm)">${anim}</rect>`
  }).join('')

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}"><defs><linearGradient id="rm" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="0">${stops}</linearGradient></defs>${body}</svg>`,
    width: w,
    height,
  }
}

/** The Ascolta / Ferma button's own glyph: its box, CSS px, and its fade in when it changes, s. */
export const LISTEN_ICON = { size: 12, fade: 0.2 } as const

/**
 * The glyph beside the reply's Ascolta / Ferma button, drawn like the mark:
 * a rounded play triangle, or a rounded stop square while the voice reads
 * that reply, filled left to right with `colors`. It fades in when it
 * changes (an interactive frame the desktop keeps while it stays the same).
 */
export const listenIconDrawing = (kind: 'play' | 'stop', colors: readonly string[]): Drawing => {
  const s = LISTEN_ICON.size
  const list = colors.length >= 2 ? colors : [colors[0] ?? '#A970FF', colors[0] ?? '#A970FF']
  const stops = list.map((hex, i) => `<stop offset="${r2(i / (list.length - 1))}" stop-color="${hex}"/>`).join('')
  const shape =
    kind === 'stop'
      ? `<rect x="2" y="2" width="${s - 4}" height="${s - 4}" rx="2" fill="url(#li)"/>`
      : `<path d="M3.5 2.2 L10 6 L3.5 9.8 Z" fill="url(#li)" stroke="url(#li)" stroke-width="1.6" stroke-linejoin="round"/>`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><defs><linearGradient id="li" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${s}" y2="0">${stops}</linearGradient></defs><g opacity="1"><animate attributeName="opacity" values="0;1" dur="${LISTEN_ICON.fade}s" fill="freeze"/>${shape}</g></svg>`,
    width: s,
    height: s,
  }
}

/** The mark where there is no Svg (the terminal): three block bars in the accent. */
export const READING_MARK_TEXT = '▂▅▃'

// ── the highlight ───────────────────────────────────────────────────────────

/** A block the overlay can follow: a paragraph of prose (no list, quote, heading, table, fence or HTML). */
const isProseBlock = (block: string) => !/^\s*([-*+]\s|\d+[.)]\s|>|#|```|~~~|\||<)/m.test(block)

/**
 * A paragraph's raw Markdown as drawn: emphasis marks, code ticks, link
 * targets and escapes gone, runs of spaces as one; `at[i]` the raw index of
 * drawn character i (lines joined by '\n').
 */
export const drawnText = (raw: string): { text: string; at: number[] } => {
  let text = ''
  const at: number[] = []
  let i = 0
  while (i < raw.length) {
    const ch = raw[i] as string
    if (ch === '\\' && i + 1 < raw.length && /[\\`*_{}[\]()#+\-.!|]/.test(raw[i + 1] as string)) {
      text += raw[i + 1]
      at.push(i + 1)
      i += 2
      continue
    }
    // a link's target: "](url)" drawn as nothing (its "[" below)
    if (ch === ']' && raw[i + 1] === '(') {
      const close = raw.indexOf(')', i + 2)
      if (close !== -1) {
        i = close + 1
        continue
      }
    }
    if (ch === '*' || ch === '`' || ch === '[' || (ch === '!' && raw[i + 1] === '[') || (ch === '_' && (raw[i + 1] === '_' || /\s|^$/.test(raw[i - 1] ?? '') || /\s|[.,;:!?]|^$/.test(raw[i + 1] ?? '')))) {
      i++
      continue
    }
    if (ch === ' ' || ch === '\t') {
      if (text.endsWith(' ') || text.endsWith('\n') || text === '') {
        i++
        continue
      }
      text += ' '
      at.push(i)
      i++
      continue
    }
    if (ch === '\n' && text.endsWith(' ')) {
      text = text.slice(0, -1)
      at.pop()
    }
    text += ch
    at.push(i)
    i++
  }

  return { text, at }
}

/** The tint over the sentence: the accent this strong, its corners this round, inset this much from the line. */
export const HIGHLIGHT = { alpha: 0.2, radius: 4, inset: 2, pad: 2 } as const

/**
 * The sentence `span` (raw indices into `text`, one Markdown part of the
 * reply) as a soft tint over the app's own text: one rounded rect per line
 * it covers, laid out as the app lays out its paragraphs (decodifica.ts:
 * 21 px lines, paragraphs 10 px apart, lines broken by glow.tsx's measured
 * model) in a drawing as wide as `width`, from the part's top down to the
 * sentence's paragraph's foot: it is laid under the text from the top, so
 * nothing after the sentence moves it. Undefined when the part, up to and
 * including the sentence's paragraph, is not plain paragraphs: the overlay
 * could not follow it.
 */
export const highlightOverlay = (text: string, span: { start: number; end: number }, width: number, tint: string): Drawing | undefined => {
  const blocks: { raw: string; from: number }[] = []
  const re = /\n[ \t]*\n/g
  let from = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    blocks.push({ raw: text.slice(from, m.index), from })
    from = m.index + m[0].length
  }
  blocks.push({ raw: text.slice(from), from })
  const kept = blocks.filter(b => b.raw.trim() !== '')
  const last = kept.findIndex(b => span.start < b.from + b.raw.length)
  if (last < 0 || !kept.slice(0, last + 1).every(b => isProseBlock(b.raw))) return undefined
  const w = Math.max(1, Math.ceil(width))
  let top = 0
  let rects = ''
  kept.slice(0, last + 1).forEach((block, p) => {
    if (p > 0) top += DECODE_GAP
    const drawn = drawnText(block.raw)
    // the sentence's drawn characters in this block
    const lo = drawn.at.findIndex(i => block.from + i >= span.start)
    let hi = -1
    for (let k = drawn.at.length - 1; k >= 0; k--) {
      if (block.from + (drawn.at[k] as number) < span.end) {
        hi = k
        break
      }
    }
    let offset = 0
    for (const raw of drawn.text.split('\n')) {
      const start = offset
      offset += raw.length + 1
      let lineAt = start
      for (const line of wrapText(raw.trim(), w)) {
        const a = Math.max(lo, lineAt)
        const b = Math.min(hi + 1, lineAt + line.length)
        if (lo >= 0 && hi >= lo && a < b) {
          const x0 = textPx(line.slice(0, a - lineAt))
          const x1 = textPx(line.slice(0, b - lineAt).replace(/\s+$/, ''))
          if (x1 > x0) rects += `<rect x="${r2(Math.max(0, x0 - HIGHLIGHT.pad))}" y="${top + HIGHLIGHT.inset}" width="${r2(Math.min(w, x1 + HIGHLIGHT.pad) - Math.max(0, x0 - HIGHLIGHT.pad))}" height="${DECODE_LINE - 2 * HIGHLIGHT.inset}" rx="${HIGHLIGHT.radius}"/>`
        }
        lineAt += line.length + 1
        top += DECODE_LINE
      }
    }
  })
  if (rects === '') return undefined
  const height = Math.max(DECODE_LINE, top)
  // only as wide as the tint reaches: a drawing wider than the text's box would be scaled down, its rows off
  const reach = Math.max(...[...rects.matchAll(/x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map(m => Number(m[1]) + Number(m[2])))
  const wide = Math.min(w, Math.ceil(reach) + 1)

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${height}" viewBox="0 0 ${wide} ${height}"><g fill="${tint}" fill-opacity="${HIGHLIGHT.alpha}">${rects}</g></svg>`,
    width: wide,
    height,
  }
}

import { textPx } from './glow'
import { escapeXml } from './svg'

/**
 * Fosforo's streaming reply, a prototype: the newest characters of the
 * reply fall in as green glyphs that scramble and settle into the real
 * letters; everything older is plain text. Pure and stable: no clock, so
 * identical inputs give the identical string (the desktop's <img> only
 * reloads, and restarts the animation, when the text itself grows).
 */

export type DecodeInput = {
  /** The reply's lines, already wrapped by the caller. */
  lines: readonly string[]
  /** CSS px between baselines. */
  lineHeight?: number
  fontSize?: number
  /** The settled text's colour. */
  color: string
  /** The falling glyphs' colour (the phosphor). */
  glyphColor: string
  /** How many characters of `lines` (newlines not counted) have streamed in so far. */
  revealedChars: number
  motion: boolean
  /** The font stack the text is drawn in; a monospace one (its name says "mono") sets every character 0.6 em. */
  font?: string
  /** The drawing's width, CSS px; the widest line's when absent. */
  width?: number
  /** How many of the newest characters are still falling. */
  window?: number
}

export const DECODE = {
  lineHeight: 21,
  fontSize: 15,
  window: 12,
  /** Seconds a character takes from its first glyph to settled. */
  fall: 0.55,
  /** Seconds the settled letter takes to cool from the glyph colour to its own. */
  cool: 0.35,
  /** Glyphs a character flips through while it falls. */
  flips: 4,
  /** How far above its place a glyph starts, as a share of the line height. */
  drop: 0.9,
} as const

/** The glyphs a falling character flips through: half-width katakana, digits and a few signs (the screen-rain look). */
export const DECODE_GLYPHS = [...'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789:=+*<>']

export const SANS = `'Anthropic Sans', -apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, system-ui, sans-serif`
export const MONO = `'SF Mono', ui-monospace, Menlo, Monaco, 'JetBrains Mono', Consolas, 'Liberation Mono', monospace`

const r3 = (n: number) => Math.round(n * 1000) / 1000

/** A small deterministic hash: the same character at the same place always flips through the same glyphs. */
export const hash = (...parts: number[]): number => {
  let h = 2166136261
  for (const p of parts) {
    h ^= p & 0xffff
    h = Math.imul(h, 16777619)
    h ^= p >>> 16
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)

  return (h ^ (h >>> 15)) >>> 0
}

/** The `k`th glyph a character `code` at index `at` flips through. */
export const glyphAt = (at: number, k: number, code: number): string => DECODE_GLYPHS[hash(at, k, code) % DECODE_GLYPHS.length] as string

/** px `text` takes at `size` in `font`: the app font's advances and kerning, or 0.6 em a character in a monospace font. */
export const advance = (text: string, size: number, font: string): number =>
  /mono/i.test(font) ? [...text].length * 0.6 * size : (textPx(text) * size) / 15

/** Whether a character is drawn plain even in the falling tail: blank space falls as nothing. */
const blank = (ch: string) => /\s/.test(ch)

/**
 * One falling character, `begin` s from the drawing's start (negative: it
 * began before, part way down), its glyph overlay centred at `cx` on the
 * baseline `y`, and the tspan that settles into the real letter.
 */
export const fallingChar = (
  ch: string,
  at: number,
  cx: number,
  y: number,
  begin: number,
  look: { color: string; glyphColor: string; drop: number; flips?: number; fall?: number; cool?: number },
): { tspan: string; glyphs: string } => {
  const fall = look.fall ?? DECODE.fall
  const cool = look.cool ?? DECODE.cool
  const flips = look.flips ?? DECODE.flips
  const step = fall / flips
  const b = (t: number) => `${r3(begin + t)}s`
  const code = ch.codePointAt(0) ?? 0
  // the real letter, in the line's own text so it sits exactly where the font puts it: hidden until it settles, then cooling to its colour
  const tspan =
    `<tspan fill-opacity="0"><set attributeName="fill-opacity" to="1" begin="${b(fall)}" fill="freeze"/>` +
    `<animate attributeName="fill" values="${look.glyphColor};${look.color}" begin="${b(fall)}" dur="${cool}s" fill="freeze"/>${escapeXml(ch)}</tspan>`
  // the glyphs: one visible at a time, the whole column falling in from above, gone when the letter lands
  const frames = Array.from(
    { length: flips },
    (_, k) => `<text x="0" y="0" visibility="hidden"><set attributeName="visibility" to="visible" begin="${b(k * step)}" dur="${r3(step)}s"/>${escapeXml(glyphAt(at, k, code))}</text>`,
  ).join('')
  const glyphs =
    `<g transform="translate(${r3(cx)} ${r3(y)})"><g opacity="0">` +
    `<animate attributeName="opacity" values="0;1;1" keyTimes="0;0.3;1" begin="${b(0)}" dur="${fall}s"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0 ${r3(-look.drop)};0 0" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.6 0.35 1" begin="${b(0)}" dur="${fall}s"/>` +
    `${frames}</g></g>`

  return { tspan, glyphs }
}

/**
 * The reply as Svg text, `lines` one under another, the first
 * `revealedChars` characters shown: the newest `window` of them falling
 * in as glyphs (staggered by age, so a re-render a few characters later
 * looks like the same falling tail), the rest plain. Still when `motion`
 * is false.
 */
export const decodeText = (input: DecodeInput): { source: string; width: number; height: number } => {
  const lineHeight = input.lineHeight ?? DECODE.lineHeight
  const size = input.fontSize ?? DECODE.fontSize
  const font = input.font ?? SANS
  const tail = Math.max(1, Math.round(input.window ?? DECODE.window))
  const lines = input.lines.map(line => [...line])
  const total = lines.reduce((n, line) => n + line.length, 0)
  const revealed = Math.max(0, Math.min(total, Math.floor(input.revealedChars)))
  const settledUpTo = input.motion ? Math.max(0, revealed - tail) : revealed
  const baseline = (i: number) => r3(i * lineHeight + lineHeight / 2 + size * 0.35)

  let at = 0
  let shownLines = 0
  let widest = 0
  let texts = ''
  let overlay = ''
  lines.forEach((chars, i) => {
    const start = at
    at += chars.length
    if (start >= revealed && !(i === 0 && revealed === 0)) return
    shownLines = i + 1
    const visible = chars.slice(0, Math.max(0, revealed - start))
    const settled = Math.min(visible.length, Math.max(0, settledUpTo - start))
    const plain = visible.slice(0, settled).join('')
    widest = Math.max(widest, advance(visible.join(''), size, font))
    let spans = ''
    for (let k = settled; k < visible.length; k++) {
      const ch = visible[k] as string
      const g = start + k
      if (blank(ch)) {
        spans += escapeXml(ch)
        continue
      }
      // age 0 the newest: it starts at the top; the oldest in the tail is nearly down already
      const age = revealed - 1 - g
      const begin = -(age / tail) * (DECODE.fall + DECODE.cool)
      const before = visible.slice(0, k).join('')
      const cx = advance(before, size, font) + advance(ch, size, font) / 2
      const one = fallingChar(ch, g, cx, baseline(i), begin, { color: input.color, glyphColor: input.glyphColor, drop: lineHeight * DECODE.drop })
      spans += one.tspan
      overlay += one.glyphs
    }
    texts += `<text x="0" y="${baseline(i)}" xml:space="preserve">${escapeXml(plain)}${spans}</text>`
  })

  const width = Math.max(1, Math.ceil(input.width ?? widest + 4))
  const height = Math.max(lineHeight, shownLines * lineHeight)
  const style = `font-family="${escapeXml(font)}" font-size="${size}"`
  // the glyphs glow a little, like phosphor
  const defs = overlay
    ? `<filter id="dc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
    : ''
  const body =
    `<g ${style} fill="${input.color}" style="white-space:pre">${texts}</g>` +
    (overlay ? `<g ${style} fill="${input.glyphColor}" text-anchor="middle" filter="url(#dc-glow)">${overlay}</g>` : '')

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`,
    width,
    height,
  }
}

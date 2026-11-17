import { MONO, glyphAt, hash } from './fx-decode'
import { DENSITY } from './densita'
import type { Density } from './densita'
import { APP_FONT, HEADING_CSS_PX, HEADING_LINE, headingPx } from './reply'
import { escapeXml } from './svg'
import { mix } from './theme'

/**
 * Headings with an effect, in two layers. The words are one still drawing,
 * the same for a given text whatever the effect's moment, so they are painted
 * at every instant. The effect is a second drawing laid over them, a seamless
 * endless loop that starts and ends at rest: decode's few falling glyphs, a
 * drifting gradient, a light passing over silver or frost, a neon halo that
 * breathes, a brief glitch now and then, Unicorno's glitter. It has no clock
 * in its source: the desktop keeps it running as an interactive Svg across its
 * redraws (animazioni.ts, steadyFrame). No layer when `motion` is false.
 */

export const HEADING_EFFECTS = ['decode', 'gradient-drift', 'silver-cut', 'neon-tube', 'frost', 'glitch', 'glitter'] as const
export type HeadingEffect = (typeof HEADING_EFFECTS)[number]
export type HeadingFont = 'sans' | 'mono' | 'serif'
export type HeadingInput = {
  text: string
  /** 1 to 3. */
  level: number
  /** The room the heading may take, CSS px. */
  width: number
  /** The effect's colours; empty for the effect's own. */
  colors: readonly string[]
  effect: HeadingEffect
  font?: HeadingFont
  motion: boolean
  /** The person's density (densita.ts): the heading's size from its row; normal when absent. */
  density?: Density
}
/** A heading's Svg, still, and its effect's loop to lay over it: `inset`/`top` the empty room left of and above the first ink (glows and sparkles need it), `lines` as wrapped. */
export type HeadingDrawing = { source: string; loop?: string; width: number; height: number; inset: number; top: number; lines: string[] }

export const SERIF = `'New York', 'Iowan Old Style', 'Palatino', Georgia, 'Times New Roman', serif`
export const HEADING_FONTS: { [font in HeadingFont]: string } = { sans: APP_FONT, mono: MONO, serif: SERIF }

/** Each effect's own colours, when the theme gives none. */
export const EFFECT_COLORS: { [effect in HeadingEffect]: readonly string[] } = {
  decode: ['#7CFF8A', '#D9FFE0'],
  'gradient-drift': ['#8B3DFF', '#4B3DFF', '#E8317A'],
  'silver-cut': ['#F5F7FA', '#B9C1CA', '#7E8893', '#E9EDF1'],
  'neon-tube': ['#FF3DCB'],
  frost: ['#E4F5FF', '#9AD3F0', '#62B2DF'],
  glitch: ['#E8E8E8'],
  glitter: ['#FFB8E6', '#D2B8FF', '#B8E6FF', '#FFF2B8'],
}

/** Room around the ink each effect needs, CSS px (x, y). */
const ROOM: { [effect in HeadingEffect]: [number, number] } = {
  decode: [0, 0],
  'gradient-drift': [0, 0],
  'silver-cut': [0, 0],
  'neon-tube': [8, 6],
  frost: [3, 2],
  glitch: [4, 0],
  glitter: [8, 6],
}

const r2 = (n: number) => Math.round(n * 100) / 100
const SPLINE = '0.45 0 0.55 1'

/** px `text` takes as a bold heading `size` px tall in `font`. */
export const effectPx = (text: string, size: number, font: HeadingFont): number =>
  font === 'mono' ? [...text].length * 0.6 * size * 1.02 : font === 'serif' ? headingPx(text, size) * 0.98 : headingPx(text, size)

/** The most lines an effect heading wraps to; a longer one is left to the app's Markdown, which wraps it itself. */
export const FX_LINES_MAX = 4

/** `word` cut into pieces of at most `room` px each (a token wider than the line: a path, a URL). */
const pieces = (word: string, size: number, font: HeadingFont, room: number): string[] => {
  const out: string[] = []
  let piece = ''
  for (const ch of word) {
    if (piece !== '' && effectPx(piece + ch, size, font) > room) {
      out.push(piece)
      piece = ch
    } else piece += ch
  }
  if (piece !== '') out.push(piece)

  return out
}

/** `text` in lines of at most `room` px, a word wider than the line cut in pieces; undefined when it needs more than FX_LINES_MAX. */
export const fxLines = (text: string, size: number, font: HeadingFont, room: number): string[] | undefined => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    for (const piece of effectPx(word, size, font) > room ? pieces(word, size, font, room) : [word]) {
      const next = line === '' ? piece : `${line} ${piece}`
      if (effectPx(next, size, font) <= room) line = next
      else {
        if (line !== '') lines.push(line)
        line = piece
      }
    }
  }
  if (line !== '') lines.push(line)

  return lines.length === 0 || lines.length > FX_LINES_MAX ? undefined : lines
}

const stopsOf = (colors: readonly string[], opacity?: (i: number) => number): string =>
  colors.map((hex, i) => `<stop offset="${r2(colors.length === 1 ? 0 : i / (colors.length - 1))}" stop-color="${hex}"${opacity ? ` stop-opacity="${r2(opacity(i))}"` : ''}/>`).join('')

/** A four-pointed sparkle at `x`, `y`, `r` px. */
const sparkle = (x: number, y: number, r: number): string => {
  const k = r * 0.22

  return `M${r2(x)} ${r2(y - r)}L${r2(x + k)} ${r2(y - k)}L${r2(x + r)} ${r2(y)}L${r2(x + k)} ${r2(y + k)}L${r2(x)} ${r2(y + r)}L${r2(x - k)} ${r2(y + k)}L${r2(x - r)} ${r2(y)}L${r2(x - k)} ${r2(y - k)}Z`
}

/**
 * A heading `level` 1 to 3 with `effect`, wrapped to `width` px (at most
 * FX_LINES_MAX lines, else undefined: the app's Markdown draws it). Never
 * wider than `width`: every line is measured to fit, ink and room included.
 */
export const headingDrawing = (input: HeadingInput): HeadingDrawing | undefined => {
  const font = input.font ?? 'sans'
  const family = escapeXml(HEADING_FONTS[font])
  const size = DENSITY[input.density ?? 'normal'].heading[input.level] ?? HEADING_CSS_PX[input.level] ?? 17
  const [px, py] = ROOM[input.effect]
  // the line's room with the ink's own margin (4% and 4 px, as inkW below) inside it: the drawing never needs more than `width`
  const lines = fxLines(input.text, size, font, (Math.floor(input.width) - 2 * px - 5) / 1.04)
  if (lines === undefined) return undefined
  const colors = (input.colors.filter(c => /^#[0-9a-f]{6}$/i.test(c)).length > 0 ? input.colors.filter(c => /^#[0-9a-f]{6}$/i.test(c)) : EFFECT_COLORS[input.effect]).map(c => c.toUpperCase())
  const first = colors[0] as string
  const pitch = Math.round(size * HEADING_LINE)
  const widest = Math.max(...lines.map(line => effectPx(line, size, font)))
  const inkW = Math.ceil(widest * 1.04 + 4)
  const width = Math.min(Math.floor(input.width), inkW + 2 * px)
  const height = pitch * lines.length + 2 * py
  const baseline = (i: number) => r2(py + i * pitch + (pitch - size) / 2 + size * 0.8)
  const textAttrs = `font-family="${family}" font-size="${size}" font-weight="700"`
  /** Every line as <text>, painted `fill`, with `extra` attributes. */
  const text = (fill: string, extra = '') => lines.map((line, i) => `<text x="${px}" y="${baseline(i)}" fill="${fill}"${extra}>${escapeXml(line)}</text>`).join('')
  /** A slanted light passing over the words, out of sight between its passes. */
  const passing = (peak: number, band: number, slant: number, share: number, dur: number) =>
    `<linearGradient id="hx-l" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${band}" y2="${r2(band * slant)}">` +
    `<stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="${peak}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>` +
    `<animateTransform attributeName="gradientTransform" type="translate" values="${-2 * band} 0;${width + band} 0;${width + band} 0" keyTimes="0;${share};1" calcMode="spline" keySplines="0.4 0 0.6 1;0 0 1 1" dur="${dur}s" repeatCount="indefinite"/></linearGradient>`
  /** A gradient mirrored every `width` px: a shift of two widths is the same picture, so its drift loops without a seam. */
  const mirrored = (id: string, list: readonly string[], dur?: number) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0" spreadMethod="reflect">${stopsOf(list)}` +
    (dur === undefined ? '' : `<animateTransform attributeName="gradientTransform" type="translate" values="0 0;${2 * width} 0" dur="${dur}s" repeatCount="indefinite"/>`) +
    `</linearGradient>`
  // the words: `defs`, `body`; the effect's loop over them: `loopDefs`, `loop`
  let defs = ''
  let body = ''
  let loopDefs = ''
  let loop = ''

  switch (input.effect) {
    case 'decode': {
      // the words plain; a few phosphor glyphs fall past them one by one, small and faint, each in its own moment of the loop
      body = text(first)
      const glow = colors[1] ?? mix(first, '#FFFFFF', 0.6)
      const count = Math.max(4, Math.min(10, Math.round(inkW / 40)))
      const dur = 7
      const glyphPx = r2(size * 0.62)
      let glyphs = ''
      for (let s = 0; s < count; s++) {
        const h = hash(s, [...input.text].length, input.level)
        const x = r2(px + ((s + 0.2 + (h % 600) / 1000) / count) * inkW)
        const line = baseline((h >>> 10) % lines.length)
        // the moment it falls, never at the loop's ends: the loop starts and ends with none in sight
        const mid = 0.14 + ((s * 0.37 + ((h >>> 24) % 100) / 400) % 1) * 0.72
        const [from, to] = [r2(mid - 0.12), r2(mid + 0.12)]
        const keys = `0;${from};${r2(mid)};${to};1`
        const [top, foot] = [r2(line - size), r2(line + size * 0.3)]
        const flips = [0, 1, 2]
          .map(k => {
            const [on, off] = [r2(from + (k * (to - from)) / 3), r2(from + ((k + 1) * (to - from)) / 3)]
            return `<text x="0" y="0" opacity="0"><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;${on};${off};1" calcMode="discrete" dur="${dur}s" repeatCount="indefinite"/>${escapeXml(glyphAt(s, k, h & 0xffff))}</text>`
          })
          .join('')
        glyphs +=
          `<g opacity="0"><animate attributeName="opacity" values="0;0;0.6;0;0" keyTimes="${keys}" dur="${dur}s" repeatCount="indefinite"/>` +
          `<animateTransform attributeName="transform" type="translate" values="${x} ${top};${x} ${top};${x} ${r2((top + foot) / 2)};${x} ${foot};${x} ${foot}" keyTimes="${keys}" dur="${dur}s" repeatCount="indefinite"/>${flips}</g>`
      }
      loop = `<g fill="${glow}" font-family="${escapeXml(MONO)}" font-size="${glyphPx}" font-weight="400" text-anchor="middle">${glyphs}</g>`
      break
    }
    case 'gradient-drift': {
      // the gradient drifts: the same picture at the loop's start as the still words
      const list = colors.length > 1 ? colors : [first, mix(first, '#FFFFFF', 0.5)]
      const stops = [...list, list[0] as string].slice(0, Math.max(2, list.length))
      defs = mirrored('hx-g', stops)
      body = text(`url(#hx-g) ${first}`)
      loopDefs = mirrored('hx-g', stops, Math.max(8, Math.round(width / 40)))
      loop = body
      break
    }
    case 'silver-cut': {
      // brushed metal cut in two at the middle of the caps, and a slanted light passing over it now and then
      const [top, mid, low, foot] = [colors[0], colors[1] ?? colors[0], colors[2] ?? colors[1] ?? colors[0], colors[3] ?? colors[0]] as string[]
      defs = lines
        .map((_, i) => {
          const y0 = baseline(i) - size * 0.8
          return `<linearGradient id="hx-m${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${r2(y0)}" x2="0" y2="${r2(y0 + size)}"><stop offset="0" stop-color="${top}"/><stop offset="0.48" stop-color="${mid}"/><stop offset="0.52" stop-color="${low}"/><stop offset="1" stop-color="${foot}"/></linearGradient>`
        })
        .join('')
      body = lines.map((line, i) => `<text x="${px}" y="${baseline(i)}" fill="url(#hx-m${i}) ${mid}">${escapeXml(line)}</text>`).join('')
      loopDefs = passing(0.85, Math.round(size * 2.4), 0.35, 0.38, 5.5)
      loop = text('url(#hx-l)')
      break
    }
    case 'neon-tube': {
      // a white-hot core in the tube's colour with a halo round it, always lit; a second halo breathes over them
      const core = mix(first, '#FFFFFF', 0.6)
      const halo =
        `<filter id="hx-n" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="${r2(size * 0.08)}" result="a"/><feGaussianBlur in="SourceGraphic" stdDeviation="${r2(size * 0.22)}" result="b"/>` +
        `<feMerge><feMergeNode in="b"/><feMergeNode in="a"/></feMerge></filter>`
      defs = halo
      body = `<g filter="url(#hx-n)" opacity="0.9">${text(first)}</g>${text(core, ` stroke="${first}" stroke-width="${r2(size * 0.035)}" stroke-opacity="0.8"`)}`
      loopDefs = halo
      loop = `<g filter="url(#hx-n)" opacity="0"><animate attributeName="opacity" values="0;0.7;0" keyTimes="0;0.5;1" calcMode="spline" keySplines="${SPLINE};${SPLINE}" dur="3.6s" repeatCount="indefinite"/>${text(first)}</g>`
      break
    }
    case 'frost': {
      // icy letters with a hairline of light, a cold breath round them and crystals inside; a cold light passes over them
      const list = colors.length > 1 ? colors : [first, mix(first, '#6FB7E0', 0.5)]
      defs =
        `<linearGradient id="hx-i" x1="0" y1="0" x2="0" y2="1">${stopsOf(list)}</linearGradient>` +
        `<filter id="hx-c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.7 0.35" numOctaves="3" seed="3" stitchTiles="stitch"/>` +
        `<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  7 0 0 0 -3.6"/></filter>` +
        `<pattern id="hx-x" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="64" height="64" filter="url(#hx-c)"/></pattern>` +
        `<filter id="hx-b" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="${r2(size * 0.12)}"/></filter>`
      body =
        `<g filter="url(#hx-b)" opacity="0.35">${text(list[list.length - 1] as string)}</g>` +
        text(`url(#hx-i) ${first}`, ` stroke="#FFFFFF" stroke-width="0.6" stroke-opacity="0.55" paint-order="stroke"`) +
        `<g opacity="0.9">${text('url(#hx-x)')}</g>`
      loopDefs = passing(0.7, Math.round(size * 2.6), 0.4, 0.4, 6.5)
      loop = text('url(#hx-l)')
      break
    }
    case 'glitch': {
      // the words stand still and stay readable; once a loop, for a breath, faint red and cyan copies split off them
      const base = colors.length > 1 ? `url(#hx-g) ${first}` : first
      if (colors.length > 1) defs = `<linearGradient id="hx-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0">${stopsOf(colors)}</linearGradient>`
      body = text(base)
      const split = (ink: string, xs: string) =>
        `<g opacity="0"><animate attributeName="opacity" values="0;0.45;0.3;0.45;0.25;0;0" keyTimes="0;0.5;0.52;0.54;0.56;0.58;1" calcMode="discrete" dur="8s" repeatCount="indefinite"/>` +
        `<animateTransform attributeName="transform" type="translate" values="${xs}" keyTimes="0;0.5;0.52;0.54;0.56;0.58;1" calcMode="discrete" dur="8s" repeatCount="indefinite"/>${text(ink)}</g>`
      loop = split('#FF2A6D', '0 0;-2 0;1.5 0.5;-1.5 0;2 -0.5;0 0;0 0') + split('#05D9E8', '0 0;2 0;-1.5 -0.5;1.5 0;-2 0.5;0 0;0 0')
      break
    }
    case 'glitter': {
      // Unicorno: pastel letters whose gradient drifts, a soft sheen gliding over, tiny sparkles that bloom and fade (all to nothing between)
      const list = colors.length > 1 ? colors : [first, mix(first, '#FFFFFF', 0.5)]
      defs = mirrored('hx-u', list)
      body = text(`url(#hx-u) ${first}`)
      loopDefs = mirrored('hx-u', list, Math.max(10, Math.round(width / 30))) + passing(0.6, Math.round(size * 2), 0.4, 0.45, 4.8)
      const dur = 4.8
      const count = Math.max(4, Math.min(9, Math.round(inkW / 55)))
      let stars = ''
      for (let s = 0; s < count; s++) {
        const h = hash(s, [...input.text].length, input.level)
        const x = px + ((s + 0.2 + ((h % 600) / 1000)) / count) * inkW
        const line = (h >>> 10) % lines.length
        // above the caps or just under the baseline: never hidden on a letter's body
        const y = baseline(line) + size * ((h >>> 14) % 2 === 0 ? -0.82 - ((h >>> 16) % 10) / 100 : 0.1 + ((h >>> 16) % 6) / 100)
        const r = 3 + ((h >>> 20) % 3) * 1.2
        // each sparkle has its own moment of the loop, never at its ends: the loop starts and ends dark
        const mid = 0.12 + (((s * 0.37 + ((h >>> 24) % 100) / 400) % 1) * 0.76)
        const keys = `0;${r2(mid - 0.1)};${r2(mid)};${r2(mid + 0.1)};1`
        stars +=
          `<g transform="translate(${r2(x)} ${r2(y)})"><path d="${sparkle(0, 0, r)}" fill="#FFFFFF" opacity="0">` +
          `<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="${keys}" dur="${dur}s" repeatCount="indefinite"/>` +
          `<animateTransform attributeName="transform" type="scale" values="0.2;0.2;1;0.2;0.2" keyTimes="${keys}" dur="${dur}s" repeatCount="indefinite"/></path></g>`
      }
      loop = text(`url(#hx-u) ${first}`) + text('url(#hx-l)') + stars
      break
    }
  }
  const svg = (inner: string, innerDefs: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${innerDefs}</defs><g ${textAttrs}>${inner}</g></svg>`

  return {
    source: svg(body, defs),
    ...(input.motion ? { loop: svg(loop, loopDefs) } : {}),
    width,
    height,
    inset: px,
    top: py,
    lines,
  }
}

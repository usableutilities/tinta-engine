import { MONO, fallingChar, hash } from './fx-decode'
import { APP_FONT, HEADING_CSS_PX, HEADING_LINE, HEADING_LINES_MAX, headingPx } from './reply'
import { escapeXml } from './svg'
import { mix } from './theme'

/**
 * Headings with an effect, drawn as Svg text: decode (Fosforo), a drifting
 * gradient, a silver cut with a light sweeping across, a neon tube, frost,
 * a one-shot glitch and Unicorno's glitter. Pure and stable: no clock in
 * the source, so the desktop's <img> keeps playing; one-shot effects play
 * on arrival and freeze, loops are seamless; still when `motion` is false.
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
}
/** A heading's Svg: `inset`/`top` the empty room left of and above the first ink (glows and sparkles need it), `lines` as wrapped. */
export type HeadingDrawing = { source: string; width: number; height: number; inset: number; top: number; lines: string[] }

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

/** `text` in lines of at most `room` px; undefined when it needs more than HEADING_LINES_MAX or a word alone is wider. */
const wrap = (text: string, size: number, font: HeadingFont, room: number): string[] | undefined => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (effectPx(word, size, font) > room) return undefined
    const next = line === '' ? word : `${line} ${word}`
    if (effectPx(next, size, font) <= room) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line !== '') lines.push(line)

  return lines.length === 0 || lines.length > HEADING_LINES_MAX ? undefined : lines
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
 * HEADING_LINES_MAX lines, else undefined: the app's Markdown draws it).
 */
export const headingDrawing = (input: HeadingInput): HeadingDrawing | undefined => {
  const font = input.font ?? 'sans'
  const family = escapeXml(HEADING_FONTS[font])
  const size = HEADING_CSS_PX[input.level] ?? 17
  const [px, py] = ROOM[input.effect]
  const lines = wrap(input.text, size, font, input.width - 2 * px - 4)
  if (lines === undefined) return undefined
  const colors = (input.colors.filter(c => /^#[0-9a-f]{6}$/i.test(c)).length > 0 ? input.colors.filter(c => /^#[0-9a-f]{6}$/i.test(c)) : EFFECT_COLORS[input.effect]).map(c => c.toUpperCase())
  const first = colors[0] as string
  const pitch = Math.round(size * HEADING_LINE)
  const widest = Math.max(...lines.map(line => effectPx(line, size, font)))
  const inkW = Math.ceil(widest * 1.04 + 4)
  const width = Math.min(Math.ceil(input.width), inkW + 2 * px)
  const height = pitch * lines.length + 2 * py
  const baseline = (i: number) => r2(py + i * pitch + (pitch - size) / 2 + size * 0.8)
  const textAttrs = `font-family="${family}" font-size="${size}" font-weight="700"`
  /** Every line as <text>, painted `fill`, with `extra` attributes. */
  const text = (fill: string, extra = '') => lines.map((line, i) => `<text x="${px}" y="${baseline(i)}" fill="${fill}"${extra}>${escapeXml(line)}</text>`).join('')
  const motion = input.motion
  let defs = ''
  let body = ''

  switch (input.effect) {
    case 'decode': {
      // every letter flips through glyphs, falling a little, then settles; left to right, once, on arrival
      if (!motion) {
        body = text(first)
        break
      }
      const glow = colors[1] ?? mix(first, '#FFFFFF', 0.6)
      const stagger = Math.min(0.04, 1.2 / Math.max(1, [...input.text].length))
      let at = 0
      let overlay = ''
      body = lines
        .map((line, i) => {
          const chars = [...line]
          const spans = chars
            .map((ch, k) => {
              const g = at++
              if (/\s/.test(ch)) return escapeXml(ch)
              const cx = px + effectPx(chars.slice(0, k).join(''), size, font) + effectPx(ch, size, font) / 2
              const one = fallingChar(ch, g, cx, baseline(i), 0.05 + g * stagger, { color: first, glyphColor: glow, drop: size * 0.5, fall: 0.5, flips: 5, cool: 0.4 })
              overlay += one.glyphs

              return one.tspan
            })
            .join('')
          at++

          return `<text x="${px}" y="${baseline(i)}" fill="${first}" xml:space="preserve">${spans}</text>`
        })
        .join('')
      defs += `<filter id="hx-p" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
      body += `<g fill="${glow}" text-anchor="middle" font-weight="700" filter="url(#hx-p)">${overlay}</g>`
      break
    }
    case 'gradient-drift': {
      // the gradient mirrored every `width` px: a shift of two widths is the same picture, so the drift loops without a seam
      const list = colors.length > 1 ? colors : [first, mix(first, '#FFFFFF', 0.5)]
      const move = motion ? `<animateTransform attributeName="gradientTransform" type="translate" values="0 0;${2 * width} 0" dur="${Math.max(8, Math.round(width / 40))}s" repeatCount="indefinite"/>` : ''
      defs += `<linearGradient id="hx-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0" spreadMethod="reflect">${stopsOf([...list, list[0] as string].slice(0, Math.max(2, list.length)))}${move}</linearGradient>`
      body = text(`url(#hx-g) ${first}`)
      break
    }
    case 'silver-cut': {
      // brushed metal cut in two at the middle of the caps, and a slanted light passing over it now and then
      const [top, mid, low, foot] = [colors[0], colors[1] ?? colors[0], colors[2] ?? colors[1] ?? colors[0], colors[3] ?? colors[0]] as string[]
      const metal = lines
        .map((_, i) => {
          const y0 = baseline(i) - size * 0.8
          return `<linearGradient id="hx-m${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${r2(y0)}" x2="0" y2="${r2(y0 + size)}"><stop offset="0" stop-color="${top}"/><stop offset="0.48" stop-color="${mid}"/><stop offset="0.52" stop-color="${low}"/><stop offset="1" stop-color="${foot}"/></linearGradient>`
        })
        .join('')
      const band = Math.round(size * 2.4)
      const sweep = motion
        ? `<animateTransform attributeName="gradientTransform" type="translate" values="${-band} 0;${width + band} 0;${width + band} 0" keyTimes="0;0.38;1" calcMode="spline" keySplines="0.4 0 0.6 1;0 0 1 1" dur="5.5s" repeatCount="indefinite"/>`
        : ''
      defs +=
        metal +
        `<linearGradient id="hx-l" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${band}" y2="${r2(band * 0.35)}">` +
        `<stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>${sweep}</linearGradient>`
      body =
        lines.map((line, i) => `<text x="${px}" y="${baseline(i)}" fill="url(#hx-m${i}) ${mid}">${escapeXml(line)}</text>`).join('') +
        // still: the light rests out of sight
        (motion ? text('url(#hx-l)') : '')
      break
    }
    case 'neon-tube': {
      // a white-hot core in the tube's colour, a halo round it; it strikes once on arrival, then hums
      const core = mix(first, '#FFFFFF', 0.6)
      defs +=
        `<filter id="hx-n" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="${r2(size * 0.08)}" result="a"/><feGaussianBlur in="SourceGraphic" stdDeviation="${r2(size * 0.22)}" result="b"/>` +
        `<feMerge><feMergeNode in="b"/><feMergeNode in="a"/></feMerge></filter>`
      const strike = motion ? `<animate attributeName="opacity" values="0;1;0.15;1;0.4;1" keyTimes="0;0.2;0.35;0.55;0.7;1" calcMode="discrete" dur="0.7s" fill="freeze"/>` : ''
      const hum = motion ? `<animate attributeName="opacity" values="0.75;1;0.75" keyTimes="0;0.5;1" calcMode="spline" keySplines="${SPLINE};${SPLINE}" dur="3.6s" repeatCount="indefinite"/>` : ''
      body = `<g>${strike}<g filter="url(#hx-n)" opacity="0.9">${hum}${text(first)}</g>${text(core, ` stroke="${first}" stroke-width="${r2(size * 0.035)}" stroke-opacity="0.8"`)}</g>`
      break
    }
    case 'frost': {
      // icy letters with a hairline of light, a cold breath round them and crystals forming inside
      const list = colors.length > 1 ? colors : [first, mix(first, '#6FB7E0', 0.5)]
      defs +=
        `<linearGradient id="hx-i" x1="0" y1="0" x2="0" y2="1">${stopsOf(list)}</linearGradient>` +
        `<filter id="hx-c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.7 0.35" numOctaves="3" seed="3" stitchTiles="stitch"/>` +
        `<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  7 0 0 0 -3.6"/></filter>` +
        `<pattern id="hx-x" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="64" height="64" filter="url(#hx-c)"/></pattern>` +
        `<filter id="hx-b" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="${r2(size * 0.12)}"/></filter>`
      const form = motion ? `<animate attributeName="opacity" values="0;0.9" keyTimes="0;1" calcMode="spline" keySplines="0.3 0 0.4 1" dur="1.4s" fill="freeze"/>` : ''
      body =
        `<g filter="url(#hx-b)" opacity="0.35">${text(list[list.length - 1] as string)}</g>` +
        text(`url(#hx-i) ${first}`, ` stroke="#FFFFFF" stroke-width="0.6" stroke-opacity="0.55" paint-order="stroke"`) +
        `<g opacity="${motion ? 0 : 0.9}">${form}${text('url(#hx-x)')}</g>`
      break
    }
    case 'glitch': {
      // once, on arrival: the letters jump and split into red and cyan for a breath, then stand still
      const base = colors.length > 1 ? `url(#hx-g) ${first}` : first
      if (colors.length > 1) defs += `<linearGradient id="hx-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0">${stopsOf(colors)}</linearGradient>`
      if (!motion) {
        body = text(base)
        break
      }
      const split = (ink: string, xs: string) =>
        `<g opacity="0" style="mix-blend-mode:screen"><animate attributeName="opacity" values="0.85;0.85;0.6;0.85;0" keyTimes="0;0.3;0.55;0.8;1" calcMode="discrete" dur="0.75s" fill="freeze"/>` +
        `<animateTransform attributeName="transform" type="translate" values="${xs}" keyTimes="0;0.2;0.4;0.6;0.8;1" calcMode="discrete" dur="0.75s" fill="freeze"/>${text(ink)}</g>`
      const jitter = `<animateTransform attributeName="transform" type="translate" values="3 0;-2 0;0 0;2 0;-1 0;0 0" keyTimes="0;0.2;0.4;0.6;0.8;1" calcMode="discrete" dur="0.75s" fill="freeze"/>`
      // a slice of the middle of the letters, torn sideways twice
      const sliceY = r2(py + pitch * 0.45)
      defs += `<clipPath id="hx-s"><rect x="0" y="${sliceY}" width="${width}" height="${r2(size * 0.22)}"/></clipPath>`
      const slice =
        `<g clip-path="url(#hx-s)"><g opacity="0"><animate attributeName="opacity" values="1;0;1;0" keyTimes="0;0.25;0.5;1" calcMode="discrete" dur="0.6s" fill="freeze"/>` +
        `<animateTransform attributeName="transform" type="translate" values="-7 0;5 0;-4 0" keyTimes="0;0.4;1" calcMode="discrete" dur="0.6s" fill="freeze"/>${text(base)}</g></g>`
      body = `<g>${jitter}${text(base)}</g>` + split('#FF2A6D', '-4 0;3 1;-2 0;4 -1;-3 0;0 0') + split('#05D9E8', '4 0;-3 -1;2 0;-4 1;3 0;0 0') + slice
      break
    }
    case 'glitter': {
      // Unicorno: pastel letters, a soft sheen gliding over, tiny sparkles that bloom and fade (all to nothing between)
      const list = colors.length > 1 ? colors : [first, mix(first, '#FFFFFF', 0.5)]
      const drift = motion ? `<animateTransform attributeName="gradientTransform" type="translate" values="0 0;${2 * width} 0" dur="${Math.max(10, Math.round(width / 30))}s" repeatCount="indefinite"/>` : ''
      defs += `<linearGradient id="hx-u" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0" spreadMethod="reflect">${stopsOf(list)}${drift}</linearGradient>`
      body = text(`url(#hx-u) ${first}`)
      if (!motion) break
      const band = Math.round(size * 2)
      defs +=
        `<linearGradient id="hx-l" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${band}" y2="${r2(band * 0.4)}">` +
        `<stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.6"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>` +
        `<animateTransform attributeName="gradientTransform" type="translate" values="${-band} 0;${width + band} 0;${width + band} 0" keyTimes="0;0.45;1" calcMode="spline" keySplines="0.4 0 0.6 1;0 0 1 1" dur="4.8s" repeatCount="indefinite"/></linearGradient>`
      body += text('url(#hx-l)')
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
      body += stars
      break
    }
  }

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs><g ${textAttrs}>${body}</g></svg>`,
    width,
    height,
    inset: px,
    top: py,
    lines,
  }
}

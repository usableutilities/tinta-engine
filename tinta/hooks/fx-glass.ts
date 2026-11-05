import { contrast, luminance } from './theme'

/**
 * Vetro Sfumature's Claude bubble: frosted glass over a few large, soft
 * colour blobs drifting slowly behind it. Pure: plain inputs in, an Svg
 * source and its size out; the same inputs always give the same string
 * (no clock in it), so the desktop's <img> never reloads and restarts it.
 */

export type GlassPalette = { blobs: readonly string[]; tint: string }
export type GlassInput = {
  width: number
  height: number
  palette: GlassPalette
  motion: boolean
  /** What the app paints behind the bubble. */
  background?: string
  /** The app's text over the glass: it keeps GLASS.minContrast over the brightest point under it. */
  text?: string
  /** The bubble's corner radius, CSS px. */
  radius?: number
}
export type GlassDrawing = { source: string; width: number; height: number; blobAlpha: number }

/** Vetro's own blues and periwinkles, and the frost's blue-white. */
export const GLASS_PALETTE: GlassPalette = { blobs: ['#3D6BFF', '#8C9EFF', '#5B8CFF', '#A9B8FF'], tint: '#E6EEFF' }

export const GLASS = {
  /** The most a blob's centre is opaque (times its weight); lowered until the text keeps minContrast. */
  blob: 0.4,
  /** The frosted layer's opacity. */
  frost: 0.06,
  /** The grain's strongest point, white. */
  grain: 0.03,
  /** The specular band's strongest point, white, fading to 0. */
  specular: 0.12,
  /** The 1 px inner highlight: white at the top left, at the bottom right. */
  rim: { top: 0.35, bottom: 0.08 },
  minContrast: 7,
  background: '#1F1F1F',
  text: '#ECECEC',
  radius: 12,
  /** The bubble's padding, CSS px: text never lies nearer the edge (the rim and the corners stay out of the check). */
  pad: { x: 16, y: 12 },
  /** The specular band's run from the top left corner to nothing, CSS px. */
  sheen: { x: 200, y: 140 },
  /** Seconds each blob takes to go round its drift once: unlike, so the blobs never move in step. */
  periods: [29, 37, 31, 43],
} as const

/** Where each blob rests (shares of width and of the blobs' reach down), its radius (share of the side) and its drift (three points, shares of its radius). */
const BLOBS = [
  { x: 0.2, y: 0.25, r: 0.55, path: [[0.22, 0.24], [0.14, -0.14], [-0.1, 0.2]] },
  { x: 0.85, y: 0.3, r: 0.5, path: [[-0.2, -0.16], [0.18, -0.18], [-0.08, 0.12]] },
  { x: 0.55, y: 0.9, r: 0.55, path: [[0.16, -0.06], [-0.2, 0.2], [-0.2, -0.28]] },
  { x: 0.05, y: 0.95, r: 0.42, path: [[0.24, 0.18], [-0.1, 0.1], [0.1, 0.25]] },
] as const
/** A blob's falloff, offset to share of its centre's opacity: soft as a gaussian, no blur filter to repaint every frame. */
const FALLOFF: readonly [number, number][] = [[0, 1], [0.3, 0.78], [0.6, 0.32], [0.85, 0.07], [1, 0]]
/**
 * The specular band along its diagonal (GLASS.sheen px from the corner):
 * offset to share of GLASS.specular. Its peak is the corner itself, in the
 * padding; under the text it is already faint, so the blobs keep their colour.
 */
const SHEEN: readonly [number, number][] = [[0, 1], [0.1, 0.5], [0.3, 0.15], [1, 0]]

const r3 = (n: number) => Math.round(n * 1000) / 1000
const HEX = /^#[0-9a-f]{6}$/i
const SPLINE = '0.45 0 0.55 1'

const piecewise = (stops: readonly [number, number][], t: number): number => {
  const first = stops[0] as [number, number]
  const last = stops[stops.length - 1] as [number, number]
  if (t <= first[0]) return first[1]
  if (t >= last[0]) return last[1]
  const i = stops.findIndex(([at]) => at >= t)
  const [a, b] = [stops[i - 1] as [number, number], stops[i] as [number, number]]

  return a[1] + ((b[1] - a[1]) * (t - a[0])) / (b[0] - a[0])
}

/**
 * A blob's opacity relative to the others: a deep blue costs the text
 * little light, so it may show stronger than a pale periwinkle; each
 * blob then lends the glass about the same light, and the most colour.
 */
const weightOf = (hex: string): number => Math.round(Math.min(1.8, Math.max(0.6, Math.sqrt(0.2 / Math.max(0.01, luminance(hex))))) * 1000) / 1000

type Blob = { color: string; weight: number; cx: number; cy: number; r: number; path: [number, number][]; dur: number }
type Layout = { w: number; h: number; blobs: Blob[]; sheen: { x: number; y: number }; tint: string }

const layout = (width: number, height: number, palette: GlassPalette): Layout => {
  const w = Math.max(24, Math.round(width))
  const h = Math.max(24, Math.round(height))
  const colors = palette.blobs.filter(c => HEX.test(c))
  const list = colors.length > 0 ? colors : [...GLASS_PALETTE.blobs]
  // a blob's radius follows the bubble's larger side, but a tall reply keeps its blobs the size a wide one has
  const side = Math.min(Math.max(w, h), Math.max(w, 420) * 1.3)
  // a tall reply: the blobs spread over its first ~1.5 widths, the rest the frost's calm wash
  const reach = Math.min(h, Math.max(w * 1.5, 260))
  const count = Math.min(4, Math.max(3, list.length))
  const blobs = BLOBS.slice(0, count).map((b, i) => {
    const r = Math.round(side * b.r)

    return {
      color: list[i % list.length] as string,
      weight: weightOf(list[i % list.length] as string),
      cx: Math.round(b.x * w),
      cy: Math.round(b.y * reach),
      r,
      path: b.path.map(([dx, dy]) => [Math.round(dx * r), Math.round(dy * r)] as [number, number]),
      dur: GLASS.periods[i] ?? 33,
    }
  })

  return { w, h, blobs, sheen: { x: Math.min(w, GLASS.sheen.x), y: Math.min(h, GLASS.sheen.y) }, tint: HEX.test(palette.tint) ? palette.tint : GLASS_PALETTE.tint }
}

/** Every place a blob's centre passes: its drift is straight lines between its rest and three points (eased in time, not in space). */
const track = (b: Blob): [number, number][] => {
  const corners: [number, number][] = [[0, 0], ...b.path, [0, 0]]
  const out: [number, number][] = []
  for (let i = 0; i + 1 < corners.length; i++) {
    const [a, c] = [corners[i] as [number, number], corners[i + 1] as [number, number]]
    for (let k = 0; k < 8; k++) out.push([b.cx + a[0] + ((c[0] - a[0]) * k) / 8, b.cy + a[1] + ((c[1] - a[1]) * k) / 8])
  }

  return out
}

type Field = { blobs: { rgb: number[]; weight: number; lum: number }[]; points: { shares: number[]; sheen: number }[]; tint: number[] }

const rgbOf = (hex: string): number[] => {
  const n = Number.parseInt(hex.slice(1, 7), 16)

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hexOf = (rgb: number[]): string => `#${rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('').toUpperCase()}`

/**
 * What can lie under the text (inside the padding) at any moment of the
 * drift: points of a grid and of every blob's track, and at each how much
 * of each blob reaches it at its nearest pass (the blobs drift at unlike
 * periods, so they meet in every combination) and how much of the sheen.
 */
const fieldOf = (l: Layout): Field => {
  const { x: px, y: py } = GLASS.pad
  const [x0, y0, x1, y1] = [Math.min(px, l.w / 2), Math.min(py, l.h / 2), Math.max(l.w / 2, l.w - px), Math.max(l.h / 2, l.h - py)]
  const tracks = l.blobs.map(track)
  const spots: [number, number][] = []
  const cols = 32
  const rows = Math.min(64, Math.max(6, Math.round(((y1 - y0) / Math.max(1, x1 - x0)) * cols)))
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) spots.push([x0 + ((x1 - x0) * i) / cols, y0 + ((y1 - y0) * j) / rows])
  for (const t of tracks) for (const [x, y] of t) spots.push([Math.min(x1, Math.max(x0, x)), Math.min(y1, Math.max(y0, y))])
  const s2 = l.sheen.x * l.sheen.x + l.sheen.y * l.sheen.y
  const points = spots.map(([x, y]) => ({
    shares: l.blobs.map((b, i) => {
      let near = Infinity
      for (const [cx, cy] of tracks[i] as [number, number][]) near = Math.min(near, Math.hypot(x - cx, y - cy))

      return piecewise(FALLOFF, near / b.r)
    }),
    sheen: piecewise(SHEEN, (x * l.sheen.x + y * l.sheen.y) / s2),
  }))

  return { blobs: l.blobs.map(b => ({ rgb: rgbOf(b.color), weight: b.weight, lum: luminance(b.color) })), points, tint: rgbOf(l.tint) }
}

/**
 * The brightest colour of `field` with the blobs at `alpha`: each point
 * composited as the browser does (sRGB), the blobs brightest last (the
 * order that leaves the most light), then the frost, the grain at its
 * strongest and the sheen there.
 */
const peakOf = (field: Field, alpha: number, background: string): string => {
  const order = field.blobs.map((b, i) => ({ ...b, i })).sort((a, b) => a.lum - b.lum)
  const over = (c: number[], ink: number[], a: number) => c.map((v, k) => v + ((ink[k] as number) - v) * a)
  const white = [255, 255, 255]
  let best = rgbOf(background)
  let lum = -1
  for (const p of field.points) {
    let c = rgbOf(background)
    for (const b of order) c = over(c, b.rgb, Math.min(1, alpha * b.weight) * (p.shares[b.i] as number))
    c = over(c, field.tint, GLASS.frost)
    c = over(c, white, GLASS.grain)
    c = over(c, white, GLASS.specular * p.sheen)
    // sRGB channels are monotone in luminance: the 0.2126/0.7152/0.0722 weights of the linear values
    const v = c.reduce((sum, ch, k) => sum + ([0.2126, 0.7152, 0.0722][k] as number) * (ch / 255 <= 0.03928 ? ch / 255 / 12.92 : ((ch / 255 + 0.055) / 1.055) ** 2.4), 0)
    if (v > lum) {
      lum = v
      best = c
    }
  }

  return hexOf(best)
}

/** The strongest blob opacity, up to GLASS.blob, that keeps `text` at minContrast over the glass's brightest point. */
export const glassBlobAlpha = (width: number, height: number, palette: GlassPalette, background: string = GLASS.background, text: string = GLASS.text): number => {
  const key = [Math.round(width), Math.round(height), ...palette.blobs, palette.tint, background, text].join(',')
  const known = ALPHAS.get(key)
  if (known !== undefined) return known
  const alpha = searchAlpha(width, height, palette, background, text)
  if (ALPHAS.size >= 64) ALPHAS.delete(ALPHAS.keys().next().value as string)
  ALPHAS.set(key, alpha)

  return alpha
}

/** The last answers of glassBlobAlpha: a re-render at the same size costs nothing (a tall reply's search takes ~80 ms). */
const ALPHAS = new Map<string, number>()

const searchAlpha = (width: number, height: number, palette: GlassPalette, background: string, text: string): number => {
  const field = fieldOf(layout(width, height, palette))
  const ok = (a: number) => contrast(text, peakOf(field, a, background)) >= GLASS.minContrast
  if (ok(GLASS.blob)) return GLASS.blob
  if (!ok(0)) return 0
  let [lo, hi] = [0, GLASS.blob]
  for (let k = 0; k < 12; k++) {
    const mid = (lo + hi) / 2
    if (ok(mid)) lo = mid
    else hi = mid
  }

  return Math.floor(lo * 1000) / 1000
}

/** The brightest colour under the text of glassUnderlay(input). */
export const glassPeak = (input: GlassInput): string => {
  const background = input.background ?? GLASS.background

  return peakOf(fieldOf(layout(input.width, input.height, input.palette)), glassBlobAlpha(input.width, input.height, input.palette, background, input.text ?? GLASS.text), background)
}

/** A closed drift: rest, three points, rest again; eased, so the loop has no seam. */
const drift = (path: [number, number][], dur: number): string =>
  `<animateTransform attributeName="transform" type="translate" values="0 0;${path.map(([x, y]) => `${x} ${y}`).join(';')};0 0" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" keySplines="${SPLINE};${SPLINE};${SPLINE};${SPLINE}" dur="${dur}s" repeatCount="indefinite"/>`

/**
 * The glass underlay for Claude's bubble, `width` by `height` CSS px (an
 * Svg's props, drawn 1:1): blobs, frost, grain, the specular band and the
 * 1 px inner highlight, its corners rounded by `radius`. Still when
 * `motion` is false.
 */
export const glassUnderlay = (input: GlassInput): GlassDrawing => {
  const l = layout(input.width, input.height, input.palette)
  const { w, h } = l
  const background = input.background ?? GLASS.background
  const radius = Math.max(0, Math.min(input.radius ?? GLASS.radius, w / 2, h / 2))
  const alpha = glassBlobAlpha(w, h, input.palette, background, input.text ?? GLASS.text)

  let defs = `<clipPath id="gl-c"><rect width="${w}" height="${h}" rx="${radius}"/></clipPath>`
  let blobs = ''
  l.blobs.forEach((b, i) => {
    defs +=
      `<radialGradient id="gl-b${i}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${b.r}">` +
      FALLOFF.map(([at, share]) => `<stop offset="${at}" stop-color="${b.color}" stop-opacity="${r3(Math.min(1, alpha * b.weight) * share)}"/>`).join('') +
      `</radialGradient>`
    blobs += `<g transform="translate(${b.cx} ${b.cy})"><g>${input.motion ? drift(b.path, b.dur) : ''}<circle r="${b.r}" fill="url(#gl-b${i})"/></g></g>`
  })

  // the grain: fractal noise in a small stitched tile (white, its alpha from the noise), so a moving blob never makes it re-render the whole bubble
  const tile = 128
  defs +=
    `<filter id="gl-n" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -0.9"/><feComponentTransfer><feFuncA type="linear" slope="${GLASS.grain}"/></feComponentTransfer></filter>` +
    `<pattern id="gl-g" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse"><rect width="${tile}" height="${tile}" filter="url(#gl-n)"/></pattern>`
  // the specular band: a diagonal sheen from the top left corner, its peak in the padding
  defs +=
    `<linearGradient id="gl-s" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${l.sheen.x}" y2="${l.sheen.y}">` +
    SHEEN.map(([at, share]) => `<stop offset="${at}" stop-color="#FFFFFF" stop-opacity="${r3(GLASS.specular * share)}"/>`).join('') +
    `</linearGradient>`
  // the rim: bright where the light comes from (top left), dim where it leaves
  defs +=
    `<linearGradient id="gl-r" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${Math.min(w, 600)}" y2="${Math.min(h, 400)}">` +
    `<stop offset="0" stop-color="#FFFFFF" stop-opacity="${GLASS.rim.top}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="${GLASS.rim.bottom}"/></linearGradient>`

  const body =
    `<g clip-path="url(#gl-c)">` +
    blobs +
    `<rect width="${w}" height="${h}" fill="${l.tint}" fill-opacity="${GLASS.frost}"/>` +
    `<rect width="${w}" height="${h}" fill="url(#gl-g)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#gl-s)"/>` +
    `</g>` +
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r3(Math.max(0, radius - 0.5))}" fill="none" stroke="url(#gl-r)" stroke-width="1"/>`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`,
    width: w,
    height: h,
    blobAlpha: alpha,
  }
}

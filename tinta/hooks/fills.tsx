/**
 * Claude's reply bubble with a fill that keeps the text selection visible.
 *
 * A `backgroundColor` on the Box around our own Markdown hid the desktop's
 * selection highlight in the reply. Each `assistant.bubble.fillMode` paints
 * the same tint a different way, so the owner can try which keeps the
 * selection on his desktop:
 *
 * - `A` (parent): the fill on the outer bubble, the Markdown in an inner Box
 *   with no background of its own.
 * - `B` (alpha): the fill on the bubble as `#RRGGBBAA` (the accent at
 *   FILL_SHARE), so a highlight drawn under the text cells shows through;
 *   its rounded edge fully transparent (CLEAR), no line.
 * - `C` (underlay): in the flow, nothing placed: a row [filler][text]; the
 *   filler is REACH cells wide with as much negative right margin (it takes
 *   no room), stretched to the row's height, clipped by the bubble's
 *   `overflow: hidden`; the text Box comes after it, so it paints on top and
 *   takes the pointer. The text has no background anywhere.
 * - `D` (svg-underlay): as C, but the filler draws an Svg (a plain image, not
 *   interactive) in place of a background colour. An Svg's size is px or its
 *   markup's, never a stretch, so the filler is 0 rows tall and the Svg, as
 *   tall as SVG_TALL, overflows it and is clipped by the bubble.
 * - `E` (stack): an absolute filler spanning the bubble (all four offsets 0),
 *   then the text in a `position: relative` Box: both positioned, the later
 *   one paints above and takes the pointer (an absolute layer after or over
 *   the text is what broke the selection before).
 *
 * - `M` (mesh, experimental): D's structure with soft radial glows like the
 *   Tinta app's gallery cards (ThemeMiniature.swift): no base of its own (the
 *   app's dark background shows), four separate soft blobs in Claude's
 *   cool colours (meshColors, MESH: violet top right 42.5%, magenta lower
 *   left 27.5%, indigo lower centre-right 17.5%, a lavender highlight top
 *   left 17.5%), light at 60%. Sized generously (the reply's estimated rows x 1.5,
 *   the bubble's estimated width) and clipped by the bubble (`overflow:
 *   hidden`) inside a fully transparent round border, so
 *   the clip has rounded corners; the drawing starts MESH.lead cells left
 *   of the inner edge (clipped) so the mesh reaches the left edge too.
 *   The text after it, unfilled, with the bubble's padding.
 *
 * A, C, D and E use the same tint made opaque over the app's background; B
 * leaves it translucent. Without a mode the bubble is the plain one: a fill
 * only when the theme names one.
 *
 * `assistant.bubble.glow` wraps whichever bubble in GLOW_RINGS concentric
 * Boxes in the flow (nothing placed), each made only of a translucent fill
 * in the tint (#RRGGBBAA, 10%, 6%, 3% in all from the bubble outward) with
 * a fully transparent round border for its corners: soft tonal steps, no
 * line, and only translucent colours so the selection still shows. B's own
 * alpha is lowered over them so the bubble reads as before. `halo` pads each
 * ring evenly all round; `drop` only right and below, so the halo hangs
 * below and right of the bubble, lifted off the page. Opt-in and off in
 * every shipped theme; nothing pulls the rings outward (a negative margin
 * clipped the reply's first letters), so the text moves in by their width.
 */

import { APP_BACKGROUND, APP_TEXT, contrast, luminance, mix } from './theme'
import { GLASS, GLASS_PALETTE, glassUnderlay } from './fx-glass'
import type { GlassDrawing } from './fx-glass'
import { phaseLock, rainBackdrop } from './animazioni'
import type { FillMode, Glow } from './fillmode'

export { FILL_MODES, fillModeOf, glowOf } from './fillmode'
export type { FillMode, Glow } from './fillmode'

/** How much of the accent the fill carries over the app's background. */
export const FILL_SHARE = 0.14
const FILL_SHARE_DEFAULT = FILL_SHARE
/**
 * M's blobs, drawn in this order (the highlight last): where each blooms
 * (shares of the width and of the reply's height), its radius (share of the
 * bubble's width) and its strength in dark; light at `lightShare`. Each
 * fades fast (half at 45% of its radius) so the spots stay apart, a mesh
 * and not a ramp: indigo lower centre-right, magenta lower left (kept in
 * the estimated height, never floating off), violet top right, a small
 * lavender highlight top left.
 */
export const MESH = {
  glows: [
    { x: 0.65, y: 0.75, reach: 0.3, dark: 0.175 },
    { x: 0.12, y: 0.65, reach: 0.35, dark: 0.275 },
    { x: 0.85, y: 0, reach: 0.45, dark: 0.425 },
    { x: 0.12, y: 0.1, reach: 0.2, dark: 0.175 },
  ],
  lightShare: 0.6,
  /** The bubble's own translucent base under the blobs (as B): tinted and rounded to its end. */
  base: 0.09,
  overshoot: 2,
  /** Cells the drawing starts left of the bubble's inner edge, clipped: covers the border cell and the padding. */
  lead: 4,
} as const

/**
 * Tinta's own, in MESH.glows' order: Claude the cool half of the brand
 * (indigo, a magenta kept pink over the dark, violet, a lavender highlight);
 * the user has the warm half (amber to magenta).
 */
export const TINTA_MESH: readonly string[] = ['#4B3DFF', '#FF5CA8', '#8B3DFF', '#B79CFF']

/** `hex` with its hue turned `degrees` (saturation and lightness kept). */
export const turnHue = (hex: string, degrees: number): string => {
  const n = Number.parseInt(hex.slice(1, 7), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const h0 = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  const h = (((h0 * 60 + degrees) % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]

  return `#${[r1, g1, b1].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** Degrees from `hex`'s hue toward blue (240), the cool side: signed, the short way. */
const towardBlue = (hex: string): number => {
  const probe = turnHue(hex, 0)
  const n = Number.parseInt(probe.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const hue = (Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180) / Math.PI
  const delta = ((240 - hue + 540) % 360) - 180

  return Math.sign(delta) || 1
}

/**
 * M's four blob colours for Claude, in MESH.glows' order: Tinta's own cool
 * half; any other theme its assistant accent's neighbours toward blue (60
 * and 30 degrees), the accent itself and a lighter highlight of it, so
 * Claude's side stays apart from the user's warmer one.
 */
export const meshColors = (look: { id?: string; palette: { [key: string]: string } }, accent: string | undefined): string[] => {
  if (look.id === 'tinta') return [...TINTA_MESH]
  const tone = (accent !== undefined && HEX6.test(accent) ? accent : look.palette.accent ?? '#8B3DFF').toUpperCase()
  const way = towardBlue(tone)

  return [turnHue(tone, 60 * way), turnHue(tone, 30 * way), tone, mix(tone, '#FFFFFF', 0.4).toUpperCase()]
}

/**
 * A mesh's blobs (MESH.glows) inside the box `x`, `y`, `w` by `h` px, in
 * `colors` (MESH.glows' order), each at its dark strength times `scale`:
 * radial gradients ids `${id}-0`.. and the rects filling the box with them.
 */
export const meshPaint = (x: number, y: number, w: number, h: number, colors: readonly string[], scale: number, id: string): { defs: string; body: string } => {
  const parts = MESH.glows.map((g, i) => {
    const reach = Math.round(Math.max(h * 0.5, w * g.reach))
    const color = colors[i] ?? colors[0] ?? '#FFFFFF'
    const at = (n: number) => Math.round(n * scale * 1000) / 1000

    return {
      defs: `<radialGradient id="${id}-${i}" gradientUnits="userSpaceOnUse" cx="${Math.round(x + g.x * w)}" cy="${Math.round(y + Math.min(1, g.y) * h)}" r="${reach}"><stop offset="0" stop-color="${color}" stop-opacity="${at(g.dark)}"/><stop offset="0.45" stop-color="${color}" stop-opacity="${at(g.dark / 2)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
      body: `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}-${i})"/>`,
    }
  })

  return { defs: parts.map(p => p.defs).join(''), body: parts.map(p => p.body).join('') }
}

/**
 * An Svg's width and height props for a drawing `width` by `height` CSS px:
 * the desktop draws a mod's Svg at its props exactly (style width/height in
 * px, max-width 100%). The old 1.17 / 1.19 "draw scales" were the app's 1.2
 * zoom seen against px fitted on screenshots (glow.tsx DESKTOP_ZOOM).
 */
export const drawnProps = (width: number, height: number): { width: number; height: number } => ({
  width: Math.max(1, Math.round(width)),
  height: Math.max(1, Math.round(height)),
})

/** CSS px a vertical Box margin's 1 stands for on the desktop: half the 21 px line (glow.tsx GLOW_MARGIN_PX). */
export const MARGIN_UNIT_PX = 10.5

/** Rows a reply takes in a bubble `cells` wide, roughly: each line wrapped, the padding not counted. */
export const replyRows = (text: string, cells: number): number =>
  text.split('\n').reduce((rows, line) => rows + Math.max(1, Math.ceil(line.length / Math.max(10, cells))), 0)

/**
 * M's Svg, `width` by `height` px: no base, the glows as radial gradients
 * (colour at its opacity to clear), placed as shares of the width and of
 * `seen` px (the reply's estimated height, the rest overshoot), the top
 * corners rounded by a clip.
 */
export const meshDrawing = (width: number, seen: number, height: number, colors: readonly string[], mode: 'dark' | 'light', lead = 0, strength = 1, extras: { highlight?: string; sparkle?: string; candy?: { from: string; to: string; alpha: number }; backdrop?: { kind: 'rain' | 'glass'; colors: readonly string[]; alpha: number; motion: boolean; now: number } } = {}): string => {
  // the drawing `lead` px wider on the left (clipped by the bubble): the blobs placed on the bubble's own width
  const w = Math.round(Math.min(SVG_WIDE - lead, Math.max(40, width)))
  const full = w + lead
  const h = Math.round(Math.min(SVG_TALL, Math.max(40, height)))
  // styleHints.assistant.bubble.meshStrength scales every blob (the palette's highest that keeps the text at 7:1)
  const peak = (dark: number) => Math.round((mode === 'dark' ? dark : dark * MESH.lightShare) * strength * 1000) / 1000
  // a candy interior (Unicorno): one soft diagonal gradient in the reply's colour, brighter top left, no blobs
  if (extras.candy) {
    const c = extras.candy
    const twinkle = (x: number, y: number, r: number, ink: string, dur: number, lag: number) =>
      `<path d="M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z" fill="${ink}"><animate attributeName="opacity" values="0;1;0" dur="${dur}s" begin="${-lag}s" repeatCount="indefinite"/></path>`
    // the lower pair a little down the left, where any reply reaches (the layout no longer knows where it ends)
    const bottom = 46
    const stars = extras.sparkle
      ? twinkle(lead + w - 14, 9, 4.5, '#FFFFFF', 2.6, 0) + twinkle(lead + w - 30, 6, 2.6, extras.sparkle, 3.2, 1) + twinkle(lead + 12, bottom, 3.5, '#FFFFFF', 3, 0.6) + twinkle(lead + 26, bottom + 3, 2.2, extras.sparkle, 3.6, 1.8)
      : ''

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${full}" height="${h}" viewBox="0 0 ${full} ${h}">` +
      `<defs><linearGradient id="candy" gradientUnits="userSpaceOnUse" x1="${lead}" y1="0" x2="${lead + w}" y2="${Math.min(h, seen)}"><stop offset="0" stop-color="${c.from}" stop-opacity="${c.alpha}"/><stop offset="1" stop-color="${c.to}" stop-opacity="${Math.round(c.alpha * 0.7 * 1000) / 1000}"/></linearGradient></defs>` +
      `<rect width="${full}" height="${h}" fill="url(#candy)"/>${stars}</svg>`
    )
  }
  // the blobs laid out on `seen` px and, down a drawing taller than that, again every `seen` px, each band mirrored
  // and its colours turned one step: whatever height the bubble clips it at, the mesh runs to its end
  const bands = Math.max(1, Math.ceil(h / Math.max(40, seen)))
  const glows = Array.from({ length: bands }, (_, k) => k).flatMap(k =>
    MESH.glows.map((g, j) => {
      const i = k * MESH.glows.length + j
      const ink = colors[(j + k) % Math.max(1, colors.length)] ?? colors[0]
      // relative to the bubble's size: a share of its width, never under its height's half
      const reach = Math.round(Math.max(seen * 0.5, w * g.reach))
      const x = k % 2 === 0 ? g.x : 1 - g.x

      return {
        defs: `<radialGradient id="mesh-${i}" gradientUnits="userSpaceOnUse" cx="${Math.round(lead + x * w)}" cy="${Math.round(BAND_Y[j] * seen + k * seen)}" r="${reach}"><stop offset="0" stop-color="${ink}" stop-opacity="${peak(g.dark)}"/><stop offset="0.45" stop-color="${ink}" stop-opacity="${peak(g.dark / 2)}"/><stop offset="1" stop-color="${ink}" stop-opacity="0"/></radialGradient>`,
        body: `<rect y="${Math.max(0, Math.round(BAND_Y[j] * seen + k * seen - reach))}" width="${full}" height="${Math.min(h, 2 * reach)}" fill="url(#mesh-${i})"/>`,
      }
    }),
  )

  // a decorative palette's light (Unicorno): a bright band along the top padding, tiny stars in the corners
  const band = extras.highlight
    ? `<linearGradient id="mesh-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${extras.highlight}" stop-opacity="0.55"/><stop offset="1" stop-color="${extras.highlight}" stop-opacity="0"/></linearGradient>`
    : ''
  const star = (x: number, y: number, r: number, dur: number) =>
    `<path d="M${x} ${y - r}L${x + r * 0.25} ${y - r * 0.25}L${x + r} ${y}L${x + r * 0.25} ${y + r * 0.25}L${x} ${y + r}L${x - r * 0.25} ${y + r * 0.25}L${x - r} ${y}L${x - r * 0.25} ${y - r * 0.25}Z" fill="${extras.sparkle}" opacity="0.9"><animate attributeName="opacity" values="0;0.95;0" dur="${dur}s" repeatCount="indefinite"/></path>`
  const stars = extras.sparkle ? star(lead + w - 12, 8, 4, 2.6) + star(lead + w - 26, 5, 2.5, 3.4) + star(lead + 10, Math.min(h, seen) - 8, 3, 3) : ''

  // the glass (Vetro): a light blue-white frost over the shading and a sheen from the top left corner
  const frost = extras.backdrop?.kind === 'glass'
    ? `<rect width="${full}" height="${h}" fill="${GLASS_PALETTE.tint}" fill-opacity="${GLASS_FROST}"/><rect x="${lead}" width="${w}" height="${Math.min(h, 260)}" fill="url(#mesh-sheen)"/>`
    : ''
  const sheen = extras.backdrop?.kind === 'glass'
    ? `<linearGradient id="mesh-sheen" gradientUnits="userSpaceOnUse" x1="${lead}" y1="0" x2="${lead + 220}" y2="150"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.1"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`
    : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${full}" height="${h}" viewBox="0 0 ${full} ${h}">` +
    `<defs>${glows.map(g => g.defs).join('')}${band}${sheen}</defs>` +
    glows.map(g => g.body).join('') +
    frost +
    (band ? `<rect x="0" y="0" width="${full}" height="14" fill="url(#mesh-top)"/>` : '') +
    (extras.backdrop?.kind === 'rain' ? rainBackdrop(lead, w, h, extras.backdrop.colors, extras.backdrop.alpha, extras.backdrop.motion, extras.backdrop.now) : '') +
    stars +
    `</svg>`
  )
}

/**
 * meshDrawing, the same source string for the same bubble: the desktop draws
 * an Svg as an image, and a new source reloads it, which restarts every
 * animation; so a re-render with the same geometry (a hover, a new word
 * elsewhere, a timer) keeps the drawing made the first time, and only a real
 * change (the bubble grew) makes a new one, its phases from the clock then.
 */
const MESH_SEEN = new Map<string, string>()
export const steadyMesh = (...args: Parameters<typeof meshDrawing>): string => {
  const [width, seen, height, colors, mode, lead, strength, extras = {}] = args
  const { now: _now, ...backdrop } = extras.backdrop ?? { now: 0 }
  const key = JSON.stringify([width, seen, height, colors, mode, lead, strength, { ...extras, backdrop }])
  const kept = MESH_SEEN.get(key)
  if (kept !== undefined) return kept
  const made = meshDrawing(...args)
  if (MESH_SEEN.size > 200) MESH_SEEN.delete(MESH_SEEN.keys().next().value as string)
  MESH_SEEN.set(key, made)

  return made
}

/** The glass frost's opacity over Vetro's shading. */
export const GLASS_FROST = 0.05
/** The glass's floor: the owner wants it evident, the app's text held at 4.5:1 (AA) over it. */
export const GLASS_FLOOR = 4.5

/**
 * Vetro's glass, more evident than fx-glass.ts's 7:1: its blobs scaled up to
 * the opacity at which the app's text keeps GLASS_FLOOR over the brightest
 * blob (its weight as fx-glass gives it, two blobs overlapping), the frost
 * on top; the same source for the same size.
 */
export const evidentGlass = (width: number, height: number, motion: boolean): GlassDrawing => {
  const base = glassUnderlay({ width, height, palette: GLASS_PALETTE, motion })
  const weight = (hex: string) => Math.min(1.8, Math.max(0.6, Math.sqrt(0.2 / Math.max(0.01, luminance(hex)))))
  const holds = (a: number) =>
    GLASS_PALETTE.blobs.every(hex => contrast(APP_TEXT.dark, mix(mix(APP_BACKGROUND.dark, hex, Math.min(1, a * weight(hex) * 1.3)), GLASS_PALETTE.tint, GLASS.frost)) >= GLASS_FLOOR)
  let target = 0
  for (let a = 0.6; a > 0; a -= 0.01) {
    if (holds(a)) {
      target = Math.round(a * 100) / 100
      break
    }
  }
  if (base.blobAlpha <= 0 || target <= base.blobAlpha) return base
  const scale = target / base.blobAlpha
  // every blob gradient's stops, scaled (the frost, grain, sheen and rim unchanged)
  const source = base.source.replace(/<radialGradient id="gl-b\d+"[^>]*>(.*?)<\/radialGradient>/g, gradient =>
    gradient.replace(/stop-opacity="([\d.]+)"/g, (_, value: string) => `stop-opacity="${Math.min(1, Math.round(Number(value) * scale * 1000) / 1000)}"`),
  )

  return { ...base, source, blobAlpha: target }
}

/** Cells the underlay is wide (C, D): wider than any bubble, clipped by it. */
export const FILL_REACH = 400
/** px the Svg underlay (D) is wide and tall, the most an Svg may be: clipped by the bubble; a reply taller than 4096 px (about 186 rows) is filled only that far. */
export const SVG_WIDE = 4096
export const SVG_TALL = 4096
/** The height Claude's bubble underlay lays its blobs and stars out on, whatever the reply's: a short reply's. */
export const MESH_LAYOUT_PX = 420
/** Where each of MESH.glows sits down a band of the underlay: all four within reach of a one-line reply's top. */
const BAND_Y = [0.62, 0.12, 0, 0.88] as const

/** A fully transparent colour: B's edge, rounded corners and no line. */
export const CLEAR = '#00000000'

/**
 * The glow's rings, from the bubble outward: how much of the tint shows
 * there in all (0-1), the rings' fills laid one over the other. Strongest
 * next to the bubble, fading outward: soft tonal steps, no line.
 */
export const GLOW_RINGS: readonly { total: number }[] = [{ total: 0.1 }, { total: 0.06 }, { total: 0.03 }]

/** `share` (0-1) as the two hex digits of a #RRGGBBAA alpha. */
const alphaHex = (share: number): string => Math.round(Math.min(1, Math.max(0, share)) * 255).toString(16).padStart(2, '0').toUpperCase()

/** The alpha to lay over `under` (0-1 already shown) so `total` shows in all. */
export const alphaOver = (under: number, total: number): number => (total <= under ? 0 : 1 - (1 - total) / (1 - under))

/** Each ring's padding inside its (transparent) border: `halo` even all round, `drop` only right and below. */
export const glowPad = (glow: Glow): { paddingLeft: number; paddingRight: number; paddingTop: number; paddingBottom: number } =>
  glow === 'halo' ? { paddingLeft: 0.5, paddingRight: 0.5, paddingTop: 0.25, paddingBottom: 0.25 } : { paddingLeft: 0, paddingRight: 1, paddingTop: 0, paddingBottom: 0.5 }

/** Cells the glow is thick on the left and on the right (each ring's border cell and padding). */
export const glowThickness = (glow: Glow): { left: number; right: number } => ({
  left: GLOW_RINGS.length * (1 + glowPad(glow).paddingLeft),
  right: GLOW_RINGS.length * (1 + glowPad(glow).paddingRight),
})

/** Cells the glow takes from the reply's width, both sides (no negative margin: one clipped the reply's first letters). */
export const glowWidth = (glow: Glow | undefined): number => (glow === undefined ? 0 : glowThickness(glow).left + glowThickness(glow).right)

/**
 * The rings' colours, from the bubble outward, in `tint` (#RRGGBB): the
 * border always CLEAR (round corners, no line), the fill #RRGGBBAA, each
 * ring's alpha what it adds over the rings outside it.
 */
export const glowColors = (tint: string): { border: string; background: string }[] =>
  GLOW_RINGS.map((ring, i) => ({ border: CLEAR, background: `${tint.toUpperCase()}${alphaHex(alphaOver(GLOW_RINGS[i + 1]?.total ?? 0, ring.total))}` }))

const HEX6 = /^#[0-9a-f]{6}$/i
const HEX8 = /^#[0-9a-f]{8}$/i

/**
 * The bubble's two fills: `alpha`, the colour at FILL_SHARE as `#RRGGBBAA`
 * (B), and `solid`, the same seen over the app's background (A, C, D, E).
 * The theme's `fill` wins when it names one (a `#RRGGBBAA` one is used as
 * given for B and composed for the rest); else the accent; else a grey.
 */
export const fillsFor = (fill: string | undefined, accent: string | undefined, mode: 'dark' | 'light', share = FILL_SHARE): { solid: string; alpha: string } => {
  const FILL_SHARE = share
  const ground = APP_BACKGROUND[mode]
  // an explicit share (styleHints.assistant.bubble.fillAlpha) wins over a fill's own alpha
  if (fill !== undefined && HEX8.test(fill) && share !== FILL_SHARE_DEFAULT) return fillsFor(fill.slice(0, 7), accent, mode, share)
  if (fill !== undefined && HEX8.test(fill)) {
    const share = Number.parseInt(fill.slice(7, 9), 16) / 255

    return { alpha: fill.toUpperCase(), solid: mix(ground, fill.slice(0, 7), share) }
  }
  if (fill !== undefined && HEX6.test(fill)) {
    return { alpha: `${fill.toUpperCase()}${Math.round(FILL_SHARE * 255).toString(16).padStart(2, '0').toUpperCase()}`, solid: fill.toUpperCase() }
  }
  const tint = accent !== undefined && HEX6.test(accent) ? accent.toUpperCase() : mode === 'dark' ? '#FFFFFF' : '#000000'

  return { alpha: `${tint}${Math.round(FILL_SHARE * 255).toString(16).padStart(2, '0').toUpperCase()}`, solid: mix(ground, tint, FILL_SHARE) }
}

/** An Svg of one rectangle in `color`, SVG_WIDE by SVG_TALL px. */
export const fillDrawing = (color: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDE}" height="${SVG_TALL}" viewBox="0 0 ${SVG_WIDE} ${SVG_TALL}"><rect width="${SVG_WIDE}" height="${SVG_TALL}" fill="${color}"/></svg>`

export type BubbleSpec = {
  mode?: FillMode
  /** The theme's own fill (plain bubble), already checked for contrast. */
  fill?: string
  fills: { solid: string; alpha: string }
  border: string
  paddingX: number
  paddingY: number
  /** M: the bubble's width in cells, estimated from the viewport (the Svg's width; any excess clipped). */
  cells?: number
  /** M: the reply's text, for its estimated height. */
  text?: string
  /** M: the two glow colours (meshColors) and the appearance drawn. */
  mesh?: { now?: number; colors: readonly string[]; mode: 'dark' | 'light'; strength?: number; baseAlpha?: number; highlight?: string; sparkle?: string; candy?: { from: string; to: string; alpha: number }; backdrop?: { kind: 'rain' | 'glass'; colors: readonly string[]; alpha: number; motion: boolean; now: number } }
  /** A faint halo of rings around the bubble; none when absent. */
  glow?: Glow
  /** A soft blurred gradient glow behind the bubble (an Svg before it, the bubble pulled up over it). */
  halo?: boolean
  /** "drop": a coloured drop shadow behind the bubble, the halo's machinery offset down. */
  shadow?: 'soft' | 'drop'
  /** The assistant's accent (#RRGGBB), for the drop shadow's colour. */
  accent?: string
  /** styleHints: no fill at all (the edge alone). */
  noFill?: boolean
  /** styleHints: a visible edge, #RRGGBBAA (only where the theme draws lines). */
  edge?: string
}

/**
 * Claude's reply bubble around `children` (our own Markdown and tables), in
 * the way `spec.mode` paints its fill. The outer Box is always keyed
 * `tinta-bubble`; the Box holding the text, `tinta-bubble-text`, never has a
 * background in A, C, D and E; the filler is `tinta-bubble-fill`.
 */
export const bubbleArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { Box: any; Svg?: any },
  spec: BubbleSpec,
  children: unknown,
): unknown => {
  const bubble = bubbleRings(els, spec, children)
  if (els.Svg === undefined) return bubble
  // the drop shadow wins over the halo when both are asked
  if (spec.shadow === 'drop') return dropArt(els, spec, bubble)
  if (spec.halo !== true) return bubble

  return haloArt(els, spec, bubble)
}

/**
 * The drop shadow (`shadow: "drop"`): a strip DROP.height px tall whose
 * height is known (not the bubble's, which is only estimated), right after
 * the bubble in the flow, with a negative bottom margin as tall as it: no
 * height added. In it a rounded shape, the bubble's width inset DROP.inset a
 * side, its top far above the strip (hidden) and its bottom DROP.offset
 * below the bubble's edge, blurred, so only a soft shadow under the bubble's
 * lower edge shows, fading to nothing inside the strip.
 */
const dropArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { Box: any; Svg?: any },
  spec: BubbleSpec,
  bubble: unknown,
): unknown => {
  const { Box, Svg } = els
  const art = dropDrawing(spec)

  return (
    <Box key="tinta-bubble-drop" flexDirection="column">
      {bubble}
      <Box key="tinta-bubble-drop-art" flexDirection="row" flexShrink={0} marginBottom={-dropUnits(art.height)}>
        <Svg source={art.source} alt="ombra" {...drawnProps(art.width, art.height)} />
      </Box>
    </Box>
  )
}

/** px as Box margin units (MARGIN_UNIT_PX), to the hundredth. */
export const dropUnits = (px: number): number => Math.round((px / MARGIN_UNIT_PX) * 100) / 100

/** The drop shadow: the strip's height, the side inset, how far below the bubble the shape ends (px), blur, opacity, how much accent in the near-black. */
export const DROP = { height: 32, inset: 12, offset: 10, blur: 6, opacity: 0.6, accent: 0.25 } as const

/**
 * The strip's Svg: the bubble's estimated width by DROP.height; the shape
 * from 60 px above the strip (hidden) down to DROP.offset into it, blurred:
 * darkest right under the bubble's edge, nothing by the strip's foot.
 * Near-black with DROP.accent of the accent.
 */
export const dropDrawing = (spec: BubbleSpec): { source: string; width: number; height: number } => {
  const width = Math.round(Math.min(SVG_WIDE, bubbleSize(spec).width))
  const height = DROP.height
  const tone = spec.accent !== undefined && HEX6.test(spec.accent) ? spec.accent : spec.fills.alpha.slice(0, 7)
  const color = mix('#000000', tone, DROP.accent).toUpperCase()
  const w = Math.max(10, width - 2 * DROP.inset)
  const top = -60

  return {
    width,
    height,
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<defs><filter id="ombra-giu" filterUnits="userSpaceOnUse" x="0" y="${top}" width="${width}" height="${height - top}"><feGaussianBlur stdDeviation="${DROP.blur}"/></filter></defs>` +
      `<rect x="${DROP.inset}" y="${top}" width="${w}" height="${DROP.offset - top}" rx="16" fill="${color}" opacity="${DROP.opacity}" filter="url(#ombra-giu)"/>` +
      `</svg>`,
  }
}

/**
 * The halo behind the bubble (`assistant.bubble.halo`), adding no height:
 * in the flow first a Box exactly as tall as the halo's Svg (in rows, with
 * overflow hidden, as the user's glow), pulled up by the room the halo
 * takes above the bubble; then the bubble, pulled up by the rest of that
 * height, so its top lies HALO.overshoot (and the fade) below the halo's
 * and the margins sum to nothing (haloLayout). The halo paints first, the
 * bubble over it: never over the text.
 */
const haloArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { Box: any; Svg?: any },
  spec: BubbleSpec,
  bubble: unknown,
): unknown => {
  const { Box, Svg } = els
  const art = haloDrawing(spec)
  const layout = haloLayout(art)

  return (
    <Box key="tinta-bubble-halo" flexDirection="column">
      <Box key="tinta-bubble-halo-art" flexDirection="row" height={layout.height} marginTop={layout.artTop} overflow="hidden" flexShrink={0}>
        <Svg source={art.source} alt="alone" {...drawnProps(art.width, art.height)} />
      </Box>
      <Box key="tinta-bubble-lifted" flexDirection="column" marginTop={layout.bubbleTop}>
        {bubble}
      </Box>
    </Box>
  )
}

/** px as Box units, to the hundredth: a height counts whole lines (ROW_PX), a margin half lines (MARGIN_UNIT_PX). */
const rowsOf = (px: number): number => Math.round((px / ROW_PX) * 100) / 100
const marginsOf = (px: number): number => Math.round((px / MARGIN_UNIT_PX) * 100) / 100

/**
 * The halo's layout: the art Box `height` tall (lines), pulled up `artTop`
 * (margin units: the room above the bubble), the bubble pulled up
 * `bubbleTop` (the rest), so in px they sum to 0: the halo adds no height.
 */
export const haloLayout = (art: { height: number; top: number }): { height: number; artTop: number; bubbleTop: number } => {
  const height = rowsOf(art.height)
  const above = marginsOf(art.top)

  return { height, artTop: above === 0 ? 0 : -above, bubbleTop: Math.round((above - (height * ROW_PX) / MARGIN_UNIT_PX) * 100) / 100 }
}

/** The halo's look: opacity, blur (stdDeviation, px), overshoot past the bubble above and below (px), side inset (px), Tinta's gradient. */
export const HALO = { opacity: 0.55, blur: 10, overshoot: 10, inset: 15, colors: ['#8B3DFF', '#4B3DFF', '#E8317A'] } as const

/** The bubble's estimated size in px: its width from the viewport, its height from the text's rows, padding and border. */
export const bubbleSize = (spec: BubbleSpec): { width: number; height: number } => {
  const cells = Math.max(10, spec.cells ?? 80)

  return { width: cells * CELL_PX, height: replyRows(spec.text ?? '', cells - 2 * spec.paddingX - 2) * ROW_PX + (2 * spec.paddingY + 2) * MARGIN_UNIT_PX }
}

/**
 * The halo's Svg: the bubble's estimated width (the row's); its estimated
 * height plus HALO.overshoot above and below plus two blurs of fade each
 * way (the blur under 3% there). The shape: HALO.overshoot taller than the
 * bubble above and below, inset HALO.inset at the sides so its blur fades
 * inside the row. `top` is where the bubble's top lies in it.
 */
export const haloDrawing = (spec: BubbleSpec): { source: string; width: number; height: number; top: number; bubble: number } => {
  const size = bubbleSize(spec)
  const fade = 2 * HALO.blur
  const o = HALO.overshoot
  const width = Math.round(Math.min(SVG_WIDE, size.width))
  const bubble = Math.round(size.height)
  const height = Math.round(Math.min(SVG_TALL, bubble + 2 * o + 2 * fade))
  const colors = spec.mesh === undefined || spec.mesh.colors.join() === TINTA_MESH.join() ? HALO.colors : [spec.mesh.colors[2] ?? spec.mesh.colors[0], spec.mesh.colors[0], spec.mesh.colors[1] ?? spec.mesh.colors[0]]
  const stops = colors.map((c, i) => `<stop offset="${i / (colors.length - 1)}" stop-color="${c}"/>`).join('')
  const w = Math.max(10, width - 2 * HALO.inset)
  const h = Math.max(10, height - 2 * fade)

  return {
    width,
    height,
    top: fade + o,
    bubble,
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<defs><linearGradient id="alone-fill" gradientUnits="userSpaceOnUse" x1="${HALO.inset}" y1="${fade}" x2="${HALO.inset + w}" y2="${fade + h}">${stops}</linearGradient>` +
      `<filter id="alone" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><feGaussianBlur stdDeviation="${HALO.blur}"/></filter></defs>` +
      `<rect x="${HALO.inset}" y="${fade}" width="${w}" height="${h}" rx="${Math.round(Math.min(16 + o, h / 2))}" fill="url(#alone-fill)" opacity="${HALO.opacity}" filter="url(#alone)"/>` +
      `</svg>`,
  }
}

/** The bubble with its rings (`glow`), or the bubble alone. */
const bubbleRings = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { Box: any; Svg?: any },
  spec: BubbleSpec,
  children: unknown,
): unknown => {
  if (spec.glow === undefined) return bubbleCore(els, spec, children)
  const { Box } = els
  const glow = spec.glow
  // the tint the fill is in (the accent, or the theme's fill), its alpha dropped
  const tint = spec.fills.alpha.slice(0, 7)
  const rings = glowColors(tint)
  // B over the rings: its alpha lowered so the bubble shows as before (its share in all), not darker
  const share = Number.parseInt(spec.fills.alpha.slice(7, 9), 16) / 255
  const fills = { ...spec.fills, alpha: `${tint.toUpperCase()}${alphaHex(alphaOver(GLOW_RINGS[0]?.total ?? 0, share))}` }
  const core = bubbleCore(els, { ...spec, fills }, children)

  // innermost ring first, each wrapping the one before: keys tinta-bubble-glow-0 (next to the bubble) outward
  return rings.reduce<unknown>(
    (inner, ring, i) => (
      <Box
        key={`tinta-bubble-glow-${i}`}
        flexDirection="column"
        borderStyle="round"
        borderColor={ring.border}
        backgroundColor={ring.background}
        {...glowPad(glow)}
      >
        {inner}
      </Box>
    ),
    core,
  )
}

const bubbleCore = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { Box: any; Svg?: any },
  spec: BubbleSpec,
  children: unknown,
): unknown => {
  const { Box, Svg } = els
  // no visible edge (the owner's call): a filled bubble keeps rounded corners
  // with its edge in its own fill; the plain bubble has none at all
  const edge = (color: string) => ({ borderStyle: 'round', borderColor: spec.edge ?? color })
  const pad = { paddingX: spec.paddingX, paddingY: spec.paddingY }
  const mode = spec.mode === 'D' && Svg === undefined ? 'C' : spec.mode
  // styleHints: no fill, the edge alone (Outline)
  if (spec.noFill) {
    return (
      <Box key="tinta-bubble" flexDirection="column" {...(spec.edge ? edge(spec.edge) : {})} {...pad}>
        {children}
      </Box>
    )
  }

  switch (mode) {
    case 'A':
      return (
        <Box key="tinta-bubble" flexDirection="column" backgroundColor={spec.fills.solid} {...edge(spec.fills.solid)} {...pad}>
          <Box key="tinta-bubble-text" flexDirection="column">
            {children}
          </Box>
        </Box>
      )
    case 'B':
      return (
        // the corners rounded, the edge fully transparent: in the translucent fill it painted twice and showed as a line
        <Box key="tinta-bubble" flexDirection="column" backgroundColor={spec.fills.alpha} {...edge(CLEAR)} {...pad}>
          <Box key="tinta-bubble-text" flexDirection="column">
            {children}
          </Box>
        </Box>
      )
    case 'M': {
      if (Svg === undefined) return bubbleCore(els, { ...spec, mode: 'B' }, children)
      const cells = Math.max(10, spec.cells ?? 80)
      // the same drawing for every reply and every streamed chunk (a new source reloads the image and restarts its
      // animations): laid out from the top left on a fixed height (MESH_LAYOUT_PX), as tall as an Svg may be, the
      // bubble clipping it wherever it ends; only the window's width changes it
      const seen = MESH_LAYOUT_PX
      const lead = MESH.lead
      // as tall as the reply may grow (its estimate and half again, in steps of a band), not the most an Svg may be:
      // the desktop makes the <img> again on every update while a reply streams, and a 4096 px drawing decoded that
      // often dropped a quarter of the frames (scenes/../frames/stream.mjs); the bubble's own base fill runs to its
      // end below it in any case
      const rows = replyRows(spec.text ?? '', cells - 2 * spec.paddingX - 2) + 2 * spec.paddingY + 2
      const tall = Math.min(SVG_TALL, Math.ceil((rows * ROW_PX * 1.5 + MESH_LAYOUT_PX) / MESH_LAYOUT_PX) * MESH_LAYOUT_PX)
      // Vetro's glass (fx-glass.ts): like the mesh, one drawing as tall as an Svg may be whatever the reply (its blobs
      // in the first widths, the frost and grain to the end), so it covers the whole bubble and never reloads
      // Vetro's glass is its mesh (deep blues and cyans) under a light frost and a sheen, drawn by meshDrawing
      const glass = undefined as GlassDrawing | undefined
      // the drawing the same for every reply (cached), its animations locked to the clock at this render
      const drawing = phaseLock(glass?.source ?? steadyMesh(cells * CELL_PX, seen, tall, spec.mesh?.colors ?? TINTA_MESH, spec.mesh?.mode ?? 'dark', Math.round(lead * CELL_PX), spec.mesh?.strength, { highlight: spec.mesh?.highlight, sparkle: spec.mesh?.sparkle, candy: spec.mesh?.candy, backdrop: spec.mesh?.backdrop }), spec.mesh?.now ?? 0)

      return (
        // round corners: a fully transparent round border, the clip follows its radius; the filler only as
        // wide as the bubble (no 400-cell row reaching past its edges), the Svg from x 0; the bubble's own
        // translucent base (as B) so it is tinted and rounded to its end whatever the Svg's height
        <Box key="tinta-bubble" flexDirection="row" alignItems="stretch" overflow="hidden" backgroundColor={spec.mesh?.candy ? `${spec.mesh.candy.to}${alphaHex(Math.round(spec.mesh.candy.alpha * 0.7 * 1000) / 1000)}` : `${spec.fills.alpha.slice(0, 7)}${alphaHex(spec.mesh?.baseAlpha ?? MESH.base)}`} {...edge(CLEAR)}>
          {/* the filler reaches MESH.lead cells left of the bubble's inner edge (the border cell and the text's
              padding, where a strip went without mesh), clipped there; its margins sum to 0, the text unmoved */}
          <Box key="tinta-bubble-fill" width={cells + lead} marginLeft={-lead} marginRight={-cells} height={0} flexShrink={0}>
            <Svg source={drawing} alt="fondo del fumetto" {...(glass ? drawnProps(glass.width, glass.height) : drawnProps(Math.round(Math.min(SVG_WIDE, Math.max(40, cells * CELL_PX)) + lead * CELL_PX), Math.round(Math.max(40, tall))))} />
          </Box>
          <Box key="tinta-bubble-text" flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} {...pad}>
            {children}
          </Box>
        </Box>
      )
    }
    case 'C':
    case 'D':
      return (
        <Box key="tinta-bubble" flexDirection="row" alignItems="stretch" overflow="hidden" {...edge(spec.fills.solid)}>
          {mode === 'C' ? (
            <Box key="tinta-bubble-fill" width={FILL_REACH} marginRight={-FILL_REACH} flexShrink={0} backgroundColor={spec.fills.solid} />
          ) : (
            <Box key="tinta-bubble-fill" width={FILL_REACH} marginRight={-FILL_REACH} height={0} flexShrink={0}>
              <Svg source={fillDrawing(spec.fills.solid)} alt="fondo del fumetto" width={SVG_WIDE} height={SVG_TALL} />
            </Box>
          )}
          <Box key="tinta-bubble-text" flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} {...pad}>
            {children}
          </Box>
        </Box>
      )
    case 'E':
      return (
        <Box key="tinta-bubble" flexDirection="column" {...edge(spec.fills.solid)}>
          <Box key="tinta-bubble-fill" position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor={spec.fills.solid} />
          <Box key="tinta-bubble-text" position="relative" flexDirection="column" {...pad}>
            {children}
          </Box>
        </Box>
      )
    default:
      // the plain bubble: no edge (unless styleHints give one), no fill unless the theme names one; the padding kept
      return (
        <Box key="tinta-bubble" flexDirection="column" {...(spec.fill ? { backgroundColor: spec.fill } : {})} {...(spec.edge ? edge(spec.edge) : {})} {...pad}>
          {children}
        </Box>
      )
  }
}

/** CSS px of a desktop cell (1ch of Anthropic Sans at 15 px) and of a text row (its 21 px line). */
export const CELL_PX = 0.605 * 15
export const ROW_PX = 21
/**
 * The soft shadow under a bubble, a CSS `box-shadow: 0 10px 30px` feel in
 * two layers: `tight` close and stronger, `wide` soft and far. Each layer:
 * the tint's opacity, its blur (stdDeviation, px), how far its bottom edge
 * reaches below the drawing's top (px) and its inset a side (px; the wide
 * layer's larger so its blur fades out inside the drawing, no cut at the
 * sides). `height` (px) lets the wide blur fade to nothing above the
 * bottom edge; `rows` the Box it sits in; `tuck` 0: no overlap with the
 * bubble, its rounded corners intact.
 */
export const SHADOW = {
  tight: { opacity: 0.55, blur: 5, reach: 2, inset: 10 },
  wide: { opacity: 0.35, blur: 14, reach: 8, inset: 32 },
  height: 38,
  rows: 1.75,
  tuck: 0,
} as const

/**
 * A coloured drop shadow cast below a card, `width` px wide: two rounded
 * bars in `tint`, each blurred, their tops well above the drawing (y
 * negative) so they seem to come out from under the card and only the
 * blur's lower part shows, fading to nothing before the bottom edge.
 */
export const shadowDrawing = (tint: string, width: number): { source: string; width: number; height: number } => {
  const w = Math.max(2 * SHADOW.wide.inset + 40, Math.round(width))
  const h = SHADOW.height
  const top = -40
  const layer = (id: string, l: { opacity: number; blur: number; reach: number; inset: number }) =>
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="-100" y="-100" width="${w + 200}" height="${h + 200}"><feGaussianBlur stdDeviation="${l.blur}"/></filter>` +
    `<rect x="${l.inset}" y="${top}" width="${w - 2 * l.inset}" height="${l.reach - top}" rx="12" fill="${tint}" fill-opacity="${l.opacity}" filter="url(#${id})"/>`

  return {
    width: w,
    height: h,
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      layer('ombra-larga', SHADOW.wide) +
      layer('ombra-stretta', SHADOW.tight) +
      `</svg>`,
  }
}

/**
 * The shadow's row, right after the bubble in the flow (nothing placed): a
 * Box SHADOW.rows tall below the bubble, no overlap (half a row over its
 * padding painted a hard strip and flattened its rounded corners), clipped
 * to the reply's width; in it the Svg, a plain image, `cells` wide. Undefined
 * without Svg.
 */
export const shadowArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { Box: any; Svg?: any },
  tint: string,
  cells: number,
): unknown => {
  const { Box, Svg } = els
  if (Svg === undefined) return undefined
  const art = shadowDrawing(tint, cells * CELL_PX)

  return (
    <Box key="tinta-bubble-shadow" flexDirection="row" justifyContent="center" height={SHADOW.rows} {...(SHADOW.tuck > 0 ? { marginTop: -SHADOW.tuck } : {})} overflow="hidden" flexShrink={0}>
      <Svg source={art.source} alt="ombra" {...drawnProps(art.width, art.height)} />
    </Box>
  )
}

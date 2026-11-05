import type { TintaFill } from '../types'

/**
 * SVG drawings for the desktop app's `Svg` element: gradient and pattern
 * fills, labels as SVG text, glass chips, orb avatars, a divider and the
 * band's pill. Every string here is built from parsed theme values only
 * (hex colors, numbers, escaped text), never from raw theme markup.
 */

export type Fill = TintaFill
type Stop = [string, number, number?]

const FONT = `-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, system-ui, 'Segoe UI', Roboto, sans-serif`

export const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const round = (n: number) => Math.round(n * 1000) / 1000

/** The stops of a fill (a solid one is a single stop). */
export const stopsOf = (fill: Fill): Stop[] =>
  'solid' in fill
    ? [[fill.solid, 0], [fill.solid, 1]]
    : 'gradient' in fill
      ? fill.gradient.stops
      : [[fill.pattern.background ?? fill.pattern.color, 0], [fill.pattern.color, 1]]

const channels = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16)

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** The fill's mean color, its transparent stops composited over `under`. */
export const averageOf = (fill: Fill, under: string): string => {
  const base = channels(under)
  const sum = [0, 0, 0]
  const stops = stopsOf(fill)
  for (const [hex, , opacity = 1] of stops) {
    const c = channels(hex)
    for (let i = 0; i < 3; i++) {
      sum[i] = (sum[i] as number) + (c[i] as number) * opacity + (base[i] as number) * (1 - opacity)
    }
  }

  return `#${sum.map(v => Math.round(v / stops.length).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/**
 * The paint for text in `fill`: the reference with its first stop as the
 * fallback color, so text never paints as `none` where a reference fails.
 */
const textPaint = (fill: Fill, ref: string): string => ('solid' in fill ? ref : `${ref} ${stopsOf(fill)[0]?.[0] ?? '#FFFFFF'}`)

/** A `<defs>` entry for `fill` under `id`, and the paint that refers to it. */
export const paint = (fill: Fill, id: string, animate: boolean): { defs: string; ref: string } => {
  if ('solid' in fill) {
    return { defs: '', ref: fill.solid }
  }
  if ('gradient' in fill) {
    const g = fill.gradient
    const stops = g.stops
      .map(([color, offset, opacity]) => `<stop offset="${round(offset)}" stop-color="${color}"${opacity === undefined ? '' : ` stop-opacity="${round(opacity)}"`}/>`)
      .join('')
    const moving =
      animate && g.animate
        ? `<animateTransform attributeName="gradientTransform" type="translate" values="-0.35 0;0.35 0;-0.35 0" dur="${g.type === 'radial' ? 14 : 10}s" repeatCount="indefinite"/>`
        : ''
    if (g.type === 'radial') {
      return { defs: `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.7" spreadMethod="reflect">${stops}${moving}</radialGradient>`, ref: `url(#${id})` }
    }
    const a = ((g.angle - 90) * Math.PI) / 180
    const [x1, y1, x2, y2] = [0.5 - Math.cos(a) / 2, 0.5 - Math.sin(a) / 2, 0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2].map(round)

    return {
      defs: `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" spreadMethod="reflect">${stops}${moving}</linearGradient>`,
      ref: `url(#${id})`,
    }
  }
  const p = fill.pattern
  const s = p.size
  const bg = p.background ? `<rect width="${s}" height="${s}" fill="${p.background}"/>` : ''
  const body =
    p.kind === 'dots'
      ? `<circle cx="${s / 2}" cy="${s / 2}" r="${round(Math.max(0.6, s / 6))}" fill="${p.color}"/>`
      : p.kind === 'lines'
        ? `<path d="M0 ${s} L${s} 0" stroke="${p.color}" stroke-width="1"/>`
        : p.kind === 'grid'
          ? `<path d="M${s} 0 L0 0 0 ${s}" fill="none" stroke="${p.color}" stroke-width="1"/>`
          : `<rect width="${s}" height="${s}" fill="${p.color}" filter="url(#${id}-n)" opacity="0.5"/>`
  const noise =
    p.kind === 'noise'
      ? `<filter id="${id}-n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.45"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/></filter>`
      : ''

  return {
    defs: `${noise}<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse">${bg}${body}</pattern>`,
    ref: `url(#${id})`,
  }
}

const GLOW = `<filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
const SHADOW = `<filter id="shadow" x="-10%" y="-30%" width="120%" height="180%"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.22"/></filter>`
const SOFT_SHADOW = `<filter id="soft" x="-10%" y="-30%" width="120%" height="180%"><feDropShadow dx="0" dy="0.5" stdDeviation="0.8" flood-color="#000000" flood-opacity="0.12"/></filter>`
const SPECULAR = `<linearGradient id="spec" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/><stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.08"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`

/** A rough width of `text` in px at `size`: wide glyphs count double. */
export const measure = (text: string, size: number, bold: boolean): number => {
  let units = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    units += code > 0x2e80 ? 1.15 : /[A-Z]/.test(char) ? 0.68 : char === ' ' ? 0.3 : code > 0x2000 ? 0.9 : 0.56
  }

  return Math.ceil(units * size * (bold ? 1.06 : 1))
}

/**
 * A drawing's size in px. `inset` is the empty room left of the first
 * visible ink (a label's text padding), so a neighbour can sit flush to it.
 */
export type Drawing = { source: string; width: number; height: number; inset?: number }

const svg = (width: number, height: number, defs: string, body: string): Drawing => ({
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`,
  width,
  height,
})

/** Every label row's metrics on desktop, in px: one height, one gap, one room below. */
export const LABEL_HEIGHT = 18
/** The px between an avatar and its label. */
export const LABEL_GAP = 6
/**
 * The px between a label row and the bubble below it (Claude's or the user's): the label belongs to its bubble; the
 * owner measured ~17 CSS px with 10 here (the bubble's own top adds the rest), so 3 gives the 8-10 px asked.
 */
export const LABEL_SPACE = 3
/** The divider's room, CSS px, above and below its line: centred in the gap before Claude's label, at least 16 px. */
export const DIVIDER_ROOM = 17
/** The cap height of the label font, as a share of its size (SF and Helvetica: ~0.7). */
const CAP = 0.7

/**
 * The baseline that centres capitals optically in a box `height` px tall:
 * the middle of the caps, not of the em box, sits on the centre line.
 */
export const capBaseline = (height: number, size: number) => round(height / 2 + (size * CAP) / 2)

/** A label as SVG text filled with `fill`, on an optional (glass) chip. */
export const labelDrawing = (
  text: string,
  options: { fill: Fill; bold?: boolean; glow?: boolean; chip?: Fill; glass?: boolean; rim?: boolean; animate?: boolean; size?: number; height?: number; outline?: { color: string; alpha: number; width: number } },
): Drawing => {
  const size = options.size ?? 13
  const padX = options.chip || options.outline ? 7 : 0
  const glow = options.glow ? 2 : 0
  const height = options.height ?? Math.round(size * 1.5)
  const width = measure(text, size, options.bold === true) + padX * 2 + glow * 2
  const ink = paint(options.fill, 'ink', options.animate === true)
  let defs = ink.defs + (options.glow ? GLOW : '')
  let chip = ''
  if (options.chip) {
    const back = paint(options.chip, 'chip', options.animate === true)
    defs += back.defs + (options.glass ? SPECULAR + SOFT_SHADOW : '')
    const r = height / 2
    // The chip fills the drawing edge to edge: its ends are the drawing's ends.
    // A glass chip stays light: a softened fill, a faint highlight and, only when the theme draws lines (rim), a hairline rim.
    chip = `<rect x="0" y="0" width="${width}" height="${height}" rx="${r}" fill="${back.ref}"${options.glass ? ' fill-opacity="0.7" filter="url(#soft)"' : ''}/>`
    if (options.glass) {
      chip += `<rect x="0.5" y="0.5" width="${width - 1}" height="${(height - 1) / 2}" rx="${r}" fill="url(#spec)" opacity="0.5"/>`
    }
    if (options.glass && options.rim === true) {
      chip += `<rect x="0.3" y="0.3" width="${width - 0.6}" height="${height - 0.6}" rx="${r - 0.3}" fill="none" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="0.6"/>`
    }
  }
  // styleHints.user.labelChip "outline": a thin ring in the role's colour, nothing inside
  if (options.outline && !options.chip) {
    const w = options.outline.width
    const r = height / 2
    chip = `<rect x="${w / 2}" y="${w / 2}" width="${width - w}" height="${height - w}" rx="${r - w / 2}" fill="none" stroke="${options.outline.color}" stroke-opacity="${options.outline.alpha}" stroke-width="${w}"/>`
  }
  const weight = options.chip ? (options.bold ? 600 : 500) : options.bold ? 700 : 500
  // on a chip the text is centred on the chip, whatever the rough measure says
  const at = options.chip || options.outline ? `x="${round(width / 2)}" text-anchor="middle"` : `x="${glow}"`
  // off a chip the ink is held to the measured width (textLength, spacing only), so the
  // gaps beside the name are exactly what the layout says, whatever the font's real width
  const exact = options.chip || options.outline ? '' : ` textLength="${width - glow * 2}" lengthAdjust="spacing"`
  const body = `${chip}<text ${at} y="${capBaseline(height, size)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" letter-spacing="${options.chip ? 0.2 : 0.4}"${exact} fill="${textPaint(options.fill, ink.ref)}"${options.glow ? ' filter="url(#glow)"' : ''}>${escapeXml(text)}</text>`

  return { ...svg(width, height, defs, body), inset: options.chip || options.outline ? 0 : glow }
}

/**
 * `left` and `right` side by side in one drawing, `gap` px between the edge
 * of `left` and the first ink of `right`, both centred on one line. One image
 * keeps the spacing exact: no layout box between them to add its own.
 * Their `<defs>` ids differ (orb, hi / ink, chip, glow, spec, soft).
 */
export const besideDrawing = (left: Drawing, right: Drawing, gap = LABEL_GAP): Drawing => {
  const x = Math.max(0, left.width + gap - (right.inset ?? 0))
  const width = x + right.width
  const height = Math.max(left.height, right.height)
  const place = (d: Drawing, at: number) =>
    d.source.replace('<svg ', `<svg x="${at}" y="${round((height - d.height) / 2)}" `).replace(' xmlns="http://www.w3.org/2000/svg"', '')
  const body = place(left, 0) + place(right, x)

  return { ...svg(width, height, '', body), inset: left.inset ?? 0 }
}

/** `drawing` with `px` of empty room below it, its art unmoved at the top. */
export const padBottom = (drawing: Drawing, px: number): Drawing => {
  const inner = drawing.source.replace('<svg ', '<svg x="0" y="0" ').replace(' xmlns="http://www.w3.org/2000/svg"', '')

  return { ...svg(drawing.width, drawing.height + px, '', inner), inset: drawing.inset }
}

/**
 * The rules' default width and the default room between each rule and its
 * content (Claude's reply, the user's bubble). A theme's `rule` sets both.
 */
export const RULE_WIDTH = 2
export const REPLY_RULE_GAP = 12

/** A rule's width and its room from the content. */
export type RuleSpec = { width: number; gap: number; opacity?: number }

const hexAt = (a: string, b: string, t: number): string => {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) {
    return t < 0.5 ? a : b
  }
  const [ca, cb] = [channels(a), channels(b)]

  return `#${ca.map((v, i) => Math.round(v + ((cb[i] as number) - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** The stop of `stops` at `at` (0 to 1), its color and opacity interpolated. */
const stopAt = (stops: Stop[], at: number): Stop => {
  const sorted = [...stops].sort((x, y) => x[1] - y[1])
  const first = sorted[0] as Stop
  const last = sorted[sorted.length - 1] as Stop
  if (at <= first[1]) return [first[0], 0, first[2]]
  if (at >= last[1]) return [last[0], 0, last[2]]
  const i = sorted.findIndex(stop => stop[1] >= at)
  const [lo, hi] = [sorted[i - 1] as Stop, sorted[i] as Stop]
  const t = hi[1] === lo[1] ? 0 : (at - lo[1]) / (hi[1] - lo[1])
  const opacity = lo[2] === undefined && hi[2] === undefined ? undefined : (lo[2] ?? 1) + ((hi[2] ?? 1) - (lo[2] ?? 1)) * t

  return opacity === undefined ? [hexAt(lo[0], hi[0], t), 0] : [hexAt(lo[0], hi[0], t), 0, round(opacity)]
}

/**
 * The part of a top-to-bottom gradient between `from` and `to` (0 to 1) of
 * the whole, as a gradient of its own: segments drawn one under the other
 * read as one gradient.
 */
export const sliceFill = (fill: Fill, from: number, to: number): Fill => {
  if (!('gradient' in fill) || (from <= 0 && to >= 1)) {
    return fill
  }
  const stops = fill.gradient.stops
  const span = Math.max(1e-6, to - from)
  const inner = stops.filter(([, at]) => at > from && at < to).map(([c, at, o]): Stop => (o === undefined ? [c, round((at - from) / span)] : [c, round((at - from) / span), o]))
  const head = stopAt(stops, from)
  const tail = stopAt(stops, to)
  head[1] = 0
  tail[1] = 1

  return { gradient: { ...fill.gradient, stops: [head, ...inner, tail] } }
}

/** The color of `fill` at `at` (0 to 1) of its run: a solid fill's own. */
export const colorAt = (fill: Fill, at: number): string => stopAt(stopsOf(fill), at)[0]

/** The px height of each rounded cap of Claude's stretched rule. */
export const RULE_CAP = 12

/**
 * The rule left of Claude's reply, or one segment of it: `rule.width` px wide
 * in `fill` run top to bottom, then `rule.gap` px of room before the reply.
 * Ends are rounded only where the rule starts (`top`) and ends (`bottom`);
 * between segments the bar runs past the edge, so they join flat.
 */
export const replyRuleDrawing = (
  fill: Fill,
  height: number,
  rule: RuleSpec = { width: RULE_WIDTH, gap: REPLY_RULE_GAP },
  ends: { top: boolean; bottom: boolean } = { top: true, bottom: true },
): Drawing => {
  const down: Fill = 'gradient' in fill ? { gradient: { ...fill.gradient, type: 'linear', angle: 180, animate: false } } : fill
  const line = paint(down, 'rule', false)
  const y = ends.top ? 0 : -rule.width
  const tall = height - y + (ends.bottom ? 0 : rule.width)

  const alpha = rule.opacity !== undefined && rule.opacity < 1 ? ` fill-opacity="${round(rule.opacity)}"` : ''

  return svg(rule.width + rule.gap, height, line.defs, `<rect x="0" y="${y}" width="${rule.width}" height="${tall}" rx="${rule.width / 2}" fill="${textPaint(down, line.ref)}"${alpha}/>`)
}

/** The bust's shade: how much lighter its top is than its foot (white mixed in). */
export const BUST_LIFT = 0.2

/**
 * The user's avatar: a bust like SF Symbols' person.fill in an 18-unit box,
 * key points on half pixels so it stays crisp at 18 px. A round head (38% of
 * the box wide, its top 1 unit down), a 1.5 unit neck gap, then soft rounded
 * shoulders cropped flat at the box's foot; no outline. A plain colour is
 * shaded top to bottom, a touch lighter above, for depth.
 */
export const personDrawing = (fill: Fill, size = LABEL_HEIGHT): Drawing => {
  const shaded: Fill =
    'solid' in fill && /^#[0-9a-f]{6}$/i.test(fill.solid)
      ? { gradient: { type: 'linear', angle: 180, stops: [[hexAt(fill.solid, '#FFFFFF', BUST_LIFT), 0], [fill.solid, 1]] } }
      : fill
  const ink = paint(shaded, 'person', false)
  const u = size / 18
  const v = (n: number) => round(n * u)
  const body =
    `<circle cx="${v(9)}" cy="${v(4.5)}" r="${v(3.5)}" fill="${textPaint(shaded, ink.ref)}"/>` +
    `<path d="M${v(1.5)} ${v(18)} L${v(1.5)} ${v(15.5)} C${v(1.5)} ${v(11.9)} ${v(4.9)} ${v(9.5)} ${v(9)} ${v(9.5)} C${v(13.1)} ${v(9.5)} ${v(16.5)} ${v(11.9)} ${v(16.5)} ${v(15.5)} L${v(16.5)} ${v(18)} Z" fill="${textPaint(shaded, ink.ref)}"/>`

  return svg(size, size, ink.defs, body)
}

/**
 * The user's default avatar: an outline bust, no fill, in a 24-unit
 * viewBox drawn in an 18 px box: a round head and the shoulders' arc,
 * stroked 1.8 units with round caps in `fill`, a plain colour shaded from a
 * touch lighter at the top down to itself.
 */
export const personOutlineDrawing = (fill: Fill, size = LABEL_HEIGHT): Drawing => {
  const shaded: Fill =
    'solid' in fill && /^#[0-9a-f]{6}$/i.test(fill.solid)
      ? { gradient: { type: 'linear', angle: 180, stops: [[hexAt(fill.solid, '#FFFFFF', BUST_LIFT), 0], [fill.solid, 1]] } }
      : fill
  const ink = paint(shaded, 'outline', false)
  const stroke = `fill="none" stroke="${textPaint(shaded, ink.ref)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><defs>${ink.defs}</defs><circle cx="12" cy="8" r="4" ${stroke}/><path d="M4.5 21c.6-4 3.6-6.4 7.5-6.4s6.9 2.4 7.5 6.4" ${stroke}/></svg>`,
    width: size,
    height: size,
  }
}

/**
 * Claude's avatar: Tinta's own spark, a bare mark in `fill` filling the
 * `size` px box. Eight tapered rays with rounded tips, four long ones turned
 * 15 degrees off the axes and four short ones between, lengths a little
 * uneven, around an open ring: an asterisk of our own, not any brand's mark.
 */
export const sparkDrawing = (fill: Fill, size = LABEL_HEIGHT): Drawing => {
  const ink = paint(fill, 'spark', false)
  const c = size / 2
  const u = size / 18
  const lengths = [8.6, 5.2, 8.1, 5.6, 8.4, 5.0, 7.9, 5.4]
  const rays = lengths
    .map((length, i) => {
      const a = ((15 + i * 45) * Math.PI) / 180
      const [dx, dy, px, py] = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)]
      const base = 2.4 * u
      const half = (i % 2 === 0 ? 1.25 : 0.95) * u
      const tip = (i % 2 === 0 ? 0.55 : 0.45) * u
      const r = (length - tip) * u
      const at = (d: number, w: number) => `${round(c + dx * d + px * w)} ${round(c + dy * d + py * w)}`

      return `M${at(base, half)} L${at(r, tip)} A${round(tip)} ${round(tip)} 0 0 1 ${at(r, -tip)} L${at(base, -half)} Z`
    })
    .join(' ')
  const paintRef = textPaint(fill, ink.ref)
  const body = `<path d="${rays}" fill="${paintRef}"/><circle cx="${c}" cy="${c}" r="${round(2.1 * u)}" fill="none" stroke="${paintRef}" stroke-width="${round(1.3 * u)}"/>`

  return svg(size, size, ink.defs, body)
}

/** Claude's terracotta, for `avatarColor: "original"`. */
export const CLAUDE_TERRACOTTA = '#D97757'

/**
 * The burst's rays in unit space (radius 1): angle jitter in degrees off a
 * 30 degree step, and length as a fraction of the radius. Fixed, so every
 * render and the app's preview draw the same irregular mark.
 */
export const BURST_JITTER = [3, -5, 2, 6, -3, -6, 4, -2, 5, -4, 1, -5]
export const BURST_LENGTH = [1, 0.78, 0.92, 0.72, 0.97, 0.84, 0.75, 0.95, 0.8, 0.9, 0.71, 0.88]
/** The first ray's angle, the base half-width and the tip radius, unit space. */
const BURST_START = -84
const BURST_HALF = 0.09
const BURST_TIP = 0.05

/**
 * Claude's avatar: a radial burst like Claude's own mark, a bare glyph in
 * `fill` filling the `size` px box. Twelve rays from a small solid centre,
 * angles and lengths a little irregular, each thick at the base and tapering
 * to a rounded tip; one path, scaled to the box and centred on its bounds.
 */
export const claudeDrawing = (fill: Fill, size = LABEL_HEIGHT, motion: boolean | 'spin' | 'pulse' = false, turnSeconds = 6): Drawing => {
  const ink = paint(fill, 'claude', false)
  const rays = BURST_LENGTH.map((length, i) => {
    const a = ((BURST_START + i * 30 + (BURST_JITTER[i] ?? 0)) * Math.PI) / 180
    return { d: [Math.cos(a), Math.sin(a)] as const, n: [-Math.sin(a), Math.cos(a)] as const, r: length - BURST_TIP }
  })
  // bounds in unit space: each ray's base corners and its tip circle
  const xs: number[] = []
  const ys: number[] = []
  for (const { d, n, r } of rays) {
    xs.push(n[0] * BURST_HALF, -n[0] * BURST_HALF, d[0] * r - BURST_TIP, d[0] * r + BURST_TIP)
    ys.push(n[1] * BURST_HALF, -n[1] * BURST_HALF, d[1] * r - BURST_TIP, d[1] * r + BURST_TIP)
  }
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const margin = size / 36
  const k = (size - 2 * margin) / Math.max(x1 - x0, y1 - y0)
  const [ox, oy] = [size / 2 - ((x0 + x1) / 2) * k, size / 2 - ((y0 + y1) / 2) * k]
  const path = rays
    .map(({ d, n, r }) => {
      const at = (dist: number, w: number) => `${round(ox + (d[0] * dist + n[0] * w) * k)} ${round(oy + (d[1] * dist + n[1] * w) * k)}`
      const t = round(BURST_TIP * k)

      return `M${at(0, BURST_HALF)} L${at(r, BURST_TIP)} A${t} ${t} 0 0 0 ${at(r + BURST_TIP, 0)} A${t} ${t} 0 0 0 ${at(r, -BURST_TIP)} L${at(0, -BURST_HALF)} Z`
    })
    .join(' ')
  const mark = `<path d="${path}" fill="${textPaint(fill, ink.ref)}"/>`
  // in motion (the spinner): a slow turn, 6 s a round, and a gentle breath
  // of scale and opacity; SMIL, so it plays where the SVG is drawn as an image
  const c = round(size / 2)
  // `pulse` only breathes, slower and shallower
  const pulse = motion === 'pulse'
  const breath = pulse ? { scale: '1;0.92;1', opacity: '1;0.8;1', dur: '3.6s' } : { scale: '1;0.84;1', opacity: '1;0.7;1', dur: '2.4s' }
  const turn = pulse ? '' : `<animateTransform attributeName="transform" type="rotate" from="0 ${c} ${c}" to="360 ${c} ${c}" dur="${turnSeconds}s" repeatCount="indefinite"/>`
  const body = motion
    ? `<g>${turn}` +
      `<g transform="translate(${c} ${c})"><g><animateTransform attributeName="transform" type="scale" values="${breath.scale}" keyTimes="0;0.5;1" dur="${breath.dur}" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="${breath.opacity}" keyTimes="0;0.5;1" dur="${breath.dur}" repeatCount="indefinite"/>` +
      `<g transform="translate(-${c} -${c})">${mark}</g></g></g></g>`
    : mark

  return svg(size, size, ink.defs, body)
}

/** A transparent block `width` px wide: room beside a theme's own avatar. */
export const spacerDrawing = (width = LABEL_GAP): Drawing => svg(width, 1, '', '')

/** A small orb: the fill, a specular highlight and a bright rim. */
export const orbDrawing = (fill: Fill, size = 16): Drawing => {
  const ball = paint(fill, 'orb', false)
  const r = size / 2
  const defs = `${ball.defs}<radialGradient id="hi" cx="0.35" cy="0.28" r="0.55"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>`
  const body = `<circle cx="${r}" cy="${r}" r="${r - 0.5}" fill="${ball.ref}"/><circle cx="${r}" cy="${r}" r="${r - 0.5}" fill="url(#hi)"/><circle cx="${r}" cy="${r}" r="${r - 1}" fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="0.8"/>`

  return svg(size, size, defs, body)
}

/** A thin horizontal rule that fades in and out at the ends. */
export const dividerDrawing = (fill: Fill, height: number): Drawing => {
  const width = 1200
  const line = paint(fill, 'line', false)
  const defs = `${line.defs}<linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.2" stop-color="#FFFFFF" stop-opacity="1"/><stop offset="0.8" stop-color="#FFFFFF" stop-opacity="1"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient><mask id="m"><rect width="${width}" height="${height}" fill="url(#fade)"/></mask>`
  const body = `<rect y="${round(height / 2 - 0.75)}" width="${width}" height="1.5" rx="0.75" fill="${line.ref}" mask="url(#m)"/>`
  const out = svg(width, height, defs, body)

  return { ...out, source: out.source.replace('<svg ', '<svg preserveAspectRatio="none" ') }
}

/** The band's dot, in px: its diameter and the room after it, before the name. */
export const DOT = { size: 10, gap: 6, box: 24 }

/**
 * The band's mark: a small still dot in the theme's gradient, vertically
 * centred in the band's row (DOT.box px, the height of the app's own
 * controls), DOT.gap px of room after it before the name.
 */
export const dotDrawing = (fill: Fill): Drawing => {
  const ink = paint(fill, 'dot', false)
  const r = DOT.size / 2

  return svg(DOT.size + DOT.gap, DOT.box, ink.defs, `<circle cx="${r}" cy="${DOT.box / 2}" r="${r}" fill="${textPaint(fill, ink.ref)}"/>`)
}

/** The px height of one chat background tile, at its own width. */
export const CHAT_TILE = 400

/**
 * The chat fill as it reads the same at any height: a linear gradient turned
 * left to right (or right to left), a radial one opened from the middle out
 * to both sides, a pattern or a color as given. Rows stack these tiles, so
 * nothing in a tile may change from top to bottom.
 */
export const levelFill = (fill: Fill): Fill => {
  if (!('gradient' in fill)) {
    return fill
  }
  const g = fill.gradient
  if (g.type === 'radial') {
    const half = (s: Stop, side: -1 | 1): Stop => {
      const at = round(0.5 + (side * s[1]) / 2)

      return s[2] === undefined ? [s[0], at] : [s[0], at, s[2]]
    }
    const stops = [...[...g.stops].reverse().map(s => half(s, -1)), ...g.stops.map(s => half(s, 1))]

    return { gradient: { type: 'linear', angle: 90, stops } }
  }
  const across = Math.cos(((g.angle - 90) * Math.PI) / 180)

  return { gradient: { type: 'linear', angle: across < 0 ? 270 : 90, stops: g.stops } }
}

/**
 * One tile of the chat background, `width` px wide, fully opaque: the app's
 * own background, the fill at `opacity`, an optional grain and a vignette at
 * the sides. Nothing varies from top to bottom (the grain is a stitched
 * noise), so tiles stacked down a row and rows stacked down the chat meet
 * without a seam, and where one row overshoots into the next the later,
 * opaque tile simply covers it.
 */
export const chatDrawing = (
  chat: { background: Fill; opacity: number; overlay?: Fill; vignette?: boolean },
  under: string,
  width: number,
): Drawing => {
  const height = CHAT_TILE
  const base = paint(levelFill(chat.background), 'bg', false)
  let defs = base.defs
  let body = `<rect width="${width}" height="${height}" fill="${under}"/><rect width="${width}" height="${height}" fill="${base.ref}" opacity="${round(chat.opacity)}"/>`
  if (chat.overlay) {
    const grain = levelFill(chat.overlay)
    const noise = 'pattern' in grain && grain.pattern.kind === 'noise'
    if (noise) {
      // stitched turbulence: the tile's top and bottom edges match
      defs += `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.5"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/></filter>`
      body += `<rect width="${width}" height="${height}" fill="${grain.pattern.color}" filter="url(#grain)" opacity="0.35"/>`
    } else {
      const over = paint(grain, 'over', false)
      defs += over.defs
      body += `<rect width="${width}" height="${height}" fill="${over.ref}" opacity="0.35"/>`
    }
  }
  if (chat.vignette) {
    defs += `<linearGradient id="vig" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="0.32"/><stop offset="0.14" stop-color="#000000" stop-opacity="0"/><stop offset="0.86" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.32"/></linearGradient>`
    body += `<rect width="${width}" height="${height}" fill="url(#vig)"/>`
  }
  const out = svg(width, height, defs, body)

  return { ...out, source: out.source.replace('<svg ', '<svg preserveAspectRatio="none" ') }
}

/**
 * The user's avatar: a rounded square in `chip` with `initial` in `ink`,
 * a shape no Claude avatar takes.
 */
export const initialDrawing = (initial: string, chip: Fill, ink: Fill, size = 16): Drawing => {
  const back = paint(chip, 'ichip', false)
  const letter = paint(ink, 'iink', false)
  const r = round(size * 0.26)
  // the square fills the drawing: its top and bottom are the pill's
  const font = round(size * (initial.length > 1 ? 0.5 : 0.64))
  const body =
    `<rect x="0" y="0" width="${size}" height="${size}" rx="${r}" fill="${back.ref}"/>` +
    `<text x="${round(size / 2)}" y="${capBaseline(size, font)}" text-anchor="middle" font-family="${FONT}" font-size="${font}" font-weight="700" fill="${textPaint(ink, letter.ref)}">${escapeXml(initial)}</text>`

  return svg(size, size, back.defs + letter.defs, body)
}

/**
 * Claude's avatar: a glyph in `fill` inside a circle tinted with its first
 * color: a four-point spark, or an ink drop.
 */
export const glyphDrawing = (kind: 'spark' | 'drop', fill: Fill, size = 16): Drawing => {
  const ink = paint(fill, 'glyph', false)
  const tint = stopsOf(fill)[0]?.[0] ?? '#FFFFFF'
  const c = size / 2
  const u = size / 16
  const p = (x: number, y: number) => `${round(c + x * u)} ${round(c + y * u)}`
  const shape =
    kind === 'spark'
      ? `M${p(0, -5.2)} C${p(0.6, -1.4)} ${p(1.4, -0.6)} ${p(5.2, 0)} C${p(1.4, 0.6)} ${p(0.6, 1.4)} ${p(0, 5.2)} C${p(-0.6, 1.4)} ${p(-1.4, 0.6)} ${p(-5.2, 0)} C${p(-1.4, -0.6)} ${p(-0.6, -1.4)} ${p(0, -5.2)}Z`
      : `M${p(0, -5)} C${p(0, -5)} ${p(3.8, -0.8)} ${p(3.8, 1.6)} A${round(3.8 * u)} ${round(3.8 * u)} 0 0 1 ${p(-3.8, 1.6)} C${p(-3.8, -0.8)} ${p(0, -5)} ${p(0, -5)}Z`
  const body =
    `<circle cx="${c}" cy="${c}" r="${round(c - 0.6)}" fill="${tint}" fill-opacity="0.16" stroke="${tint}" stroke-opacity="0.85" stroke-width="1"/>` +
    `<path d="${shape}" fill="${ink.ref}"/>`

  return svg(size, size, ink.defs, body)
}

/** The meta text's font size in px: a step under the label's 12. */
export const META_SIZE = 11

/** The px between the time, its dot and the name, on both sides of the dot. */
export const META_GAP = 6
/** The middle dot's own px width at META_SIZE. */
const DOT_WIDTH = 3

/**
 * A label's quiet companion: the time and a middle dot, plain text in
 * `color`, regular weight, a step smaller, on the label's own baseline.
 * `before` the name ("10:42 ·", the user's) the time ends META_GAP px before
 * the dot, anchored at its end so a wider font never eats the gap; after it
 * ("· 10:43", Claude's) the dot comes META_GAP px after the name's edge.
 * Either way the dot sits META_GAP px from the name and from the time.
 */
export const metaDrawing = (time: string, color: string, side: 'before' | 'after', height = LABEL_HEIGHT, labelSize = 12): Drawing => {
  const room = Math.ceil(measure(time, META_SIZE, false) * 1.12)
  const width = room + META_GAP * 2 + DOT_WIDTH
  const y = capBaseline(height, labelSize)
  const style = `font-family="${FONT}" font-size="${META_SIZE}" font-weight="400" fill="${color}"`
  const dotX = side === 'before' ? width - META_GAP - DOT_WIDTH / 2 : META_GAP + DOT_WIDTH / 2
  const timeAt = side === 'before' ? `x="${width - META_GAP * 2 - DOT_WIDTH}" text-anchor="end"` : `x="${META_GAP * 2 + DOT_WIDTH}"`
  const body = `<text ${timeAt} y="${y}" ${style}>${escapeXml(time)}</text><text x="${round(dotX)}" y="${y}" text-anchor="middle" ${style}>·</text>`

  return { ...svg(width, height, '', body), inset: 0 }
}

/** The band's context meter, in px: a short rounded track. */
export const METER = { width: 44, height: 6, box: 16 }

/**
 * The context window's fill as a tiny meter: a faint track in `track`, the
 * filled part in the theme's gradient, rounded, centred in a 16 px box.
 */
export const meterDrawing = (percent: number, fill: Fill, track: string): Drawing => {
  const p = Math.max(0, Math.min(100, percent))
  const { width, height, box } = METER
  const y = round((box - height) / 2)
  const r = height / 2
  const ink = paint(fill, 'meter', false)
  const filled = p === 0 ? 0 : Math.max(height, round((width * p) / 100))
  const bar = filled > 0 ? `<rect x="0" y="${y}" width="${filled}" height="${height}" rx="${r}" fill="${ink.ref}"/>` : ''

  return svg(width, box, ink.defs, `<rect x="0" y="${y}" width="${width}" height="${height}" rx="${r}" fill="${track}" fill-opacity="0.28"/>${bar}`)
}

/** A transparent block `width` by `height` px: room in a column of the flow. */
export const blankDrawing = (width: number, height: number): Drawing => svg(width, height, '', '')

/** The activity chip, in px: its side, its corner, the room after it. */
export const CHIP = { size: 18, radius: 5, gap: 6, tint: 0.18 }

/** Line icons for the activity kinds, SF-like, in a 24-unit box. */
export const ACTIVITY_ICONS: { [kind: string]: string } = {
  // two people: an agent, or a message to or from one
  agent: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.6-3.4 2.9-5.3 6-5.3s5.4 1.9 6 5.3"/><circle cx="17" cy="9" r="2.6"/><path d="M16.6 14.2c2.6.1 4.2 1.8 4.6 4.8"/>',
  // wrench: any other tool
  tool: '<path d="M14.7 6.3a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3l8.7-8.7a4 4 0 0 0-2-2z"/>',
  // clock: background work
  task: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  // a terminal prompt: commands, shells, slash commands
  command: '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
  terminal: '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
  shell: '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
  // magnifier: reading and searching
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  // pencil on a page: writing and editing files
  edit: '<path d="M12.5 4H7a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V13"/><path d="M17.8 3.7a1.9 1.9 0 0 1 2.7 2.7L13 13.9l-3.6.9.9-3.6z"/>',
  // globe: the web
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.3 3.5 5.1 3.5 8.5s-1.2 6.2-3.5 8.5c-2.3-2.3-3.5-5.1-3.5-8.5s1.2-6.2 3.5-8.5z"/>',
  // a circular arrow: a prompt the system sent (a schedule, a relay)
  auto: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  // checkmark: done, a result
  result: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  // a triangle with an exclamation: an error
  warning: '<path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.3 12.6a2 2 0 0 1-1.7 3H4.7a2 2 0 0 1-1.7-3z"/><path d="M12 9.5v4M12 16.8v.01"/>',
  // a pulse line: a monitor watching
  monitor: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
  // branches: a workflow
  workflow: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="12" r="2.2"/><path d="M6 8.2v7.6M8 6.8c5 0 4 5.2 7.8 5.2"/>',
  // a cross: failed
  failed: '<path d="M7 7l10 10M17 7L7 17"/>',
  // a square: stopped
  stopped: '<rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/>',
}

/** The icon a tool's row wears, by the tool's name: search, edit, terminal, agent, web, task, or the wrench. */
export const iconForTool = (tool: string): string => {
  if (/^(Read|Grep|Glob|LS|NotebookRead|ToolSearch|LSP)$/.test(tool)) return 'search'
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 'edit'
  if (/^(Bash|BashOutput|KillShell|KillBash|PowerShell)$/.test(tool)) return 'terminal'
  if (/^(Agent|Task|SendMessage|ListAgents|SubagentHandback)$/.test(tool)) return 'agent'
  if (/^(WebFetch|WebSearch)$/.test(tool) || /^mcp__.*(chrome|browser)/i.test(tool)) return 'web'
  if (/^(Monitor|TaskStop|TaskOutput|TaskGet|TaskList|Workflow)$/.test(tool)) return 'task'

  return 'tool'
}

/**
 * CSS px a chip sits below its row's top, so its centre meets the first
 * text line's: the row's line is 21 px (Anthropic Sans 15/21, the desktop's
 * exact CSS), its centre 10.5 down, the 18 px chip's 9 below its top. The
 * old 6 was an estimate and set the chip ~4.5 px low (the owner's grouped
 * Edit rows).
 */
export const ROW_LINE_PX = 21
export const CHIP_TOP = ROW_LINE_PX / 2 - 18 / 2


/**
 * An activity row's mark: a rounded square in `accent` at CHIP.tint, the
 * kind's line icon (or a theme's own glyph as text) in `accent` at full
 * strength, then CHIP.gap px of room before the row.
 */
export const chipDrawing = (kind: string, accent: string, glyph?: string, top = 0): Drawing => {
  const { size, radius, gap, tint } = CHIP
  const back = `<rect x="0" y="${top}" width="${size}" height="${size}" rx="${radius}" fill="${accent}" fill-opacity="${tint}"/>`
  // the icon 14 px in the 18 px square, its strokes 1.6 px (2.75 of its 24 units)
  const icon =
    glyph !== undefined
      ? `<text x="${size / 2}" y="${top + size / 2}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="11" fill="${accent}">${escapeXml(glyph)}</text>`
      : `<svg x="2" y="${top + 2}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round">${ACTIVITY_ICONS[kind] ?? ACTIVITY_ICONS.tool}</svg>`

  return svg(size + gap, size + top, '', back + icon)
}

/**
 * The icon slot every non-prose row shares on desktop (activity chips, the
 * spinner's burst): CHIP.size px square at the row's start, the same x as
 * Claude's label icon, then CHIP.gap px of room before the row's text.
 * `mark` sits centred in the slot.
 */
export const slotDrawing = (mark: Drawing): Drawing => {
  const inner = mark.source
    .replace('<svg ', `<svg x="${round((CHIP.size - mark.width) / 2)}" y="${round((CHIP.size - mark.height) / 2)}" `)
    .replace(' xmlns="http://www.w3.org/2000/svg"', '')

  return svg(CHIP.size + CHIP.gap, CHIP.size, '', inner)
}

/** A running row's dots: PENDING.dots dots `r` px in radius, `gap` px apart, in a `width` x CHIP.size box, then `room` px. */
export const PENDING = { dots: 3, r: 2, gap: 4, width: 22, room: 4, dur: 1.2, stagger: 0.2 } as const

/**
 * A running activity row's mark, after its chip: three small dots in
 * `colors` (the theme's gradient at its start, middle and end), each fading
 * 0.25 to 1 and back and swelling a little, PENDING.dur s, PENDING.stagger s
 * apart. `now` (ms, a steady clock) sets each animation's phase (a negative
 * begin), so a re-render carries on instead of starting over; without
 * `motion` the dots stand still. `top` px down, as the chip, so their centre
 * meets the first text line's.
 */
export const pendingDrawing = (colors: readonly string[], motion: boolean, now = 0, top = 0): Drawing => {
  const { dots, r, gap, width, room, dur, stagger } = PENDING
  const span = dots * 2 * r + (dots - 1) * gap
  const left = (width - span) / 2
  const cy = top + CHIP.size / 2
  const inks = colors.length > 0 ? colors : ['#FFFFFF']
  const body = Array.from({ length: dots }, (_, i) => {
    const cx = round(left + r + i * (2 * r + gap))
    const ink = inks[Math.min(inks.length - 1, Math.round((i * (inks.length - 1)) / Math.max(1, dots - 1)))] as string
    // where this dot's cycle is at `now`, lagging `stagger` s a dot: a negative begin
    const begin = (-((((now / 1000 - i * stagger) % dur) + dur) % dur)).toFixed(3)
    const pulse = motion
      ? `<animate attributeName="opacity" values="0.25;1;0.25" keyTimes="0;0.5;1" dur="${dur}s" repeatCount="indefinite" begin="${begin}s"/>` +
        `<animate attributeName="r" values="${r};${r * 1.2};${r}" keyTimes="0;0.5;1" dur="${dur}s" repeatCount="indefinite" begin="${begin}s"/>`
      : ''

    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}" opacity="${motion ? 0.25 : 0.7}">${pulse}</circle>`
  })

  return svg(width + room, CHIP.size + top, '', body.join(''))
}

/** The spinner's voice wave: its px box. */
export const WAVE = { width: 96, height: 20 }

/**
 * Claude at work as a voice wave: three or four translucent ribbons, each a
 * sine under a tapering envelope in one of `colors`, a blurred halo under a
 * lighter core. With `motion` each ribbon's outline morphs through four
 * shapes (spline-eased, 1.6 to 2.8 s, staggered) so it never reads as a
 * loop; without, one calm flat wave. `now` (ms, a steady clock) sets every
 * animation's phase (`begin` negative, the clock modulo its period), so a
 * drawing made again (a new word, a re-render) carries on where the last one
 * was instead of starting over: the motion never jumps. The box is always
 * WAVE, whatever the word.
 */
const r1 = (n: number) => Math.round(n * 10) / 10

export const waveDrawing = (colors: string[], motion: boolean, now = 0): Drawing => {
  // where an animation `dur` s long, offset `lag` s, is at `now`: as a negative begin
  const phase = (dur: number, lag: number) => (-(((now / 1000 + lag) % dur) + dur) % dur).toFixed(3)
  const { width: W, height: H } = WAVE
  const mid = H / 2
  const inks = colors.length > 0 ? colors : ['#FFFFFF']
  const ribbons = Math.min(4, Math.max(3, inks.length))
  const STEPS = 24
  const shape = (freq: number, phase: number, amp: number) => {
    const top: string[] = []
    const bottom: string[] = []
    for (let i = 0; i <= STEPS; i++) {
      const x = (W * i) / STEPS
      const env = Math.pow(Math.sin((Math.PI * i) / STEPS), 1.6)
      const y = amp * env * Math.sin((2 * Math.PI * freq * i) / STEPS + phase)
      top.push(`${r1(x)} ${r1(mid - y - env * 0.9)}`)
      bottom.unshift(`${r1(x)} ${r1(mid - y * 0.35 + env * 0.9)}`)
    }

    return `M${top.join('L')}L${bottom.join('L')}Z`
  }
  const body: string[] = []
  const halo: string[] = []
  for (let r = 0; r < ribbons; r++) {
    const ink = inks[r % inks.length] as string
    const freq = 1.2 + r * 0.45
    const base = 3.2 + ((r * 1.7) % 3.4)
    const frames = [0, 1, 2, 3].map(k => shape(freq + (k % 2) * 0.25, r * 1.3 + k * 1.7, base * (0.55 + ((k * 0.37 + r * 0.21) % 0.6))))
    const calm = shape(freq, r * 1.3, motion ? base : 1.4 + r * 0.4)
    const dur = Number((1.6 + ((r * 0.4 + 0.3) % 1.2)).toFixed(2))
    const morph = motion
      ? `<animate attributeName="d" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.33;0.66;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" values="${[...frames.slice(0, 3), frames[0]].join(';')}" begin="${phase(dur, r * 0.37)}s"/>`
      : ''
    halo.push(`<path d="${motion ? frames[0] : calm}" fill="${ink}" fill-opacity="0.45">${morph}</path>`)
    body.push(`<path d="${motion ? frames[0] : calm}" fill="${ink}" fill-opacity="${(0.55 - r * 0.07).toFixed(2)}">${morph}</path>`)
  }
  // a gentle breath of the whole wave's height
  const breath = motion
    ? `<animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1 0.72;1 1" dur="3.1s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" begin="${phase(3.1, 0)}s"/>`
    : ''
  const defs = '<filter id="wave-glow" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.4"/></filter>'
  const group = (inner: string, extra: string) => `<g transform="translate(0 ${mid})"><g>${breath}<g transform="translate(0 ${-mid})"${extra}>${inner}</g></g></g>`

  return svg(W, H, defs, group(halo.join(''), ' filter="url(#wave-glow)"') + group(body.join(''), ' style="mix-blend-mode:screen"'))
}

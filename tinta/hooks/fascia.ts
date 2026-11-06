import { textPx } from './glow'
import type { Drawing, Fill } from './svg'
import { claudeDrawing, escapeXml, paint } from './svg'

/**
 * The band's own drawings: who (the palette's burst and the theme's name)
 * and the session's health (context, limits, the turn's time). Every
 * changing figure has a fixed slot sized for its longest form, tabular
 * digits right-aligned in it, so nothing in the band moves as they tick.
 */

/** The band's type: a step under the app's text. */
export const BAND_FONT_PX = 12.5
const FONT = `'Anthropic Sans', -apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, system-ui, sans-serif`
const NUM = `font-family="${escapeXml(FONT)}" font-size="${BAND_FONT_PX}" style="font-variant-numeric: tabular-nums"`
const H = 20
const BASE = 14

/** px a string takes in the band's type (the app font's advances, scaled). */
export const bandPx = (text: string): number => Math.ceil(textPx(text) * (BAND_FONT_PX / 15))

const r1 = (n: number) => Math.round(n * 10) / 10

/** The slots, px: "100%", a limit's "5h 100%", the turn's "0:00:00". */
export const BAND_SLOTS = { percent: bandPx('100%') + 2, limitLabel: bandPx('7g') + 2, timer: bandPx('0:00:00') + 2 } as const

/**
 * Who: Claude's burst in the palette's fill, then the palette's name strong
 * (in the fill as gradient text where `gradientName`, else plain in `ink`)
 * and the style's name muted after a middle dot.
 */
export const bandWhoDrawing = (fill: Fill, name: string, style: string | undefined, gradientName: boolean, ink: string, muted: string): Drawing => {
  const mark = claudeDrawing(fill, 14)
  const nested = mark.source.replace('<svg xmlns="http://www.w3.org/2000/svg"', `<svg x="0" y="${r1((H - mark.height) / 2)}"`)
  const strong = paint(fill, 'bandname', false)
  const x = mark.width + 6
  const nameW = Math.ceil(bandPx(name) * 1.04)
  const rest = style ? ` · ${style}` : ''
  const restW = style ? Math.ceil(bandPx(rest) * 1.04) : 0
  const width = x + nameW + restW + 2
  const nameFill = gradientName && strong.defs !== '' ? `url(#bandname) ${ink}` : ink
  const defs = gradientName ? strong.defs : ''
  const text =
    `<text x="${x}" y="${BASE}" font-family="${escapeXml(FONT)}" font-size="${BAND_FONT_PX}" font-weight="650" fill="${nameFill}">${escapeXml(name)}</text>` +
    (style ? `<text x="${x + nameW}" y="${BASE}" font-family="${escapeXml(FONT)}" font-size="${BAND_FONT_PX}" fill="${muted}">${escapeXml(rest)}</text>` : '')

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}"><defs>${defs}</defs>${nested}${text}</svg>`,
    width,
    height: H,
  }
}

export type BandLimit = { label: string; percent: number }

/** A figure's colour: muted, amber from 70%, the danger colour past 85%. */
export const levelInk = (percent: number, muted: string, amber: string, danger: string): string => (percent > 85 ? danger : percent >= 70 ? amber : muted)

/**
 * The session's health in one drawing: a slim rounded context bar in the
 * palette's fill with a soft glow and its % in a fixed slot, then a small
 * ring gauge for each limit with its name and % (fixed slots). Each part
 * only when it applies.
 */
export const bandHealthDrawing = (input: {
  percent?: number
  limits: readonly BandLimit[]
  fill: Fill
  track: string
  muted: string
  amber: string
  danger: string
}): Drawing | undefined => {
  const parts: string[] = []
  let defs = ''
  let x = 0
  const gap = 12
  if (input.percent !== undefined) {
    const p = Math.max(0, Math.min(100, input.percent))
    const bar = { w: 56, h: 5 }
    const ink = paint(input.fill, 'bandbar', false)
    defs += ink.defs
    defs += `<filter id="bandglow" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="1.6"/></filter>`
    const y = r1((H - bar.h) / 2)
    const filled = r1((bar.w * p) / 100)
    parts.push(
      `<rect x="${x}" y="${y}" width="${bar.w}" height="${bar.h}" rx="${bar.h / 2}" fill="${input.track}" fill-opacity="0.35"/>` +
        (filled > 0
          ? `<rect x="${x}" y="${y}" width="${Math.max(bar.h, filled)}" height="${bar.h}" rx="${bar.h / 2}" fill="${ink.ref}" filter="url(#bandglow)" opacity="0.55"/>` +
            `<rect x="${x}" y="${y}" width="${Math.max(bar.h, filled)}" height="${bar.h}" rx="${bar.h / 2}" fill="${ink.ref}"/>`
          : ''),
    )
    x += bar.w + 5
    const color = levelInk(p, input.muted, input.amber, input.danger)
    x += BAND_SLOTS.percent
    parts.push(`<text x="${x}" y="${BASE}" text-anchor="end" ${NUM} fill="${color}">${p}%</text>`)
    x += gap
  }
  for (const limit of input.limits) {
    const p = Math.max(0, Math.min(100, limit.percent))
    const color = levelInk(p, input.muted, input.amber, input.danger)
    const r = 5.5
    const cx = x + r + 0.5
    const c = 2 * Math.PI * r
    parts.push(
      `<circle cx="${cx}" cy="${H / 2}" r="${r}" fill="none" stroke="${input.track}" stroke-opacity="0.45" stroke-width="2"/>` +
        (p > 0 ? `<circle cx="${cx}" cy="${H / 2}" r="${r}" fill="none" stroke="${color === input.muted ? input.track : color}" stroke-width="2" stroke-linecap="round" stroke-dasharray="${r1((c * p) / 100)} ${r1(c)}" transform="rotate(-90 ${cx} ${H / 2})"${color === input.muted ? ' stroke-opacity="0.9"' : ''}/>` : ''),
    )
    x += 2 * r + 1 + 4
    parts.push(`<text x="${x}" y="${BASE}" font-family="${escapeXml(FONT)}" font-size="${BAND_FONT_PX}" fill="${input.muted}">${escapeXml(limit.label)}</text>`)
    x += BAND_SLOTS.limitLabel + BAND_SLOTS.percent
    parts.push(`<text x="${x}" y="${BASE}" text-anchor="end" ${NUM} fill="${color}">${p}%</text>`)
    x += gap
  }
  if (parts.length === 0) return undefined
  const width = Math.ceil(x - gap + 1)

  return { source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}"><defs>${defs}</defs>${parts.join('')}</svg>`, width, height: H }
}

/** The turn's time as a clock: "0:07", "1:05", "12:40", "1:02:09" (tabular in its fixed slot). */
export const clockText = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor(s / 60) % 60
  const ss = String(s % 60).padStart(2, '0')

  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/**
 * The turn's time in its fixed slot, right-aligned; the slot drawn empty
 * between turns, so the band keeps its width as a turn starts and ends.
 * Its own drawing: only it reloads each second.
 */
export const bandTimerDrawing = (text: string | undefined, muted: string): Drawing => {
  const width = BAND_SLOTS.timer

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}">${text === undefined ? '' : `<text x="${width}" y="${BASE}" text-anchor="end" ${NUM} fill="${muted}">${escapeXml(text)}</text>`}</svg>`,
    width,
    height: H,
  }
}

/** The session's state, one signal everywhere: Claude works, waits for the person, is done, or stopped on an error. */
export type SessionState = 'working' | 'waiting' | 'done' | 'failed'

/**
 * The state's mark, still in every state (it reads with Reduce Motion and
 * with the theme's motion off): working a ring round a dot, waiting a pause
 * sign on a soft disc, done a tick in a ring, failed a cross in a ring.
 * Shape and colour both change, so the state never rests on colour alone.
 */
export const statusMarkDrawing = (state: SessionState, ink: string, size = 14): Drawing => {
  const c = size / 2
  const r = c - 1
  const sw = r1(Math.max(1.4, size / 9))
  const ring = `<circle cx="${c}" cy="${c}" r="${r1(r - sw / 2)}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`
  const u = size / 14
  const body =
    state === 'working'
      ? `${ring}<circle cx="${c}" cy="${c}" r="${r1(2.6 * u)}" fill="${ink}"/>`
      : state === 'waiting'
        ? `<circle cx="${c}" cy="${c}" r="${r1(r)}" fill="${ink}" fill-opacity="0.22"/>${ring}<rect x="${r1(c - 2.6 * u)}" y="${r1(c - 3 * u)}" width="${r1(1.8 * u)}" height="${r1(6 * u)}" rx="${r1(0.6 * u)}" fill="${ink}"/><rect x="${r1(c + 0.8 * u)}" y="${r1(c - 3 * u)}" width="${r1(1.8 * u)}" height="${r1(6 * u)}" rx="${r1(0.6 * u)}" fill="${ink}"/>`
        : state === 'done'
          ? `${ring}<path d="M${r1(c - 3 * u)} ${r1(c + 0.2 * u)} L${r1(c - 0.8 * u)} ${r1(c + 2.4 * u)} L${r1(c + 3.2 * u)} ${r1(c - 2.2 * u)}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`
          : `${ring}<path d="M${r1(c - 2.4 * u)} ${r1(c - 2.4 * u)} L${r1(c + 2.4 * u)} ${r1(c + 2.4 * u)} M${r1(c + 2.4 * u)} ${r1(c - 2.4 * u)} L${r1(c - 2.4 * u)} ${r1(c + 2.4 * u)}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`

  return { source: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`, width: size, height: size }
}

/**
 * The band's state: its mark and its word in the state's colour, in a slot as
 * wide as the longest of `words` (every state's word in this language), so
 * the band never shifts as the state changes. Still: nothing in it moves.
 */
export const bandStatusDrawing = (state: SessionState, word: string, ink: string, words: readonly string[]): Drawing => {
  const mark = statusMarkDrawing(state, ink, 14)
  const nested = mark.source.replace('<svg xmlns="http://www.w3.org/2000/svg"', `<svg x="0" y="${r1((H - mark.height) / 2)}"`)
  const x = mark.width + 6
  const slot = Math.max(...[word, ...words].map(one => Math.ceil(bandPx(one) * 1.06)))
  const width = x + slot + 2

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}">${nested}<text x="${x}" y="${BASE}" font-family="${escapeXml(FONT)}" font-size="${BAND_FONT_PX}" font-weight="600" fill="${ink}">${escapeXml(word)}</text></svg>`,
    width,
    height: H,
  }
}

/** The state's glyph where only text is drawn (the terminal's band): the same four shapes. */
export const STATUS_GLYPHS: { [state in SessionState]: string } = { working: '◉', waiting: '⏸', done: '✓', failed: '✕' }

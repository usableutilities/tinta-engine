import type { Drawing } from './svg'
import { WAVE, escapeXml, waveDrawing } from './svg'

/**
 * The design system's signature motions (styleHints part 2): the waiting
 * wave's kinds and the headings' effects, all SMIL inside the Svg (it plays
 * where the desktop draws an Svg as an image), every animation's phase from
 * the clock (`begin` negative), still when the theme has no motion.
 */

const r1 = (n: number) => Math.round(n * 10) / 10

const svg = (width: number, height: number, defs: string, body: string): Drawing => ({
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`,
  width,
  height,
})

/** Where an animation `dur` s long, offset `lag` s, is at `now`: a negative begin. */
const phaseAt = (now: number, dur: number, lag = 0) => (-(((now / 1000 + lag) % dur) + dur) % dur).toFixed(3)

/** A sine across the wave's box, `amp` px, `freq` periods, shifted by `shift` rad. */
const sine = (amp: number, freq: number, shift: number, steps = 32): string => {
  const { width: W, height: H } = WAVE
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const x = (W * i) / steps
    const env = Math.sin((Math.PI * i) / steps)
    pts.push(`${r1(x)} ${r1(H / 2 - amp * env * Math.sin((2 * Math.PI * freq * i) / steps + shift))}`)
  }

  return `M${pts.join('L')}`
}

export type WaveKind = 'none' | 'line' | 'voice' | 'ink' | 'curtain' | 'refraction' | 'scanline' | 'flicker' | 'breath' | 'ink-line' | 'rain' | 'log' | 'sparkle' | 'ember' | 'unicorn' | 'comet'

/**
 * The waiting wave of `kind`, WAVE's box, in `colors`: line (one thin sine
 * gliding), voice (the ribbons), ink (drops spreading and fading), curtain
 * (three veils swaying), refraction (three sines at their own speeds),
 * scanline (a bright line sweeping a faint grid), flicker (a wave that
 * stutters like a tube lighting), breath (a sine breathing, 4 s), ink-line
 * (a stroke writing itself and wiping), rain (glyph columns falling), log (a
 * line of output scrolling), sparkle (stars twinkling), ember (sparks
 * rising). Undefined for none.
 */
export const waveKindDrawing = (kind: WaveKind, colors: readonly string[], motion: boolean, now = 0, stroke = 1.5): Drawing | undefined => {
  const { width: W, height: H } = WAVE
  const inks = colors.length > 0 ? [...colors] : ['#FFFFFF']
  const ink = (i: number) => inks[i % inks.length] as string
  const at = (dur: number, lag = 0) => phaseAt(now, dur, lag)
  const anim = (body: string) => (motion ? body : '')
  // every loop seamless (the owner's rule): first and last keyframes the same, eased with splines; a gliding wave is
  // a sine drawn two widths long and moved by exactly one width (a whole number of periods), so the loop cannot show
  const EASE = 'calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"'
  const glide = (amp: number, periods: number, dur: number, lag: number, attrs: string) => {
    const steps = 64
    const pts: string[] = []
    for (let i = 0; i <= steps; i++) {
      const x = (2 * W * i) / steps
      pts.push(`${r1(x)} ${r1(H / 2 - amp * Math.sin((2 * Math.PI * periods * x) / W))}`)
    }
    const move = anim(`<animateTransform attributeName="transform" type="translate" dur="${dur}s" repeatCount="indefinite" values="0 0;${-W} 0" begin="${at(dur, lag)}s"/>`)

    return `<path d="M${pts.join('L')}" fill="none" ${attrs}>${move}</path>`
  }
  // the wave fades at both ends of the box: its tiled glide never shows an edge
  const fadeDefs = `<linearGradient id="wf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF" stop-opacity="0"/><stop offset="0.15" stop-color="#FFF"/><stop offset="0.85" stop-color="#FFF"/><stop offset="1" stop-color="#FFF" stop-opacity="0"/></linearGradient><mask id="wm"><rect width="${W}" height="${H}" fill="url(#wf)"/></mask>`
  switch (kind) {
    case 'none':
      return undefined
    case 'voice':
      return waveDrawing(inks, motion, now)
    case 'line':
      return svg(W, H, fadeDefs, `<g mask="url(#wm)">${glide(4, 2, 2.4, 0, `stroke="${ink(0)}" stroke-width="${stroke}" stroke-linecap="round"`)}</g>`)
    case 'breath': {
      const calm = sine(1.5, 1.2, 0)
      const deep = sine(6, 1.2, 0)
      const move = anim(`<animate attributeName="d" dur="4s" repeatCount="indefinite" ${EASE} keyTimes="0;0.5;1" values="${calm};${deep};${calm}" begin="${at(4)}s"/>`)

      return svg(W, H, '', `<path d="${motion ? calm : sine(3, 1.2, 0)}" fill="none" stroke="${ink(0)}" stroke-width="${stroke + 0.5}" stroke-linecap="round">${move}</path>`)
    }
    case 'refraction':
      return svg(W, H, fadeDefs, `<g mask="url(#wm)">${[0, 1, 2].map(i => glide(3 + i, 1 + i, 2 + i * 0.9, i * 0.3, `stroke="${ink(i)}" stroke-opacity="${0.75 - i * 0.18}" stroke-width="${stroke}"`)).join('')}</g>`)
    case 'flicker': {
      const flick = anim(`<animate attributeName="opacity" dur="3s" repeatCount="indefinite" keyTimes="0;0.05;0.08;0.12;0.16;0.6;0.62;0.64;1" values="1;0.3;1;0.4;1;1;0.5;1;1" begin="${at(3)}s"/>`)
      const glow = '<filter id="fl"><feGaussianBlur stdDeviation="1.2"/></filter>'

      return svg(W, H, glow + fadeDefs, `<g mask="url(#wm)">${flick}${glide(5, 2, 3, 0, `stroke="${ink(0)}" stroke-width="${stroke + 2}" stroke-opacity="0.45" filter="url(#fl)"`)}${glide(5, 2, 3, 0, `stroke="${ink(1)}" stroke-width="${stroke}"`)}</g>`)
    }
    case 'ink': {
      const drops = [0, 1, 2]
        .map(i => {
          const cx = 18 + i * 30
          const lag = i * 0.6
          // grows from nothing and fades to nothing: the loop restarts unseen
          const grow = anim(`<animate attributeName="r" dur="1.8s" repeatCount="indefinite" values="1;8;9;1" keyTimes="0;0.6;0.99;1" begin="${at(1.8, lag)}s"/><animate attributeName="opacity" dur="1.8s" repeatCount="indefinite" values="0;0.9;0;0" keyTimes="0;0.15;0.99;1" begin="${at(1.8, lag)}s"/>`)

          return `<circle cx="${cx}" cy="${H / 2}" r="${motion ? 1 : 5}" fill="${ink(i)}" opacity="${motion ? 0 : 0.5}">${grow}</circle>`
        })
        .join('')

      return svg(W, H, '<filter id="ik"><feGaussianBlur stdDeviation="1.6"/></filter>', `<g filter="url(#ik)">${drops}</g>`)
    }
    case 'curtain': {
      const veils = [0, 1, 2]
        .map(i => {
          const x = 10 + i * 28
          const sway = anim(`<animateTransform attributeName="transform" type="skewX" dur="${3 + i}s" repeatCount="indefinite" values="-12;12;-12" ${EASE} keyTimes="0;0.5;1" begin="${at(3 + i, i)}s"/>`)

          return `<g transform="translate(${x} 0)"><g>${sway}<rect x="0" y="0" width="22" height="${H}" fill="url(#cv${i})"/></g></g>`
        })
        .join('')
      const defs = [0, 1, 2].map(i => `<linearGradient id="cv${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ink(i)}" stop-opacity="0.8"/><stop offset="1" stop-color="${ink(i)}" stop-opacity="0"/></linearGradient>`).join('')

      return svg(W, H, defs + '<filter id="cu"><feGaussianBlur stdDeviation="1.5"/></filter>', `<g filter="url(#cu)">${veils}</g>`)
    }
    case 'scanline': {
      const grid = [4, 8, 12, 16].map(y => `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${ink(1)}" stroke-opacity="0.15" stroke-width="0.5"/>`).join('')
      const sweep = anim(`<animateTransform attributeName="transform" type="translate" dur="1.6s" repeatCount="indefinite" values="0 0;0 ${H - 2};0 0" ${EASE} keyTimes="0;0.5;1" begin="${at(1.6)}s"/>`)

      return svg(W, H, '', `${grid}<g>${sweep}<rect x="0" y="${motion ? 0 : H / 2 - 1}" width="${W}" height="2" fill="${ink(0)}" opacity="0.85"/></g>`)
    }
    case 'ink-line': {
      const d = sine(5, 1.3, 0.6)
      const length = W * 1.4
      // written, held, unwritten: the dash grows from nothing to the whole path and back (first frame = last)
      const write = anim(`<animate attributeName="stroke-dasharray" dur="2.6s" repeatCount="indefinite" values="0 ${r1(length)};${r1(length)} 0;${r1(length)} 0;0 ${r1(length)}" keyTimes="0;0.45;0.6;1" begin="${at(2.6)}s"/>`)

      return svg(W, H, '', `<path d="${d}" fill="none" stroke="${ink(0)}" stroke-width="${stroke + 0.4}" stroke-linecap="round" stroke-dasharray="${motion ? `0 ${r1(length)}` : `${r1(length)} 0`}">${write}</path>`)
    }
    case 'rain': {
      const glyphs = 'アイウエオカキクケコ01'
      const cols = [0, 1, 2, 3, 4, 5, 6, 7]
        .map(i => {
          const x = 4 + i * 12
          const dur = 1 + ((i * 0.37) % 0.9)
          // from above the box to below it: out of view at both ends of the loop
          const fall = anim(`<animateTransform attributeName="transform" type="translate" dur="${dur}s" repeatCount="indefinite" values="0 ${-H - 2};0 ${H + 2}" begin="${at(dur, i * 0.21)}s"/>`)
          const chars = [0, 1, 2].map(k => `<text x="${x}" y="${6 + k * 7}" font-family="ui-monospace, Menlo, monospace" font-size="7" fill="${ink(k)}" fill-opacity="${1 - k * 0.3}">${escapeXml(glyphs[(i * 3 + k) % glyphs.length] as string)}</text>`).join('')

          return `<g>${fall}${chars}</g>`
        })
        .join('')

      return svg(W, H, '', cols)
    }
    case 'log': {
      // one copy's width exactly (monospace, 0.6 em at 9 px): moved by one copy, three drawn, the loop invisible
      const line = '› build ok · test 133/133 · lint ok · deploy …  '
      const copy = [...line].length * 9 * 0.6
      const scroll = anim(`<animateTransform attributeName="transform" type="translate" dur="6s" repeatCount="indefinite" values="0 0;${-r1(copy)} 0" begin="${at(6)}s"/>`)
      const text = (x: number) => `<text x="${r1(x)}" y="${H / 2 + 3}" font-family="ui-monospace, Menlo, monospace" font-size="9" textLength="${r1(copy)}" lengthAdjust="spacingAndGlyphs" fill="${ink(0)}">${escapeXml(line)}</text>`

      return svg(W, H, '', `<g>${scroll}${text(0)}${text(copy)}${text(2 * copy)}</g>`)
    }
    case 'unicorn':
      return unicornDrawing(inks, motion, now)
    case 'comet':
      return cometDrawing(inks, motion, now)
    case 'sparkle':
    case 'ember': {
      const spark = (x: number, y: number) => `M${x} ${y - 3}L${x + 0.8} ${y - 0.8}L${x + 3} ${y}L${x + 0.8} ${y + 0.8}L${x} ${y + 3}L${x - 0.8} ${y + 0.8}L${x - 3} ${y}L${x - 0.8} ${y - 0.8}Z`
      const body = [0, 1, 2, 3, 4, 5]
        .map(i => {
          const x = 8 + i * 16
          const y = 5 + ((i * 7) % 11)
          const dur = 1.4 + ((i * 0.3) % 0.8)
          // each one fades to nothing before it restarts
          const motionOf =
            kind === 'sparkle'
              ? `<animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" values="0;1;0" ${EASE} keyTimes="0;0.5;1" begin="${at(dur, i * 0.27)}s"/>`
              : `<animateTransform attributeName="transform" type="translate" dur="${dur}s" repeatCount="indefinite" values="0 ${H / 2};0 ${-H / 2}" begin="${at(dur, i * 0.27)}s"/><animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" values="0;1;0" keyTimes="0;0.3;1" begin="${at(dur, i * 0.27)}s"/>`
          const shape = kind === 'sparkle' ? `<path d="${spark(x, y)}" fill="${ink(i)}"/>` : `<circle cx="${x}" cy="${y}" r="1.4" fill="${ink(i)}"/>`

          return `<g opacity="${motion ? 0 : 0.8}">${anim(motionOf)}${shape}</g>`
        })
        .join('')

      return svg(W, H, '', body)
    }
  }
}

/** Unicorno's own pastels for the unicorn, the owner's palette. */
export const UNICORN_INKS: readonly string[] = ['#FBB0FA', '#C9A4F5', '#A4A5F4', '#A2BCF4']

/**
 * Unicorno's waiting mark: a small original unicorn (rounded body, head,
 * white horn, pastel mane and tail, four legs), 16 px tall in WAVE's box,
 * in a pastel gradient, hopping in place forever (a smooth arc with a small
 * squash as it lands, 0.9 s, first frame = last), a short trail of white
 * and pastel stars twinkling out behind it. Standing, with two stars, when
 * the theme has no motion.
 */
export const unicornDrawing = (colors: readonly string[], motion: boolean, now = 0): Drawing => {
  const { width: W, height: H } = WAVE
  const inks = colors.length >= 2 ? colors : UNICORN_INKS
  const at = (dur: number, lag = 0) => phaseAt(now, dur, lag)
  const stops = inks.map((hex, i) => `<stop offset="${(i / Math.max(1, inks.length - 1)).toFixed(2)}" stop-color="${hex}"/>`).join('')
  const defs = `<linearGradient id="uni" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`
  // the unicorn, facing right, its feet on y 19, about 16 px tall; x from 54
  const x0 = 54
  const unicorn =
    // tail and mane in the pastels
    `<path d="M${x0 + 1} 9c-3 0-4 3-3 5 1-1 2-1 3-2" fill="none" stroke="${inks[0]}" stroke-width="1.6" stroke-linecap="round"/>` +
    // legs
    [3, 6, 11, 14].map(x => `<rect x="${x0 + x}" y="14" width="1.8" height="5" rx="0.9" fill="url(#uni)"/>`).join('') +
    // body and neck, head
    `<ellipse cx="${x0 + 9}" cy="11.5" rx="7.5" ry="4.2" fill="url(#uni)"/>` +
    `<path d="M${x0 + 13} 10l2.5-5 3 1-1.5 5z" fill="url(#uni)"/>` +
    `<ellipse cx="${x0 + 18.5}" cy="5.6" rx="3.4" ry="2.5" fill="url(#uni)"/>` +
    // the horn, white, and the eye
    `<path d="M${x0 + 18} 3.6l2.6-3.4 0.2 3.6z" fill="#FFFFFF"/>` +
    `<circle cx="${x0 + 19.5}" cy="5.2" r="0.55" fill="#3A2A4A"/>` +
    // the mane
    `<path d="M${x0 + 15} 3.8c-1.5 1-2 3-1.6 5 0.8-1.2 1.6-1.6 2.6-2" fill="${inks[1] ?? inks[0]}"/>`
  // forward across the slot: the unicorn travels one slot width and a body more (it enters from beyond the left edge
  // and leaves beyond the right), hopping 3 times on the way; a second unicorn one travel behind it makes the loop
  // seamless (the same picture at both ends); stars fall behind where it hopped and fade out
  // from wholly beyond the left edge (its nose at x < 0) to wholly beyond the right (its tail at x > W)
  const start = -(x0 + 23)
  const end = W - x0 + 4
  const travel = end - start
  const lap = 2.7
  const hops = 3
  const hopDur = lap / hops
  const hop = motion
    ? `<animateTransform attributeName="transform" type="translate" additive="sum" dur="${hopDur}s" repeatCount="indefinite" values="0 0;0 -3.5;0 0;0 0" keyTimes="0;0.45;0.85;1" calcMode="spline" keySplines="0.3 0 0.5 1;0.5 0 0.7 1;0 0 1 1" begin="${at(hopDur)}s"/>`
    : ''
  const squash = motion
    ? `<animateTransform attributeName="transform" type="scale" additive="sum" dur="${hopDur}s" repeatCount="indefinite" values="1 1;1 1;1.06 0.9;1 1" keyTimes="0;0.8;0.9;1" begin="${at(hopDur)}s"/>`
    : ''
  const one = (shift: number) =>
    `<g transform="translate(${shift} 0)"><g>${hop}<g transform="translate(${x0 + 9} 19)"><g>${squash}<g transform="translate(${-(x0 + 9)} -19)">${unicorn}</g></g></g></g></g>`
  const star = (x: number, y: number, r: number, ink: string, lag: number) => {
    const twinkle = motion ? `<animate attributeName="opacity" dur="${hopDur}s" repeatCount="indefinite" values="0;1;0" keyTimes="0;0.3;1" begin="${at(hopDur, lag)}s"/>` : ''

    return `<path d="M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z" fill="${ink}" opacity="${motion ? 0 : 0.9}">${twinkle}</path>`
  }
  if (!motion) return svg(W, H, defs, `${star(46, 8, 2.6, '#FFFFFF', 0)}${star(36, 12, 2, inks[0] as string, 0)}${one(0)}`)
  // the trail rides with the unicorn, a little behind it, each star lit at a landing and fading
  const trail = star(x0 - 4, 14, 2.2, '#FFFFFF', 0.1) + star(x0 - 12, 9, 1.8, inks[0] as string, 0.35) + star(x0 - 20, 13, 1.4, inks[2] ?? '#FFFFFF', 0.6)
  const rider = (shift: number) => `<g transform="translate(${shift} 0)">${trail}</g>`
  const run = `<animateTransform attributeName="transform" type="translate" dur="${lap}s" repeatCount="indefinite" values="${start} 0;${end} 0" begin="${at(lap)}s"/>`

  return svg(W, H, defs, `<g>${run}${rider(0)}${one(0)}${rider(-travel)}${one(-travel)}</g>`)
}

/**
 * Unicorno Sfumature's waiting mark: a pastel shooting star crossing the slot
 * left to right on a gentle arc. A white four-point head with a soft glow, a
 * tapered ribbon trail flowing through the owner's pastels, five tiny stars
 * shed where it passed, each twinkling out. Seamless: the arc is periodic in
 * the travel and a second comet rides exactly one travel behind, the stars'
 * keyframes start and end at 0. Without motion: the comet mid-flight with its
 * stars lit.
 */
export const cometDrawing = (colors: readonly string[], motion: boolean, now = 0): Drawing => {
  const { width: W, height: H } = WAVE
  const inks = colors.length >= 2 ? colors : UNICORN_INKS
  const at = (dur: number, lag = 0) => phaseAt(now, dur, lag)
  const TRAIL = 34
  // from the head just beyond the left edge to just beyond the right, the trail still showing as the next one enters:
  // three comets one travel apart, so the picture at the loop's seam is the same
  const start = -6
  const end = W + 18
  const travel = end - start
  const lap = 2.8
  // the arc: highest mid-slot, periodic in the travel, so the comet one travel behind rides the same curve
  const yAt = (x: number) => H / 2 + 1.5 - 3.5 * Math.cos((2 * Math.PI * (x - W / 2)) / travel)
  const slope = (x: number) => (3.5 * 2 * Math.PI * Math.sin((2 * Math.PI * (x - W / 2)) / travel)) / travel
  const stops = [
    `<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/>`,
    ...inks.map((hex, i) => `<stop offset="${(0.12 + (0.78 * i) / Math.max(1, inks.length - 1)).toFixed(2)}" stop-color="${hex}" stop-opacity="${(0.9 - (0.75 * i) / Math.max(1, inks.length - 1)).toFixed(2)}"/>`),
    `<stop offset="1" stop-color="${inks[inks.length - 1]}" stop-opacity="0"/>`,
  ].join('')
  const defs =
    `<linearGradient id="ct" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${-TRAIL}" y2="0">${stops}</linearGradient>` +
    `<radialGradient id="cg"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="0.45" stop-color="${inks[0]}" stop-opacity="0.35"/><stop offset="1" stop-color="${inks[0]}" stop-opacity="0"/></radialGradient>`
  const star = (x: number, y: number, r: number) =>
    `M${r1(x)} ${r1(y - r)}L${r1(x + r * 0.26)} ${r1(y - r * 0.26)}L${r1(x + r)} ${r1(y)}L${r1(x + r * 0.26)} ${r1(y + r * 0.26)}L${r1(x)} ${r1(y + r)}L${r1(x - r * 0.26)} ${r1(y + r * 0.26)}L${r1(x - r)} ${r1(y)}L${r1(x - r * 0.26)} ${r1(y - r * 0.26)}Z`
  // the comet in its own frame: the head at 0 0, the trail toward -x
  const comet =
    `<path d="M0 -2.1C-8 -1.8 -20 -0.9 ${-TRAIL} 0C-20 0.9 -8 1.8 0 2.1Z" fill="url(#ct)"/>` +
    `<path d="M0 -0.7C-8 -0.5 -16 -0.2 ${-TRAIL * 0.6} 0C-16 0.2 -8 0.5 0 0.7Z" fill="#FFFFFF" opacity="0.7"/>` +
    `<circle r="5" fill="url(#cg)"/>` +
    `<path d="${star(0, 0, 3.4)}" fill="#FFFFFF"/>`
  // the stars it sheds, in the slot's frame, a little under the arc
  const shed = [14, 30, 47, 63, 80].map((x, i) => ({ x, y: yAt(x) + (i % 2 === 0 ? 3 : -2.5), r: i % 2 === 0 ? 1.9 : 1.5, ink: i === 2 ? '#FFFFFF' : (inks[i % inks.length] as string) }))
  if (!motion) {
    const x = 60
    const angle = (Math.atan(slope(x)) * 180) / Math.PI

    return svg(W, H, defs, shed.filter(s => s.x < x).map(s => `<path d="${star(s.x, s.y, s.r)}" fill="${s.ink}" opacity="0.8"/>`).join('') + `<g transform="translate(${x} ${r1(yAt(x))}) rotate(${r1(angle)})">${comet}</g>`)
  }
  // the flight: translate and tilt sampled along the arc, linear in x
  const N = 24
  const xs = Array.from({ length: N + 1 }, (_, i) => start + (travel * i) / N)
  const move = `<animateTransform attributeName="transform" type="translate" dur="${lap}s" repeatCount="indefinite" values="${xs.map(x => `${r1(x)} ${r1(yAt(x))}`).join(';')}" begin="${at(lap)}s"/>`
  const tilt = `<animateTransform attributeName="transform" type="rotate" dur="${lap}s" repeatCount="indefinite" values="${xs.map(x => r1((Math.atan(slope(x)) * 180) / Math.PI)).join(';')}" begin="${at(lap)}s"/>`
  const flier = (shift: number) => `<g transform="translate(${shift} 0)"><g>${move}<g>${tilt}${comet}</g></g></g>`
  // each star lit as the head passes it, then twinkling out, dark again well before the lap ends
  const lit = shed
    .map(s => {
      const t = (s.x - start) / travel
      const keys = [0, t, Math.min(t + 0.03, 0.97), Math.min(t + 0.16, 0.98), Math.min(t + 0.3, 0.99), 1].map(k => k.toFixed(3)).join(';')
      const fade = `<animate attributeName="opacity" dur="${lap}s" repeatCount="indefinite" keyTimes="${keys}" values="0;0;1;0.5;0;0" begin="${at(lap)}s"/>`
      const sink = `<animateTransform attributeName="transform" type="translate" dur="${lap}s" repeatCount="indefinite" keyTimes="${keys}" values="0 0;0 0;0 0;0 0.8;0 1.6;0 0" begin="${at(lap)}s"/>`

      return `<g opacity="0">${fade}<path d="${star(s.x, s.y, s.r)}" fill="${s.ink}">${sink}</path></g>`
    })
    .join('')

  return svg(W, H, defs, `${lit}<g>${flier(-travel)}${flier(0)}${flier(travel)}</g>`)
}

/**
 * A bubble's backdrop drawn in its underlay Svg (under the text, clipped by
 * the bubble), `w` by `h` px from x `x`: rain, slow columns of small glyphs
 * in `colors` at `alpha`, few and faint, fading out toward the middle where
 * the words are; still without motion. Glass: see glassBackdrop.
 */
export const rainBackdrop = (x: number, w: number, h: number, colors: readonly string[], alpha: number, motion: boolean, now = 0): string => {
  const glyphs = 'アイウエオカキクケコサシスセソタチツテトナニ0123456789'
  const head = '#A8FFD0'
  const trail = colors.find(c => c.toUpperCase() === '#39FF88') ?? colors.find(c => c.toUpperCase() !== head) ?? '#39FF88'
  // a column every 18 px; all of them in the outer 72 px of each side (the padding and the edges), every third in
  // between, behind the words, at under half the strength
  const step = 18
  const cols = Math.max(2, Math.floor((w - 8) / step))
  const LEN = 8
  const ROW = 13
  // each column a drop every TILE px down the whole drawing, moved down by one TILE a loop: the same picture at
  // the seam, and the same at every height the bubble clips it at
  const TILE = 420
  const tiles = Math.ceil(h / TILE) + 1
  const defs: string[] = []
  const out: string[] = []
  for (let i = 0; i < cols; i++) {
    const cx = Math.round(x + 6 + i * step + ((i * 7) % 5))
    const fromEdge = Math.min(cx - x, x + w - cx)
    const edge = fromEdge < 72
    if (!edge && i % 3 !== 1) continue
    const strength = edge ? alpha : alpha * 0.45
    const dur = r1(5.5 + ((i * 1.7) % 4))
    const offset = (i * 137) % TILE
    // the leading glyph (the lowest) brightest, in the light phosphor; the trail above it dimming in the green
    const drop = (shift: number) =>
      Array.from({ length: LEN }, (_, k) => {
        const fromHead = LEN - 1 - k
        const a = fromHead === 0 ? strength : strength * 0.85 * (1 - fromHead / LEN)

        return `<text x="${cx}" y="${(k + 1) * ROW}" font-family="ui-monospace, Menlo, monospace" font-size="11.5" fill="${fromHead === 0 ? head : trail}" fill-opacity="${a.toFixed(3)}">${escapeXml(glyphs[(i * 5 + k * 3 + shift) % glyphs.length] as string)}</text>`
      }).join('')
    defs.push(`<g id="rd${i}">${drop(0)}</g>`)
    const fall = motion ? `<animateTransform attributeName="transform" type="translate" dur="${dur}s" repeatCount="indefinite" values="0 0;0 ${TILE}" begin="${phaseAt(now, dur, i * 0.9)}s"/>` : ''
    const copies = Array.from({ length: tiles }, (_, t) => `<use href="#rd${i}" y="${offset + (t - 1) * TILE}"/>`).join('')
    // at the edges a second drop half a tile down: twice as dense where there are no words
    const twins = edge ? Array.from({ length: tiles }, (_, t) => `<use href="#rd${i}" y="${offset + (t - 1) * TILE + TILE / 2}"/>`).join('') : ''
    out.push(`<g>${fall}${copies}${twins}</g>`)
  }

  return `<defs>${defs.join('')}</defs>${out.join('')}`
}

export type HeadingEffect = 'decode' | 'gradient-drift' | 'silver-cut' | 'neon-tube' | 'frost' | 'glitch' | 'sparkle' | 'gradient' | 'leaf' | 'serif'

/**
 * A heading's signature effect laid over its drawing's parts (headingDrawing
 * in reply.tsx hands the text elements and their size): extra defs, a
 * wrapper for the text, and pieces over it. The text stays drawn in full in
 * every frame but decode's first second, and is the Svg's alt.
 */
export const headingEffect = (effect: HeadingEffect | undefined, motion: boolean, now: number, size: { width: number; height: number }, colors: readonly string[]): { defs: string; open: string; close: string; over: string; gradient: string } => {
  const at = (dur: number, lag = 0) => phaseAt(now, dur, lag)
  const none = { defs: '', open: '', close: '', over: '', gradient: '' }
  const first = colors[0] ?? '#FFFFFF'
  const last = colors[colors.length - 1] ?? first
  switch (effect) {
    case 'gradient-drift':
      return { ...none, gradient: motion ? `<animateTransform attributeName="gradientTransform" type="translate" values="-0.5 0;0.5 0;-0.5 0" dur="8s" repeatCount="indefinite" begin="${at(8)}s"/>` : '' }
    case 'silver-cut':
      return {
        ...none,
        defs: `<linearGradient id="cut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>${motion ? `<animateTransform attributeName="gradientTransform" type="translate" values="-1 0;1 0;1 0" keyTimes="0;0.3;1" dur="6s" repeatCount="indefinite" begin="${at(6)}s"/>` : ''}</linearGradient><mask id="cutm"><g id="cutt"></g></mask>`,
        over: 'CUT',
      }
    case 'neon-tube':
      return {
        ...none,
        defs: `<filter id="neon" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
        open: `<g filter="url(#neon)">${motion ? `<animate attributeName="opacity" dur="5s" repeatCount="indefinite" keyTimes="0;0.02;0.04;0.06;0.08;1" values="1;0.3;1;0.4;0.8;1" begin="${at(5)}s"/>` : ''}`,
        close: '</g>',
      }
    case 'frost':
      return {
        ...none,
        defs: `<filter id="frost" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b"/><feFlood flood-color="#FFFFFF" flood-opacity="0.35"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
        open: '<g filter="url(#frost)">',
        close: '</g>',
      }
    case 'glitch':
      return {
        ...none,
        over: motion ? `GLITCH:${at(3)}` : '',
      }
    case 'sparkle': {
      const stars = [0.15, 0.45, 0.8]
        .map((x, i) => {
          const cx = Math.round(size.width * x)
          const cy = Math.round(size.height * (0.2 + 0.25 * i))
          const twinkle = motion ? `<animate attributeName="opacity" dur="${1.6 + i * 0.4}s" repeatCount="indefinite" values="0;1;0" begin="${at(1.6 + i * 0.4, i * 0.5)}s"/>` : ''

          return `<path d="M${cx} ${cy - 4}L${cx + 1} ${cy - 1}L${cx + 4} ${cy}L${cx + 1} ${cy + 1}L${cx} ${cy + 4}L${cx - 1} ${cy + 1}L${cx - 4} ${cy}L${cx - 1} ${cy - 1}Z" fill="${i % 2 ? last : '#FFFFFF'}" opacity="${motion ? 0 : 0.8}">${twinkle}</path>`
        })
        .join('')

      return { ...none, over: stars }
    }
    case 'decode':
      return {
        ...none,
        defs: `<clipPath id="dec"><rect x="0" y="0" width="${motion ? 0 : size.width}" height="${size.height}">${motion ? `<animate attributeName="width" from="0" to="${size.width}" dur="0.9s" fill="freeze"/>` : ''}</rect></clipPath>`,
        open: '<g clip-path="url(#dec)">',
        close: '</g>',
        over: motion ? `<rect x="0" y="${Math.round(size.height * 0.75)}" width="2" height="${Math.round(size.height * 0.2)}" fill="${first}"><animate attributeName="x" from="0" to="${size.width}" dur="0.9s" fill="freeze"/><animate attributeName="opacity" values="1;0" begin="0.9s" dur="0.2s" fill="freeze"/></rect>` : '',
      }
    default:
      return none
  }
}

/**
 * The page's digital rain (a theme's `page.kind: "rain"`, Fosforo
 * Sfumature's own): phosphor glyph columns falling behind the whole
 * conversation, on the app's ground `base`, the leading glyph brightest at
 * `alpha`, its trail dimming. Drawn 1600 x 1000 and sliced to the window.
 * Seamless: each column a drop every TILE px moved down one TILE a loop.
 * One source for a theme, whatever the moment (the image never reloads);
 * still without motion. A few glyph columns shared by `use`, so the source
 * stays small.
 */
export const pageRainDrawing = (colors: readonly string[], alpha: number, motion: boolean, base: string): Drawing => {
  const W = 1600
  const H = 1000
  const glyphs = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789'
  const head = '#A8FFD0'
  const trail = colors.find(c => c.toUpperCase() === '#39FF88') ?? colors[0] ?? '#39FF88'
  const LEN = 12
  const ROW = 16
  const TILE = 520
  const STEP = 24
  const KINDS = 9
  // nine drops of their own glyphs; every column one of them
  const defs = Array.from({ length: KINDS }, (_, d) => {
    const chars = Array.from({ length: LEN }, (_, k) => {
      const fromHead = LEN - 1 - k
      const a = fromHead === 0 ? alpha : alpha * 0.8 * (1 - fromHead / LEN)

      return `<text y="${(k + 1) * ROW}" fill="${fromHead === 0 ? head : trail}" fill-opacity="${a.toFixed(3)}">${escapeXml(glyphs[(d * 7 + k * 5) % glyphs.length] as string)}</text>`
    }).join('')

    return `<g id="pr${d}" font-family="ui-monospace, Menlo, monospace" font-size="14">${chars}</g>`
  }).join('')
  const cols = Math.floor(W / STEP)
  const tiles = Math.ceil(H / TILE) + 1
  const body = Array.from({ length: cols }, (_, i) => {
    const x = 6 + i * STEP
    const d = (i * 4) % KINDS
    const offset = (i * 211) % TILE
    const dur = r1(7 + ((i * 1.3) % 6))
    const fall = motion ? `<animateTransform attributeName="transform" type="translate" dur="${dur}s" repeatCount="indefinite" values="0 0;0 ${TILE}" begin="${-r1((i * 0.77) % dur)}s"/>` : ''
    const uses = Array.from({ length: tiles }, (_, t) => `<use href="#pr${d}" x="${x}" y="${offset + (t - 1) * TILE}"/>`).join('')

    return `<g>${fall}${uses}</g>`
  }).join('')

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs><rect width="100%" height="100%" fill="${base}"/>${body}</svg>`,
    width: W,
    height: H,
  }
}

/**
 * A drawing's animations locked to the wall clock. The desktop draws an Svg as
 * an <img>, and an <img> starts its animations from 0 whenever it is created,
 * a remounted row (scrolling, a reply streaming in, a row expanding) or a new
 * source alike (measured: scenes/../frames/remount.mjs). So each animation's
 * `begin` is set from the clock at render time: a looping one (repeatCount
 * indefinite) to where its loop stands now (its own lag kept), a one-shot
 * (fill freeze) to how long ago the drawing first appeared (`born`), so it
 * plays once and a later remount shows it finished. Without motion nothing
 * changes. The drawing's own begins, written for the clock at 0, carry each
 * element's lag.
 */
export const phaseLock = (source: string, now: number, born = now): string => {
  if (!source.includes('<animate')) return source
  const seconds = now / 1000
  const since = Math.max(0, (now - born) / 1000)

  return source.replace(/<(animate|animateTransform|animateMotion)\b([^>]*?)(\/?)>/g, (whole, tag: string, attrs: string, close: string) => {
    const dur = Number(/\bdur="([\d.]+)s"/.exec(attrs)?.[1] ?? NaN)
    if (!Number.isFinite(dur) || dur <= 0) return whole
    // a begin tied to an event or another animation is left as written
    if (/\bbegin="/.test(attrs) && !/\bbegin="-?[\d.]+s"/.test(attrs)) return whole
    const begin = /\bbegin="(-?[\d.]+)s"/.exec(attrs)
    const lag = begin ? -Number(begin[1]) : 0
    const loops = /repeatCount="indefinite"/.test(attrs)
    const at = loops ? -(((seconds + lag) % dur) + dur) % dur : -(since + lag)
    const rest = attrs.replace(/\s*\bbegin="[^"]*"/, '')

    return `<${tag}${rest} begin="${at.toFixed(3)}s"${close}>`
  })
}

/** The ink written on a steady frame's root, so the desktop never writes the host's own (see steadyFrame). */
export const STEADY_INK = { color: '#FFFFFF', font: 'system-ui, sans-serif' } as const

/**
 * A looping drawing for an interactive Svg that keeps running across the
 * desktop's redraws. The desktop draws an interactive Svg in a sandboxed
 * frame and, when it redraws a tree, keeps a frame equal to the old one (same
 * source, same place) with its document and its clock; an <img> it makes
 * again every time, restarting the animations. Equal means byte for byte: so
 * the source carries no moment (no phase lock, the same on every render) and
 * the root its own colour and font, else the desktop writes the host's in
 * (they change with the row's ink and would make a new frame).
 */
export const steadyFrame = (source: string): string => {
  const root = /^<svg\b[^>]*>/.exec(source)?.[0]
  if (root === undefined) return source
  const add = (/\scolor=/.test(root) ? '' : ` color="${STEADY_INK.color}"`) + (/\sfont-family=/.test(root) ? '' : ` font-family="${STEADY_INK.font}"`)

  return add === '' ? source : `<svg${add}${source.slice(4)}`
}

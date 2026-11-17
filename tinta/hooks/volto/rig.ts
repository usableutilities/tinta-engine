import type { Mood } from './tipi'

/**
 * Il "rig" comune a ogni personaggio: un solo disegno per tutta la vita del
 * pannello. L'umore entra nel riquadro come la sua larghezza (un righello
 * accanto, vedi register.tsx); dentro, una media query per umore imposta
 * pose e pesi, e le transizioni CSS su proprieta' registrate (@property)
 * interpolano tutto. I micro-movimenti di ogni umore girano sempre, ciascuno
 * moltiplicato per il peso del suo umore: cambiare umore li dissolve, non li
 * interrompe.
 */

export const MOODS: readonly Mood[] = ['idle', 'listening', 'thinking', 'working', 'talking', 'waiting', 'happy', 'worried']

/**
 * L'altezza del riquadro per l'umore: la base piu' 3 px per umore. La larghezza e' quella vera
 * del pannello (il riquadro la prende tutta); l'altezza, esatta in px, porta l'umore dentro il disegno.
 */
export const heightFor = (mood: Mood, h: number, level = 0) => h + MOOD_STEP * MOODS.indexOf(mood) + (mood === 'talking' ? Math.max(0, Math.min(4, Math.round(level))) : 0)

/**
 * Ogni umore occupa 8 px di altezza; mentre parla, i px 1-4 della sua fascia portano il volume della
 * voce (0: nessun dato, la bocca segue il suo ritmo; 1 chiusa ... 4 aperta): labbra a tempo con l'audio.
 */
export const MOOD_STEP = 8

/** Il riquadro: altezza di base in px e colonne del pannello (per stimarne la forma). */
export type Frame = { h: number; cols: number; tempo?: number }

/**
 * Il riquadro per un pannello di `cols` x `rows` celle: alto quanto resta tolta la barra dei comandi
 * (stima per difetto: una riga e' circa 18 px o piu'), a passi di 20 px cosi' un piccolo
 * ridimensionamento non cambia la sorgente.
 */
export const frameFor = (cols: number, rows: number): Frame => {
  const h = rows > 0 ? Math.max(180, Math.min(2400, Math.floor((rows * 18 - 70) / 20) * 20)) : 220

  return { h, cols: Math.max(10, cols) }
}

/** Il volto (0..200) sta al centro con un margine: occupa circa il 77% del lato piu' corto. */
export const VIEWBOX = '-30 -30 260 260'

/**
 * La parte di disegno che puo' vedersi attorno al volto, in coordinate del volto: lo sfondo la copre
 * tutta. La forma vera del pannello non si conosce: si stima dalle colonne e si abbonda.
 */
export const viewOf = (f: Frame) => {
  const estWide = Math.max(240, f.cols * 9)
  const ratio = f.h / estWide
  const w = 260 * (ratio < 1 ? Math.min(1 / ratio, 3) : 1) * 1.25
  const h = 260 * (ratio > 1 ? Math.min(ratio, 5) : 1) * 1.25

  return { x: 100 - w / 2, y: 100 - h / 2, w, h }
}

/** L'apertura del disegno: riempie il riquadro, il volto centrato. */
export const svgOpen = (_f: Frame, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" color="${color}" font-family="system-ui, sans-serif" width="100%" height="100%" viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet">`

/** Lo sfondo che riempie tutto il riquadro, fermo sotto il volto. */
export const backdrop = (f: Frame, fill: string, glow?: string) => {
  const v = viewOf(f)

  return (
    `<rect x="${n(v.x - 2)}" y="${n(v.y - 2)}" width="${n(v.w + 4)}" height="${n(v.h + 4)}" fill="${fill}"/>` +
    (glow ? `<radialGradient id="v-bg-glow" cx="100" cy="100" r="160" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${glow}" stop-opacity=".16"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient><rect x="${n(v.x - 2)}" y="${n(v.y - 2)}" width="${n(v.w + 4)}" height="${n(v.h + 4)}" fill="url(#v-bg-glow)"/>` : '')
  )
}

const MORPH = '.38s cubic-bezier(.4,0,.2,1)'
const n = (v: number) => String(Math.round(v * 1000) / 1000)

// --- pose: numeri che ogni umore imposta e che passano da un umore all'altro ---

export type Pose = {
  eye: number // apertura delle palpebre (1 aperto)
  wide: number // scala dell'occhio (occhi sgranati)
  px: number // sguardo di base
  py: number
  pr: number // scala della pupilla
  lower: number // palpebra inferiore che sale (sorriso, socchiuso)
  blush: number
  cheek: number // guance che salgono (px, negativo = su)
  tilt: number // inclinazione della testa (gradi)
  ear: number // orecchie / antenna (gradi, positivo = giu')
  glow: number // luminosita' (robot)
}

export const POSES: { [mood in Mood]: Pose } = {
  idle: { eye: 1, wide: 1, px: 0, py: 0, pr: 1, lower: 0.08, blush: 0.15, cheek: 0, tilt: 0, ear: 0, glow: 0.75 },
  listening: { eye: 1.1, wide: 1.06, px: 0, py: -5, pr: 1, lower: 0, blush: 0.1, cheek: 0, tilt: 3, ear: -12, glow: 0.9 },
  thinking: { eye: 0.92, wide: 1, px: 0, py: -2, pr: 0.92, lower: 0.12, blush: 0, cheek: 0, tilt: 0, ear: 4, glow: 0.7 },
  working: { eye: 0.9, wide: 1, px: 0, py: 3, pr: 1, lower: 0.1, blush: 0, cheek: 0, tilt: 0, ear: 0, glow: 0.85 },
  talking: { eye: 1, wide: 1, px: 0, py: 0, pr: 1, lower: 0.1, blush: 0.2, cheek: -1, tilt: 0, ear: -4, glow: 0.95 },
  waiting: { eye: 1.15, wide: 1.1, px: 0, py: 0, pr: 1.15, lower: 0, blush: 0, cheek: 0, tilt: 0, ear: -16, glow: 1 },
  happy: { eye: 1, wide: 1, px: 0, py: -1, pr: 1, lower: 0.55, blush: 0.75, cheek: -5, tilt: 0, ear: -8, glow: 1 },
  worried: { eye: 1.05, wide: 1.04, px: 0, py: 3, pr: 0.9, lower: 0.05, blush: 0, cheek: 1, tilt: 0, ear: 22, glow: 0.55 },
}

const POSE_KEYS = Object.keys(POSES.idle) as (keyof Pose)[]

// --- forme: parametri comuni che ogni personaggio traduce nella sua geometria ---

export type BrowShape = { lift: number; tilt: number; arch: number }
export type MouthShape = { w: number; up: number; low: number; corner: number; wave: number }

export const SHAPES: { [mood in Mood]: { brow: BrowShape; mouth: MouthShape } } = {
  idle: { brow: { lift: 0, tilt: 0, arch: 3 }, mouth: { w: 14, up: 4, low: 5, corner: -1, wave: 0 } },
  listening: { brow: { lift: -7, tilt: 0, arch: 4 }, mouth: { w: 6, up: -4, low: 6, corner: 0, wave: 0 } },
  thinking: { brow: { lift: -1, tilt: 3, arch: 1 }, mouth: { w: 8, up: 1, low: 1.5, corner: 1, wave: 1.5 } },
  working: { brow: { lift: 1, tilt: 2, arch: 2 }, mouth: { w: 11, up: 0, low: 0.6, corner: 0, wave: 0 } },
  talking: { brow: { lift: -2, tilt: 0, arch: 4 }, mouth: { w: 12, up: 0, low: 8, corner: -1, wave: 0 } },
  waiting: { brow: { lift: -10, tilt: -1, arch: 5 }, mouth: { w: 10, up: 2, low: 3, corner: 0, wave: 0 } },
  happy: { brow: { lift: -4, tilt: 0, arch: 5 }, mouth: { w: 20, up: 3, low: 15, corner: -5, wave: 0 } },
  worried: { brow: { lift: -3, tilt: -5, arch: 0 }, mouth: { w: 15, up: 1, low: 7, corner: 5, wave: 3.5 } },
}

/** Bocca centrata in 0,0: due cubiche chiuse (labbro sopra, sotto), stessa struttura in ogni umore. */
export const mouthD = (m: MouthShape, s = 1) => {
  const w = m.w * s
  const h = w / 2
  const y = m.corner * s
  const up = m.up * s
  const low = m.low * s
  const wv = m.wave * s

  return `M${n(-w)} ${n(y)}C${n(-h)} ${n(up + wv)} ${n(h)} ${n(up - wv)} ${n(w)} ${n(y)}C${n(h)} ${n(low - wv)} ${n(-h)} ${n(low + wv)} ${n(-w)} ${n(y)}Z`
}

/** Sopracciglio da esterno a interno, base `y`; stessa struttura in ogni umore. */
export const browD = (outerX: number, innerX: number, y: number, b: BrowShape, s = 1) => {
  const iy = y + (b.lift + b.tilt) * s
  const oy = y + (b.lift - b.tilt * 0.5) * s
  const cx = (outerX + innerX) / 2
  const cy = (iy + oy) / 2 - b.arch * s

  return `M${n(outerX)} ${n(oy)}Q${n(cx)} ${n(cy)} ${n(innerX)} ${n(iy)}`
}

// --- micro-movimenti: tracce di fotogrammi chiave per umore ---

/** Un fotogramma: istante (s), valori dei canali, curva del tratto che arriva qui. */
type Beat = { at: number; v: { [channel: string]: number }; ease?: string }
type Track = { dur: number; frames: Beat[] }

const SACCADE = 'cubic-bezier(.25,0,.15,1)'
const SMOOTH = 'cubic-bezier(.45,0,.55,1)'
const READ = 'cubic-bezier(.3,0,.7,1)'

/** Fissazione dello sguardo: dove, quanto socchiuso, per quanto, come ci si arriva. */
type Fix = { x: number; y: number; s?: number; hold: number; move?: number; ease?: string }

const gaze = (fixes: Fix[]): Track => {
  const frames: Beat[] = []
  let at = 0
  fixes.forEach((f, i) => {
    at += i === 0 ? 0 : (f.move ?? 0.07)
    const v = { gx: f.x, gy: f.y, sq: f.s ?? 0 }
    frames.push({ at, v, ease: f.ease ?? SACCADE }, { at: at + f.hold, v })
    at += f.hold
  })

  return { dur: at + 0.09, frames }
}

const one = (channel: string, dur: number, pairs: [number, number][], ease = SMOOTH): Track => ({
  dur,
  frames: pairs.map(([at, v]) => ({ at, v: { [channel]: v }, ease })),
})

const two = (a: string, b: string, dur: number, rows: [number, number, number][], ease = SMOOTH): Track => ({
  dur,
  frames: rows.map(([at, x, y]) => ({ at, v: { [a]: x, [b]: y }, ease })),
})

/** I canali per umore: sguardo (gx gy sq), testa (sway bob), bocca (mx my, talk tw), sopracciglia (bl br). */
const MOTION: { [mood in Mood]: Track[] } = {
  idle: [
    gaze([
      { x: 0, y: 0, hold: 2.6 },
      { x: -7, y: 1, hold: 1.1 },
      { x: -6, y: 2, hold: 0.7, move: 0.05 },
      { x: 0, y: 0, hold: 3.4, move: 0.09 },
      { x: 6, y: -4, hold: 1.3 },
      { x: 2, y: 3, hold: 1.8, move: 0.08 },
    ]),
  ],
  listening: [
    gaze([
      { x: 0, y: 0, hold: 1.8 },
      { x: 3, y: -1, hold: 1.2 },
      { x: -2, y: -2, hold: 1.5, move: 0.06 },
      { x: 1, y: 1, hold: 0.9 },
    ]),
  ],
  thinking: [
    gaze([
      { x: 0, y: 0, hold: 0.5 },
      { x: -8, y: -8, hold: 1.4 },
      { x: -7, y: -9, hold: 0.6, move: 0.05 },
      { x: 7, y: -9, s: 0.18, hold: 1.2, move: 0.09 },
      { x: 8, y: -7, s: 0.22, hold: 0.8, move: 0.05 },
      { x: -4, y: 2, hold: 0.7 },
      { x: -9, y: -3, hold: 1.1 },
      { x: 4, y: -10, hold: 1 },
    ]),
    two('mx', 'my', 7.7, [[0, 0, 0], [1.2, 0, 0], [1.5, -5, 1], [3.4, -5, 1], [3.8, 4, 0], [5.6, 4, 0], [6, 0, 0]]),
    two('bl', 'br', 8.9, [[0, 0, 0], [1.6, 0, 0], [1.85, 0, -7], [3.6, 0, -7], [3.95, 0, 0], [5.4, 0, 0], [5.7, -3, 0], [6.9, -3, 0], [7.2, 0, 0]]),
  ],
  working: [
    // lettura: sinistra -> destra lenta, a capo piu' in basso, tre righe, poi su
    gaze([
      { x: -8, y: -2, hold: 0.15 },
      { x: 8, y: -2, hold: 0.12, move: 1.05, ease: READ },
      { x: -8, y: 1, hold: 0.15, move: 0.12 },
      { x: 7, y: 1, hold: 0.12, move: 0.9, ease: READ },
      { x: -8, y: 4, hold: 0.15, move: 0.12 },
      { x: 3, y: 4, hold: 0.5, move: 0.7, ease: READ },
      { x: 6, y: -3, hold: 0.4, move: 0.1 },
    ]),
  ],
  talking: [
    gaze([
      { x: 0, y: 0, hold: 1.6 },
      { x: -4, y: -1, hold: 0.9 },
      { x: 1, y: 0, hold: 1.4, move: 0.06 },
      { x: 4, y: -2, hold: 0.7 },
    ]),
    // aperture irregolari: delta di scala verticale (talk) e orizzontale (tw)
    two('talk', 'tw', 2.71, [
      [0, 0, 0], [0.13, -0.62, -0.12], [0.31, 0.38, 0.08], [0.44, -0.74, -0.2], [0.71, -0.1, -0.06], [0.86, -0.3, -0.35],
      [1.12, -0.5, 0], [1.33, 0.3, 0.14], [1.61, -0.64, -0.14], [1.94, 0, 0], [2.09, -0.72, -0.24], [2.42, -0.22, -0.06],
    ], 'cubic-bezier(.35,0,.4,1)'),
    two('bl', 'br', 3.83, [[0, 0, 0], [0.9, 0, 0], [1.1, -4, -4.5], [1.6, 0, 0], [2.9, 0, 0], [3.05, -2.5, -2], [3.4, 0, 0]]),
    // un secondo ritmo sopra il primo (1.79 s contro 2.71 s): o tonde (strette e alte), i larghe (basse e larghe),
    // chiusure brevi; insieme non si ripetono quasi mai uguali
    two('tk2', 'tw2', 1.79, [
      [0, 0, 0], [0.17, 0.25, -0.22], [0.31, -0.3, 0.18], [0.52, 0.15, 0.12], [0.66, -0.45, 0], [0.83, 0.3, -0.2], [1.07, -0.2, 0.22], [1.24, 0.1, -0.1], [1.43, -0.4, 0.05], [1.6, 0.2, 0.15],
    ], 'cubic-bezier(.35,0,.4,1)'),
  ],
  waiting: [
    gaze([
      { x: 0, y: 0, hold: 2.2 },
      { x: 2, y: -1, hold: 1, move: 0.05 },
      { x: -1, y: 0, hold: 1.7, move: 0.05 },
    ]),
  ],
  happy: [
    gaze([
      { x: 0, y: 0, hold: 1.5 },
      { x: -3, y: -1, hold: 0.8 },
      { x: 3, y: -1, hold: 0.9 },
    ]),
  ],
  worried: [
    gaze([
      { x: 0, y: 0, hold: 0.6 },
      { x: -7, y: 3, hold: 0.45 },
      { x: 6, y: 2, hold: 0.5 },
      { x: -2, y: 5, hold: 0.8 },
      { x: 5, y: -1, hold: 0.35 },
    ]),
    two('mx', 'my', 0.41, [[0, 0, 0], [0.1, -0.9, 0], [0.24, 0.8, 0.3]]),
  ],
}

/** Canali comuni a ogni umore, mai pesati: tremolio, battito di ciglia, respiro. */
const GLOBAL: Track[] = [
  two('jx', 'jy', 1.93, [[0, 0, 0], [0.31, 0.7, -0.4], [0.52, 0.2, 0.5], [0.97, -0.6, 0.2], [1.21, -0.3, -0.6], [1.63, 0.5, 0.1]]),
  // ciglia: a istanti irregolari su 13.7 s, con un doppio battito
  {
    dur: 13.7,
    frames: [0, 1.9, 6.4, 6.75, 9.1, 11.2].flatMap((t, i) =>
      i === 0
        ? [{ at: 0, v: { blink: 1 } }]
        : [
            { at: t, v: { blink: 1 } },
            { at: t + 0.07, v: { blink: 0 }, ease: 'cubic-bezier(.5,0,1,1)' },
            { at: t + 0.19, v: { blink: 1 }, ease: 'cubic-bezier(0,0,.4,1)' },
          ],
    ),
  },
]

/** Le proprieta' di un umore: `--<mood>-<canale>`; quelle comuni: `--<canale>`. */
const channelsOf = (tracks: Track[]) => [...new Set(tracks.flatMap(t => t.frames.flatMap(f => Object.keys(f.v))))]

/** @keyframes di una traccia; il loop si chiude sul primo fotogramma. */
const keyframes = (name: string, track: Track, prop: (channel: string) => string) => {
  const frames = track.frames
  const first = frames[0]
  const all = first && (frames[frames.length - 1]?.at ?? 0) < track.dur ? [...frames, { at: track.dur, v: first.v, ease: SMOOTH }] : frames
  const body = all
    .map((f, i) => {
      const next = all[i + 1]
      const pct = Math.min(100, (f.at / track.dur) * 100)
      const decl = Object.entries(f.v).map(([c, v]) => `${prop(c)}:${n(v)}`).join(';')
      const ease = next ? `;animation-timing-function:${next.ease ?? SMOOTH}` : ''

      return `${n(pct)}%{${decl}${ease}}`
    })
    .join('')

  return `@keyframes ${name}{${body}}`
}

/** La somma pesata di un canale su tutti gli umori che lo usano. */
const weighted = (channel: string) => {
  const terms = MOODS.filter(m => channelsOf(MOTION[m]).includes(channel)).map(m => `var(--w-${m})*var(--${m}-${channel})`)

  return terms.length === 0 ? '0' : terms.join(' + ')
}

/** Ogni forma che cambia con l'umore: selettore -> d per umore. */
export type ShapeRules = { [selector: string]: (mood: Mood) => string }

/** Il foglio di stile del rig: proprieta', pose, pesi, loop, e le forme del personaggio. */
export const rigCss = (f: Frame, shapes: ShapeRules, extra = '', idleCss = '') => {
  const h0 = f.h
  // la bocca che parla segue la velocita' della voce
  const tempo = f.tempo && f.tempo > 0 ? f.tempo : 1
  const props: string[] = []
  const register = (name: string, initial: number) =>
    props.push(`@property --${name}{syntax:'&lt;number&gt;';inherits:true;initial-value:${n(initial)}}`)

  MOODS.forEach(m => register(`w-${m}`, m === 'idle' ? 1 : 0))
  register('lipon', 0)
  register('lvl', 0)
  POSE_KEYS.forEach(k => register(k, POSES.idle[k]))
  const loops: string[] = []
  const anims: string[] = []
  MOODS.forEach(m => {
    channelsOf(MOTION[m]).forEach(c => register(`${m}-${c}`, 0))
    MOTION[m].forEach((track, i) => {
      const dur = m === 'talking' && track.frames.some(fr => 'talk' in fr.v || 'tk2' in fr.v) ? track.dur / tempo : track.dur
      loops.push(keyframes(`volto-${m}-${i}`, track, c => `--${m}-${c}`))
      anims.push(`volto-${m}-${i} ${n(dur)}s infinite`)
    })
  })
  channelsOf(GLOBAL).forEach(c => register(c, c === 'blink' ? 1 : 0))
  GLOBAL.forEach((track, i) => {
    loops.push(keyframes(`volto-g-${i}`, track, c => `--${c}`))
    anims.push(`volto-g-${i} ${n(track.dur)}s infinite`)
  })

  const poseDecl = (mood: Mood) => POSE_KEYS.map(k => `--${k}:${n(POSES[mood][k])}`).join(';')
  const weightDecl = (mood: Mood) => MOODS.map(m => `--w-${m}:${m === mood ? 1 : 0}`).join(';')
  const shapeDecl = (mood: Mood) => Object.entries(shapes).map(([sel, d]) => `${sel}{d:path("${d(mood)}")}`).join('')
  const selectors = Object.keys(shapes).join(',')

  // le grandezze derivate, ricalcolate a ogni fotogramma dalle proprieta' animate
  const derived = [
    `--GX:calc(var(--px) + ${weighted('gx')} + var(--jx))`,
    `--GY:calc(var(--py) + ${weighted('gy')} + var(--jy))`,
    `--SQ:calc(${weighted('sq')})`,
    `--OPEN:clamp(0, calc(var(--eye) * var(--blink) - var(--SQ) - var(--GY) * 0.012), 1.2)`,
    // la testa sta ferma: solo la posa dell'umore (un cenno mentre ascolta), che arriva con la transizione
    `--SWAY:calc(var(--tilt))`,
    `--BOB:0`,
    `--MX:calc(${weighted('mx')})`,
    `--MY:calc(${weighted('my')})`,
    // la bocca: il suo ritmo, o il volume della voce quando c'e' (lipon)
    `--TALK:calc((${weighted('talk')} + (${weighted('tk2')})) * (1 - var(--lipon)) + var(--w-talking) * var(--lipon) * (var(--lvl) * 0.75 - 0.6))`,
    `--TW:calc((${weighted('tw')} + (${weighted('tw2')})) * (1 - var(--lipon)))`,
    `--BL:calc(${weighted('bl')})`,
    `--BR:calc(${weighted('br')})`,
  ].join(';')

  const rules = [
    `:root{${derived};animation:${anims.join(',')};transition:${[...MOODS.map(m => `--w-${m}`), ...POSE_KEYS.map(k => `--${k}`)].map(p => `${p} ${MORPH}`).join(',')},--lvl .07s linear,--lipon .2s linear}`,
    `${selectors}{transition:d ${MORPH}}`,
    // la testa: inclinazione e saltello attorno al collo, respiro dal basso
    `.v-sway{transform:translate(0px,calc(var(--BOB) * 1px)) translate(100px,180px) rotate(calc(var(--SWAY) * 1deg)) translate(-100px,-180px)}`,
    // occhio: tutto disegnato attorno a 0,0 dentro un gruppo gia' spostato al centro
    `.v-eyesc{transform:scale(var(--wide))}`,
    `:root{--gs:1}`,
    // lo sguardo in px, scalato alla grandezza dell'occhio del personaggio (--gs)
    `.v-iris{transform:translate(calc(var(--GX) * var(--gs) * 1px),calc(var(--GY) * var(--gs) * 1px)) scale(var(--pr))}`,
    `.v-open{transform:scale(1,min(var(--OPEN), 1))}`,
    `.v-lid{transform:translate(0px,calc((1 - min(var(--OPEN), 1)) * var(--ry) * 1.96px))}`,
    `.v-low{transform:translate(0px,calc((var(--lower) + var(--SQ) * 0.6) * var(--ry) * -1px))}`,
    // le sopracciglia seguono lo sguardo, e si alzano da sole (enfasi)
    `.v-brows{transform:translate(calc(var(--GX) * 0.18px),calc((var(--GY) * 0.45 + var(--SQ) * 14) * 1px))}`,
    `.v-brow-l{transform:translate(0px,calc(var(--BL) * 1px))}`,
    `.v-brow-r{transform:translate(0px,calc(var(--BR) * 1px))}`,
    `.v-mouth{transform:translate(calc(var(--MX) * 1px),calc(var(--MY) * 1px)) scale(calc(1 + var(--TW)),calc(1 + var(--TALK)))}`,
    `.v-blush{opacity:var(--blush)}`,
    `.v-cheek{transform:translate(0px,calc(var(--cheek) * 1px))}`,
    `.v-ear-l{transform:rotate(calc(var(--ear) * -1deg))}`,
    `.v-ear-r{transform:rotate(calc(var(--ear) * 1deg))}`,
    `.v-glow{opacity:var(--glow)}`,
    `@keyframes volto-hop{0%{transform:translate(0,0);animation-timing-function:cubic-bezier(.3,0,.4,1)}25%{transform:translate(0,-6px);animation-timing-function:cubic-bezier(.6,0,.7,1)}50%{transform:translate(0,0);animation-timing-function:cubic-bezier(.3,0,.4,1)}75%{transform:translate(0,-3px);animation-timing-function:cubic-bezier(.6,0,.7,1)}100%{transform:translate(0,0)}}`,
    `:root{${poseDecl('idle')}}`,
    shapeDecl('idle'),
  ]
  // ogni umore: la sua fascia di larghezza
  const blocks = MOODS.map(m => {
    const h = heightFor(m, h0)
    const hop = m === 'happy' ? `.v-hop{animation:volto-hop .8s .38s both}` : m === 'idle' ? idleCss : ''
    // mentre parla, una fascia per livello di voce
    const lips = m === 'talking'
      ? [1, 2, 3, 4].map(l => `@media (min-height:${n(h + l - 0.45)}px) and (max-height:${n(h + l + 0.45)}px){:root{--lipon:1;--lvl:${n((l - 1) / 3)}}}`).join('')
      : ''

    return lips + `@media (min-height:${n(h - 0.45)}px) and (max-height:${n(h + 4.45)}px){:root{${weightDecl(m)};${poseDecl(m)}}${shapeDecl(m)}${hop}}`
  })

  return `<style>${props.join('')}${loops.join('')}${rules.join('')}${extra}${blocks.join('')}</style>`
}

/** Un occhio completo attorno a (cx, cy): bianco, iride che guarda, palpebre che coprono. */
export type EyeParts = {
  id: string
  cx: number
  cy: number
  rx: number
  ry: number
  /** contorno dell'occhio attorno a 0,0 (default ellisse) */
  outline?: string
  sclera: string
  iris: string // disegno dell'iride attorno a 0,0
  lid: string // colore della palpebra
  lidLine?: string // linea del bordo (ciglia)
  lidLineWidth?: number
  lashes?: 'l' | 'r' // ciglia, dal lato esterno
  lower?: string // colore della palpebra inferiore (default lid)
  extra?: string // disegnato sopra, dentro il ritaglio
}

export const eye = (p: EyeParts) => {
  const shape = p.outline ?? `M${-p.rx} 0A${p.rx} ${p.ry} 0 1 0 ${p.rx} 0A${p.rx} ${p.ry} 0 1 0 ${-p.rx} 0Z`
  const w = p.rx + 4
  // palpebra superiore: il bordo inferiore e' una curva che a occhio aperto sta sopra l'occhio
  const lidPath = `M${-w} ${-p.ry * 3}L${w} ${-p.ry * 3}L${w} ${-p.ry}Q0 ${-p.ry * 0.55} ${-w} ${-p.ry}Z`
  const edge = `M${-w} ${-p.ry}Q0 ${-p.ry * 0.55} ${w} ${-p.ry}`
  // ciglia all'angolo esterno, sul bordo della palpebra (che a occhio aperto e' sopra l'occhio)
  const out = p.lashes === 'l' ? -1 : 1
  const edgeY = (x: number) => -p.ry * 0.775 - p.ry * 0.225 * (x / w) ** 2
  const lashes = p.lashes
    ? [0.62, 0.8, 0.96]
        .map((t, i) => {
          const x = out * p.rx * t
          const y = edgeY(x)

          return `<path d="M${n(x)} ${n(y)}q${n(out * (2 + i))} ${n(-2 - i * 0.6)} ${n(out * (3.5 + i * 1.6))} ${n(-2.2 - i)}" stroke="${p.lidLine ?? '#000'}" stroke-width="1.5" stroke-linecap="round" fill="none"/>`
        })
        .join('')
    : ''
  const lowPath = `M${-w} ${p.ry * 3}L${w} ${p.ry * 3}L${w} ${p.ry}Q0 ${p.ry * 1.25} ${-w} ${p.ry}Z`

  return (
    `<g transform="translate(${p.cx} ${p.cy})" style="--ry:${p.ry}"><g class="v-eyesc">` +
    `<clipPath id="${p.id}"><path d="${shape}"/></clipPath>` +
    `<path d="${shape}" fill="${p.sclera}"/>` +
    `<g clip-path="url(#${p.id})">` +
    `<g class="v-iris">${p.iris}</g>${p.extra ?? ''}` +
    `<g class="v-low"><path d="${lowPath}" fill="${p.lower ?? p.lid}"/></g>` +
    `<g class="v-lid"><path d="${lidPath}" fill="${p.lid}"/>` +
    (p.lidLine ? `<path d="${edge}" fill="none" stroke="${p.lidLine}" stroke-width="${p.lidLineWidth ?? 2}" stroke-linecap="round"/>` : '') +
    `</g></g>` +
    // ciglia fuori dal ritaglio, ma con la palpebra
    (lashes ? `<g class="v-lid">${lashes}</g>` : '') +
    `</g></g>`
  )
}

// --- colori ---

const hex = (c: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim())
  const v = m?.[1] ?? '808080'

  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

/** Miscela di due colori #RRGGBB, `t` verso il secondo. */
export const mix = (a: string, b: string, t: number) => {
  const x = hex(a)
  const y = hex(b)

  return `#${x.map((v, i) => Math.round(v + ((y[i] ?? 0) - v) * t).toString(16).padStart(2, '0')).join('')}`
}

/** Luminanza relativa approssimata, 0..1. */
export const lum = (c: string) => {
  const [r, g, b] = hex(c)

  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

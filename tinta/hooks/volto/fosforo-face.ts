import type { Mood } from './tipi'
import type { Palette } from './face'
import { lightColors } from './face'
import { BOTTOM, HALO, MAPS, MAP_SIZE, MOUTHS, MOUTH_BOX, MOUTH_FEATHER, SPEC, TOP } from './fosforo-maps'
import { MOODS, SHAPES, browD, lum, mix, mouthD, rigCss, svgOpen, viewOf } from './rig'
import type { Frame, ShapeRules } from './rig'

/**
 * Fosforo: un volto umano che emerge dalla pioggia di codice.
 *
 * Il volto non e' disegnato a mano: e' una mappa di luce di una testa vera
 * (il base mesh CC0 di MakeHuman, renderizzato offline: vedi tools/), usata
 * come maschera di luminanza sopra colonne fitte di glifi che scendono. Dove
 * la testa prende luce (fronte, dorso del naso, zigomi, labbra) il codice
 * brilla; orbite, narici e la linea della bocca restano vuoto. Sopra, sullo
 * stesso rig degli altri personaggi: occhi che si accendono, sopracciglia e
 * bocca come tagli e luci nella maschera, micro-rotazioni della testa per
 * dissolvenza tra le viste a tre quarti, velocita' della pioggia e disturbi
 * secondo l'umore.
 *
 * Si usa come gli altri: `fosforo(palette, frame)` restituisce il disegno,
 * `fosforoBase(palette)` il colore del pannello attorno.
 */

const n = (v: number) => String(Math.round(v * 100) / 100)

/** Un generatore deterministico: stessa sorgente a ogni disegno. */
const seeded = (seed: number) => {
  let s = seed >>> 0

  return () => {
    s = (s * 1664525 + 1013904223) >>> 0

    return s / 4294967296
  }
}

// --- geometria: la mappa nel sistema del volto (0..200) ---

const [MAP_W, MAP_H] = MAP_SIZE
const FRONT = MAPS.front!
const EYE_MID: [number, number] = [(FRONT.eyeL[0] + FRONT.eyeR[0]) / 2, FRONT.eyeL[1]]
// la testa intera sta nel riquadro con margine: alta 175 unita' (il volto e' 0..200, il riquadro ne mostra 260)
const MAP_TOP = Math.min(...TOP.filter(v => v >= 0))
const MAP_BOTTOM = Math.max(...BOTTOM)
const K = 175 / (MAP_BOTTOM - MAP_TOP) // unita' del volto per pixel della mappa
/** origine della mappa: la testa centrata in (100, 100) */
const OX = 100 - EYE_MID[0] * K
const OY = 100 - ((MAP_TOP + MAP_BOTTOM) / 2) * K
const at = (p: [number, number]): [number, number] => [OX + p[0] * K, OY + p[1] * K]
const EYE_L = at(FRONT.eyeL)
/** la finestra della bocca (x, y, w, h) e la sua sfumatura, in unita' del volto */
const MW = [OX + MOUTH_BOX[0] * K, OY + MOUTH_BOX[1] * K, MOUTH_BOX[2] * K, MOUTH_BOX[3] * K] as const
const MF = { cx: OX + MOUTH_FEATHER.cx * K, cy: OY + MOUTH_FEATHER.cy * K, rx: MOUTH_FEATHER.rx * K, ry: MOUTH_FEATHER.ry * K }
const MOUTH_ORDER = ['sorriso', 'giu', 'semi', 'aperta', 'o'] as const
const EYE_R = at(FRONT.eyeR)
/** la linea delle labbra: poco sotto il centro dei denti superiori */
const MOUTH = at([FRONT.teeth[0], FRONT.teeth[1] + 5])
/** quanto si spostano i tratti con la testa girata del tutto verso una vista */
const shift = (view: string) => {
  const m = MAPS[view] ?? FRONT

  return [((m.eyeL[0] + m.eyeR[0]) / 2 - EYE_MID[0]) * K, (m.eyeL[1] - FRONT.eyeL[1]) * K] as const
}
const SH_L = shift('left')
const SH_R = shift('right')
const SH_D = shift('down')
const HEAD_TOP = OY + Math.min(...TOP.filter(v => v >= 0)) * K
const HEAD_BOTTOM = OY + Math.max(...BOTTOM) * K
const CX = 100
const CY = (HEAD_TOP + HEAD_BOTTOM) / 2

// --- la pioggia ---

// pochi kana (3 byte l'uno) e molti segni ASCII: la sorgente deve stare nei 128 KiB del desktop
const GLYPHS = [...'ｱｳｶｷｻｼﾀﾂﾅﾊﾐﾘ0123456789012345678901234567{}[]=+*:;/#$%<>ABCDEFXZ']
const STEP = 3.4 // distanza tra le colonne del volto
const GY = 2.9 // passo verticale di un glifo
const ROWS = 30 // glifi per giro
const LOOP = ROWS * GY // la colonna scende di LOOP e ricomincia identica

/** Il colore di fondo di Fosforo (anche del pannello attorno). */
export const fosforoBase = (c: Palette) => lightColors(c).base

/** Quanto ogni umore gira la testa (ampiezza del moto lento), e il tipo di sguardo. */
// la testa non oscilla da sola (scelta del proprietario): resta solo lo sguardo che la volge un poco
const TURN: { [mood in Mood]: number } = { idle: 0, listening: 0, thinking: 0, working: 0, talking: 0, waiting: 0, happy: 0, worried: 0 }
const weighted = (table: { [mood in Mood]: number }) => MOODS.map(m => `var(--w-${m}) * ${table[m]}`).join(' + ')

/** Le forme della bocca e delle sopracciglia, sulle posizioni della mappa. */
const BROW_Y = EYE_L[1] - 10.5
const shapes: ShapeRules = {
  '.b-l': (mood: Mood) => browD(EYE_L[0] - 13, EYE_L[0] + 10, BROW_Y, SHAPES[mood].brow, 0.75),
  '.b-r': (mood: Mood) => browD(EYE_R[0] + 13, EYE_R[0] - 10, BROW_Y, SHAPES[mood].brow, 0.75),
  '.m-shape': (mood: Mood) => mouthD(LIPS[mood], 1),
}

/**
 * Le labbra di un volto vero, non una bocca disegnata: piccole deformazioni. Sorriso: angoli appena su;
 * "o": un'apertura piccola e tonda; preoccupato: angoli giu'; parla: si apre poco, a tempo con la voce.
 */
const LIPS: { [mood in Mood]: { w: number; up: number; low: number; corner: number; wave: number } } = {
  idle: { w: 10, up: 0.3, low: 1, corner: 0, wave: 0 },
  listening: { w: 5.5, up: -1.6, low: 2.4, corner: 0, wave: 0 },
  thinking: { w: 9.5, up: 0.3, low: 0.8, corner: 0.6, wave: 0.5 },
  working: { w: 9.5, up: 0.2, low: 0.7, corner: 0, wave: 0 },
  talking: { w: 10, up: -1.4, low: 5.2, corner: 0, wave: 0 },
  waiting: { w: 9.5, up: 0.3, low: 0.9, corner: 0, wave: 0 },
  happy: { w: 11.5, up: 0.5, low: 1.4, corner: -1.8, wave: 0 },
  worried: { w: 10, up: 0.5, low: 1.2, corner: 1.5, wave: 0.6 },
}

/** Una mappa di luce: rettangolo bianco mascherato in luminanza dall'immagine (stirata sul rettangolo). */
const mapRect = (href: string, x: number, y: number, w: number, h: number, cls = '') =>
  `<rect${cls ? ` class="${cls}"` : ''} x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#fff" style="mask-image:url('${href}');mask-mode:luminance;mask-size:100% 100%;mask-repeat:no-repeat;mask-origin:fill-box;mask-clip:fill-box"/>`

export const fosforo = (c: Palette, f: Frame) => {
  // i colori del tema attivo (con il tema Fosforo, il suo verde)
  const glow = lightColors(c).glow
  const hot = mix(glow, '#ffffff', 0.7)
  const soft = mix(glow, '#000000', 0.25)
  const deep = fosforoBase(c)
  const v = viewOf(f)
  const rnd = seeded(23)
  const pick = () => GLYPHS[Math.floor(rnd() * GLYPHS.length)] ?? '0'

  /** Una colonna di glifi che scende di LOOP e ricomincia uguale, con la sua scia (gradiente). */
  const column = (x: number, y0: number, y1: number, dur: number, size: number, trail: string, mouth?: string[]) => {
    const pattern = Array.from({ length: ROWS }, pick).join('')
    const loops = Math.ceil((y1 - y0) / LOOP) + 1
    const top = y0 - LOOP
    const anim = `<g class="fz-c" style="animation-duration:${n(dur)}s;animation-delay:${n(-rnd() * dur)}s">`
    // la stessa colonna, accorciata alla finestra della bocca: stessi glifi, stesso passo, stesso moto
    if (mouth && Math.abs(x - MF.cx) < MF.rx + 1) {
      const skip = Math.floor((MW[1] - LOOP - top) / LOOP)
      const count = Math.ceil(((MW[3] + LOOP) / LOOP) * ROWS)
      mouth.push(`${anim}<text x="${n(x)}" y="${n(top + skip * LOOP)}" font-size="${n(size)}" textLength="${n((count * LOOP) / ROWS)}" lengthAdjust="spacing" fill="url(#${trail})">${pattern.repeat(3).slice(0, count)}</text></g>`)
    }

    return `${anim}<text x="${n(x)}" y="${n(top)}" font-size="${n(size)}" textLength="${n(loops * LOOP)}" lengthAdjust="spacing" fill="url(#${trail})">${pattern.repeat(loops)}</text></g>`
  }

  // --- maschera del volto: la testa in luce, le viste a tre quarti in dissolvenza, i tratti mobili ---
  // il desktop toglie ogni <image> e ogni href non interno: la mappa entra come mask-image CSS su un rettangolo bianco
  const img = (view: string, cls: string) => mapRect(MAPS[view]?.png ?? FRONT.png, OX, OY, MAP_W * K, MAP_H * K, cls)
  // gli occhi nella mappa di luce: l'orbita in ombra, il bianco appena acceso, l'iride piu' scura con la pupilla
  // (seguono lo sguardo), la palpebra superiore come una linea scura che scende col battito, la inferiore piu' tenue
  const sockets = [EYE_L, EYE_R]
    .map(
      ([x, y]) =>
        `<g transform="translate(${n(x)} ${n(y)})" style="--ry:3.2"><g class="v-eyesc">` +
        `<ellipse rx="10.5" ry="5.4" fill="#000" opacity=".6"/>` +
        `<g class="v-open"><ellipse rx="8.6" ry="3.6" fill="#fff" opacity=".42"/>` +
        `<g class="v-iris"><circle r="3.2" fill="#000" opacity=".55"/><circle r="1.5" fill="#000" opacity=".9"/></g></g>` +
        `<g class="v-lid"><path d="M-9.5 -3.2Q0 -6.6 9.5 -3.2" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" opacity=".85"/></g>` +
        `<path d="M-8 3.4Q0 5.4 8 3.4" fill="none" stroke="#000" stroke-width=".9" stroke-linecap="round" opacity=".45"/>` +
        `</g></g>`,
    )
    .join('')
  // colate di codice: sotto la mascella e sopra la testa la luce continua per un tratto, colonna per colonna
  const drips: string[] = []
  for (let x = OX + STEP / 2; x < OX + MAP_W * K; x += STEP) {
    const i = Math.floor((x - OX) / K / 2)
    const b = BOTTOM[i] ?? -1
    const t = TOP[i] ?? -1
    if (b > 0 && OY + b * K > MOUTH[1] + 10) {
      const y = OY + b * K - 4
      drips.push(`<rect x="${n(x - STEP / 2)}" y="${n(y)}" width="${n(STEP)}" height="${n(14 + rnd() * rnd() * 90)}" fill="url(#fz-down)" opacity="${n(0.35 + rnd() * 0.5)}"/>`)
    }
    if (t > 0 && OY + t * K < EYE_L[1] - 30 && rnd() > 0.25) {
      const h = 8 + rnd() * rnd() * 60
      drips.push(`<rect x="${n(x - STEP / 2)}" y="${n(OY + t * K + 3 - h)}" width="${n(STEP)}" height="${n(h)}" fill="url(#fz-up)" opacity="${n(0.25 + rnd() * 0.45)}"/>`)
    }
  }
  const mask =
    `<mask id="fz-face" maskUnits="userSpaceOnUse" x="-300" y="-300" width="800" height="800">` +
    `<rect x="-300" y="-300" width="800" height="800" fill="#000"/>` +
    `<g>` +
    img('front', '') +
    img('down', 'fz-vd') +
    img('left', 'fz-vl') +
    img('right', 'fz-vr') +
    drips.join('') +
    `<g class="fz-feat">` +
    // zigomi che salgono e si accendono (felice)
    `<g class="v-cheek"><ellipse class="fz-cheek" cx="${n(EYE_L[0] - 3)}" cy="${n(EYE_L[1] + 22)}" rx="15" ry="9" fill="url(#fz-spot)"/><ellipse class="fz-cheek" cx="${n(EYE_R[0] + 3)}" cy="${n(EYE_R[1] + 22)}" rx="15" ry="9" fill="url(#fz-spot)"/></g>` +
    sockets +
    // sopracciglia: una cresta di luce con l'ombra sotto, che si muove con l'umore
    `<g class="v-brows">` +
    `<g class="v-brow-l"><path class="b-l" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="round" opacity=".55" transform="translate(0 3.2)"/><path class="b-l" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".6"/></g>` +
    `<g class="v-brow-r"><path class="b-r" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="round" opacity=".55" transform="translate(0 3.2)"/><path class="b-r" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".6"/></g>` +
    `</g>` +
    `</g>` +
    // onde di elaborazione che attraversano il volto (pensa: sale, lavora: scende)
    `<g mask="url(#fz-halo)"><rect class="fz-wave fz-wave-up" x="-100" y="${n(HEAD_BOTTOM)}" width="400" height="26" fill="url(#fz-band)"/>` +
    `<rect class="fz-wave fz-wave-down" x="-100" y="${n(HEAD_TOP - 26)}" width="400" height="26" fill="url(#fz-band)"/></g>` +
    // ascolto: la luce pulsa dalle orecchie
    `<g class="fz-ears"><ellipse class="fz-ear" cx="${n(OX + 26 * K)}" cy="${n(EYE_L[1] + 8)}" rx="18" ry="30" fill="url(#fz-spot)"/><ellipse class="fz-ear fz-ear-2" cx="${n(OX + (MAP_W - 26) * K)}" cy="${n(EYE_L[1] + 8)}" rx="18" ry="30" fill="url(#fz-spot)"/></g>` +
    `</g></mask>` +
    `<mask id="fz-halo" maskUnits="userSpaceOnUse" x="-300" y="-300" width="800" height="800">` +
    mapRect(HALO, CX - (MAP_W * K * 1.3) / 2, CY - (MAP_H * K * 1.25) / 2 + 6, MAP_W * K * 1.3, MAP_H * K * 1.25) +
    `</mask>` +
    `<mask id="fz-spec" maskUnits="userSpaceOnUse" x="-300" y="-300" width="800" height="800">` +
    mapRect(SPEC, OX, OY, MAP_W * K, MAP_H * K) +
    `</mask>`

  // --- la pioggia del volto: colonne lente sempre, veloci e piu' fitte quando lavora ---
  const x0 = OX + 10
  const x1 = OX + MAP_W * K - 10
  const y0 = HEAD_TOP - 40
  const y1 = HEAD_BOTTOM + 60
  const trails = ['fz-t1', 'fz-t2', 'fz-t3']
  let slow = ''
  const mouthCols: string[] = []
  let fast = ''
  // nei riquadri piccoli (sotto i 400 px) meno colonne: la stessa luce, meno lavoro
  const small = f.h < 400 || f.cols * 9 < 400
  const step = small ? STEP * 1.6 : STEP
  for (let x = x0, i = 0; x <= x1; x += step, i++) {
    slow += column(x, y0, y1, 6 + rnd() * 7, 2.7, trails[i % 3] ?? 'fz-t1', mouthCols)
    if (i % 3 === 0) fast += column(x + STEP / 2, y0, y1, 1.3 + rnd() * 1.4, 2.3, trails[(i + 1) % 3] ?? 'fz-t1')
  }
  // trattini di codice tra le colonne: riempiono le ombre morbide (un pattern, un solo elemento)
  let dashes = ''
  for (let col = 0; col < 8; col++) {
    let y = rnd() * 6
    while (y < 90) {
      const h = 0.8 + rnd() * rnd() * 5
      if (y + h < 90) dashes += `M${n(col * STEP + STEP / 2 - 0.3)} ${n(y)}h.6v${n(h)}h-.6Z`
      y += h + 0.8 + rnd() * 2.2
    }
  }

  // --- lo sfondo: pioggia debole fino ai bordi, alone, tracce di circuito, scintille ---
  let back = ''
  // limitata in alto e in basso (oltre resta il fondo pieno, dello stesso colore): la sorgente sta nei 128 KiB del desktop
  // la pioggia di fondo, limitata: la sorgente deve restare ben sotto i 128 KiB del desktop a ogni misura
  const by0 = Math.max(v.y, CY - 150)
  const by1 = Math.min(v.y + v.h, CY + 150)
  const bx0 = Math.max(v.x, CX - 170) + 1.5
  const bx1 = Math.min(v.x + v.w, CX + 170)
  // al massimo 14 colonne di fondo, qualunque sia la larghezza
  const bstep = Math.max(small ? 15 : 12, (bx1 - bx0) / 14)
  for (let x = bx0; x <= bx1; x += bstep) back += column(x, by0, by1, 7 + rnd() * 9, 3, trails[Math.floor(rnd() * 3)] ?? 'fz-t1')
  const R = Math.max(v.w, v.h)
  const swirls = [0, 1, 2, 3, 4]
    .map(i => {
      const r = 108 + i * 17 + rnd() * 8
      const a0 = rnd() * Math.PI * 2
      const a1 = a0 + 0.8 + rnd() * 1.6
      const p = (a: number, rr: number) => `${n(CX + Math.cos(a) * rr)} ${n(CY + Math.sin(a) * rr * 1.08)}`
      const end = p(a1, r)

      return (
        `<path class="fz-swirl" style="animation-delay:${n(-rnd() * 9)}s" d="M${p(a0, r)}A${n(r)} ${n(r * 1.08)} 0 0 1 ${end}L${p(a1 + 0.06, r + 9)}" fill="none" stroke="${glow}" stroke-width=".45" stroke-dasharray="${n(18 + rnd() * 30)} ${n(4 + rnd() * 6)}"/>` +
        `<circle cx="${p(a1 + 0.06, r + 9).split(' ')[0]}" cy="${p(a1 + 0.06, r + 9).split(' ')[1]}" r="1.1" fill="none" stroke="${glow}" stroke-width=".45" opacity=".8"/>`
      )
    })
    .join('')
  const sparks = Array.from({ length: 46 }, () => {
    // piu' fitte attorno alla testa, rade lontano
    const a = rnd() * Math.PI * 2
    const r = 70 + Math.pow(rnd(), 0.7) * R * 0.55
    const x = CX + Math.cos(a) * r * 0.85
    const y = CY + Math.sin(a) * r * 1.15
    const s = 0.35 + rnd() * rnd() * 1.1
    const d = n(1.6 + rnd() * 3)

    return `<circle class="fz-spark" cx="${n(x)}" cy="${n(y)}" r="${n(s)}" fill="${rnd() > 0.3 ? hot : glow}" style="animation-duration:${d}s;animation-delay:${n(-rnd() * 4)}s"/>`
  }).join('')
  // disturbi: righe orizzontali che lampeggiano e scorrono di lato (preoccupato, pensa, lavora)
  const glitches = Array.from({ length: 9 }, (_, i) => {
    const y = HEAD_TOP + 20 + rnd() * (HEAD_BOTTOM - HEAD_TOP - 10)
    const w = 30 + rnd() * 110
    const x = CX - w / 2 + (rnd() - 0.5) * 80

    return `<rect class="fz-glitch" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(0.6 + rnd() * 2.2)}" fill="url(#fz-streak)" style="animation-duration:${n(1.7 + rnd() * 2.6)}s;animation-delay:${n(-rnd() * 3 - i * 0.37)}s"/>`
  }).join('')

  // la bocca: ogni stato e' la pioggia del volto (le stesse colonne, accorciate) vista attraverso la sua mappa,
  // sopra un fondo che copre la bocca chiusa con la stessa sfumatura; strati separati, fuori dalla maschera del volto
  const mouthDefs =
    `<g id="fz-mrain"><rect class="fz-skin" x="${n(MW[0])}" y="${n(MW[1])}" width="${n(MW[2])}" height="${n(MW[3])}" fill="${glow}"/>` +
    `<rect class="fz-dash" x="${n(x0 - STEP)}" y="${n(y0 - 90)}" width="${n(x1 - x0 + STEP * 3)}" height="${n(y1 - y0 + 180)}" fill="url(#fz-dash)"/>` +
    `<g class="fz-slow">${mouthCols.join('')}</g></g>` +
    // cio' che sta dietro la pioggia del volto (fondo, alone), nella sfumatura della finestra: copre la bocca chiusa
    `<radialGradient id="fz-mf"><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<mask id="fz-mfm" maskUnits="userSpaceOnUse" x="${n(MW[0])}" y="${n(MW[1])}" width="${n(MW[2])}" height="${n(MW[3])}"><ellipse cx="${n(MF.cx)}" cy="${n(MF.cy)}" rx="${n(MF.rx)}" ry="${n(MF.ry)}" fill="url(#fz-mf)"/></mask>` +
    `<g id="fz-mback" mask="url(#fz-mfm)"><rect x="${n(MW[0])}" y="${n(MW[1])}" width="${n(MW[2])}" height="${n(MW[3])}" fill="${deep}"/><rect x="${n(MW[0])}" y="${n(MW[1])}" width="${n(MW[2])}" height="${n(MW[3])}" fill="url(#fz-vig)"/><rect class="fz-halo" x="-300" y="-300" width="800" height="800" fill="${glow}" mask="url(#fz-halo)"/></g>` +
    MOUTH_ORDER.map(m => `<mask id="fz-m-${m}" maskUnits="userSpaceOnUse" x="${n(MW[0])}" y="${n(MW[1])}" width="${n(MW[2])}" height="${n(MW[3])}">${mapRect(MOUTHS[m] ?? '', MW[0], MW[1], MW[2], MW[3])}</mask>`).join('')
  const mouths =
    `<g class="fz-feat">` +
    MOUTH_ORDER.map(m => `<g class="fz-m-${m}"><use href="#fz-mback"/><g class="fz-face" mask="url(#fz-m-${m})"><use href="#fz-mrain"/></g></g>`).join('') +
    `</g>`
  const eyes = [EYE_L, EYE_R]
    .map(
      ([x, y]) =>
        `<g transform="translate(${n(x)} ${n(y)})"><g class="v-eyesc"><g class="fz-low"><g class="v-open"><g class="fz-eye">` +
        // occhi veri, fatti dello stesso codice: niente bagliore; sopra resta solo un piccolo riflesso netto,
        // e appena un tepore attorno all'iride (l'iride e la pupilla sono pioggia piu' scura, nella maschera)
        `<g class="v-iris"><circle r="3.4" fill="${glow}" opacity=".08"/><circle cx=".9" cy="-.9" r=".55" fill="${hot}" opacity=".85"/></g>` +
        `</g></g></g></g></g>`,
    )
    .join('')

  const defs =
    // scie: chiaro in testa, poi la luce che si spegne verso l'alto; periodi diversi (una o due teste per giro)
    `<linearGradient id="fz-t1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${n(LOOP)}" spreadMethod="repeat"><stop offset="0" stop-color="${soft}" stop-opacity=".7"/><stop offset=".55" stop-color="${glow}"/><stop offset=".93" stop-color="${glow}"/><stop offset=".97" stop-color="${hot}"/><stop offset="1" stop-color="${soft}" stop-opacity=".7"/></linearGradient>` +
    `<linearGradient id="fz-t2" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${n(LOOP / 2)}" spreadMethod="repeat"><stop offset="0" stop-color="${soft}" stop-opacity=".75"/><stop offset=".8" stop-color="${glow}"/><stop offset=".94" stop-color="${hot}"/><stop offset="1" stop-color="${soft}" stop-opacity=".75"/></linearGradient>` +
    `<linearGradient id="fz-t3" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${n(LOOP)}" spreadMethod="repeat"><stop offset="0" stop-color="${glow}" stop-opacity=".65"/><stop offset=".4" stop-color="${soft}" stop-opacity=".5"/><stop offset=".9" stop-color="${glow}" stop-opacity=".95"/><stop offset=".96" stop-color="${hot}"/><stop offset="1" stop-color="${glow}" stop-opacity=".65"/></linearGradient>` +
    `<linearGradient id="fz-down" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="fz-up" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="fz-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="fz-streak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${glow}" stop-opacity="0"/><stop offset=".35" stop-color="${hot}"/><stop offset=".7" stop-color="${glow}" stop-opacity=".8"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="fz-spot"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="fz-eyeglow"><stop offset="0" stop-color="${hot}" stop-opacity=".95"/><stop offset=".35" stop-color="${glow}" stop-opacity=".7"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="fz-vig" cx="${n(CX)}" cy="${n(CY)}" r="${n(R * 0.62)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${glow}" stop-opacity=".07"/><stop offset=".5" stop-color="${glow}" stop-opacity=".025"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>` +
    `<pattern id="fz-dash" width="${n(STEP * 8)}" height="90" patternUnits="userSpaceOnUse"><path d="${dashes}" fill="${glow}"/></pattern>` +
    `<pattern id="fz-lines" width="4" height="1.6" patternUnits="userSpaceOnUse"><rect width="4" height=".45" fill="${glow}"/></pattern>` +
    `<filter id="fz-bloom" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="1.6"/></filter>` +
    mouthDefs +
    mask

  const T = `calc((${weighted(TURN)}) * var(--fz-osc) + var(--GX) * .035)`
  const css =
    // la bocca vera: gli stati renderizzati della stessa testa, in dissolvenza. Parlando l'apertura segue il
    // ritmo del rig (--TALK, due cicli sfasati): socchiusa, poi aperta; quando si stringe (--TW < 0) si arrotonda.
    // Nelle pause tra un pezzo di voce e l'altro (--lipon 1) le labbra si chiudono
    `svg{--fz-O:calc(clamp(0, calc((var(--TALK) + .9) / 1.4), 1) * (1 - var(--lipon)))}` +
    `.fz-m-semi{opacity:calc(var(--w-talking) * clamp(0, calc(var(--fz-O) * 2), 1))}` +
    `.fz-m-aperta{opacity:calc(var(--w-talking) * clamp(0, calc(var(--fz-O) * 2 - 1), 1))}` +
    `.fz-m-o{opacity:calc(var(--w-talking) * clamp(0, calc(var(--TW) * -2.2), 1) * clamp(0, calc(var(--fz-O) * 2), 1) + var(--w-listening) * .55)}` +
    `.fz-m-sorriso{opacity:var(--w-happy)}` +
    `.fz-m-giu{opacity:calc(var(--w-worried) * .9 + var(--w-thinking) * .2)}` +
    `:root{--gs:.32}` +
    `.fz-c{animation:fz-fall 8s linear infinite}` +
    `.fz-c text{font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Osaka","Noto Sans CJK JP",monospace;font-weight:600;writing-mode:vertical-rl;text-orientation:upright}` +
    `@keyframes fz-fall{from{transform:translate(0,0)}to{transform:translate(0,${n(LOOP)}px)}}` +
    `.fz-dash{animation:fz-dashfall 16s linear infinite}` +
    `@keyframes fz-dashfall{from{transform:translate(0,0)}to{transform:translate(0,90px)}}` +
    // la testa gira appena: un moto lento sempre acceso, ampiezza secondo l'umore, piu' lo sguardo
    `@property --fz-osc{syntax:'&lt;number&gt;';inherits:true;initial-value:0}` +
    `@property --fz-j{syntax:'&lt;number&gt;';inherits:true;initial-value:0}` +
    `@keyframes fz-osc{0%{--fz-osc:0}22%{--fz-osc:.85}48%{--fz-osc:.2}71%{--fz-osc:-.8}100%{--fz-osc:0}}` +
    `@keyframes fz-jit{0%{--fz-j:0}13%{--fz-j:1.6}27%{--fz-j:-1}41%{--fz-j:.4}58%{--fz-j:-1.8}74%{--fz-j:.9}100%{--fz-j:0}}` +
    `svg{--fz-T:${T};--fz-L:max(0, calc(var(--fz-T) * -1));--fz-R:max(0, var(--fz-T));--fz-D:calc(var(--w-working) * .85 + var(--w-worried) * .35);animation:fz-osc 14.3s cubic-bezier(.45,0,.55,1) infinite,fz-jit .83s linear infinite}` +
    `.fz-vl{opacity:var(--fz-L)}.fz-vr{opacity:var(--fz-R)}.fz-vd{opacity:var(--fz-D)}` +
    `.fz-feat{transform:translate(calc((var(--fz-L) * ${n(SH_L[0])} + var(--fz-R) * ${n(SH_R[0])}) * 1px),calc(var(--fz-D) * ${n(SH_D[1])} * 1px))}` +
    `.fz-eyes{transform:translate(calc((var(--fz-L) * ${n(SH_L[0])} + var(--fz-R) * ${n(SH_R[0])}) * 1px),calc(var(--fz-D) * ${n(SH_D[1])} * 1px))}` +
    // micro-movimenti della testa: inclinazione ridotta, nessun busto che ondeggia
    `.fz-head{transform:translate(calc(var(--w-worried) * var(--fz-j) * .8px),calc(var(--BOB) * .5px)) translate(100px,${n(HEAD_BOTTOM)}px) rotate(calc(var(--SWAY) * .3deg)) translate(-100px,-${n(HEAD_BOTTOM)}px)}` +
    `.fz-face{opacity:calc(.72 + var(--glow) * .34 + var(--w-talking) * var(--TALK) * -.12)}` +
    // pioggia: lenta sempre, veloce e piu' fitta quando pensa o lavora, quieta in attesa
    `.fz-slow{opacity:calc(1 - var(--w-waiting) * .25)}` +
    `.fz-fast{opacity:calc(var(--w-working) * .95 + var(--w-thinking) * .7 + var(--w-worried) * .45 + var(--w-talking) * .2)}` +
    `.fz-dash{opacity:.42}.fz-skin{opacity:calc(.09 + var(--glow) * .05)}.fz-shine{opacity:calc((.1 + var(--glow) * .12) * (1 - var(--fz-L) - var(--fz-R) - var(--fz-D) * .6))}` +
    `.fz-back{opacity:calc(.16 + var(--w-working) * .08 - var(--w-waiting) * .08)}` +
    `.fz-halo{opacity:calc(.07 + var(--glow) * .06 + var(--w-happy) * .06)}` +
    // occhi: luce secondo l'umore, pulsano in attesa
    `.fz-eye{opacity:calc(.55 + var(--glow) * .45 - var(--w-waiting) * (1 - var(--fz-p)) * .35);transform:scale(calc(.9 + var(--glow) * .15))}` +
    `.fz-eyes{animation:fz-pulse 2.2s cubic-bezier(.45,0,.55,1) infinite}` +
    `@property --fz-p{syntax:'&lt;number&gt;';inherits:true;initial-value:0}` +
    `@keyframes fz-pulse{0%,100%{--fz-p:0}50%{--fz-p:1}}` +
    `.fz-low{transform:translate(0px,calc(var(--lower) * -2px)) scale(1,calc(1 - var(--lower) * .55))}` +
    `.fz-cheek{opacity:calc(var(--blush) * .8)}` +
    `.fz-wave{opacity:0;animation:fz-wave 2.6s cubic-bezier(.45,0,.55,1) infinite}` +
    `.fz-wave-up{--fz-wv:var(--w-thinking);animation-name:fz-up}` +
    `.fz-wave-down{--fz-wv:var(--w-working);animation-name:fz-down;animation-duration:1.9s}` +
    `@keyframes fz-up{from{transform:translate(0,0);opacity:var(--fz-wv)}to{transform:translate(0,-${n(HEAD_BOTTOM - HEAD_TOP + 26)}px);opacity:var(--fz-wv)}}` +
    `@keyframes fz-down{from{transform:translate(0,0);opacity:var(--fz-wv)}to{transform:translate(0,${n(HEAD_BOTTOM - HEAD_TOP + 26)}px);opacity:var(--fz-wv)}}` +
    `.fz-ear{opacity:0;animation:fz-ear 1.8s cubic-bezier(.3,0,.5,1) infinite}.fz-ear-2{animation-delay:-.9s}` +
    `@keyframes fz-ear{0%,100%{opacity:0}35%{opacity:calc(var(--w-listening) * .9)}}` +
    `.fz-spark{opacity:.15;animation:fz-tw 3s cubic-bezier(.45,0,.55,1) infinite}` +
    `@keyframes fz-tw{0%,100%{opacity:.08}50%{opacity:calc(.5 + var(--w-happy) * .5)}}` +
    `.fz-swirl{opacity:.16;animation:fz-flow 9s linear infinite}` +
    `@keyframes fz-flow{to{stroke-dashoffset:-120}}` +
    `.fz-lines{opacity:calc(.04 + var(--w-worried) * .05)}` +
    `.fz-glitch{opacity:0;animation:fz-gl 2.5s steps(1) infinite}` +
    `@keyframes fz-gl{0%{opacity:0;transform:translate(0,0)}71%{opacity:var(--fz-g);transform:translate(-6px,0)}75%{opacity:calc(var(--fz-g) * .5);transform:translate(9px,0)}79%{opacity:0;transform:translate(0,0)}100%{opacity:0}}` +
    `svg{--fz-g:calc(.12 + var(--w-worried) * .85 + var(--w-thinking) * .25 + var(--w-working) * .2)}`

  const background =
    `<rect x="${n(v.x - 2)}" y="${n(v.y - 2)}" width="${n(v.w + 4)}" height="${n(v.h + 4)}" fill="${deep}"/>` +
    `<g class="fz-back">${back}</g>` +
    `<rect x="${n(v.x - 2)}" y="${n(v.y - 2)}" width="${n(v.w + 4)}" height="${n(v.h + 4)}" fill="url(#fz-vig)"/>` +
    swirls

  const face =
    `<g class="fz-head">` +
    `<rect class="fz-halo" x="-300" y="-300" width="800" height="800" fill="${glow}" mask="url(#fz-halo)"/>` +
    `<g class="fz-face" mask="url(#fz-face)">` +
    // la luce della testa sotto il codice: tiene uniti i piani tra una colonna e l'altra
    `<rect class="fz-skin" x="-300" y="-300" width="800" height="800" fill="${glow}"/>` +
    `<rect class="fz-dash" x="${n(x0 - STEP)}" y="${n(y0 - 90)}" width="${n(x1 - x0 + STEP * 3)}" height="${n(y1 - y0 + 180)}" fill="url(#fz-dash)"/>` +
    `<g class="fz-slow">${slow}</g><g class="fz-fast">${fast}</g>` +
    `</g>` +
    `<rect class="fz-shine" x="-300" y="-300" width="800" height="800" fill="${hot}" mask="url(#fz-spec)"/>` +
    mouths +
    `<g class="fz-eyes">` +
    eyes +
    `</g>` +
    glitches +
    `</g>`

  // nei pannelli alti il volto si allarga (circa tre quarti della larghezza), negli altri resta intero in altezza
  const ratio = f.h / Math.max(240, f.cols * 9)
  const zoom = ratio > 1.15 ? 1.12 : ratio > 0.9 ? 1 : 0.94
  const body =
    `<g transform="translate(100 97) scale(${n(zoom)}) translate(-100 -97)">${face}</g>` +
    sparks +
    `<rect class="fz-lines" x="${n(v.x - 2)}" y="${n(v.y - 2)}" width="${n(v.w + 4)}" height="${n(v.h + 4)}" fill="url(#fz-lines)"/>`

  // a riposo la pioggia si ferma (restano gli occhi che battono): riparte con qualunque attivita'
  return svgOpen(f, c.text) + `${rigCss(f, shapes, css, '.fz-c,.fz-glitch,.fz-wave,.fz-dash{animation-play-state:paused}')}<defs>${defs}</defs>${background}${body}</svg>`
}

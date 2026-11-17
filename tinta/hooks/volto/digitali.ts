import type { Mood } from './tipi'
import type { Palette } from './face'
import { FALLBACK, lightColors } from './face'
import { SHAPES, browD, eye, lum, mix, mouthD, rigCss, svgOpen, viewOf } from './rig'
import type { Frame, ShapeRules } from './rig'

/**
 * Due volti fatti di luce, sullo stesso rig degli altri: la faccia e' una
 * maschera di luminanza (con le stesse classi animate: occhi, bocca,
 * sopracciglia), e cio' che la maschera lascia vedere e' pioggia di glifi
 * (Fosforo) o una griglia di punti (AI). Elementi limitati: la pioggia sono
 * poche colonne di testo verticale, i punti due pattern.
 */

const n = (v: number) => String(Math.round(v * 100) / 100)

const svg = (f: Frame, c: Palette, defs: string, css: string, body: string, background: string) =>
  svgOpen(f, c.text) +
  `${css}<defs>${defs}</defs>${background}` +
  `<g class="v-hop"><g class="v-sway"><g class="v-breathe">${body}</g></g></g></svg>`

const shapesFor = (browY: number, mouthS: number): ShapeRules => ({
  '.b-l': (mood: Mood) => browD(60, 88, browY, SHAPES[mood].brow, 0.9),
  '.b-r': (mood: Mood) => browD(140, 112, browY, SHAPES[mood].brow, 0.9),
  '.m-shape': (mood: Mood) => mouthD(SHAPES[mood].mouth, mouthS),
})

/** Un generatore deterministico: stessa sorgente a ogni disegno. */
const seeded = (seed: number) => {
  let s = seed >>> 0

  return () => {
    s = (s * 1664525 + 1013904223) >>> 0

    return s / 4294967296
  }
}

// --- 5. Fosforo: pioggia di glifi da cui emerge un volto ---

const GLYPHS = [...'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789:=+*<>']
const STEP = 10
const ROWS = 21 // glifi per giro: la colonna scende di ROWS * STEP e ricomincia identica
const PERIOD = ROWS * STEP

/** Il colore di fondo di Fosforo (anche del pannello attorno). */
export const fosforoBase = (c: Palette) => mix(c.ink, '#000000', 0.3)

export const fosforo = (c: Palette, f: Frame) => {
  const glow = lum(c.accent) > 0.35 ? c.accent : '#39FF88'
  const hot = mix(glow, '#ffffff', 0.55)
  const deep = fosforoBase(c)
  const v = viewOf(f)
  const rnd = seeded(7)
  /**
   * Colonne di glifi in [x0, x1] che coprono [y0, y1]: testo verticale che scende di un giro e
   * ricomincia uguale; con `heads`, teste chiare e scie ogni 70 px (tre per giro).
   */
  const rain = (x0: number, x1: number, y0: number, y1: number, speed: [number, number], heads: boolean) => {
    const out: string[] = []
    const length = y1 - y0 + PERIOD
    for (let x = Math.floor(x0 / STEP) * STEP + 5; x <= x1; x += STEP) {
      const dur = speed[0] + rnd() * (speed[1] - speed[0])
      const lag = -rnd() * dur
      const alpha = 0.45 + rnd() * 0.35
      const pattern = Array.from({ length: ROWS }, () => GLYPHS[Math.floor(rnd() * GLYPHS.length)] ?? '0').join('')
      const glyphs = pattern.repeat(Math.ceil(length / PERIOD) + 1).slice(0, Math.ceil(length / STEP))
      const top = y0 - PERIOD
      let marks = ''
      if (heads) {
        const offs = [rnd() * 20, rnd() * 20, rnd() * 20]
        let tails = ''
        let tips = ''
        for (let k = 0; top + k * 70 < y1 + 10; k++) {
          const y = top + k * 70 + (offs[k % 3] ?? 0)
          tails += `M${n(x - 4)} ${n(y - 30)}h8v30h-8Z`
          tips += `M${n(x - 3.5)} ${n(y - 1)}h7v8h-7Z`
        }
        marks = `<path d="${tails}" fill="${glow}" opacity=".13"/><path d="${tips}" fill="${hot}" opacity=".36"/>`
      }
      out.push(`<g class="p-col" style="animation-duration:${n(dur)}s;animation-delay:${n(lag)}s">${marks}<text x="${n(x)}" y="${n(top)}" fill="${glow}" fill-opacity="${n(alpha)}">${glyphs}</text></g>`)
    }

    return out.join('')
  }
  // la maschera: il volto e' luce, orbite, naso e bocca sono vuoto
  const sockets = ([[76, 'l'], [124, 'r']] as const)
    .map(([x]) => `<g transform="translate(${x} 100)"><g class="v-eyesc"><ellipse rx="15" ry="11" fill="#000"/></g></g>`)
    .join('')
  const mask =
    `<mask id="p-face" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">` +
    `<rect width="200" height="200" fill="#000"/>` +
    `<ellipse cx="100" cy="104" rx="56" ry="74" fill="url(#p-depth)"/>` +
    // zigomi e fronte piu' in luce
    `<ellipse cx="100" cy="66" rx="34" ry="16" fill="#fff" opacity=".35"/>` +
    `<g class="v-cheek"><ellipse cx="68" cy="124" rx="14" ry="10" fill="#fff" opacity=".4"/><ellipse cx="132" cy="124" rx="14" ry="10" fill="#fff" opacity=".4"/></g>` +
    sockets +
    `<g class="v-brows"><g class="v-brow-l"><path class="b-l" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round"/></g><g class="v-brow-r"><path class="b-r" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round"/></g></g>` +
    // ponte del naso e narici
    `<path d="M95 104L96 128L92 134L108 134L104 128L105 104Z" fill="#000" opacity=".55"/><ellipse cx="100" cy="136" rx="10" ry="3" fill="#000" opacity=".7"/>` +
    `<g transform="translate(100 152)"><g class="v-mouth"><path class="m-shape" fill="#000" stroke="#000" stroke-width="3"/></g></g>` +
    `</mask>`
  const eyes = ([[76, 'l'], [124, 'r']] as const)
    .map(
      ([x]) =>
        `<g transform="translate(${x} 100)"><g class="v-eyesc"><g class="v-open"><g class="v-glow">` +
        `<ellipse rx="13" ry="6" fill="${glow}" opacity=".35" filter="url(#p-bloom)"/>` +
        `<g class="v-iris"><circle r="5.5" fill="${glow}" filter="url(#p-bloom)"/><circle r="2.6" fill="${hot}"/></g>` +
        `</g></g></g></g>`,
    )
    .join('')
  const sparks = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2
    const r = 76 + rnd() * 16

    return `<path class="p-spark" style="animation-delay:${n(-rnd() * 2.6)}s" d="M${n(100 + Math.cos(a) * r)} ${n(104 + Math.sin(a) * r * 1.05 - 3)}l0 6M${n(100 + Math.cos(a) * r - 3)} ${n(104 + Math.sin(a) * r * 1.05)}l6 0" stroke="${hot}" stroke-width="1.2" stroke-linecap="round"/>`
  }).join('')
  const scan = [0, 1, 2].map(i => `<rect class="p-scan" x="${n(v.x)}" y="${n(v.y)}" width="${n(v.w)}" height="${2 + i * 2}" fill="${glow}" style="animation-duration:${n(2.3 + i * 1.7)}s;animation-delay:${n(-i * 0.9)}s"/>`).join('')
  const defs =
    `<radialGradient id="p-depth" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#fff"/><stop offset=".65" stop-color="#bbb"/><stop offset="1" stop-color="#000"/></radialGradient>` +
    `<filter id="p-bloom" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.2"/></filter>` +
    `<linearGradient id="p-tail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${glow}" stop-opacity="0"/><stop offset="1" stop-color="${glow}" stop-opacity=".28"/></linearGradient>` +
    mask
  const css =
    `:root{--gs:.5}` +
    `.p-col{animation:p-fall 5s linear infinite}.p-col text{font:9px/1 "Hiragino Sans","Osaka",monospace;writing-mode:vertical-rl;text-orientation:upright;letter-spacing:1px}` +
    `@keyframes p-fall{from{transform:translate(0,0)}to{transform:translate(0,${PERIOD}px)}}` +
    // pioggia lenta sempre; veloce e fitta quando pensa o lavora; piu' quieta in attesa
    `.p-slow{opacity:calc(1 - var(--w-waiting) * .45 - var(--w-working) * .3)}` +
    `.p-fast{opacity:calc(var(--w-working) + var(--w-thinking) * .65 + var(--w-worried) * .3)}` +
    `.p-dim{opacity:.2}` +
    `.p-scan{opacity:calc(.05 + var(--w-thinking) * .32 + var(--w-worried) * .45);animation:p-sweep 3s cubic-bezier(.45,0,.55,1) infinite}` +
    `@keyframes p-sweep{from{transform:translate(0,-10px)}to{transform:translate(0,${n(v.h + 10)}px)}}` +
    `.p-face{transform:translate(calc(var(--w-worried) * var(--pj) * 1px),0)}` +
    `@property --pj{syntax:'&lt;number&gt;';inherits:true;initial-value:0}` +
    `@keyframes p-jit{0%{--pj:0}17%{--pj:2.2}31%{--pj:-1.4}48%{--pj:.6}63%{--pj:-2.4}79%{--pj:1.2}100%{--pj:0}}` +
    `.p-jitter{animation-timing-function:cubic-bezier(.3,0,.2,1)}` +
    `.p-jitter{animation:p-jit .9s infinite}` +
    `.p-spark{opacity:0;animation:p-twinkle 2.6s cubic-bezier(.45,0,.55,1) infinite}` +
    `@keyframes p-twinkle{0%,100%{opacity:0}50%{opacity:calc(.15 + var(--w-happy) * .85)}}` +
    `.p-talk{opacity:calc(var(--w-talking) * (.35 + var(--TALK) * -.4))}`
  // la pioggia debole riempie tutto il riquadro, ferma sotto il volto che si muove
  const background = `<rect x="${n(v.x - 2)}" y="${n(v.y - 2)}" width="${n(v.w + 4)}" height="${n(v.h + 4)}" fill="${deep}"/><g class="p-dim"><g class="p-slow">${rain(v.x, v.x + v.w, v.y, v.y + v.h, [4.5, 8], false)}</g></g>`
  const body =
    `<g class="p-jitter">` +
    `<g class="p-face" mask="url(#p-face)"><g class="p-slow">${rain(40, 160, 22, 190, [4.5, 8], true)}</g><g class="p-fast">${rain(40, 160, 22, 190, [1.1, 2.2], true)}</g></g>` +
    // la bocca che parla pulsa di luce
    `<g transform="translate(100 152)"><g class="v-mouth"><ellipse class="p-talk" rx="16" ry="7" fill="${glow}" filter="url(#p-bloom)"/></g></g>` +
    eyes +
    scan +
    sparks +
    `</g>`

  return svg(f, c, defs, rigCss(f, shapesFor(80, 0.95), css, '.p-col,.p-scan,.p-spark{animation-play-state:paused}'), body, background)
}

// --- 6. AI: una testa di punti luminosi ---

/** Il colore di fondo di AI (anche del pannello attorno). */
export const aiBase = (c: Palette) => (c === FALLBACK || c.accent === FALLBACK.accent ? '#020616' : lightColors(c).base)

export const ai = (c: Palette, f: Frame) => {
  const v = viewOf(f)
  // i colori del tema attivo; senza tema, il blu-ciano di serie
  const themed = !(c === FALLBACK || c.accent === FALLBACK.accent)
  const lc = lightColors(c)
  const base = themed ? lc.glow : '#4FC3FF'
  const dot = themed ? mix(base, lc.second, 0.25) : mix(base, '#9FE8FF', 0.35)
  const bright = mix(dot, '#ffffff', 0.6)
  const bgBottom = aiBase(c)
  const bgTop = mix(bgBottom, base, 0.12)
  const rnd = seeded(11)
  const gray = (v: number) => {
    const h = Math.round(v * 255).toString(16).padStart(2, '0')

    return `#${h}${h}${h}`
  }
  // la testa come mappa di profondita': luce dall'alto a sinistra
  const eyes = ([[78, 'l'], [122, 'r']] as const)
    .map(([x, s]) =>
      eye({
        id: `ai-eye-${s}`,
        cx: x,
        cy: 100,
        rx: 12,
        ry: 8,
        outline: 'M-12 1C-8 -7 -3 -8 1 -8C7 -8 11 -5 12 -1C9 5 4 7 0 7C-6 7 -10 5 -12 1Z',
        // occhi di punti, non fari: bianco tenue, iride e pupilla piu' scure, un solo riflesso piccolo
        sclera: gray(0.5),
        iris: `<circle r="4.8" fill="${gray(0.22)}"/><circle r="2.3" fill="#000"/><circle cx="1.5" cy="-1.6" r=".9" fill="#fff"/>`,
        lid: gray(0.62),
        lidLine: gray(0.9),
        lidLineWidth: 1.6,
        lower: gray(0.55),
      }),
    )
    .join('')
  const mask =
    `<mask id="ai-head" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">` +
    `<rect width="200" height="200" fill="#000"/>` +
    `<g class="ai-turn">` +
    // cranio e mascella
    `<path d="M100 34C134 34 152 60 152 94C152 118 146 138 134 152C124 164 112 170 100 170C88 170 76 164 66 152C54 138 48 118 48 94C48 60 66 34 100 34Z" fill="url(#ai-depth)"/>` +
    `<ellipse cx="88" cy="58" rx="30" ry="14" fill="#fff" opacity=".35"/>` +
    `<g class="v-cheek"><ellipse cx="70" cy="122" rx="13" ry="9" fill="#fff" opacity=".35"/><ellipse cx="130" cy="122" rx="13" ry="9" fill="#fff" opacity=".22"/></g>` +
    // orbite in ombra, poi gli occhi
    `<ellipse cx="78" cy="98" rx="18" ry="12" fill="#000" opacity=".55"/><ellipse cx="122" cy="98" rx="18" ry="12" fill="#000" opacity=".5"/>` +
    eyes +
    // arcate: creste in luce, che seguono le sopracciglia
    `<g class="v-brows"><g class="v-brow-l"><path class="b-l" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/></g><g class="v-brow-r"><path class="b-r" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".65"/></g></g>` +
    // naso: dorso in luce, ombra sotto
    `<path d="M98 100C99 112 98 124 95 132C99 135 103 135 106 132C103 124 102 112 102 100Z" fill="#fff" opacity=".7"/>` +
    `<ellipse cx="101" cy="137" rx="10" ry="3.2" fill="#000" opacity=".6"/>` +
    // labbra in luce attorno alla bocca scura
    // la bocca: labbra di punti accesi attorno a un varco scuro che si apre e si chiude parlando
    `<g transform="translate(100 151)"><g class="v-mouth"><path class="m-shape" fill="none" stroke="#fff" stroke-width="5" stroke-opacity=".7" stroke-linejoin="round"/><path class="m-shape" fill="#000" stroke="#000" stroke-width="2.4" stroke-linejoin="round"/></g></g>` +
    `<ellipse cx="100" cy="164" rx="12" ry="5" fill="#fff" opacity=".3"/>` +
    // onda di luce che attraversa i punti (pensa), scansione (lavora), bocca che pulsa (parla)
    `<rect class="ai-wave" x="-60" y="20" width="60" height="180" fill="url(#ai-band)"/>` +
    `<rect class="ai-scan" x="30" y="0" width="140" height="18" fill="url(#ai-band-h)"/>` +
    `</g></mask>` +
    // il campo largo di punti deboli, che sfuma lontano dalla testa; increspature che partono dai bordi (ascolta)
    `<mask id="ai-field" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">` +
    `<rect width="200" height="200" fill="url(#ai-fall)"/>` +
    `<g transform="translate(100 104)"><circle class="ai-ripple" r="60" fill="none" stroke="#fff" stroke-width="8"/><circle class="ai-ripple ai-ripple-2" r="60" fill="none" stroke="#fff" stroke-width="8"/></g>` +
    `</mask>`
  const defs =
    `<pattern id="ai-dots" width="4.6" height="4.6" patternUnits="userSpaceOnUse"><circle cx="2.3" cy="2.3" r="1.25" fill="${dot}"/></pattern>` +
    `<pattern id="ai-dots-2" width="4.6" height="4.6" patternUnits="userSpaceOnUse"><circle cx="2.3" cy="2.3" r=".7" fill="${bright}"/></pattern>` +
    `<radialGradient id="ai-depth" cx=".4" cy=".36" r=".72"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#9a9a9a"/><stop offset=".9" stop-color="#3a3a3a"/><stop offset="1" stop-color="#151515"/></radialGradient>` +
    `<linearGradient id="ai-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#555"/><stop offset="1" stop-color="#111"/></linearGradient>` +
    `<radialGradient id="ai-fall" cx=".5" cy=".52" r=".55"><stop offset="0" stop-color="#777"/><stop offset=".6" stop-color="#333"/><stop offset="1" stop-color="#000"/></radialGradient>` +
    `<linearGradient id="ai-band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="ai-band-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="ai-bg" cx="100" cy="95" r="165" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBottom}"/></radialGradient>` +
    `<filter id="ai-bloom" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    mask
  const sparks = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + rnd() * 0.4
    const r = 70 + rnd() * 18

    return `<g transform="translate(${n(100 + Math.cos(a) * r)} ${n(100 + Math.sin(a) * r)})"><path class="ai-spark" style="animation-delay:${n(-rnd() * 2)}s" d="M0 -4L1 -1L4 0L1 1L0 4L-1 1L-4 0L-1 -1Z" fill="${bright}"/></g>`
  }).join('')
  const css =
    `:root{--gs:.5}` +
    // rotazione apparente: la mappa scivola sopra la griglia ferma, le luci scorrono sui punti
    `@property --turn{syntax:'&lt;number&gt;';inherits:true;initial-value:0}` +
    `@keyframes ai-turn{0%{--turn:0;animation-timing-function:cubic-bezier(.45,0,.55,1)}30%{--turn:3.2;animation-timing-function:cubic-bezier(.45,0,.55,1)}62%{--turn:-2.6;animation-timing-function:cubic-bezier(.45,0,.55,1)}100%{--turn:0}}` +
    `.ai-turn{transform:translate(calc((var(--turn) + var(--GX) * .25) * 1px),0)}` +
    `.ai-head{opacity:calc(.5 + var(--glow) * .5)}` +
    `.ai-shimmer{animation:ai-shim 3.3s cubic-bezier(.45,0,.55,1) infinite}` +
    `@keyframes ai-shim{0%,100%{opacity:.25}50%{opacity:.75}}` +
    `.ai-jit{transform:translate(calc(var(--w-worried) * var(--MX) * 1.4px),calc(var(--w-worried) * var(--MY) * 1.4px))}` +
    `.ai-wave{opacity:calc(var(--w-thinking) * .75);animation:ai-sweep 2.4s cubic-bezier(.45,0,.55,1) infinite}` +
    `@keyframes ai-sweep{from{transform:translate(0,0)}to{transform:translate(260px,0)}}` +
    `.ai-scan{opacity:calc(var(--w-working) * .8);animation:ai-down 1.9s cubic-bezier(.45,0,.55,1) infinite}` +
    `@keyframes ai-down{from{transform:translate(0,20px)}to{transform:translate(0,170px)}}` +
    `.ai-ripple{opacity:calc(var(--w-listening) * .9);transform-box:fill-box;transform-origin:center;animation:ai-ripple 2.2s cubic-bezier(.2,0,.4,1) infinite}` +
    `.ai-ripple-2{animation-delay:-1.1s}` +
    `@keyframes ai-ripple{from{transform:scale(.9);stroke-opacity:1}to{transform:scale(1.7);stroke-opacity:0}}` +
    `.ai-spark{opacity:0;transform-box:fill-box;transform-origin:center;animation:ai-burst 2s cubic-bezier(.2,0,.4,1) infinite}` +
    `@keyframes ai-burst{0%{opacity:0;transform:scale(.2)}30%{opacity:calc(var(--w-happy));transform:scale(1.2)}100%{opacity:0;transform:scale(.4)}}`
  // fondo blu profondo e un campo di punti debolissimi fino ai bordi
  const background =
    `<rect x="${n(v.x - 2)}" y="${n(v.y - 2)}" width="${n(v.w + 4)}" height="${n(v.h + 4)}" fill="${bgBottom}"/>` +
    `<rect x="${n(v.x - 2)}" y="${n(v.y - 2)}" width="${n(v.w + 4)}" height="${n(v.h + 4)}" fill="url(#ai-bg)"/>` +
    `<rect x="${n(v.x - 2)}" y="${n(v.y - 2)}" width="${n(v.w + 4)}" height="${n(v.h + 4)}" fill="url(#ai-dots)" opacity=".1"/>`
  const body =
    `<g class="ai-root"><g class="ai-jit">` +
    `<rect width="200" height="200" fill="url(#ai-dots)" mask="url(#ai-field)" opacity=".45"/>` +
    `<g class="ai-head" filter="url(#ai-bloom)"><g mask="url(#ai-head)"><rect width="200" height="200" fill="url(#ai-dots)"/><rect class="ai-shimmer" width="200" height="200" fill="url(#ai-dots-2)"/></g></g>` +
    `</g>${sparks}</g>`

  // a riposo i punti smettono di brillare e di scorrere: restano gli occhi
  return svg(f, c, defs, rigCss(f, shapesFor(84, 1.3), css, '.ai-shimmer,.ai-spark,.ai-wave,.ai-scan,.ai-ripple{animation-play-state:paused}'), body, background)
}

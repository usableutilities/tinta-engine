import type { Mood } from './tipi'
import type { Palette } from './face'
import { SHAPES, backdrop, browD, eye, lum, mix, mouthD, rigCss, svgOpen } from './rig'
import type { Frame, ShapeRules } from './rig'
import { ai, aiBase } from './digitali'
import { fosforo, fosforoBase } from './fosforo-face'

export type CharacterId = 'astratto' | 'volpe' | 'robot' | 'umano' | 'fosforo' | 'ai'

export const CHARACTERS: readonly { id: CharacterId; label: string }[] = [
  { id: 'astratto', label: 'Astratto' },
  { id: 'volpe', label: 'Volpe' },
  { id: 'robot', label: 'Robot' },
  { id: 'umano', label: 'Umano' },
  { id: 'fosforo', label: 'Codice' },
  { id: 'ai', label: 'AI' },
]

export const isCharacter = (v: unknown): v is CharacterId => CHARACTERS.some(c => c.id === v)

/** Un iride con pupilla e due riflessi, attorno a 0,0. */
const iris = (r: number, ring: string, pupil: string, pupilR = r * 0.48) =>
  `<circle r="${r}" fill="url(#__IRIS__)"/>` +
  `<circle r="${r}" fill="none" stroke="${ring}" stroke-width="${(r * 0.16).toFixed(2)}" opacity=".55"/>` +
  `<circle r="${pupilR.toFixed(2)}" fill="${pupil}"/>` +
  `<circle cx="${(r * 0.38).toFixed(2)}" cy="${(-r * 0.42).toFixed(2)}" r="${(r * 0.3).toFixed(2)}" fill="#fff" opacity=".92"/>` +
  `<circle cx="${(-r * 0.35).toFixed(2)}" cy="${(r * 0.38).toFixed(2)}" r="${(r * 0.13).toFixed(2)}" fill="#fff" opacity=".6"/>`

const irisGrad = (id: string, inner: string, outer: string) =>
  `<radialGradient id="${id}" cx=".45" cy=".4" r=".65"><stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/></radialGradient>`

const svg = (f: Frame, c: Palette, defs: string, css: string, body: string) =>
  svgOpen(f, c.text) +
  `${css}<defs>${defs}</defs>${backdrop(f, backdropOf('astratto', c), c.accent)}` +
  `<g class="v-hop"><g class="v-sway"><g class="v-breathe">${body}</g></g></g></svg>`

/** Le forme comuni (sopracciglia e bocca) nella geometria di un personaggio. */
const commonShapes = (g: { browOuter: [number, number]; browInner: [number, number]; browY: number; browS: number; mouthS: number }, extraMouth?: (mood: Mood) => string): ShapeRules => {
  const rules: ShapeRules = {
    '.b-l': mood => browD(g.browOuter[0], g.browInner[0], g.browY, SHAPES[mood].brow, g.browS),
    '.b-r': mood => browD(g.browOuter[1], g.browInner[1], g.browY, SHAPES[mood].brow, g.browS),
    '.m-shape': mood => mouthD(SHAPES[mood].mouth, g.mouthS),
  }
  if (extraMouth) rules['.m-inner'] = extraMouth

  return rules
}

// --- 1. Astratto: una figura morbida, evoluzione del primo volto ---

const astratto = (c: Palette, f: Frame) => {
  const dark = lum(c.surface) < 0.5
  const skin = dark ? mix(c.surface, c.text, 0.1) : mix(c.surface, '#ffffff', 0.4)
  const light = mix(skin, '#ffffff', dark ? 0.16 : 0.5)
  const shade = mix(skin, '#000000', 0.22)
  const irisIn = mix(c.accent, '#ffffff', 0.35)
  const irisOut = mix(c.accent, '#000000', 0.35)
  const lips = mix(c.accent, '#000000', 0.45)
  const shapes = commonShapes({ browOuter: [56, 144], browInner: [85, 115], browY: 64, browS: 1, mouthS: 1 }, mood => mouthD({ ...SHAPES[mood].mouth, up: SHAPES[mood].mouth.low * 0.55 + SHAPES[mood].mouth.up * 0.45 }, 0.62))
  const defs =
    `<radialGradient id="a-head" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="${light}"/><stop offset=".6" stop-color="${skin}"/><stop offset="1" stop-color="${shade}"/></radialGradient>` +
    `<radialGradient id="a-blush"><stop offset="0" stop-color="${c.accent}" stop-opacity=".75"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="a-shadow"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    irisGrad('a-iris', irisIn, irisOut)
  const eyes = ([[72, 'l'], [128, 'r']] as const)
    .map(([x, s]) =>
      eye({ id: `a-eye-${s}`, cx: x, cy: 97, rx: 17, ry: 21, sclera: mix(c.text, '#ffffff', 0.5), iris: iris(10.5, irisOut, c.ink).replace('__IRIS__', 'a-iris'), lid: skin, lidLine: shade, lidLineWidth: 2.2 }),
    )
    .join('')
  const body =
    `<ellipse cx="100" cy="188" rx="58" ry="7" fill="url(#a-shadow)"/>` +
    `<path d="M100 24C164 24 180 40 180 104C180 168 164 184 100 184C36 184 20 168 20 104C20 40 36 24 100 24Z" fill="url(#a-head)" stroke="${c.accent}" stroke-width="2.5"/>` +
    // lucentezza in alto
    `<path d="M58 40C74 32 98 31 116 34" stroke="#fff" stroke-opacity=".25" stroke-width="6" stroke-linecap="round" fill="none"/>` +
    `<g class="v-cheek"><g class="v-blush"><ellipse cx="50" cy="128" rx="17" ry="10" fill="url(#a-blush)"/><ellipse cx="150" cy="128" rx="17" ry="10" fill="url(#a-blush)"/></g></g>` +
    eyes +
    `<g class="v-brows"><g class="v-brow-l"><path class="b-l" fill="none" stroke="${mix(c.text, skin, 0.15)}" stroke-width="5.5" stroke-linecap="round"/></g>` +
    `<g class="v-brow-r"><path class="b-r" fill="none" stroke="${mix(c.text, skin, 0.15)}" stroke-width="5.5" stroke-linecap="round"/></g></g>` +
    `<g transform="translate(100 141)"><g class="v-mouth"><path class="m-shape" fill="${lips}" stroke="${mix(c.text, skin, 0.1)}" stroke-width="3.6" stroke-linejoin="round"/>` +
    `<clipPath id="a-mclip"><path class="m-shape"/></clipPath><path class="m-inner" clip-path="url(#a-mclip)" fill="${mix(c.accent, '#ff8a8a', 0.4)}" opacity=".8"/></g></g>`

  return svg(f, c, defs, rigCss(f, shapes), body)
}

// --- 2. Volpe ---

const volpe = (c: Palette, f: Frame) => {
  const fur = mix(c.accent, '#E5793A', 0.62)
  const furLight = mix(fur, '#FFD3A8', 0.45)
  const furDark = mix(fur, '#5A2A12', 0.45)
  const cream = mix('#FFF4E6', c.text, 0.2)
  const nose = mix(c.ink, '#1a1010', 0.5)
  const irisIn = mix('#F6C453', c.accent, 0.2)
  const irisOut = mix('#B8741A', c.accent, 0.15)
  const shapes = commonShapes({ browOuter: [56, 144], browInner: [84, 116], browY: 86, browS: 0.85, mouthS: 0.8 }, mood => mouthD({ ...SHAPES[mood].mouth, up: SHAPES[mood].mouth.low * 0.55 + SHAPES[mood].mouth.up * 0.45 }, 0.5))
  const defs =
    `<radialGradient id="f-head" cx=".45" cy=".3" r=".8"><stop offset="0" stop-color="${furLight}"/><stop offset=".7" stop-color="${fur}"/><stop offset="1" stop-color="${furDark}"/></radialGradient>` +
    `<linearGradient id="f-ear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${furDark}"/><stop offset=".45" stop-color="${fur}"/></linearGradient>` +
    `<radialGradient id="f-muzzle" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${cream}"/></radialGradient>` +
    `<radialGradient id="f-blush"><stop offset="0" stop-color="#FF7A7A" stop-opacity=".6"/><stop offset="1" stop-color="#FF7A7A" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="f-shadow"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    irisGrad('f-iris', irisIn, irisOut)
  const ear = (side: 'l' | 'r') => {
    const flip = side === 'l' ? '' : ' scale(-1 1)'

    return (
      `<g transform="translate(${side === 'l' ? 64 : 136} 70)${flip}"><g class="v-ear-l">` +
      `<path d="M-22 6C-30 -22 -26 -46 -16 -62C-4 -48 10 -30 16 -6Z" fill="url(#f-ear)" stroke="${furDark}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M-14 0C-20 -18 -18 -34 -13 -46C-6 -36 2 -24 6 -6Z" fill="${mix(cream, '#F3B7A0', 0.4)}"/>` +
      `</g></g>`
    )
  }
  const eyes = ([[75, 'l'], [125, 'r']] as const)
    .map(([x, s]) =>
      eye({
        id: `f-eye-${s}`,
        cx: x,
        cy: 108,
        rx: 14,
        ry: 15,
        // occhio a mandorla, angolo esterno in su
        outline: s === 'l' ? 'M-14 2C-12 -10 -2 -15 8 -13C13 -11 15 -6 14 -2C12 8 3 14 -4 13C-10 12 -14 8 -14 2Z' : 'M14 2C12 -10 2 -15 -8 -13C-13 -11 -15 -6 -14 -2C-12 8 -3 14 4 13C10 12 14 8 14 2Z',
        sclera: '#FFFDF8',
        iris: iris(9.5, irisOut, '#1a120c', 4.6).replace('__IRIS__', 'f-iris'),
        lid: fur,
        lidLine: '#2a160c',
        lidLineWidth: 2.6,
        lower: cream,
      }),
    )
    .join('')
  const body =
    `<ellipse cx="100" cy="190" rx="56" ry="7" fill="url(#f-shadow)"/>` +
    ear('l') +
    ear('r') +
    // testa: guance larghe con ciuffi
    `<path d="M100 48C140 48 164 70 168 104C172 128 178 140 186 150C170 152 160 156 150 164C136 176 118 182 100 182C82 182 64 176 50 164C40 156 30 152 14 150C22 140 28 128 32 104C36 70 60 48 100 48Z" fill="url(#f-head)" stroke="${furDark}" stroke-width="1.6"/>` +
    // muso chiaro e fronte
    `<path d="M100 98C114 98 124 112 140 126C154 138 160 150 150 162C136 176 118 181 100 181C82 181 64 176 50 162C40 150 46 138 60 126C76 112 86 98 100 98Z" fill="url(#f-muzzle)"/>` +
    `<path d="M92 56C96 66 104 66 108 56" stroke="${furLight}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>` +
    `<g class="v-cheek"><g class="v-blush"><ellipse cx="54" cy="138" rx="15" ry="9" fill="url(#f-blush)"/><ellipse cx="146" cy="138" rx="15" ry="9" fill="url(#f-blush)"/></g></g>` +
    eyes +
    // sopracciglia: ciuffi chiari sopra gli occhi
    `<g class="v-brows"><g class="v-brow-l"><path class="b-l" fill="none" stroke="${mix(furLight, '#ffffff', 0.4)}" stroke-width="5" stroke-linecap="round"/></g>` +
    `<g class="v-brow-r"><path class="b-r" fill="none" stroke="${mix(furLight, '#ffffff', 0.4)}" stroke-width="5" stroke-linecap="round"/></g></g>` +
    // naso e filtro
    `<path d="M91 128C91 123 109 123 109 128C109 133 103 137 100 137C97 137 91 133 91 128Z" fill="${nose}"/>` +
    `<ellipse cx="96.5" cy="126.5" rx="3" ry="1.6" fill="#fff" opacity=".45"/>` +
    `<path d="M100 137L100 143" stroke="${nose}" stroke-width="2" stroke-linecap="round"/>` +
    `<g transform="translate(100 147)"><g class="v-mouth"><path class="m-shape" fill="#5a1f1a" stroke="${nose}" stroke-width="2.6" stroke-linejoin="round"/>` +
    `<clipPath id="f-mclip"><path class="m-shape"/></clipPath><path class="m-inner" clip-path="url(#f-mclip)" fill="#E86B6B" opacity=".9"/></g></g>` +
    // baffi
    `<g stroke="${furDark}" stroke-width="1.2" stroke-linecap="round" opacity=".5"><path d="M70 140L46 136M70 145L48 148"/><path d="M130 140L154 136M130 145L152 148"/></g>`

  return svg(f, c, defs, rigCss(f, shapes, ':root{--gs:.62}'), body)
}

// --- 3. Robot ---

const robot = (c: Palette, f: Frame) => {
  const metal = mix(c.surface, '#C9CED6', 0.55)
  const metalLight = mix(metal, '#ffffff', 0.5)
  const metalDark = mix(metal, '#000000', 0.4)
  const screen = mix(c.ink, '#05070a', 0.4)
  const led = mix(c.accent, '#7FF7FF', lum(c.accent) < 0.35 ? 0.4 : 0.1)
  const ledCore = mix(led, '#ffffff', 0.55)
  const shapes = commonShapes({ browOuter: [62, 138], browInner: [90, 110], browY: 76, browS: 0.75, mouthS: 0.95 })
  const defs =
    `<linearGradient id="r-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${metalLight}"/><stop offset=".55" stop-color="${metal}"/><stop offset="1" stop-color="${metalDark}"/></linearGradient>` +
    `<linearGradient id="r-screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(screen, led, 0.12)}"/><stop offset="1" stop-color="${screen}"/></linearGradient>` +
    `<radialGradient id="r-iris" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="${ledCore}"/><stop offset="1" stop-color="${led}"/></radialGradient>` +
    `<radialGradient id="r-bulb" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="${led}"/><stop offset="1" stop-color="${mix(led, '#000', 0.4)}"/></radialGradient>` +
    `<filter id="r-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<radialGradient id="r-shadow"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`
  // occhi: schermi led arrotondati, "pupilla" piu' luminosa che si muove
  const ledEye = (x: number, s: string) =>
    eye({
      id: `r-eye-${s}`,
      cx: x,
      cy: 102,
      rx: 15,
      ry: 17,
      outline: 'M-15 -9C-15 -15 -11 -17 -5 -17L5 -17C11 -17 15 -15 15 -9L15 9C15 15 11 17 5 17L-5 17C-11 17 -15 15 -15 9Z',
      sclera: mix(led, screen, 0.55),
      iris: `<rect x="-8" y="-9" width="16" height="18" rx="5" fill="url(#r-iris)"/><rect x="-1" y="-6" width="5" height="4" rx="1.5" fill="#fff" opacity=".8"/>`,
      lid: screen,
      lidLine: mix(led, screen, 0.3),
      lidLineWidth: 1.6,
    })
  const body =
    `<ellipse cx="100" cy="190" rx="60" ry="7" fill="url(#r-shadow)"/>` +
    // antenna
    `<g transform="translate(100 46)"><g class="v-ear-r"><path d="M0 0L0 -20" stroke="${metalDark}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<circle cy="-24" r="6.5" fill="url(#r-bulb)" filter="url(#r-glow)" class="v-glow"/><circle cy="-24" r="6.5" fill="none" stroke="${metalDark}" stroke-width="1.2"/></g></g>` +
    // orecchie: dischi laterali
    `<g transform="translate(26 108)"><g class="v-ear-l"><rect x="-6" y="-18" width="14" height="36" rx="6" fill="url(#r-head)" stroke="${metalDark}" stroke-width="1.5"/><path d="M1 -10L1 10" stroke="${led}" stroke-width="2" stroke-linecap="round" class="v-glow"/></g></g>` +
    `<g transform="translate(174 108)"><g class="v-ear-r"><rect x="-8" y="-18" width="14" height="36" rx="6" fill="url(#r-head)" stroke="${metalDark}" stroke-width="1.5"/><path d="M-1 -10L-1 10" stroke="${led}" stroke-width="2" stroke-linecap="round" class="v-glow"/></g></g>` +
    // testa e schermo
    `<rect x="32" y="44" width="136" height="132" rx="30" fill="url(#r-head)" stroke="${metalDark}" stroke-width="2"/>` +
    `<path d="M48 56C70 50 130 50 152 56" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<rect x="44" y="62" width="112" height="98" rx="22" fill="url(#r-screen)" stroke="${metalDark}" stroke-width="1.5"/>` +
    `<g opacity=".08" stroke="${led}">${[70, 78, 86, 94, 102, 110, 118, 126, 134, 142, 150].map(y => `<path d="M48 ${y}L152 ${y}"/>`).join('')}</g>` +
    `<g filter="url(#r-glow)">${ledEye(78, 'l')}${ledEye(122, 'r')}</g>` +
    `<g class="v-cheek"><g class="v-blush"><rect x="52" y="128" width="14" height="5" rx="2.5" fill="#FF7AB0"/><rect x="134" y="128" width="14" height="5" rx="2.5" fill="#FF7AB0"/></g></g>` +
    `<g filter="url(#r-glow)"><g class="v-brows"><g class="v-brow-l"><path class="b-l" fill="none" stroke="${led}" stroke-width="4" stroke-linecap="round"/></g>` +
    `<g class="v-brow-r"><path class="b-r" fill="none" stroke="${led}" stroke-width="4" stroke-linecap="round"/></g></g>` +
    `<g transform="translate(100 136)"><g class="v-mouth"><path class="m-shape" fill="${mix(led, screen, 0.7)}" stroke="${led}" stroke-width="3" stroke-linejoin="round"/></g></g></g>` +
    // bulloni
    `<g fill="${metalDark}">${[[42, 54], [158, 54], [42, 166], [158, 166]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join('')}</g>`

  return svg(f, c, defs, rigCss(f, shapes, `:root{--gs:.6}.v-glow{filter:drop-shadow(0 0 2px ${led})}`), body)
}

// --- 4. Umano: volto illustrato, neutro ---

const umano = (c: Palette, f: Frame) => {
  const skin = mix('#E9B998', c.accent, 0.06)
  const skinLight = mix(skin, '#FFF1E6', 0.45)
  const skinShade = mix(skin, '#8A4B33', 0.3)
  const hair = mix(mix(c.ink, '#3A2418', 0.6), c.accent, 0.18)
  const hairLight = mix(hair, '#ffffff', 0.22)
  const lip = mix('#C2655F', c.accent, 0.12)
  const irisIn = mix(c.accent, '#9BC7E8', 0.35)
  const irisOut = mix(c.accent, '#1E3A55', 0.55)
  const shirt = c.accent
  const shapes = commonShapes({ browOuter: [60, 140], browInner: [87, 113], browY: 84, browS: 0.85, mouthS: 0.82 }, mood => mouthD({ ...SHAPES[mood].mouth, up: SHAPES[mood].mouth.low * 0.6 + SHAPES[mood].mouth.up * 0.4 }, 0.55))
  const defs =
    `<radialGradient id="h-face" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="${skinLight}"/><stop offset=".65" stop-color="${skin}"/><stop offset="1" stop-color="${skinShade}"/></radialGradient>` +
    `<linearGradient id="h-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hairLight}"/><stop offset="1" stop-color="${hair}"/></linearGradient>` +
    `<radialGradient id="h-blush"><stop offset="0" stop-color="#F07A78" stop-opacity=".55"/><stop offset="1" stop-color="#F07A78" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="h-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(shirt, '#fff', 0.15)}"/><stop offset="1" stop-color="${mix(shirt, '#000', 0.3)}"/></linearGradient>` +
    irisGrad('h-iris', irisIn, irisOut)
  const eyes = ([[77, 'l'], [123, 'r']] as const)
    .map(([x, s]) =>
      eye({
        id: `h-eye-${s}`,
        cx: x,
        cy: 106,
        rx: 13,
        ry: 10,
        outline: 'M-13 1C-9 -8 -3 -10 2 -10C8 -10 12 -6 13 -1C10 6 5 9 0 9C-6 9 -11 6 -13 1Z',
        sclera: '#FBF8F4',
        iris: iris(7.6, irisOut, '#141018', 3.6).replace('__IRIS__', 'h-iris'),
        lid: skin,
        lidLine: '#2B1D18',
        lidLineWidth: 2.4,
        lashes: s,
        lower: skin,
      }),
    )
    .join('')
  const body =
    // capelli dietro
    `<path d="M40 108C34 64 60 34 100 34C140 34 166 64 160 108C160 124 156 140 150 150L50 150C44 140 40 124 40 108Z" fill="${hair}"/>` +
    // orecchie
    `<ellipse cx="44" cy="112" rx="8" ry="12" fill="${skinShade}"/><ellipse cx="156" cy="112" rx="8" ry="12" fill="${skinShade}"/>` +
    `<path d="M45 106C42 110 42 116 46 119" stroke="${mix(skinShade, '#000', 0.25)}" stroke-width="1.4" fill="none"/><path d="M155 106C158 110 158 116 154 119" stroke="${mix(skinShade, '#000', 0.25)}" stroke-width="1.4" fill="none"/>` +
    // volto
    `<path d="M100 52C132 52 152 74 152 108C152 140 128 166 100 166C72 166 48 140 48 108C48 74 68 52 100 52Z" fill="url(#h-face)"/>` +
    // frangia
    `<path d="M46 98C46 62 70 42 100 42C132 42 156 62 154 98C146 84 136 74 120 70C110 78 92 80 78 74C66 80 54 88 46 98Z" fill="url(#h-hair)"/>` +
    `<path d="M70 56C84 48 104 46 122 52" stroke="#fff" stroke-opacity=".2" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    `<g class="v-cheek"><g class="v-blush"><ellipse cx="66" cy="130" rx="14" ry="8" fill="url(#h-blush)"/><ellipse cx="134" cy="130" rx="14" ry="8" fill="url(#h-blush)"/></g>` +
    // zigomi che salgono col sorriso
    `<path d="M58 128C64 134 72 136 80 134" stroke="${skinShade}" stroke-opacity=".25" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M142 128C136 134 128 136 120 134" stroke="${skinShade}" stroke-opacity=".25" stroke-width="2" fill="none" stroke-linecap="round"/></g>` +
    eyes +
    `<g class="v-brows"><g class="v-brow-l"><path class="b-l" fill="none" stroke="${hair}" stroke-width="4.6" stroke-linecap="round"/></g>` +
    `<g class="v-brow-r"><path class="b-r" fill="none" stroke="${hair}" stroke-width="4.6" stroke-linecap="round"/></g></g>` +
    // naso: un'ombra e la punta
    `<path d="M101 112C103 122 106 128 104 132C102 134 98 134 96 132" stroke="${skinShade}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>` +
    `<ellipse cx="102" cy="129" rx="3" ry="1.5" fill="#fff" opacity=".25"/>` +
    `<g transform="translate(100 146)"><g class="v-mouth"><path class="m-shape" fill="${lip}" stroke="${mix(lip, '#000', 0.3)}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<clipPath id="h-mclip"><path class="m-shape"/></clipPath><path class="m-inner" clip-path="url(#h-mclip)" fill="#5A2322" opacity=".75"/></g></g>`

  return svg(f, c, defs, rigCss(f, shapes, ':root{--gs:.45}'), body)
}

const BUILDERS: { [id in CharacterId]: (c: Palette, f: Frame) => string } = { astratto, volpe, robot, umano, fosforo, ai }

/** Il disegno del personaggio: identico per tutta la vita del pannello (dipende solo da colori e lato). */
export const characterSvg = (id: CharacterId, c: Palette, f: Frame) => (BUILDERS[id] ?? BUILDERS.astratto)(c, f)

/** Il colore che riempie il pannello attorno al personaggio: lo stesso del suo sfondo. */
export const backdropOf = (id: CharacterId, c: Palette) => (id === 'fosforo' ? fosforoBase(c) : id === 'ai' ? aiBase(c) : c.surface)

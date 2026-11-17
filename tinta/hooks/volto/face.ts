import type { Mood } from './tipi'

/** I colori del volto, presi dal tema attivo o dal ripiego. */
export type Palette = { surface: string; accent: string; text: string; ink: string; muted: string; accent2?: string; mode?: 'dark' | 'light' }

export const FALLBACK: Palette = { surface: '#24262B', accent: '#7FB7A4', text: '#F2EFEA', ink: '#16171A', muted: '#9A9A9A' }

export const MOOD_WORDS: { [mood in Mood]: string } = {
  idle: 'a riposo',
  listening: 'ascolto',
  thinking: 'ci penso',
  working: 'al lavoro',
  talking: 'rispondo',
  waiting: 'tocca a te',
  happy: 'fatto',
  worried: 'qualcosa non va',
}

/** Il volto in testo, per il terminale. */
export const FACE_TEXT: { [mood in Mood]: string } = {
  idle: '( ・‿・ )',
  listening: '( °ᴗ° )',
  thinking: '( ¬_¬ )',
  working: '( ・_・)→',
  talking: '( ・o・ )',
  waiting: '( ºдº )?',
  happy: '( ^‿^ )',
  worried: '( ・﹏・ )',
}

const HEX = /^#[0-9a-f]{6}$/i

/** I colori dal testo di un tema Tinta in chiaro; undefined se sigillato o illeggibile. */
export const paletteOf = (text: string): Palette | undefined => {
  try {
    const theme = JSON.parse(text) as { palette?: Partial<Palette> }
    const p = theme.palette
    if (p === undefined || typeof p.accent !== 'string' || !HEX.test(p.accent)) return undefined
    const pick = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v : d)

    return {
      surface: pick(p.surface, FALLBACK.surface),
      accent: p.accent,
      text: pick(p.text, FALLBACK.text),
      ink: pick(p.ink, FALLBACK.ink),
      muted: pick(p.muted, FALLBACK.muted),
    }
  } catch {
    return undefined
  }
}

/** L'id del tema dal testo di active.json, anche se sigillato. */
export const themeIdOf = (text: string): string | undefined => {
  try {
    const id = (JSON.parse(text) as { id?: unknown }).id

    return typeof id === 'string' && /^[a-z0-9-]+$/.test(id) ? id : undefined
  } catch {
    return undefined
  }
}

/** Palette note dei temi Tinta, per quando il tema attivo e' sigillato. */
const KNOWN: { [base: string]: Palette } = {
  fosforo: { surface: '#0A140C', accent: '#39FF88', text: '#DDF5E2', ink: '#050A06', muted: '#6F9A80' },
}

export const knownPalette = (id: string): Palette | undefined => KNOWN[id.split('-')[0] ?? '']

/** I colori pubblicati in chiaro dal motore Tinta (~/.claude/tinta/active-colors.json), anche per i temi sigillati. */
export const publishedPalette = (text: string): { id?: string; palette: Palette } | undefined => {
  try {
    const raw = JSON.parse(text) as { [key: string]: unknown }
    const pick = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v : undefined)
    const accent = pick(raw.accent)
    if (!accent) return undefined
    const palette: Palette = {
      surface: pick(raw.surface) ?? FALLBACK.surface,
      accent,
      text: pick(raw.text) ?? FALLBACK.text,
      ink: pick(raw.bg) ?? FALLBACK.ink,
      muted: pick(raw.muted) ?? FALLBACK.muted,
      ...(pick(raw.accent2) ? { accent2: pick(raw.accent2) } : {}),
      ...(raw.mode === 'light' || raw.mode === 'dark' ? { mode: raw.mode } : {}),
    }

    return { ...(typeof raw.id === 'string' ? { id: raw.id } : {}), palette }
  } catch {
    return undefined
  }
}

const hex3 = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const lumOf = (c: string) => {
  const [r = 0, g = 0, b = 0] = hex3(c)

  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
const blend = (a: string, b: string, t: number) => {
  const x = hex3(a)
  const y = hex3(b)

  return `#${x.map((v, i) => Math.round(v + ((y[i] ?? 0) - v) * t).toString(16).padStart(2, '0')).join('')}`
}

/**
 * I colori dei volti fatti di luce (Codice, AI) da qualunque tema: fondo sempre scuro (il colore piu'
 * scuro del tema, scurito e appena tinto dall'accento: anche con un tema chiaro, perche' la luce
 * si legge solo sul buio), luce dall'accento schiarito quanto serve, un secondo colore per i riflessi.
 */
export const lightColors = (c: Palette) => {
  const darkest = [c.ink, c.surface, c.text].reduce((a, b) => (lumOf(b) < lumOf(a) ? b : a))
  const base = blend(blend(darkest, '#000000', lumOf(darkest) > 0.2 ? 0.8 : 0.45), c.accent, 0.05)
  let glow = c.accent
  for (let i = 0; i < 6 && lumOf(glow) < 0.42; i++) glow = blend(glow, '#ffffff', 0.18)
  const second = c.accent2 && lumOf(c.accent2) > 0.25 ? c.accent2 : blend(glow, '#ffffff', 0.45)

  return { base, glow, hot: blend(glow, '#ffffff', 0.6), second }
}

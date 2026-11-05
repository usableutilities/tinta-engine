/**
 * Sfondo della pagina del tab Code tramite il "Backdrop" pubblico dell'API dei mod
 * (`$.ui.backdrop` + `ui.render` per `Backdrop`, motore 2.1.317, app del 2 novembre 2026).
 *
 * Il desktop disegna l'albero restituito per `Backdrop` a tutta finestra, dietro la
 * conversazione (`-z-10`, `inert`, `aria-hidden`, `pointer-events: none`): non tocca
 * selezione, puntatore o lettura a schermo. Con `glass` l'app smeriglia i suoi pannelli
 * sopra il disegno: colonna della conversazione (velo = `opacity`), barra laterale (56%),
 * composer e barra del titolo (46%), schede (55%), coperture piene (70%).
 *
 * Questo modulo e' fatto solo di funzioni pure: dal campo `page` di un tema (o dalla
 * tavolozza) calcola gli argomenti di `$.ui.backdrop` e il disegno Svg, controllando che il
 * testo dell'app resti leggibile sopra ogni pannello smerigliato. Il collegamento
 * (session.start, hook di render) sta in register.tsx: vedi RICERCA-SFONDO-PAGINA-2.md.
 */

export type PageAppearance = 'dark' | 'light'

/** Come il disegno riempie la finestra. */
export type PageKind = 'solid' | 'gradient' | 'mesh' | 'dots'

/** Il vetro dei pannelli dell'app, come lo accetta `$.ui.backdrop` (UiBackdropGlass). */
export type PageGlass = { blur: number; opacity: number; tint?: string }

/** Il campo `page` di un tema, gia' letto e ripulito. */
export type PageSpec = {
  /** Nome del backdrop tra quelli di Tinta: 1-64 lettere, cifre, `_` o `-`. */
  id: string
  kind: PageKind
  /** Da 1 a 5 colori `#RRGGBB`. */
  colors: string[]
  /** Quanto i colori si allontanano dal fondo dell'app: 0 (niente) a 1 (pieni). */
  strength: number
  /** Direzione del gradiente in gradi (0 = da sinistra a destra, 90 = dall'alto in basso). */
  angle: number
  /** Deriva lentissima dei bagliori (SMIL); l'app la toglie da sola con "riduci movimento". */
  motion: boolean
  /** `false`: pannelli dell'app come sono (il disegno resta sotto il testo senza velo). */
  glass: { blur?: number; opacity?: number; tint?: string } | false
}

/** Gli argomenti di `$.ui.backdrop` (UiBackdropArgs). */
export type PageBackdropArgs = { id: string; glass: PageGlass | false }

/** Quello che l'hook di render disegna: un Box pieno con dentro un Svg. */
export type PageDrawing = { base: string; source: string; alt: string }

// MARK: - Costanti dell'app (lette nel bundle web del 2 novembre 2026)

/** Fondo della conversazione per aspetto (uguale a APP_BACKGROUND di theme.ts). */
export const PAGE_BACKGROUND: { [mode in PageAppearance]: string } = { dark: '#1F1F1F', light: '#FFFFFF' }
/** Testo principale dell'app (uguale a APP_TEXT di theme.ts). */
export const PAGE_TEXT: { [mode in PageAppearance]: string } = { dark: '#ECECEC', light: '#1F1F1F' }
/** Contrasto minimo del testo principale sopra ogni pannello smerigliato (come CHAT_MIN_CONTRAST). */
export const PAGE_MIN_CONTRAST = 7

/**
 * Quanto ogni pannello dell'app copre il disegno con la sua tinta, se `glass` e' attivo
 * (`.dframe-root[data-engine-glass]` nel CSS dell'app): il velo della colonna usa
 * `opacity`, gli altri quote fisse. Il composer e la barra del titolo sono i piu' scoperti.
 */
export const GLASS_SHARE = { sidebar: 0.56, card: 0.55, pane: 0.46, cover: 0.7 } as const
/** Sotto la vibrancy della barra o senza GPU l'app alza il velo almeno a questo valore. */
export const GLASS_OPACITY_FLOOR = 0.3
/** Default dell'app quando `glass` e' `{}`. */
export const GLASS_DEFAULT = { blur: 16, opacity: 0.6 } as const
/** Limiti di `UiBackdropGlass`. */
export const GLASS_BLUR_MAX = 64
/**
 * Soglia di luminanza con cui l'app tiene o scarta la tinta del vetro: in scuro la tinta
 * deve stare sotto, in chiaro sopra; altrimenti usa il colore del suo pannello.
 */
export const GLASS_TINT_LUMINANCE = 0.179
/** Formato di `id` accettato da `$.ui.backdrop`. */
export const PAGE_ID = /^[A-Za-z0-9_-]{1,64}$/
/** Lunghezza massima di `Svg.source`. */
export const SVG_MAX = 131072
/** Il disegno: 16:10, ritagliato per coprire la finestra (`slice`); l'app lo stira al 100%. */
export const PAGE_VIEW = { width: 1600, height: 1000 } as const
/** Una deriva completa dei bagliori, in secondi: abbastanza lenta da non distrarre. */
export const PAGE_DRIFT_S = 140

const KINDS: readonly PageKind[] = ['solid', 'gradient', 'mesh', 'dots']
const HEX6 = /^#[0-9a-fA-F]{6}$/
const HEX3 = /^#[0-9a-fA-F]{3}$/

// MARK: - Colori

/** `#RGB` o `#RRGGBB` in `#RRGGBB` maiuscolo; altro undefined. */
export const hex6 = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  if (HEX6.test(v)) return v.toUpperCase()
  if (HEX3.test(v)) return `#${[...v.slice(1)].map(c => c + c).join('')}`.toUpperCase()
  return undefined
}

const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (c: number[]): string =>
  `#${c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase()}`

/** `a` spostato verso `b` di `t` (0..1): come `color-mix(in srgb, b t, a)`. */
export const mixHex = (a: string, b: string, t: number): string => {
  const x = rgb(a)
  const y = rgb(b)
  return toHex(x.map((c, i) => c + ((y[i] as number) - c) * t))
}

/** Luminanza relativa WCAG. */
export const lum = (hex: string): number => {
  const [r, g, b] = rgb(hex).map(c => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapporto di contrasto WCAG, 1..21. */
export const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const round2 = (v: number): number => Math.round(v * 100) / 100

// MARK: - Lettura del tema

/**
 * Il campo `page` di un tema in un PageSpec; `undefined` se manca, e' `false`/`"none"`
 * o non ha colori. I colori sono `#hex` o nomi della tavolozza; senza colori propri
 * prende `accent` (e `accent2`, `accent3` se ci sono) dalla tavolozza.
 *
 * ```json
 * "page": { "kind": "mesh", "colors": ["accent", "#3A6BD8"], "strength": 0.35, "glass": { "blur": 18 } }
 * ```
 */
export const pageSpecOf = (raw: unknown, palette: { [key: string]: string } = {}, themeId = 'tinta'): PageSpec | undefined => {
  if (raw === undefined || raw === null || raw === false || raw === 'none') return undefined
  const page = (typeof raw === 'object' ? raw : typeof raw === 'string' ? { kind: raw } : {}) as { [key: string]: unknown }
  const colorOf = (v: unknown): string | undefined => hex6(v) ?? (typeof v === 'string' ? hex6(palette[v]) : undefined)
  const listed = Array.isArray(page.colors) ? page.colors : typeof page.colors === 'string' ? [page.colors] : []
  const own = listed.map(colorOf).filter((c): c is string => c !== undefined)
  const fromPalette = ['accent', 'accent2', 'accent3'].map(k => colorOf(palette[k])).filter((c): c is string => c !== undefined)
  const colors = (own.length > 0 ? own : fromPalette).slice(0, 5)
  if (colors.length === 0) return undefined
  const kind = KINDS.find(k => k === (typeof page.kind === 'string' ? page.kind.trim().toLowerCase() : '')) ?? 'mesh'
  const glassRaw = page.glass
  const glass: PageSpec['glass'] =
    glassRaw === false
      ? false
      : typeof glassRaw === 'object' && glassRaw !== null
        ? (() => {
            const g = glassRaw as { [key: string]: unknown }
            const tint = colorOf(g.tint)
            return {
              ...(typeof g.blur === 'number' && Number.isFinite(g.blur) && { blur: g.blur }),
              ...(typeof g.opacity === 'number' && Number.isFinite(g.opacity) && { opacity: g.opacity }),
              ...(tint !== undefined && { tint }),
            }
          })()
        : {}
  const rawId = typeof page.id === 'string' ? page.id : `tinta-${themeId}`
  const id = rawId.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64) || 'tinta'

  return {
    id,
    kind,
    colors,
    strength: clamp(num(page.strength, 0.3), 0, 1),
    angle: ((num(page.angle, 135) % 360) + 360) % 360,
    motion: page.motion === true,
    glass,
  }
}

// MARK: - Vetro e leggibilita'

/** La tinta del vetro che l'app tiene davvero in questo aspetto, altrimenti undefined. */
export const keptTint = (tint: string | undefined, mode: PageAppearance): string | undefined => {
  const c = hex6(tint)
  if (c === undefined) return undefined
  return mode === 'light' ? (lum(c) >= GLASS_TINT_LUMINANCE ? c : undefined) : lum(c) <= GLASS_TINT_LUMINANCE ? c : undefined
}

/**
 * I colori piu' lontani dal fondo che il disegno puo' mostrare, gia' sfumati sul fondo
 * dell'app: un colore del tema a `strength`; con `mesh` due bagliori sovrapposti
 * (alfa composto `1 - (1 - s)^2`), con `dots` un punto pieno al doppio della forza.
 */
export const pageInks = (spec: PageSpec, mode: PageAppearance): string[] => {
  const base = PAGE_BACKGROUND[mode]
  const s = spec.strength
  const reach = spec.kind === 'mesh' ? 1 - (1 - s) ** 2 : spec.kind === 'dots' ? Math.min(1, s * 2) : s
  return spec.colors.map(c => mixHex(base, c, reach))
}

/** Il fondo sotto il testo di un pannello che copre il disegno con `tint` a quota `share`. */
export const underPanel = (ink: string, tint: string, share: number): string => mixHex(ink, tint, clamp(share, 0, 1))

/**
 * Il contrasto peggiore del testo dell'app sopra il disegno: su ogni pannello smerigliato
 * (velo della colonna a `opacity`, barra 56%, composer e titolo 46%) o, senza vetro,
 * direttamente sopra il disegno.
 */
export const worstContrast = (spec: PageSpec, glass: PageGlass | false, mode: PageAppearance): number => {
  const text = PAGE_TEXT[mode]
  const inks = pageInks(spec, mode)
  if (glass === false) return Math.min(...inks.map(ink => ratio(text, ink)))
  const tint = keptTint(glass.tint, mode) ?? PAGE_BACKGROUND[mode]
  const shares = [glass.opacity, GLASS_SHARE.sidebar, GLASS_SHARE.card, GLASS_SHARE.pane]
  return Math.min(...inks.flatMap(ink => shares.map(share => ratio(text, underPanel(ink, tint, share)))))
}

/**
 * Il vetro da chiedere all'app: limiti di `UiBackdropGlass`, tinta solo se l'app la tiene,
 * opacita' alzata a passi di 0,05 finche' il velo della colonna tiene PAGE_MIN_CONTRAST.
 * `false` resta `false`.
 */
export const glassFor = (spec: PageSpec, mode: PageAppearance): PageGlass | false => {
  if (spec.glass === false) return false
  const tint = keptTint(spec.glass.tint, mode)
  const blur = round2(clamp(num(spec.glass.blur, GLASS_DEFAULT.blur), 0, GLASS_BLUR_MAX))
  let opacity = clamp(num(spec.glass.opacity, GLASS_DEFAULT.opacity), 0, 1)
  const text = PAGE_TEXT[mode]
  const veil = tint ?? PAGE_BACKGROUND[mode]
  const inks = pageInks(spec, mode)
  while (opacity < 0.95 && Math.min(...inks.map(ink => ratio(text, underPanel(ink, veil, opacity)))) < PAGE_MIN_CONTRAST) {
    opacity = Math.min(0.95, opacity + 0.05)
  }
  return { blur, opacity: round2(opacity), ...(tint !== undefined && { tint }) }
}

/**
 * Il PageSpec con `strength` abbassata (a passi di 0,02) finche' il testo resta leggibile
 * anche sui pannelli a quota fissa (composer 46%), che l'opacita' non puo' aiutare.
 */
export const legibleSpec = (spec: PageSpec, mode: PageAppearance): PageSpec => {
  let out = spec
  const glass = glassFor(spec, mode)
  while (out.strength > 0 && worstContrast(out, glass, mode) < PAGE_MIN_CONTRAST) {
    out = { ...out, strength: round2(Math.max(0, out.strength - 0.02)) }
  }
  return out
}

/** Gli argomenti per `$.ui.backdrop`, gia' leggibili; `undefined` se l'id non e' valido. */
export const backdropArgsFor = (spec: PageSpec, mode: PageAppearance): PageBackdropArgs | undefined => {
  if (!PAGE_ID.test(spec.id)) return undefined
  return { id: spec.id, glass: glassFor(legibleSpec(spec, mode), mode) }
}

/** Vero se il backdrop in `ui.render` e' di Tinta (gli altri plugin si lasciano stare). */
export const isOwnBackdrop = (props: { plugin?: unknown; id?: unknown } | undefined, plugin = 'tinta'): boolean =>
  props !== undefined && props.plugin === plugin && typeof props.id === 'string'

// MARK: - Disegno

/** Un numero intero stabile da una stringa (FNV-1a), per posare i bagliori sempre uguali. */
export const seedOf = (text: string): number => {
  let h = 0x811c9dc5
  for (const ch of text) {
    h ^= ch.codePointAt(0) as number
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** Posizioni dei bagliori: ai quattro angoli e al centro, ruotate dal seme, mai sovrapposte al centro. */
export const meshSpots = (count: number, seed: number): { x: number; y: number; r: number }[] => {
  const { width: w, height: hgt } = PAGE_VIEW
  const anchors = [
    { x: 0.12, y: 0.15 },
    { x: 0.88, y: 0.2 },
    { x: 0.8, y: 0.88 },
    { x: 0.18, y: 0.82 },
    { x: 0.5, y: 0.5 },
  ]
  return Array.from({ length: count }, (_, i) => {
    const a = anchors[(i + seed) % anchors.length] as { x: number; y: number }
    const jitter = ((seed >>> (i * 3)) % 7) / 100
    return { x: Math.round((a.x + jitter - 0.03) * w), y: Math.round((a.y - jitter + 0.03) * hgt), r: Math.round(w * (0.42 + ((seed >>> i) % 5) / 50)) }
  })
}

const svgOpen = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_VIEW.width} ${PAGE_VIEW.height}" preserveAspectRatio="xMidYMid slice">${body}</svg>`

/**
 * Il disegno del backdrop: `base` per il Box sotto (copre anche prima che l'immagine
 * arrivi), `source` per l'Svg. Lo spec va passato gia' leggibile (legibleSpec).
 */
export const pageDrawing = (spec: PageSpec, mode: PageAppearance): PageDrawing => {
  const base = PAGE_BACKGROUND[mode]
  const s = round2(spec.strength)
  const rect = (fill: string): string => `<rect width="100%" height="100%" fill="${fill}"/>`
  let body: string

  if (spec.kind === 'solid') {
    body = rect(mixHex(base, spec.colors[0] as string, s))
  } else if (spec.kind === 'gradient') {
    const rad = (spec.angle * Math.PI) / 180
    const [x1, y1, x2, y2] = [0.5 - Math.cos(rad) / 2, 0.5 - Math.sin(rad) / 2, 0.5 + Math.cos(rad) / 2, 0.5 + Math.sin(rad) / 2].map(round2)
    const list = spec.colors.length === 1 ? [spec.colors[0] as string, base] : spec.colors
    const stops = list
      .map((c, i) => `<stop offset="${round2(i / (list.length - 1))}" stop-color="${c === base ? base : mixHex(base, c, s)}"/>`)
      .join('')
    body = `<defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient></defs>${rect('url(#g)')}`
  } else if (spec.kind === 'dots') {
    const dot = mixHex(base, spec.colors[0] as string, Math.min(1, s * 2))
    body =
      `<defs><pattern id="d" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="1.6" fill="${dot}"/></pattern></defs>` +
      `${rect(base)}${rect('url(#d)')}`
  } else {
    const spots = meshSpots(Math.max(3, spec.colors.length), seedOf(spec.id))
    const defs = spots
      .map((_, i) => {
        const c = spec.colors[i % spec.colors.length] as string
        return `<radialGradient id="m${i}"><stop offset="0" stop-color="${c}" stop-opacity="${s}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
      })
      .join('')
    const blobs = spots
      .map((p, i) => {
        const drift = spec.motion
          ? `<animateTransform attributeName="transform" type="translate" values="0 0;${i % 2 ? -60 : 60} ${i % 3 ? 40 : -40};0 0" dur="${PAGE_DRIFT_S + i * 17}s" repeatCount="indefinite"/>`
          : ''
        return `<g><circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="url(#m${i})"/>${drift}</g>`
      })
      .join('')
    body = `<defs>${defs}</defs>${rect(base)}${blobs}`
  }

  return { base, source: svgOpen(body), alt: 'Sfondo Tinta' }
}

/**
 * Tutto quello che serve al collegamento: argomenti per `$.ui.backdrop` e disegno per
 * l'hook di render, dallo stesso spec reso leggibile. `undefined` se il tema non ha `page`.
 */
export const pagePlan = (
  raw: unknown,
  palette: { [key: string]: string },
  mode: PageAppearance,
  themeId = 'tinta',
): { args: PageBackdropArgs; drawing: PageDrawing; spec: PageSpec } | undefined => {
  const parsed = pageSpecOf(raw, palette, themeId)
  if (parsed === undefined) return undefined
  const spec = legibleSpec(parsed, mode)
  const args = backdropArgsFor(spec, mode)
  if (args === undefined) return undefined
  const drawing = pageDrawing(spec, mode)
  return drawing.source.length > SVG_MAX ? undefined : { args, drawing, spec }
}

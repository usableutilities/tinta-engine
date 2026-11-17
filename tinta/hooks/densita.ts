import type { Look } from './theme'

/**
 * Density: how much room Tinta's own drawings take up and down, the
 * person's choice in ~/.claude/tinta/preferenze.json `"density"`, read at
 * every poll: `large`, `normal` (the default: exactly as before), `compact`,
 * `ultra`. One scale table, every renderer reads its row: heading sizes, the
 * room round headings, tables and code, the ## underline, the label row
 * (name · time) and Claude's bubble padding. Colours, gradients and loops are
 * the same at every density. The desktop's own rows (the person's native
 * bubble, the gap the app keeps between rows) are the app's: no density
 * reaches them.
 */
export const DENSITIES = ['large', 'normal', 'compact', 'ultra'] as const
export type Density = (typeof DENSITIES)[number]

export type DensityScale = {
  /** A heading's size per level, CSS px (the app's body text is 16). */
  heading: { [level: number]: number }
  /** The share of the normal room above and below a heading, a table, a code window. */
  space: number
  /** The ## underline: px under the words, and its thickness. */
  rule: { gap: number; height: number }
  /** The label row: its drawing's share of its size, its room below in px, and whether the time shows in it. */
  label: { scale: number; space: number; time: boolean }
  /** The share of the normal padding in Claude's bubble and a theme's own user bubble. */
  pad: number
}

/** The scale table. `normal` is the engine's constants as they were (reply.tsx HEADING_CSS_PX, svg.ts LABEL_SPACE). */
export const DENSITY: { [density in Density]: DensityScale } = {
  large: { heading: { 1: 28, 2: 23, 3: 19.5 }, space: 1.4, rule: { gap: 6, height: 2 }, label: { scale: 1.1, space: 5, time: true }, pad: 1.4 },
  normal: { heading: { 1: 24, 2: 20, 3: 17 }, space: 1, rule: { gap: 5, height: 1.5 }, label: { scale: 1, space: 3, time: true }, pad: 1 },
  compact: { heading: { 1: 19, 2: 17, 3: 16.5 }, space: 0.5, rule: { gap: 3, height: 1 }, label: { scale: 0.85, space: 1, time: true }, pad: 0.5 },
  ultra: { heading: { 1: 17, 2: 16, 3: 16 }, space: 0.25, rule: { gap: 2, height: 0.75 }, label: { scale: 0.75, space: 0, time: false }, pad: 0.25 },
}

/** preferenze.json's `density` read: one of DENSITIES, anything else `normal`. */
export const densityOf = (value: unknown): Density => (DENSITIES.includes(value as Density) ? (value as Density) : 'normal')

/** The density `look` is drawn at (withDensity marks it), `normal` when unmarked. */
export const densityOfLook = (look: { density?: string } | null | undefined): Density => densityOf(look?.density)

/** The scale row `look` is drawn at. */
export const scaleOf = (look: { density?: string } | null | undefined): DensityScale => DENSITY[densityOfLook(look)]

const times = (n: number | undefined, share: number): number | undefined => (n === undefined ? undefined : Math.round(n * share * 100) / 100)

/** A heading's room above and below, Box margin units: the normal rhythm at `scale`'s share. */
export const rhythmAt = (normal: { top: number; bottom: number }, scale: DensityScale): { top: number; bottom: number } =>
  scale.space === 1 ? normal : { top: times(normal.top, scale.space) as number, bottom: times(normal.bottom, scale.space) as number }

/** `look` at `density`: marked so the renderers pick its scale, Claude's bubble's and the user's paddings scaled. Normal: `look` itself. */
export const withDensity = (look: Look, density: Density): Look => {
  if (density === 'normal') return look
  const { pad } = DENSITY[density]
  const bubble = look.assistant?.bubble
  const user = look.user

  return {
    ...look,
    density,
    ...(look.assistant ? { assistant: { ...look.assistant, ...(bubble ? { bubble: { ...bubble, paddingX: times(bubble.paddingX, pad), paddingY: times(bubble.paddingY, pad) } } : {}) } } : {}),
    ...(user
      ? {
          user: {
            ...user,
            ...(user.paddingX !== undefined ? { paddingX: times(user.paddingX, pad) } : {}),
            ...(user.paddingY !== undefined ? { paddingY: times(user.paddingY, pad) } : {}),
            ...(user.marginY !== undefined ? { marginY: times(user.marginY, pad) } : {}),
          },
        }
      : {}),
  } as Look
}

/** `drawing` shown at `scale` of its size: its root's width and height scaled, its viewBox kept, so the picture shrinks whole. */
export const scaledDrawing = <D extends { source: string; width: number; height: number }>(drawing: D, scale: number): D => {
  if (scale === 1) return drawing
  const width = Math.max(1, Math.round(drawing.width * scale * 100) / 100)
  const height = Math.max(1, Math.round(drawing.height * scale * 100) / 100)
  const source = drawing.source.replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${width}" height="${height}"`)

  return { ...drawing, source, width, height }
}

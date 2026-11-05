/** `assistant.bubble.fillMode`: how Claude's bubble paints its fill (see fills.tsx). */
export type FillMode = 'A' | 'B' | 'C' | 'D' | 'E' | 'M'

/** The names a theme may give `fillMode`, by letter or by name, any case. */
export const FILL_MODES: { [name: string]: FillMode } = {
  a: 'A',
  parent: 'A',
  b: 'B',
  alpha: 'B',
  c: 'C',
  underlay: 'C',
  d: 'D',
  'svg-underlay': 'D',
  e: 'E',
  stack: 'E',
  m: 'M',
  mesh: 'M',
}

/** A theme's `fillMode` as a letter; anything else none. */
export const fillModeOf = (value: unknown): FillMode | undefined => (typeof value === 'string' ? FILL_MODES[value.trim().toLowerCase()] : undefined)

/** `assistant.bubble.glow`: a faint coloured halo around Claude's bubble (see fills.tsx). */
export type Glow = 'halo' | 'drop'

/** A theme's `glow`: "halo" or "drop", any case; `false` or anything else none. */
export const glowOf = (value: unknown): Glow | undefined => {
  const name = typeof value === 'string' ? value.trim().toLowerCase() : undefined

  return name === 'halo' || name === 'drop' ? name : undefined
}

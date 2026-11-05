import { localize } from './i18n'
import type { PluginState } from 'claude-code'

import type { TintaAssistantAvatar, TintaBorderStyle, TintaChat, TintaFill, TintaUserAvatar } from '../types'
import { averageOf } from './svg'
import { fillModeOf, glowOf } from './fillmode'
import type { FillMode, Glow } from './fillmode'

export type Theme = NonNullable<PluginState['tinta']['theme']>
export type Look = Omit<Theme, 'variants'>
export type Border = { style: string; color?: string; hoverColor?: string }
export type Appearance = 'dark' | 'light'
export type Surface = 'terminal' | 'desktop' | 'mobile' | 'vscode'

/** What the app paints behind a row Tinta leaves transparent. */
export const APP_BACKGROUND: { [mode in Appearance]: string } = { dark: '#1F1F1F', light: '#FFFFFF' }
/** The least contrast a color Tinta draws must keep against what is behind it. */
export const MIN_CONTRAST = 3

const HEX = /^#[0-9a-fA-F]{6}$/
const BORDER_STYLES: readonly TintaBorderStyle[] = ['single', 'round', 'double', 'bold', 'classic', 'none']
const SPINNER_MODES = ['thinking', 'requesting', 'responding', 'tool-use', 'tool-input'] as const
const SOUND_FILE = /^[\w.-]+\.(wav|mp3|aiff|aif|m4a|ogg)$/i

type Json = { [key: string]: unknown }

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const section = (value: unknown): Json => (isObject(value) ? value : {})

export const text = (value: unknown, max = 120): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, '')

  return clean.length > 0 && clean.length <= max ? clean : undefined
}

/** A number from 0 to `max` in quarter steps: cells or rows of padding. */
const quarter = (value: unknown, max: number): number | undefined =>
  typeof value === 'number' && Number.isInteger(value * 4) && value >= 0 && value <= max ? value : undefined

const bool = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined)

/**
 * A CSS font stack for SVG text (a heading's display face): family names,
 * quoted or bare, commas and spaces only, at most 200 characters; anything
 * else (markup, url(), semicolons) is dropped.
 */
export const fontStack = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' && value.length <= 200 && /^[\w\s,'"-]+$/.test(value) ? value.trim() : undefined

const int = (value: unknown, max: number): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : undefined

const svg = (value: unknown): string | undefined => {
  const source = text(value, 131072)

  return source !== undefined && /^\s*<svg[\s>]/i.test(source) ? source : undefined
}

const words = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }
  const list = value.map(word => text(word, 40)).filter((word): word is string => word !== undefined)

  return list.length > 0 ? list.slice(0, 50) : undefined
}

/** One or two letters or digits, uppercase: a chip's initial. */
export const initialOf = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const letters = [...value.trim()].filter(char => /[\p{L}\p{N}]/u.test(char)).slice(0, 2).join('').toUpperCase()

  return letters.length > 0 ? letters : undefined
}

/** Drops undefined fields so the value is plain JSON for $.state. */
const compact = <T extends Json>(value: T): T => {
  const out: Json = {}
  for (const [key, field] of Object.entries(value)) {
    if (field !== undefined) {
      out[key] = field
    }
  }

  return out as T
}

const nonEmpty = <T extends Json>(value: T): T | undefined => {
  const out = compact(value)

  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Lays `patch` over `base`: objects merge key by key, anything else replaces,
 * and `null` removes the key (a variant drops a background with it).
 */
export const deepMerge = (base: Json, patch: Json): Json => {
  const out: Json = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete out[key]
    } else if (isObject(value) && isObject(out[key])) {
      out[key] = deepMerge(out[key] as Json, value)
    } else {
      out[key] = value
    }
  }

  return out
}

/**
 * A themed prompt's stub: a preset name, or up to three printable characters
 * of the theme's own (the "⋯" handle by default, see register.tsx USER_STUB);
 * `same` leaves the app's row the prompt's real words (stubMode hidden).
 */
export const stubOf = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  if (['blank', 'space', 'empty', 'zwsp', 'same'].includes(value)) return value
  const chars = [...value]

  return chars.length >= 1 && chars.length <= 3 && !/[\u0000-\u001F\u007F-\u009F]/.test(value) ? value : undefined
}

export const parseTheme = (source: string, locale?: string | null): Theme | null => {
  let raw: unknown
  try {
    // per-language text ({ "it": ..., "en": ... }) resolved to the user's language first
    raw = localize(JSON.parse(source), locale)
  } catch {
    return null
  }
  if (!isObject(raw) || (raw.schema !== undefined && raw.schema !== 1)) {
    return null
  }
  const { variants: rawVariants, ...rest } = raw
  const base = parseLook(rest)
  const variants: { [mode: string]: Look } = {}
  for (const mode of ['dark', 'light'] as const) {
    const patch = section(rawVariants)[mode]
    if (isObject(patch)) {
      const { id: _id, name: _name, variants: _nested, ...safe } = patch
      variants[mode] = parseLook(deepMerge(rest, safe))
    }
  }

  return Object.keys(variants).length > 0 ? { ...base, variants } : base
}

/** A theme's `page`, its known fields only (fx-page.ts reads it again with the palette). */
const PAGE_KINDS = ['solid', 'gradient', 'mesh', 'dots', 'rain'] as const
const pageOf = (value: unknown): Look['page'] => {
  if (typeof value === 'string') return PAGE_KINDS.includes(value as never) ? value : undefined
  if (!isObject(value)) return undefined
  const glass = value.glass === false ? false : isObject(value.glass) ? compact({ blur: typeof value.glass.blur === 'number' ? value.glass.blur : undefined, opacity: typeof value.glass.opacity === 'number' ? value.glass.opacity : undefined, tint: typeof value.glass.tint === 'string' ? value.glass.tint : undefined }) : undefined
  return compact({
    id: typeof value.id === 'string' ? value.id : undefined,
    kind: PAGE_KINDS.find(kind => kind === value.kind),
    colors: Array.isArray(value.colors) ? value.colors.filter((c): c is string => typeof c === 'string').slice(0, 5) : undefined,
    strength: typeof value.strength === 'number' ? value.strength : undefined,
    angle: typeof value.angle === 'number' ? value.angle : undefined,
    motion: typeof value.motion === 'boolean' ? value.motion : undefined,
    glass,
  }) as Look['page']
}

const parseLook = (raw: Json): Look => {

  const palette: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(section(raw.palette))) {
    if (typeof value === 'string' && HEX.test(value) && /^\w{1,32}$/.test(key)) {
      palette[key] = value
    }
  }

  // A color is a hex value or the name of a palette entry.
  const color = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
      return undefined
    }

    return HEX.test(value) ? value : palette[value]
  }

  const border = (value: unknown): Border | undefined => {
    const field = section(value)
    const style = typeof field.style === 'string' ? field.style : undefined
    if (style === undefined || !(BORDER_STYLES as readonly string[]).includes(style)) {
      return undefined
    }

    return compact({ style, color: color(field.color), hoverColor: color(field.hoverColor) })
  }

  const unit = (value: unknown, fallback?: number): number | undefined =>
    typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback

  // A fill: a color, { gradient } or { pattern }; anything else is dropped.
  const fill = (value: unknown): TintaFill | undefined => {
    const solid = color(value)
    if (solid !== undefined) {
      return { solid }
    }
    const field = section(value)
    if (isObject(field.gradient)) {
      const g = field.gradient
      const stops: [string, number, number?][] = []
      for (const entry of Array.isArray(g.stops) ? g.stops.slice(0, 8) : []) {
        if (!Array.isArray(entry)) {
          continue
        }
        const hex = color(entry[0])
        const offset = unit(entry[1])
        const opacity = unit(entry[2])
        if (hex !== undefined && offset !== undefined) {
          stops.push(opacity === undefined ? [hex, offset] : [hex, offset, opacity])
        }
      }
      if (stops.length < 2) {
        return undefined
      }
      const angle = typeof g.angle === 'number' && Number.isFinite(g.angle) ? ((g.angle % 360) + 360) % 360 : 90

      return { gradient: compact({ type: g.type === 'radial' ? ('radial' as const) : ('linear' as const), angle, stops, animate: bool(g.animate) }) }
    }
    if (isObject(field.pattern)) {
      const p = field.pattern
      const kind = p.kind === 'dots' || p.kind === 'lines' || p.kind === 'grid' || p.kind === 'noise' ? p.kind : undefined
      const ink = color(p.color)
      if (kind === undefined || ink === undefined) {
        return undefined
      }
      const size = typeof p.size === 'number' && p.size >= 2 && p.size <= 32 ? Math.round(p.size) : 6

      return { pattern: compact({ kind, color: ink, background: color(p.background), size }) }
    }

    return undefined
  }

  const art = (field: Json) => ({
    labelFill: fill(field.labelFill),
    labelChip: fill(field.labelChip),
    labelGlow: bool(field.labelGlow),
    labelGlass: bool(field.labelGlass),
    avatarFill: fill(field.avatarFill),
  })

  const user = section(raw.user)
  const assistant = section(raw.assistant)
  const tools = section(raw.tools)
  const toolResult = section(raw.toolResult)
  const activity = section(raw.activity)
  const glyphs = section(activity.glyphs)
  const spinner = section(raw.spinner)
  const band = section(raw.band)
  const sounds = section(raw.sounds)

  const perTool: { [tool: string]: { icon?: string; color?: string } } = {}
  for (const [name, value] of Object.entries(section(tools.perTool))) {
    const entry = section(value)
    const one = nonEmpty({ icon: text(entry.icon, 4), color: color(entry.color) })
    if (one !== undefined && /^[\w-]{1,64}$/.test(name)) {
      perTool[name] = one
    }
  }

  const spinnerWords: { [mode: string]: string[] } = {}
  for (const mode of SPINNER_MODES) {
    const list = words(spinner[mode])
    if (list !== undefined) {
      spinnerWords[mode] = list
    }
  }
  const suffix = typeof spinner.suffix === 'string' && spinner.suffix.length <= 8 ? spinner.suffix : undefined

  const align = user.align === 'right' || user.align === 'left' ? user.align : undefined

  const theme: Look = compact({
    id: text(raw.id, 64) ?? 'tema',
    name: text(raw.name, 64) ?? text(raw.id, 64) ?? 'Tema',
    author: text(raw.author, 64),
    palette,
    user: nonEmpty({
      label: text(user.label, 60),
      labelColor: color(user.labelColor),
      labelBold: bool(user.labelBold),
      textColor: color(user.textColor),
      background: color(user.background),
      border: border(user.border),
      paddingX: int(user.paddingX, 8),
      paddingY: int(user.paddingY, 4),
      marginY: int(user.marginY, 4),
      align,
      rule: bool(user.rule),
      desktopLabel: bool(user.desktopLabel),
      avatarSvg: svg(user.avatarSvg),
      accent: color(user.accent),
      avatar: (['person-outline', 'person', 'initial', 'orb', 'none'] as const).find(kind => kind === user.avatar) as TintaUserAvatar | undefined,
      initial: initialOf(user.initial),
      name: text(user.name, 40),
      render: user.render === 'themed' || user.render === 'native' ? user.render : undefined,
      stub: stubOf(user.stub),
      stubMode: user.stubMode === 'hidden' || user.stubMode === 'beside' || user.stubMode === 'segment' || user.stubMode === 'glow' || user.stubMode === 'twin-fill' ? user.stubMode : undefined,
      // stubMode glow: the blurred shape under the app's bubble
      glowFill: fill(user.glowFill),
      // glowFill "mesh": the warm mesh (glow.tsx USER_MESH) in place of a fill
      glowMesh: user.glowFill === 'mesh' ? true : undefined,
      glowOpacity: unit(user.glowOpacity),
      glowBlur: int(user.glowBlur, 40),
      glowOvershoot: int(user.glowOvershoot, 80),
      glowOffsetY: typeof user.glowOffsetY === 'number' && Number.isInteger(user.glowOffsetY) && Math.abs(user.glowOffsetY) <= 120 ? user.glowOffsetY : undefined,
      glowOffsetX: typeof user.glowOffsetX === 'number' && Number.isInteger(user.glowOffsetX) && Math.abs(user.glowOffsetX) <= 120 ? user.glowOffsetX : undefined,
      glowWidthScale: typeof user.glowWidthScale === 'number' && user.glowWidthScale >= 0.5 && user.glowWidthScale <= 1.5 ? user.glowWidthScale : undefined,
      // the user's bubble shadow (same art as Claude's, in the user's accent): parsed, drawn later
      shadow: user.shadow === 'soft' ? ('soft' as const) : undefined,
      ...art(user),
    }),
    assistant: nonEmpty({
      label: text(assistant.label, 60),
      labelColor: color(assistant.labelColor),
      labelBold: bool(assistant.labelBold),
      background: color(assistant.background),
      border: border(assistant.border),
      indent: int(assistant.indent, 12),
      rule: bool(assistant.rule),
      desktopLabel: bool(assistant.desktopLabel),
      avatarSvg: svg(assistant.avatarSvg),
      accent: color(assistant.accent),
      avatar: (['claude', 'spark', 'drop', 'orb', 'none'] as const).find(kind => kind === assistant.avatar) as TintaAssistantAvatar | undefined,
      avatarColor: (['theme', 'original'] as const).find(kind => kind === assistant.avatarColor),
      bubble:
        assistant.bubble === false
          ? false
          : isObject(assistant.bubble)
            ? compact({
                fill: color(section(assistant.bubble).fill),
                border: color(section(assistant.bubble).border),
                paddingX: quarter(section(assistant.bubble).paddingX, 6),
                paddingY: quarter(section(assistant.bubble).paddingY, 2),
                fillMode: fillModeOf(section(assistant.bubble).fillMode),
                glow: glowOf(section(assistant.bubble).glow),
                shadow: section(assistant.bubble).shadow === 'soft' || section(assistant.bubble).shadow === 'drop' ? (section(assistant.bubble).shadow as 'soft' | 'drop') : undefined,
                halo: bool(section(assistant.bubble).halo),
              })
            : undefined,
      ...art(assistant),
    }),
    tools: isObject(raw.tools)
      ? compact({
          icon: text(tools.icon, 4),
          color: color(tools.color),
          nameColor: color(tools.nameColor),
          perTool,
        })
      : undefined,
    toolResult: nonEmpty({ border: border(toolResult.border), background: color(toolResult.background) }),
    activity: nonEmpty({
      show: bool(activity.show),
      color: color(activity.color),
      guide: bool(activity.guide),
      background: bool(activity.background),
      pending: bool(activity.pending),
      diffstat: bool(activity.diffstat),
      glyphs: nonEmpty({ tool: text(glyphs.tool, 4), agent: text(glyphs.agent, 4), task: text(glyphs.task, 4), command: text(glyphs.command, 4) }),
    }),
    spinner:
      Object.keys(spinnerWords).length > 0 || suffix !== undefined || spinner.wave !== undefined
        ? compact({
            words: spinnerWords,
            suffix,
            keepAppStepText: bool(spinner.keepAppStepText) ?? true,
            mark: (['spin', 'pulse', 'still'] as const).find(kind => kind === spinner.mark),
            wave:
              spinner.wave === true
                ? (true as const)
                : isObject(spinner.wave)
                  ? nonEmpty({ colors: (Array.isArray(section(spinner.wave).colors) ? (section(spinner.wave).colors as unknown[]) : []).map(one => color(one)).filter((one): one is string => one !== undefined).slice(0, 4) }) ?? (true as const)
                  : undefined,
          })
        : undefined,
    band: isObject(raw.band)
      ? compact({
          show: bool(band.show) ?? true,
          text: text(band.text, 80),
          color: color(band.color),
          background: color(band.background),
          svg: svg(band.svg),
          fill: fill(band.fill),
          titleFill: fill(band.titleFill),
          overlay: fill(band.overlay),
          glass: bool(band.glass),
          showToggle: bool(band.showToggle) ?? true,
          switcher: bool(band.switcher),
          context: (['bar', 'percent', 'off'] as const).find(kind => kind === band.context),
          timer: bool(band.timer),
        })
      : undefined,
    appearance: raw.appearance === 'dark' || raw.appearance === 'light' ? raw.appearance : undefined,
    forceBackground: bool(raw.forceBackground),
    motion: bool(raw.motion),
    // visible border lines only for a theme built around them; absent or false: none
    style: isObject(raw.style) ? nonEmpty({ borders: bool(section(raw.style).borders) }) : undefined,
    meta: bool(raw.meta),
    markdown: (() => {
      const m = section(raw.markdown)
      const tables = m.tables === 'tinta' || m.tables === 'app' ? m.tables : undefined

      return nonEmpty({ tables, headings: bool(m.headings), code: bool(m.code) })
    })(),
    page: pageOf(raw.page),
    // the design system's styleHints (docs/DESIGN-SYSTEM.md), read as written in the v2 templates
    hints: (() => {
      const h = section(raw.styleHints)
      const u = section(h.user)
      const b = section(section(h.assistant).bubble)
      const stroke = (value: unknown) => {
        const one = section(value)
        const c = color(one.color)

        return c === undefined ? undefined : compact({ color: c, alpha: unit(one.alpha) ?? 0.25, width: typeof one.width === 'number' && one.width > 0 && one.width <= 4 ? one.width : 1 })
      }
      const colors = (value: unknown) => (Array.isArray(value) ? value.map(one => color(one)).filter((one): one is string => one !== undefined).slice(0, 6) : [])
      const pick = <T extends string>(value: unknown, list: readonly T[]): T | undefined => list.find(one => one === value)
      const meshOf = section(u.mesh)
      const cw = section(h.codeWindow)
      const hd = section(h.headings)
      const wave = section(h.wave)
      const label = section(h.label)
      const glow = section(h.glow)
      const activityHint = section(h.activity)
      const borders = section(h.borders)

      return nonEmpty({
        user: nonEmpty({
          labelChip: pick(u.labelChip, ['none', 'outline', 'gradient-glow'] as const),
          glowStroke: stroke(u.glowStroke),
          glowFill: u.glowFill === 'none' ? ('none' as const) : undefined,
          fillAlpha: unit(u.fillAlpha),
          mesh: colors(meshOf.colors).length >= 2 ? compact({ colors: colors(meshOf.colors), base: color(meshOf.base), baseAlpha: unit(meshOf.baseAlpha) }) : undefined,
        }),
        cycle: (() => {
          const list = Array.isArray(section(h.assistant).cycle) ? (section(h.assistant).cycle as unknown[]) : Array.isArray(section(raw.assistant).cycle) ? (section(raw.assistant).cycle as unknown[]) : []
          const sets = list
            .map(one => section(one))
            .map(one => compact({ accent: color(one.accent) as string, label: colors(one.label).length > 0 ? colors(one.label) : undefined, mesh: colors(one.mesh).length > 0 ? colors(one.mesh) : undefined, edge: color(one.edge) }))
            .filter(one => one.accent !== undefined)
            .slice(0, 12)

          return sets.length >= 2 ? sets : undefined
        })(),
        bubble: nonEmpty({
          fill: b.fill === 'none' ? ('none' as const) : color(b.fill),
          fillAlpha: unit(b.fillAlpha),
          border: stroke(b.border),
          mesh: colors(b.mesh).length >= 2 ? colors(b.mesh) : undefined,
          meshStrength: typeof b.meshStrength === 'number' && b.meshStrength > 0 && b.meshStrength <= 2 ? b.meshStrength : undefined,
          meshBaseAlpha: unit(b.meshBaseAlpha),
          backdrop: pick(b.backdrop ?? section(section(raw.assistant).bubble).backdrop, ['rain', 'glass', 'none'] as const),
        }),
        borders: nonEmpty({ alpha: unit(borders.alpha), width: typeof borders.width === 'number' && borders.width > 0 && borders.width <= 4 ? borders.width : undefined }),
        activity: nonEmpty({ rowFill: color(activityHint.rowFill), rowFillAlpha: unit(activityHint.rowFillAlpha) }),
        glow: nonEmpty({ activityTile: bool(glow.activityTile), label: bool(glow.label) }),
        headings: nonEmpty({
          fill: fill(hd.fill),
          style: pick(hd.style, ['outline-rule'] as const),
          rule: bool(hd.rule),
          effect: pick(hd.effect, ['decode', 'gradient-drift', 'silver-cut', 'neon-tube', 'frost', 'glitch', 'glitter', 'sparkle', 'gradient', 'leaf', 'serif', 'terracotta'] as const),
          font: pick(hd.font, ['sans', 'mono', 'serif'] as const),
        }),
        codeWindow: nonEmpty({
          header: pick(cw.header, ['none', 'outline', 'solid', 'mesh'] as const),
          headerAlpha: unit(cw.headerAlpha),
          borderAlpha: unit(cw.borderAlpha),
          headerFill: fill(cw.headerFill),
          dots: cw.dots === false ? ('none' as const) : pick(cw.dots, ['none', 'ring', 'filled', 'glow'] as const),
          dotColors: colors(cw.dotColors).length > 0 ? colors(cw.dotColors) : undefined,
          languageChip: pick(cw.languageChip, ['chip', 'text'] as const),
        }),
        tables: pick(h.tables, ['outline'] as const),
        darkOnly: bool(h.darkOnly),
        wave: nonEmpty({
          kind: pick(wave.kind, ['none', 'line', 'voice', 'ink', 'curtain', 'refraction', 'scanline', 'flicker', 'breath', 'ink-line', 'rain', 'log', 'sparkle', 'ember', 'unicorn'] as const),
          colors: colors(wave.colors).length > 0 ? colors(wave.colors) : undefined,
          strokeWidth: typeof wave.strokeWidth === 'number' && wave.strokeWidth > 0 && wave.strokeWidth <= 6 ? wave.strokeWidth : undefined,
        }),
        label: nonEmpty({
          font: pick(label.font, ['mono', 'serif', 'sans'] as const),
          prefix: typeof label.prefix === 'string' && label.prefix.length <= 24 && !/[\u0000-\u001f<>&]/.test(label.prefix) ? label.prefix : undefined,
          cursor: typeof label.cursor === 'string' && [...label.cursor].length === 1 && !/[<>&]/.test(label.cursor) ? label.cursor : undefined,
          smallCaps: bool(label.smallCaps),
          tracking: typeof label.tracking === 'number' && label.tracking >= 0 && label.tracking <= 0.5 ? label.tracking : undefined,
        }),
        tools: nonEmpty({ prefix: typeof section(h.tools).prefix === 'string' && String(section(h.tools).prefix).length <= 8 ? String(section(h.tools).prefix) : undefined, outcome: bool(section(h.tools).outcome) }),
        band: pick(h.band, ['tmux'] as const),
      })
    })(),
    // the owner's batch of experiments, each off-switchable; absent: on for Tinta alone (featureOn)
    experiments: (() => {
      const x = section(raw.experiments)

      return nonEmpty(Object.fromEntries(EXPERIMENTS.map(name => [name, bool(x[name])])) as { [name in Experiment]?: boolean })
    })(),
    typography: (() => {
      const display = fontStack(section(raw.typography).display)

      return display === undefined ? undefined : { display }
    })(),
    rule: (() => {
      const r = section(raw.rule)
      const spec = compact({ width: int(r.width, 8), gap: int(r.gap, 40), opacity: unit(r.opacity) })

      return Object.keys(spec).length === 0 ? undefined : spec
    })(),
    divider: (() => {
      const d = section(raw.divider)
      const f = fill(d.fill)

      return f === undefined ? undefined : compact({ fill: f, height: int(d.height, 24) ?? 10, show: bool(d.show) })
    })(),
    chat: (() => {
      const c = section(raw.chat)
      const background = fill(c.background)

      return background === undefined
        ? undefined
        : compact({
            background,
            opacity: unit(c.opacity, 0.6) as number,
            bleed: int(c.bleed, 4) ?? 1,
            overlay: fill(c.overlay),
            vignette: bool(c.vignette),
          })
    })(),
    statusLine: text(raw.statusLine, 120),
    promptHint: text(raw.promptHint, 120),
    // "" turns the footer label off; absent, the engine shows the theme's id
    modeLabel: raw.modeLabel === '' ? '' : text(raw.modeLabel, 32),
    toasts: nonEmpty({ onApply: text(section(raw.toasts).onApply, 120) }),
    sounds: nonEmpty({
      ...Object.fromEntries(
        SOUND_EVENTS.map(name => [name, typeof sounds[name] === 'string' && SOUND_FILE.test(sounds[name] as string) ? (sounds[name] as string) : undefined]),
      ),
      volume: typeof sounds.volume === 'number' && Number.isFinite(sounds.volume) ? Math.max(0, Math.min(1, sounds.volume)) : undefined,
      muted: typeof sounds.muted === 'boolean' ? sounds.muted : undefined,
    }),
  })

  return JSON.parse(JSON.stringify(theme)) as Look
}

/**
 * An experimental feature's switch (markdown.headings, markdown.code,
 * activity.diffstat and the like): the theme's own value when it gives one,
 * else on for the Tinta theme alone, so the owner's copy of it shows them.
 */
/** The experiments a theme can switch (`experiments.<name>`), each on for Tinta unless false. */
export const EXPERIMENTS = ['taskRows', 'todos', 'hoverScope', 'spinnerModes', 'toasts', 'turnFooter', 'permissionNotice', 'diffButton', 'glowExactWidth', 'userBreaks'] as const
export type Experiment = (typeof EXPERIMENTS)[number]

/** Whether `look` runs experiment `name`. */
export const tries = (look: { id: string; experiments?: { [name in Experiment]?: boolean } } | null | undefined, name: Experiment): boolean =>
  look !== null && look !== undefined && featureOn(look.experiments?.[name], look)

export const featureOn = (value: boolean | undefined, look: { id: string }): boolean => value ?? look.id === 'tinta'

/** Whether a look is built for the dark app alone (styleHints.darkOnly; Fosforo and Avorio unless they say otherwise). */
export const darkOnly = (look: { id: string; hints?: { darkOnly?: boolean } }): boolean => look.hints?.darkOnly ?? /^(fosforo|avorio)-/.test(look.id)

/** Fills {name}, {id} and {author} in a theme string. */
export const fill = (template: string, theme: Look): string =>
  template
    .replaceAll('{name}', theme.name)
    .replaceAll('{id}', theme.id)
    .replaceAll('{author}', theme.author ?? '')

/** A short description of a tool call's input, or undefined when unsure. */
export const describeCall = (tool: string, input: unknown): string | undefined => {
  const args = section(input)
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = args[key]
      if (typeof value === 'string' && value.trim() !== '') {
        return value
      }
    }

    return undefined
  }
  const value =
    tool === 'Bash'
      ? pick('command')
      : pick('file_path', 'notebook_path', 'path', 'pattern', 'url', 'query', 'description', 'command')
  if (value === undefined) {
    return undefined
  }
  const line = (value.split('\n')[0] ?? '').replace(/[\u0000-\u001f\u007f]/g, '')

  return line.length > 80 ? `${line.slice(0, 79)}…` : line
}

/** The moments a theme may give a sound to (`sounds.<name>`: a file name). */
export const SOUND_EVENTS = ['turnStart', 'turnComplete', 'error', 'toolError', 'permissionRequest', 'compaction', 'agentDone', 'alert'] as const
export type SoundEvent = (typeof SOUND_EVENTS)[number]

export const MIME: { [ext: string]: string } = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
}

// MARK: - Appearance and contrast

/** The app appearance a `/config` theme value names, or undefined. */
export const appearanceOf = (value: unknown): Appearance | undefined =>
  typeof value !== 'string' ? undefined : value.startsWith('light') ? 'light' : value.startsWith('dark') ? 'dark' : undefined

/**
 * The appearance to draw for: the theme's own `appearance` first (the person's
 * override), then the terminal's `/config` theme; the desktop's own light or
 * dark look never reaches a mod, so it counts as dark there.
 */
export const appearanceFor = (theme: Theme, detected: Appearance | undefined, surface: Surface): Appearance =>
  theme.appearance ?? (surface === 'terminal' ? detected : undefined) ?? 'dark'

const channels = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16)

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (rgb: number[]): string =>
  `#${rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('').toUpperCase()}`

/** WCAG relative luminance of `#RRGGBB`. */
export const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map(c => {
    const v = c / 255

    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two `#RRGGBB` colors, 1 to 21. */
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]

  return (hi + 0.05) / (lo + 0.05)
}

/** `a` moved toward `b` by `t` (0 to 1). */
export const mix = (a: string, b: string, t: number): string => {
  const x = channels(a)
  const y = channels(b)

  return toHex(x.map((c, i) => c + ((y[i] ?? c) - c) * t))
}

/**
 * `color` itself when it keeps MIN_CONTRAST against `background`, else the
 * nearest step toward `toward` (the palette's text when that reads, white or
 * black otherwise) that does: the hue stays as far as legibility allows.
 */
/**
 * A colour that reads at 3:1 on both the app's dark and light backgrounds:
 * its luminance pushed into [0.141, 0.30] (3:1 on #1F1F1F needs 0.141 or
 * more, 3:1 on #FFFFFF 0.30 or less), toward white or black in tenths.
 * The desktop never tells its appearance, so its colours must read on both.
 */
export const readableOnBoth = (color: string | undefined): string | undefined => {
  if (color === undefined || !HEX.test(color)) return color
  const low = 0.141
  const high = 0.3
  const l = luminance(color)
  if (l >= low && l <= high) return color.toUpperCase()
  const target = l < low ? '#FFFFFF' : '#000000'
  for (let step = 1; step <= 40; step++) {
    const candidate = mix(color, target, step / 40)
    const m = luminance(candidate)
    if (m >= low && m <= high) return candidate
  }

  return l < low ? '#8A8A8A' : '#5F5F5F'
}

/** A bubble edge for the desktop: the accent at EDGE_ALPHA as #RRGGBBAA, or a neutral grey. */
export const alphaEdge = (accent: string | undefined): string =>
  `${accent !== undefined && HEX.test(accent) ? accent.toUpperCase() : '#808080'}${Math.round(EDGE_ALPHA * 255).toString(16).padStart(2, '0').toUpperCase()}`

/** The alpha of a bubble's edge on the desktop, where the accent itself reads on both backgrounds. */
export const EDGE_ALPHA = 0.45

export const readable = (color: string | undefined, background: string, toward?: string): string | undefined => {
  if (color === undefined || !HEX.test(color) || contrast(color, background) >= MIN_CONTRAST) {
    return color
  }
  const target =
    toward !== undefined && HEX.test(toward) && contrast(toward, background) >= MIN_CONTRAST
      ? toward
      : luminance(background) < 0.5
        ? '#FFFFFF'
        : '#000000'
  for (let step = 1; step <= 10; step++) {
    const candidate = mix(color, target, step / 10)
    if (contrast(candidate, background) >= MIN_CONTRAST) {
      return candidate
    }
  }

  return target
}

/**
 * The look to draw on `surface` in `appearance`: the matching variant laid
 * over the base, backgrounds dropped behind anything the app draws itself
 * (unless `forceBackground`), and every color Tinta draws text in moved until
 * it reads against what is really behind it.
 */
export const lookFor = (theme: Theme, appearance: Appearance, surface: Surface): Look => {
  const { variants, ...base } = theme
  const look: Look = variants?.[appearance] ?? base
  const force = look.forceBackground === true
  // The chat background is parsed but never drawn (see DECISIONI.md: a layer
  // behind the app's rows broke text selection in the replies), so every
  // color Tinta writes is measured against the app's own background.
  const app = APP_BACKGROUND[appearance]
  const toward = look.palette.text
  // the desktop never says light or dark: what Tinta writes on the app's own
  // background must read on both, unless the theme fixes its appearance
  // styleHints.darkOnly (and Fosforo and Avorio, built for the dark app): read only against the appearance the app
  // has (the dark one), the light app getting the template's light variant; never pushed to 3:1 against white
  const both = surface === 'desktop' && theme.appearance === undefined && !darkOnly(look)
  const fix = (color: string | undefined, background = app) => (both && background === app ? readableOnBoth(color) : readable(color, background, toward))
  const fixBorder = (border: Border | undefined, background = app): Border | undefined =>
    border === undefined
      ? undefined
      : compact({ ...border, color: fix(border.color, background), hoverColor: fix(border.hoverColor, background) })

  /** A text fill whose every stop reads against `background`. */
  const fixFill = (value: TintaFill | undefined, background: string): TintaFill | undefined => {
    if (value === undefined) {
      return undefined
    }
    if ('solid' in value) {
      return { solid: fix(value.solid, background) as string }
    }
    if ('gradient' in value) {
      return {
        gradient: {
          ...value.gradient,
          stops: value.gradient.stops.map(([hex, offset, opacity]) => {
            const fixed = fix(hex, background) as string

            return opacity === undefined ? [fixed, offset] : [fixed, offset, opacity]
          }),
        },
      }
    }

    return { pattern: { ...value.pattern, color: fix(value.pattern.color, background) as string } }
  }
  /** Label art with its text fill legible on its chip, or on `background`. */
  const fixArt = <T extends { labelFill?: TintaFill; labelChip?: TintaFill }>(style: T, background: string): T =>
    compact({
      ...style,
      labelFill: fixFill(style.labelFill, style.labelChip ? averageOf(style.labelChip, background) : background),
    })

  const { chat: _chat, ...drawn } = withRoles(look)
  const out: Look = compact({ ...drawn, palette: { ...look.palette } })
  for (const key of ['accent', 'danger', 'success', ...(both ? (['muted'] as const) : [])] as const) {
    if (out.palette[key] !== undefined) {
      out.palette[key] = fix(out.palette[key]) as string
    }
  }

  if (out.activity !== undefined) {
    out.activity = compact({ ...out.activity, color: fix(out.activity.color) })
  }

  const roles = withRoles(look)
  if (roles.user !== undefined) {
    const lookUser = roles.user
    // On the terminal Tinta draws the prompt's text itself, so its fill is
    // safe; on the desktop the row inside is the app's.
    const ownsText = surface === 'terminal' || surface === 'mobile' || surface === 'vscode'
    const background = lookUser.background !== undefined && (ownsText || force) ? lookUser.background : undefined
    const behind = background ?? app
    out.user = compact({
      ...lookUser,
      // The desktop app draws its prompt bubble at the right: the label and
      // rule follow it unless the theme asks for the left.
      align: lookUser.align ?? (surface === 'desktop' ? 'right' : undefined),
      background,
      labelColor: fix(lookUser.labelColor, behind),
      accent: fix(lookUser.accent, behind),
      textColor: ownsText ? fix(lookUser.textColor, behind) : undefined,
      border: fixBorder(lookUser.border, behind),
    })
    out.user = fixArt(out.user, behind)
  }

  if (roles.assistant !== undefined) {
    // The reply's body is the app's Markdown, drawn in the app's colors.
    const background = force ? roles.assistant.background : undefined
    out.assistant = compact({
      ...roles.assistant,
      // On desktop the reply starts where the app's own rows start.
      ...(surface === 'desktop' ? { indent: 0 } : {}),
      background,
      labelColor: fix(roles.assistant.labelColor, background ?? app),
      accent: fix(roles.assistant.accent, background ?? app),
      bubble:
        roles.assistant.bubble === false
          ? (false as const)
          : both
            ? bubbleFor({ ...roles.assistant.bubble, border: roles.assistant.bubble?.border ?? alphaEdge(fix(roles.assistant.accent ?? look.palette.accent)) }, undefined, appearance)
            : bubbleFor(roles.assistant.bubble, roles.assistant.accent ?? look.palette.accent, appearance),
    })
    out.assistant = fixArt(out.assistant, background ?? app)
  }

  if (look.tools !== undefined) {
    const perTool: typeof look.tools.perTool = {}
    for (const [name, one] of Object.entries(look.tools.perTool)) {
      perTool[name] = compact({ ...one, color: fix(one.color) })
    }
    out.tools = compact({ ...look.tools, color: fix(look.tools.color), nameColor: fix(look.tools.nameColor), perTool })
  }

  if (look.toolResult !== undefined) {
    // The result inside is the app's own row.
    const background = force ? look.toolResult.background : undefined
    out.toolResult = nonEmpty({ border: fixBorder(look.toolResult.border, background ?? app), background })
  }

  if (look.band !== undefined) {
    // The toggle is the app's native Button, drawn in the app's colors.
    const background = look.band.background !== undefined && (!look.band.showToggle || force) ? look.band.background : undefined
    const behind = background ?? app
    const under = look.band.fill ? averageOf(look.band.fill, behind) : behind
    out.band = compact({
      ...look.band,
      background,
      color: fix(look.band.color, behind),
      titleFill: fixFill(look.band.titleFill, under),
    })
  }

  return out
}

// MARK: - Roles: the user and Claude, told apart at a glance

/** The text color that reads best on `accent`: the palette's ink or text, else black or white. */
export const onColor = (accent: string, palette: { [key: string]: string }): string => {
  const candidates = [palette.ink, palette.text, '#000000', '#FFFFFF'].filter((c): c is string => c !== undefined && HEX.test(c))
  const good = candidates.find(c => contrast(c, accent) >= 4.5)

  return good ?? (contrast('#000000', accent) >= contrast('#FFFFFF', accent) ? '#000000' : '#FFFFFF')
}

/**
 * The roles' defaults from their accents: the user gets a solid pill in the
 * accent with legible text (drawn on desktop only when the theme opts in)
 * and a bust silhouette; Claude gets the accent as label text with no pill
 * and the Claude burst. Fields the theme sets
 * itself are kept, except Claude's pill, which a role accent removes.
 */
export const withRoles = (look: Look): Look => {
  const out: Look = { ...look }
  const user = look.user
  if (user?.accent !== undefined) {
    out.user = compact({
      ...user,
      labelColor: user.labelColor ?? user.accent,
      // styleHints.user.labelChip: none (the name in the accent, no pill), outline (a thin ring, the name in the
      // accent), gradient-glow (the pill, glowing); absent, the full pill as before
      ...(look.hints?.user?.labelChip === 'none' || look.hints?.user?.labelChip === 'outline'
        ? { labelChip: undefined, labelFill: user.labelFill ?? { solid: user.accent } }
        : { labelChip: user.labelChip ?? { solid: user.accent }, labelFill: user.labelFill ?? { solid: onColor(user.accent, look.palette) } }),
      ...(look.hints?.user?.labelChip === 'gradient-glow' ? { labelGlow: true } : {}),
      avatar: user.avatar ?? 'person-outline',
    })
  }
  const assistant = look.assistant
  if (assistant?.accent !== undefined) {
    out.assistant = compact({
      ...assistant,
      labelColor: assistant.labelColor ?? assistant.accent,
      labelFill: assistant.labelFill ?? { solid: assistant.accent },
      labelChip: undefined,
      labelGlass: undefined,
      avatar: assistant.avatar ?? 'claude',
    })
  }
  // the bust and the burst unless the theme picks another avatar by name
  if (out.user !== undefined && out.user.avatar === undefined) out.user = { ...out.user, avatar: 'person-outline' }
  if (out.assistant !== undefined && out.assistant.avatar === undefined) out.assistant = { ...out.assistant, avatar: 'claude' }

  return out
}

/** OKLCH of `#RRGGBB`: lightness 0 to 1, chroma, hue in degrees. */
export const oklch = (hex: string): { l: number; c: number; h: number } => {
  const [r, g, b] = channels(hex).map(v => {
    const x = v / 255

    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

/** The least hue distance, in degrees, between two colorful role accents. */
export const ROLE_MIN_HUE = 70
/** The least OKLCH lightness difference, 0 to 100, when either accent is near grey. */
export const ROLE_MIN_LIGHTNESS = 30
/** Below this OKLCH chroma an accent counts as grey: its hue says nothing. */
export const ROLE_GREY_CHROMA = 0.05

/**
 * Whether the user's and Claude's accents tell the two apart at a glance:
 * hues at least ROLE_MIN_HUE apart when both have color, or lightness at
 * least ROLE_MIN_LIGHTNESS apart (the only test for a near-grey accent).
 */
/** Roles apart by colourfulness (a monochrome palette): one at least this many times the other's OKLCH chroma... */
export const ROLE_CHROMA_RATIO = 3
/** ...and at least this many lightness points apart... */
export const ROLE_CHROMA_LIGHTNESS = 10
/** ...the vivid one truly vivid (OKLCH chroma): ivory against gold is not a monochrome pair. */
export const ROLE_CHROMA_VIVID = 0.15

export const rolesDistinct = (user: string, assistant: string): { hue: number; lightness: number; ok: boolean } => {
  const a = oklch(user)
  const b = oklch(assistant)
  const raw = Math.abs(a.h - b.h)
  const hue = Math.min(raw, 360 - raw)
  const lightness = Math.abs(a.l - b.l) * 100
  const colorful = a.c >= ROLE_GREY_CHROMA && b.c >= ROLE_GREY_CHROMA

  // a monochrome palette: one vivid, the other near grey, and a little lightness between them
  const [dull, vivid] = [Math.min(a.c, b.c), Math.max(a.c, b.c)]
  const chroma = vivid >= ROLE_CHROMA_VIVID && vivid >= ROLE_CHROMA_RATIO * Math.max(dull, 0.005) && lightness >= ROLE_CHROMA_LIGHTNESS

  return { hue, lightness, ok: (colorful && hue >= ROLE_MIN_HUE) || lightness >= ROLE_MIN_LIGHTNESS || chroma }
}

// MARK: - Chat background

/** The text color the app writes its own rows in, per appearance. */
export const APP_TEXT: { [mode in Appearance]: string } = { dark: '#ECECEC', light: '#1F1F1F' }

/**
 * A system row's quiet frame (activity rows, the spinner): the app's
 * background lifted by white at 3.5% (dark) or darkened by black at 3%
 * (light), leaning 3% toward the accent; its edge one step further.
 */
export const systemTone = (accent: string | undefined, appearance: Appearance): { fill: string; edge: string } => {
  const lift = appearance === 'dark' ? '#FFFFFF' : '#000000'
  const base = mix(APP_BACKGROUND[appearance], lift, appearance === 'dark' ? 0.035 : 0.03)
  const fill = accent && HEX.test(accent) ? mix(base, accent, 0.03) : base

  return { fill, edge: mix(fill, lift, appearance === 'dark' ? 0.07 : 0.06) }
}

/** The app's own prompt bubble grey, the base of Claude's reply bubble. */
export const APP_BUBBLE: { [mode in Appearance]: string } = { dark: '#262626', light: '#F2F2F2' }
/** How far Claude's bubble edge leans toward its accent, by appearance: "in tinta". */
export const BUBBLE_TINT: { [mode in Appearance]: number } = { dark: 0.2, light: 0.12 }
/**
 * Claude's bubble padding, the app's own prompt bubble's: about 20 px a side
 * and 16 px above and below. Measured on the desktop, 2.5 cells drew 28 px and
 * a row 22 px, so 1.75 cells and 0.75 of a row (quarter steps are accepted).
 */
export const BUBBLE_PAD = { x: 1.75, y: 0.75 }
/**
 * Claude's bubble padding, whatever the theme writes: the app's user bubble's
 * 16 CSS px a side (1ch = 9.075 px) and 12 px above and below (a vertical
 * unit is 10.5 px), to the hundredth.
 */
export const CLAUDE_PAD = { x: Math.round((16 / 9.075) * 100) / 100, y: Math.round((12 / 10.5) * 100) / 100 }
/** The least contrast the app's text keeps on a bubble fill a theme asks for. */
export const BUBBLE_MIN_CONTRAST = 7

/**
 * Claude's reply bubble on `appearance`: a rounded edge in the app's bubble
 * grey leaning toward `accent` (BUBBLE_TINT), padding like the app's bubble,
 * and no fill unless the theme names one: a filled box hid the app's text
 * selection in the replies, and selection comes first. A named fill the
 * app's text would not read on at 7:1 is dropped.
 */
export const bubbleFor = (
  bubble: { fill?: string; border?: string; paddingX?: number; paddingY?: number; fillMode?: FillMode; glow?: Glow; shadow?: 'soft' | 'drop'; halo?: boolean } | undefined,
  accent: string | undefined,
  appearance: Appearance,
): { fill?: string; border: string; paddingX: number; paddingY: number; fillMode?: FillMode; glow?: Glow; shadow?: 'soft' | 'drop'; halo?: boolean } => {
  const grey = APP_BUBBLE[appearance]
  const edge = bubble?.border ?? (accent && HEX.test(accent) ? mix(grey, accent, BUBBLE_TINT[appearance]) : mix(grey, appearance === 'dark' ? '#FFFFFF' : '#000000', 0.08))
  const fill = bubble?.fill !== undefined && contrast(APP_TEXT[appearance], bubble.fill) >= BUBBLE_MIN_CONTRAST ? bubble.fill : undefined

  return compact({ fill, border: edge, paddingX: CLAUDE_PAD.x, paddingY: CLAUDE_PAD.y, fillMode: bubble?.fillMode, glow: bubble?.glow, shadow: bubble?.shadow, halo: bubble?.halo })
}
/** The least contrast the app's own text must keep on the chat background. */
export const CHAT_MIN_CONTRAST = 7

/** The chat background's mean color: the fill at its opacity over the app's background. */
export const chatAverage = (chat: TintaChat, appearance: Appearance): string => {
  const app = APP_BACKGROUND[appearance]

  return mix(app, averageOf(chat.background, app), chat.opacity)
}

/**
 * The chat background as it can be drawn: the app writes its rows in its own
 * text color, so the fill fades (opacity down in steps of 0.05) until that
 * text keeps CHAT_MIN_CONTRAST on it, or it is dropped.
 */
export const legibleChat = (chat: TintaChat | undefined, appearance: Appearance): TintaChat | undefined => {
  if (chat === undefined) {
    return undefined
  }
  for (let opacity = chat.opacity; opacity > 0.001; opacity = Math.round((opacity - 0.05) * 100) / 100) {
    const candidate = { ...chat, opacity }
    if (contrast(APP_TEXT[appearance], chatAverage(candidate, appearance)) >= CHAT_MIN_CONTRAST) {
      return candidate
    }
  }

  return undefined
}

// MARK: - Paths (macOS, Linux, Windows)

/** The separator a path already uses: `\\` for a Windows path, `/` otherwise. */
export const separatorOf = (path: string): string => (/^[A-Za-z]:\\|^\\\\/.test(path) || (path.includes('\\') && !path.includes('/')) ? '\\' : '/')

/** `parts` joined onto `dir` with the separator `dir` uses, slashes in parts converted. */
export const joinPath = (dir: string, ...parts: string[]): string => {
  const sep = separatorOf(dir)
  const head = dir.replace(/[\\/]+$/, '')

  return [head, ...parts.map(part => part.replace(/[\\/]+/g, sep).replace(/^[\\/]+|[\\/]+$/g, ''))].join(sep)
}

/** The home folder: HOME, then USERPROFILE, then HOMEDRIVE + HOMEPATH. */
export const homeFrom = (env: { HOME?: string; USERPROFILE?: string; HOMEDRIVE?: string; HOMEPATH?: string }): string | undefined => {
  const pick = (value: string | undefined) => (value !== undefined && value.trim() !== '' ? value : undefined)

  return pick(env.HOME) ?? pick(env.USERPROFILE) ?? (pick(env.HOMEDRIVE) && pick(env.HOMEPATH) ? `${env.HOMEDRIVE}${env.HOMEPATH}` : undefined)
}

/** The Tinta folder, `<home>/.claude/tinta`, in the home folder's own separator. */
export const tintaDir = (home: string | undefined): string | undefined =>
  home === undefined ? undefined : joinPath(home, '.claude', 'tinta')

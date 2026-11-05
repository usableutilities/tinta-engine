import type { RenderElement } from 'claude-code'

import { CLEAR, HALO, drawnProps, meshColors } from './fills'
import { GLOW_FONT_PX, GLOW_UNIT_PX, textPx } from './glow'
import type { Drawing } from './svg'
import { CHIP, escapeXml, measure, stopsOf } from './svg'
import { darkOnly, readableOnBoth } from './theme'
import type { Look } from './theme'

/**
 * Claude's reply on desktop, the parts Tinta draws itself besides tables:
 * headings as gradient Svg text, fenced code in a window of its own, and
 * an Edit or Write row's diffstat. Every drawing is built from parsed
 * values only (hex colours, numbers, escaped text).
 */

/** The app's own font first, then the system's: what SVG text falls back through. */
export const APP_FONT = `'Anthropic Sans', -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, system-ui, sans-serif`

const round = (n: number) => Math.round(n * 100) / 100

const drawing = (width: number, height: number, defs: string, body: string): Drawing => ({
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`,
  width,
  height,
})

/** `#RRGGBB` at `opacity` as `#RRGGBBAA`. */
const alpha = (hex: string, opacity: number): string =>
  /^#[0-9a-f]{6}$/i.test(hex) ? `${hex.toUpperCase()}${Math.round(opacity * 255).toString(16).padStart(2, '0').toUpperCase()}` : hex

// ── headings ────────────────────────────────────────────────────────────────

/** A heading's size per level, CSS px (the app's body text is 16). */
export const HEADING_CSS_PX: { [level: number]: number } = { 1: 24, 2: 20, 3: 17 }
/** CSS px to the px textPx and drawnProps speak: both true CSS px now (glow.tsx DESKTOP_ZOOM). */
export const CSS_TO_PX = 1
/** How much wider weight 700 sets than the app's 430 the advances were read at. */
export const HEADING_BOLD = 1.08
/** A heading's line pitch, as a share of its size. */
export const HEADING_LINE = 1.3
/**
 * The ## underline's length as a share of the measured line: the face the
 * desktop draws Svg text in sets about this much narrower than the app
 * font's advances say (the owner's screenshot: a full-width line ran ~50 px
 * past the words), and it fades to nothing at its end.
 */
export const HEADING_RULE_SHARE = 0.8
/** The most lines a heading wraps to; a longer one is left to the app's Markdown. */
export const HEADING_LINES_MAX = 2
/** Box margin units above a heading by level (1 ≈ 12.2 px), none when it opens the reply; and below. */
export const HEADING_RHYTHM: { [level: number]: { top: number; bottom: number } } = { 1: { top: 1.5, bottom: 0.5 }, 2: { top: 1.25, bottom: 0.5 }, 3: { top: 1, bottom: 0.25 } }

/** A heading's text as drawn: its inline marks (**, __, `, *, _, links) gone. */
export const headingText = (raw: string): string =>
  raw
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => a ?? b)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=$|[\s).,;:!?])/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1')
    .trim()

/** px `text` takes as a heading `size` px tall, bold. */
export const headingPx = (text: string, size: number): number => (textPx(text) * size * HEADING_BOLD) / GLOW_FONT_PX

/** `text` broken into lines of at most `room` px at `size`; undefined when it needs more than `max` or a word alone is wider. */
export const headingLines = (text: string, size: number, room: number, max = HEADING_LINES_MAX): string[] | undefined => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (headingPx(word, size) > room) return undefined
    const next = line === '' ? word : `${line} ${word}`
    if (headingPx(next, size) <= room) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line !== '') lines.push(line)

  return lines.length === 0 || lines.length > max ? undefined : lines
}

/**
 * A heading's gradient: Tinta's violet, indigo, magenta (Claude's cool
 * half, the halo's); any other theme its assistant label's gradient, else
 * its accent and the accent's neighbours toward blue. Each stop lifted so
 * it reads on the app's dark and light backgrounds alike.
 */
export const headingColors = (look: Look): string[] => {
  const accent = look.assistant?.accent ?? look.palette.accent
  const label = look.assistant?.labelFill
  const raw =
    look.id === 'tinta'
      ? [...HALO.colors]
      : label !== undefined && 'gradient' in label
        ? stopsOf(label).map(([hex]) => hex)
        : (() => {
            const mesh = meshColors(look, accent)

            return [mesh[2], mesh[0], mesh[1]].filter((one): one is string => one !== undefined)
          })()

  // Unicorno's pastels stay light (our own Svg, not the app's text)
  return /^unicorno-/.test(look.id) || darkOnly(look) ? raw : raw.map(hex => readableOnBoth(hex) ?? hex)
}

/**
 * A heading as Svg text, `level` 1 to 3, in `colors` left to right, weight
 * 700, in `font`; wrapped to `room` px. `##` gets a thin gradient
 * underline fading to the right. Undefined when it does not fit in
 * HEADING_LINES_MAX lines: the app's Markdown draws it then.
 */
export const headingDrawing = (text: string, level: number, colors: readonly string[], room: number, font = APP_FONT): Drawing | undefined => {
  const size = round((HEADING_CSS_PX[level] ?? 17) * CSS_TO_PX)
  const lines = headingLines(text, size, room)
  if (lines === undefined) return undefined
  const pitch = Math.round(size * HEADING_LINE)
  const widest = Math.max(...lines.map(line => headingPx(line, size)))
  // a little room right: the real face may set wider than the advances say
  const width = Math.min(Math.ceil(room), Math.ceil(widest * 1.04 + 4))
  const rule = level === 2 ? { gap: 5, height: 1.5 } : undefined
  const height = pitch * lines.length + (rule ? rule.gap + Math.ceil(rule.height) : 0)
  const list = colors.length >= 2 ? colors : [colors[0] ?? '#A970FF', colors[0] ?? '#A970FF']
  const stops = list.map((hex, i) => `<stop offset="${round(i / (list.length - 1))}" stop-color="${hex}"/>`).join('')
  // the underline fades to nothing at its end, HEADING_RULE_SHARE of the measured line (the drawn face sets narrower than the advances)
  const fade = list.map((hex, i) => `<stop offset="${round(i / (list.length - 1))}" stop-color="${hex}" stop-opacity="${round(0.8 * (1 - i / (list.length - 1)))}"/>`).join('')
  const defs = `<linearGradient id="hd" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>${rule ? `<linearGradient id="hu" x1="0" y1="0" x2="1" y2="0">${fade}</linearGradient>` : ''}`
  const baseline = (i: number) => round(i * pitch + (pitch - size) / 2 + size * 0.8)
  const body = lines
    .map((line, i) => `<text x="0" y="${baseline(i)}" font-family="${escapeXml(font)}" font-size="${size}" font-weight="700" fill="url(#hd) ${list[0]}">${escapeXml(line)}</text>`)
    .join('')
  const underline = rule ? `<rect x="0" y="${pitch * lines.length + rule.gap}" width="${Math.round(widest * HEADING_RULE_SHARE)}" height="${rule.height}" rx="${rule.height / 2}" fill="url(#hu)"/>` : ''

  return drawing(width, height, defs, body + underline)
}

/** A heading in the flow: its Svg (alt the heading's text) with the app's rhythm above and below. */
export const headingArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { Box, Svg }: { Box: any; Svg: any },
  art: Drawing,
  text: string,
  level: number,
  first: boolean,
  key: string,
): RenderElement => {
  const rhythm = HEADING_RHYTHM[level] ?? { top: 1, bottom: 0.25 }

  return (
    <Box key={key} flexDirection="row" marginTop={first ? 0 : rhythm.top} marginBottom={rhythm.bottom}>
      <Svg source={art.source} alt={text} {...drawnProps(art.width, art.height)} />
    </Box>
  )
}

/** The px a reply's text has across, from its cells (the viewport's columns less the bubble's own). */
export const roomPx = (cells: number): number => Math.max(10, cells) * GLOW_UNIT_PX

// ── code ────────────────────────────────────────────────────────────────────

/** A fence's info string read: its language, and a file name given after it (`ts src/app.ts`, `ts:src/app.ts`, `title="app.ts"`). */
export const fenceInfo = (info: string): { language?: string; title?: string } => {
  const text = info.trim()
  const titled = /(?:^|\s)(?:title|file|filename)=(?:"([^"]+)"|'([^']+)'|(\S+))/.exec(text)
  const rest = titled ? (text.slice(0, titled.index) + text.slice(titled.index + titled[0].length)).trim() : text
  const [head = '', ...more] = rest.split(/\s+/).filter(Boolean)
  const [lang, path] = head.includes(':') && !/^\w+:\/\//.test(head) ? (head.split(':', 2) as [string, string]) : [head, undefined]
  const language = /^[\w+#.-]{1,32}$/.test(lang) ? lang : undefined
  const named = titled?.[1] ?? titled?.[2] ?? titled?.[3] ?? path ?? more.find(one => /[/\\]|\.\w{1,8}$/.test(one))
  const title = named === undefined ? undefined : named.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) || undefined

  return { ...(language ? { language } : {}), ...(title ? { title } : {}) }
}

/** The longest code a window holds: the Code element's own limit. */
export const CODE_MAX = 10000

/** Code's text as the element takes it: tab and newline its only control characters. */
export const codeSource = (source: string): string => source.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')

/** The window's three dots, in the theme's danger, warm and success colours, muted where it has none. */
export const dotsDrawing = (colors: readonly string[]): Drawing => {
  const r = 4
  const gap = 6
  const height = 14
  const body = colors
    .slice(0, 3)
    .map((hex, i) => `<circle cx="${r + i * (2 * r + gap)}" cy="${height / 2}" r="${r}" fill="${hex}" fill-opacity="0.85"/>`)
    .join('')

  return drawing(3 * 2 * r + 2 * gap, height, '', body)
}

/** A small-caps chip: `text` upper-cased, letter-spaced, in `ink` on a faint square of it. */
export const badgeDrawing = (text: string, ink: string, height = 16, tint = 0.16): Drawing => {
  const word = text.toUpperCase()
  const size = 9.5
  const spacing = 0.8
  const pad = 6
  const width = Math.ceil(measure(word, size, true) * 0.92 + spacing * [...word].length + 2 * pad)
  const body = `<rect x="0" y="0" width="${width}" height="${height}" rx="4" fill="${ink}" fill-opacity="${tint}"/><text x="${round(width / 2)}" y="${round(height / 2 + size * 0.36)}" text-anchor="middle" font-family="${escapeXml(APP_FONT)}" font-size="${size}" font-weight="650" letter-spacing="${spacing}" fill="${ink}">${escapeXml(word)}</text>`

  return drawing(width, height, '', body)
}

/**
 * The window's header: its tint (translucent, so a selection still shows),
 * its edge when the theme draws lines, and how far (Box margin units, 1 ≈
 * 12.2 px) the app's code box is pulled up over the header's lower border
 * row, so the header's rounded bottom corners hide under it and the two
 * read as one window: rounded top, flush, the same width.
 */
export const CODE_TINT = { head: 0.16, edge: 0.22, overlap: 1 } as const

export type CodeTone = { accent: string; muted?: string; dots: readonly string[]; lines: boolean }

/**
 * A fenced code block as one window: the app's own Code element (its dark
 * rounded box, highlighter, token colours and copy button) with Tinta's
 * header flush on top of it, in one column with no padding, so both take
 * the same width. The header is rounded by a transparent round border (an
 * edge only with the theme's lines) on a faint tint of the accent: three
 * dots, the language's chip and the file name; the code box is pulled up
 * over its bottom border row, so only its top corners stay rounded. No
 * frame around, nothing of the engine's inside.
 */
export const codeArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { Box, Svg, Text, Code }: { Box: any; Svg?: any; Text: any; Code: any },
  part: { language?: string; title?: string; source: string },
  tone: CodeTone,
  first: boolean,
  key: string,
): RenderElement => {
  const dots = dotsDrawing(tone.dots)
  const chip = part.language ? badgeDrawing(part.language, tone.accent) : undefined

  return (
    <Box key={key} flexDirection="column" marginTop={first ? 0 : 1} marginBottom={1}>
      <Box
        key="tinta-code-head"
        flexDirection="row"
        alignItems="center"
        gap={1}
        borderStyle="round"
        borderColor={tone.lines ? alpha(tone.accent, CODE_TINT.edge) : CLEAR}
        backgroundColor={alpha(tone.accent, CODE_TINT.head)}
      >
        {Svg && <Svg source={dots.source} alt="•••" {...drawnProps(dots.width, dots.height)} />}
        {Svg && chip && <Svg source={chip.source} alt={part.language} {...drawnProps(chip.width, chip.height)} />}
        {!Svg && part.language && <Text color={tone.accent}>{part.language.toUpperCase()}</Text>}
        {part.title && (
          <Text key="tinta-code-title" color={tone.muted} wrap="truncate-end">
            {part.title}
          </Text>
        )}
      </Box>
      <Box key="tinta-code-body" flexDirection="column" marginTop={-CODE_TINT.overlap}>
        <Code source={part.source} {...(part.language ? { language: part.language } : {})} {...(part.title ? { path: part.title } : {})} wrap="wrap" />
      </Box>
    </Box>
  )
}

// ── diffstat ────────────────────────────────────────────────────────────────

export type DiffStat = { added: number; removed: number; created: boolean }

const record = (value: unknown): { [key: string]: unknown } => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as { [key: string]: unknown }) : {})

/**
 * An Edit or Write call's lines added and removed, from its result: git's
 * own counts when it gives them, else the patch's hunks, else (a new file
 * with no patch) the content's lines. Undefined for any other tool, a call
 * held for review (`staged`), or nothing changed.
 */
export const diffStatOf = (tool: string, output: unknown, input?: unknown): DiffStat | undefined => {
  if (!/^(Edit|Write|MultiEdit)$/.test(tool)) return undefined
  const out = record(output)
  if (out.staged === true) return undefined
  // the desktop may hand the row the text the model read, not the record: the call's input then
  if (typeof output === 'string' || out.structuredPatch === undefined) return diffFromInput(tool, output, input)
  const git = record(out.gitDiff)
  const created = out.type === 'create' || git.status === 'added'
  let added = 0
  let removed = 0
  if (typeof git.additions === 'number' && typeof git.deletions === 'number') {
    added = git.additions
    removed = git.deletions
  } else {
    for (const hunk of Array.isArray(out.structuredPatch) ? out.structuredPatch : []) {
      for (const line of Array.isArray(record(hunk).lines) ? (record(hunk).lines as unknown[]) : []) {
        if (typeof line !== 'string') continue
        if (line.startsWith('+')) added++
        else if (line.startsWith('-')) removed++
      }
    }
    if (added + removed === 0 && created && typeof out.content === 'string' && out.content !== '') {
      added = out.content.replace(/\n$/, '').split('\n').length
    }
  }
  if (added + removed === 0 && !created) return undefined

  return { added: Math.max(0, Math.round(added)), removed: Math.max(0, Math.round(removed)), created }
}

/** Lines of `text` (a trailing newline ends the last, it adds none). */
const linesIn = (text: string): string[] => (text === '' ? [] : text.replace(/\n$/, '').split('\n'))

/** Lines added and removed from `before` to `after`: what a longest common subsequence leaves (cheap past 400 lines: all of each). */
export const lineDiff = (before: string, after: string): { added: number; removed: number } => {
  const a = linesIn(before)
  const b = linesIn(after)
  if (a.length * b.length > 160000) return { added: b.length, removed: a.length }
  let row = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const next = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) next[j] = a[i - 1] === b[j - 1] ? (row[j - 1] as number) + 1 : Math.max(row[j] as number, next[j - 1] as number)
    row = next
  }
  const common = row[b.length] as number

  return { added: b.length - common, removed: a.length - common }
}

/**
 * The diffstat from the call's input, when the row's output is the model's
 * text ("File created successfully at …", "The file … has been updated"):
 * an Edit's old and new strings (each of a MultiEdit's), a Write's content,
 * created when its text says so.
 */
export const diffFromInput = (tool: string, output: unknown, input: unknown): DiffStat | undefined => {
  const args = record(input)
  const said = typeof output === 'string' ? output : ''
  if (/^(Error|<tool_use_error>)/i.test(said.trim())) return undefined
  if (tool === 'Write') {
    const content = typeof args.content === 'string' ? args.content : ''
    const created = /\bcreated\b/i.test(said)

    return created || content !== '' ? { added: linesIn(content).length, removed: 0, created } : undefined
  }
  const edits = tool === 'MultiEdit' && Array.isArray(args.edits) ? (args.edits as unknown[]).map(record) : [args]
  let added = 0
  let removed = 0
  for (const one of edits) {
    if (typeof one.old_string !== 'string' || typeof one.new_string !== 'string') continue
    const d = lineDiff(one.old_string, one.new_string)
    added += d.added
    removed += d.removed
  }

  return added + removed === 0 ? undefined : { added, removed, created: false }
}

/** The diffstat's five blocks: how many green, red and neutral (GitHub's way: few changes leave blocks neutral). */
export const diffBlocks = (stat: DiffStat, blocks = 5): { added: number; removed: number; neutral: number } => {
  const total = stat.added + stat.removed
  if (total === 0) return { added: 0, removed: 0, neutral: blocks }
  const filled = Math.min(blocks, total)
  let added = Math.round((filled * stat.added) / total)
  let removed = filled - added
  if (stat.added > 0 && added === 0) [added, removed] = [1, removed - 1]
  if (stat.removed > 0 && removed === 0 && filled > 1) [added, removed] = [added - 1, 1]

  return { added, removed, neutral: blocks - added - removed }
}

/** "+12 −3", the minus a real one. */
export const diffText = (stat: DiffStat): string => `+${stat.added} −${stat.removed}`

/**
 * The diffstat beside an Edit or Write row's chip: five small blocks in
 * `colors.added` / `colors.removed` / a neutral, the counts in the same
 * colours and, for a created file, a `fresh` badge; `top` px down, as the
 * chip, so their centres meet the row's first line. Room after it as the
 * chip leaves.
 */
export const diffstatDrawing = (stat: DiffStat, colors: { added: string; removed: string; neutral: string }, fresh?: string, top = 0, counts = true): Drawing => {
  const side = 7
  const gap = 2
  const mid = top + CHIP.size / 2
  const split = diffBlocks(stat)
  const fills = [...Array(split.added).fill(colors.added), ...Array(split.removed).fill(colors.removed), ...Array(split.neutral).fill(colors.neutral)] as string[]
  const blocks = fills.map((hex, i) => `<rect x="${i * (side + gap)}" y="${round(mid - side / 2)}" width="${side}" height="${side}" rx="1.5" fill="${hex}"/>`).join('')
  let x = 5 * side + 4 * gap
  const size = 11
  const plus = `+${stat.added}`
  const minus = `−${stat.removed}`
  const plusPx = measure(plus, size, true) * 0.9
  const minusPx = measure(minus, size, true) * 0.9
  const y = round(mid + size * 0.36)
 x += counts ? 6 : 0
  const numbers = !counts ? '' : `<text x="${x}" y="${y}" font-family="${escapeXml(APP_FONT)}" font-size="${size}" font-weight="600" style="font-variant-numeric: tabular-nums" fill="${colors.added}">${plus}</text><text x="${round(x + plusPx + 4)}" y="${y}" font-family="${escapeXml(APP_FONT)}" font-size="${size}" font-weight="600" style="font-variant-numeric: tabular-nums" fill="${colors.removed}">${minus}</text>`
  if (counts) x = Math.ceil(x + plusPx + 4 + minusPx)
  let badge = ''
  if (fresh !== undefined) {
    const chip = badgeDrawing(fresh, colors.added, 14, 0.18)
    const inner = chip.source.replace(/^<svg[^>]*><defs><\/defs>/, '').replace(/<\/svg>$/, '')
    badge = `<g transform="translate(${x + 6} ${round(mid - 7)})">${inner}</g>`
    x += 6 + chip.width
  }

  return drawing(x + CHIP.gap, CHIP.size + top, '', blocks + numbers + badge)
}

/** The diffstat's colours: the theme's success and danger (its variant's for the mode), a neutral of its muted. */
export const diffColors = (look: Look): { added: string; removed: string; neutral: string } => ({
  added: look.palette.success ?? '#3FB950',
  removed: look.palette.danger ?? '#F85149',
  neutral: alpha(look.palette.muted ?? '#808080', 0.35),
})

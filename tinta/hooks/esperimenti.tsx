import { APP_FONT, diffFromInput, diffText } from './reply'
import { t } from './i18n'
import type { StringKey } from './i18n'
import { APP_BACKGROUND, APP_TEXT, contrast, mix } from './theme'
import type { Drawing } from './svg'
import { CHIP, escapeXml, measure } from './svg'

/**
 * The owner's batch of desktop experiments (theme `experiments.*`), the
 * drawings and words they share: pure helpers, wired in register.tsx.
 */

const round = (n: number) => Math.round(n * 100) / 100

const drawing = (width: number, height: number, body: string): Drawing => ({
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,
  width,
  height,
})

// ── (a) background task notices ─────────────────────────────────────────────

/** A task's end as the chip tells it: ✓ completed, ✕ failed, ■ killed or stopped; undefined for anything else. */
export const taskEnd = (status: string | undefined): 'done' | 'failed' | 'stopped' | undefined =>
  status === 'completed' ? 'done' : status === 'failed' ? 'failed' : status === 'killed' || status === 'stopped' ? 'stopped' : undefined

/** The chip's icon (svg.ts ACTIVITY_ICONS) per end. */
export const TASK_END_ICONS = { done: 'result', failed: 'failed', stopped: 'stopped' } as const

/** A duration, short: 850ms, 12s, 1m 12s, 1h 05m. */
export const durationText = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`

  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`
}

/**
 * A notice's summary without what the chip and pill now say: the task's
 * own name out of its quotes (`Background command "npm test" completed
 * (exit code 0)` → `npm test`), a trailing status word and a zero exit code
 * dropped; a non-zero exit code kept, short. The text as it was when
 * nothing is left.
 */
export const cleanTaskText = (text: string): string => {
  const one = text.replace(/\s+/g, ' ').trim()
  const exit = /\(exit code (\d+)\)/i.exec(one)?.[1]
  const quoted = /^[^"“]*["“]([^"”]+)["”]/.exec(one)?.[1]
  const bare = one
    .replace(/\s*\(exit code \d+\)\s*$/i, '')
    .replace(/\s+(has |was )?(completed|failed|been stopped|stopped|killed|completato|fallito|interrotto)\.?$/i, '')
    .trim()
  const name = (quoted ?? bare).trim()
  const cleaned = exit !== undefined && exit !== '0' ? `${name} (exit ${exit})` : name

  return cleaned === '' ? text : cleaned
}

/** A small pill: `text` in `ink` on a faint rounded rect of it, `top` px down as the chips, centred on their line. */
export const pillDrawing = (text: string, ink: string, top = 0, tint = 0.14): Drawing => {
  const size = 11
  const height = 16
  const pad = 6
  const width = Math.ceil(measure(text, size, false) * 0.92 + 2 * pad)
  const y = round(top + CHIP.size / 2 - height / 2)
  const body =
    `<rect x="0" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${ink}" fill-opacity="${tint}"/>` +
    `<text x="${round(width / 2)}" y="${round(y + height / 2 + size * 0.36)}" text-anchor="middle" font-family="${escapeXml(APP_FONT)}" font-size="${size}" font-weight="500" style="font-variant-numeric: tabular-nums" fill="${ink}">${escapeXml(text)}</text>`

  return drawing(width + CHIP.gap, CHIP.size + top, body)
}

// ── (b) todo lists ──────────────────────────────────────────────────────────

export type Todo = { content: string; status: string; activeForm?: string }

/** A TodoWrite call's list after and before it: the result's newTodos / oldTodos, else the input's todos. */
export const todosOf = (input: unknown, output: unknown): { now: Todo[]; before: Todo[] } => {
  const list = (value: unknown): Todo[] =>
    Array.isArray(value)
      ? value
          .filter((one): one is { [key: string]: unknown } => typeof one === 'object' && one !== null)
          .filter(one => typeof one.content === 'string')
          .map(one => ({ content: one.content as string, status: typeof one.status === 'string' ? one.status : 'pending' }))
      : []
  const out = typeof output === 'object' && output !== null ? (output as { [key: string]: unknown }) : {}
  const args = typeof input === 'object' && input !== null ? (input as { [key: string]: unknown }) : {}
  const now = list(out.newTodos)

  return { now: now.length > 0 ? now : list(args.todos), before: list(out.oldTodos) }
}

/** Items done in `now` that were not in `before` (by their text). */
export const newlyDone = (now: readonly Todo[], before: readonly Todo[]): Set<string> =>
  new Set(now.filter(one => one.status === 'completed' && !before.some(old => old.content === one.content && old.status === 'completed')).map(one => one.content))

/** A checkbox, 16 px on a 21 px line: done a filled square with a tick, in progress a ring with a dot, pending an empty ring. */
export const checkboxDrawing = (status: string, colors: { done: string; doing: string; todo: string }): Drawing => {
  const size = 16
  const height = 21
  const y = (height - size) / 2
  const box = (ink: string, fill: number) => `<rect x="1" y="${y + 1}" width="${size - 2}" height="${size - 2}" rx="4" fill="${ink}" fill-opacity="${fill}" stroke="${ink}" stroke-width="1.5"/>`
  const body =
    status === 'completed'
      ? box(colors.done, 0.9) + `<path d="M4.5 ${y + 8.5}l2.6 2.6L11.8 ${y + 5.6}" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
      : status === 'in_progress'
        ? box(colors.doing, 0.15) + `<circle cx="8" cy="${y + 8}" r="2.6" fill="${colors.doing}"/>`
        : box(colors.todo, 0)

  return drawing(size + 6, height, body)
}

/** The list's progress: a ring `done` of `total` in `ink` on a faint track, "3/7" beside it; `top` px down as the chips. */
export const ringDrawing = (done: number, total: number, ink: string, track: string, top = 0): Drawing => {
  const r = 6.5
  const c = top + CHIP.size / 2
  const length = 2 * Math.PI * r
  const share = total > 0 ? Math.min(1, done / total) : 0
  const label = `${done}/${total}`
  const size = 11
  const textX = 2 * r + 8
  const width = Math.ceil(textX + measure(label, size, true) * 0.9)
  const body =
    `<circle cx="${r + 1.5}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="2.5"/>` +
    `<circle cx="${r + 1.5}" cy="${c}" r="${r}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${round(length * share)} ${round(length)}" transform="rotate(-90 ${r + 1.5} ${c})"/>` +
    `<text x="${textX}" y="${round(c + size * 0.36)}" font-family="${escapeXml(APP_FONT)}" font-size="${size}" font-weight="600" style="font-variant-numeric: tabular-nums" fill="${ink}">${label}</text>`

  return drawing(width + CHIP.gap, CHIP.size + top, body)
}

export type PlanItem = { id: string; status: string }

/**
 * The session's plan as the band counts it, after a call: TodoWrite's list
 * whole, TaskList's whole, TaskCreate adds one pending, TaskUpdate changes
 * one (deleted: gone). Undefined when the call says nothing about it.
 */
export const planAfter = (held: readonly PlanItem[], tool: string, input: unknown, result: unknown): PlanItem[] | undefined => {
  const args = typeof input === 'object' && input !== null ? (input as { [key: string]: unknown }) : {}
  const out = typeof result === 'object' && result !== null ? (result as { [key: string]: unknown }) : {}
  if (tool === 'TodoWrite') return todosOf(input, result).now.map((one, i) => ({ id: `todo-${i}`, status: one.status }))
  if (tool === 'TaskList' && Array.isArray(out.tasks)) {
    return (out.tasks as { id?: unknown; status?: unknown }[]).map(one => ({ id: String(one.id), status: String(one.status ?? 'pending') }))
  }
  if (tool === 'TaskCreate') {
    const id = (out.task as { id?: unknown } | undefined)?.id

    return id === undefined ? undefined : [...held.filter(one => one.id !== String(id)), { id: String(id), status: 'pending' }]
  }
  if (tool === 'TaskUpdate' && typeof args.taskId === 'string' && typeof args.status === 'string') {
    return args.status === 'deleted' ? held.filter(one => one.id !== args.taskId) : held.map(one => (one.id === args.taskId ? { ...one, status: args.status as string } : one))
  }

  return undefined
}

/** done / total of a plan. */
export const planCount = (items: readonly PlanItem[]): { done: number; total: number } => ({ done: items.filter(one => one.status === 'completed').length, total: items.length })

// ── (d) the spinner's mark per mode ─────────────────────────────────────────

/**
 * How the spinner's burst moves in each of the modes the desktop tells
 * apart: thinking breathes, requesting turns slowly, a tool turns fast,
 * responding at the usual pace; each in its own hue, turned from the
 * accent (Tinta: violet, indigo, cyan, magenta). Never the user's warm
 * colours on anything of Claude's: the two sides apart at a glance.
 */
export const SPINNER_MODES: { [mode: string]: { motion: 'spin' | 'pulse'; seconds: number; hue: number | 'cool' } } = {
  thinking: { motion: 'pulse', seconds: 6, hue: 0 },
  requesting: { motion: 'spin', seconds: 10, hue: -35 },
  'tool-use': { motion: 'spin', seconds: 2.4, hue: 'cool' },
  'tool-input': { motion: 'spin', seconds: 2.4, hue: 'cool' },
  responding: { motion: 'spin', seconds: 6, hue: 45 },
}

// ── (e) toasts ──────────────────────────────────────────────────────────────

/** A token count, short: 950, 21k, 182k, 1.2M. */
export const tokensText = (n: number): string =>
  !Number.isFinite(n) || n < 0 ? '?' : n < 1000 ? String(Math.round(n)) : n < 1_000_000 ? `${Math.round(n / 1000)}k` : `${Math.round(n / 100_000) / 10}M`

/** A tool's phase colour on Claude's side: cyan for Tinta, else the accent turned toward cyan; never the user's warm half. */
export const CLAUDE_COOL = '#4FD1E8'

// ── (f) the turn's closing line ─────────────────────────────────────────────

export type TurnStats = { tools: number; files: string[] }

/** The files a call wrote (Edit, Write, MultiEdit, NotebookEdit): its path, or none. */
export const writtenFile = (tool: string, input: unknown): string | undefined => {
  if (!/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool) || typeof input !== 'object' || input === null) return undefined
  const args = input as { file_path?: unknown; notebook_path?: unknown }
  const path = args.file_path ?? args.notebook_path

  return typeof path === 'string' && path !== '' ? path : undefined
}

/** "⏱ 1m 12s · 14 strumenti · 3 file": the parts with nothing to say left out. */
export const footerText = (ms: number, stats: TurnStats, words: { tools: (n: number) => string; files: (n: number) => string }): string =>
  [`⏱ ${durationText(ms)}`, stats.tools > 0 ? words.tools(stats.tools) : undefined, stats.files.length > 0 ? words.files(stats.files.length) : undefined].filter(Boolean).join(' · ')

// ── (g) a line under the permission dialog ──────────────────────────────────

/** A permission's risk: high (hard to undo, outside the project), medium (changes beyond a file), low (a file, a page). */
export type RiskLevel = 'high' | 'medium' | 'low'

/** What a Bash command risks, by pattern, highest first: its level and the words that say why. */
const BASH_RISKS: readonly [RegExp, RiskLevel, StringKey][] = [
  [/\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*\s+)*-?[a-zA-Z]*f|\brm\s+-[a-zA-Z]*[rR]/, 'high', 'riskRmRecursive'],
  [/\bsudo\b/, 'high', 'riskSudo'],
  [/\bgit\s+push\b[^\n]*(--force\b|\s-f\b|--force-with-lease)/, 'high', 'riskForcePush'],
  [/\bgit\s+(reset\s+--hard|clean\s+-[a-zA-Z]*f|checkout\s+--\s|restore\s)/, 'high', 'riskDiscard'],
  [/\b(curl|wget)\b[^|\n]*\|\s*(sudo\s+)?(ba|z)?sh\b/, 'high', 'riskPipeShell'],
  [/\b(npm|pnpm|yarn)\s+publish\b|\bgh\s+release\s+create\b/, 'high', 'riskPublish'],
  [/\bgit\s+push\b/, 'medium', 'riskPush'],
  [/\b(npm|pnpm|yarn|pip3?|brew)\s+(install|add|i)\b/, 'medium', 'riskInstall'],
  [/\bchmod\b|\bchown\b/, 'medium', 'riskChmod'],
]

/** A command that only looks (lists, reads, searches, git's read-only verbs), alone: no chain, pipe, redirect or substitution. */
const BASH_LOOKS = /^\s*(ls|cat|head|tail|wc|pwd|echo|grep|rg|which|file|stat|du|df|tree|git\s+(status|log|diff|show|branch))\b/
const BASH_CHAINS = /[;&|>`]|\$\(/

/** Files whose change reaches past the project: secrets, keys, shell start-up, git's own, system and Claude settings. */
const SENSITIVE_PATH = /(^|[\\/])\.(env|ssh|aws|gnupg|netrc|npmrc|zshrc|bashrc|bash_profile|profile|zprofile)([\\/.]|$)|(^|[\\/])\.git[\\/]|^\/(etc|usr|System|Library)\/|[\\/]\.claude[\\/]settings/

/** The level's mark: the same three in every theme, read before the words. */
export const RISK_MARKS: { [level in RiskLevel]: string } = { high: '⚠', medium: '◆', low: '○' }

/** The longest a risk line runs: one line under the dialog. */
const RISK_LINE_MAX = 110

/** A command as one short line: its first line, spaces folded, cut with an ellipsis. */
const shortCommand = (command: string, max = 60): string => {
  const line = (command.split('\n')[0] ?? '').replace(/\s+/g, ' ').trim()

  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** The risk of a call asking permission and what it does, or undefined when there is nothing readable to say. */
export const riskOf = (tool: string, input: unknown, lang: string): { level: RiskLevel; what: string } | undefined => {
  const args = typeof input === 'object' && input !== null ? (input as { [key: string]: unknown }) : {}
  if (tool === 'Bash' && typeof args.command === 'string' && args.command.trim() !== '') {
    const command = args.command
    const hit = BASH_RISKS.find(([pattern]) => pattern.test(command))
    if (hit !== undefined) return { level: hit[1], what: `${t(lang, hit[2])} · ${shortCommand(command)}` }
    const looks = BASH_LOOKS.test(command) && !BASH_CHAINS.test(command) && !command.includes('\n')

    return { level: looks ? 'low' : 'medium', what: `${t(lang, 'riskRuns')} ${shortCommand(command)}` }
  }
  const path = writtenFile(tool, input)
  if (path !== undefined) {
    const name = path.split(/[\\/]/).pop() ?? path
    const stat = tool === 'NotebookEdit' ? undefined : diffFromInput(tool, '', input)
    const counts = stat === undefined ? '' : tool === 'Write' ? ` (+${stat.added})` : ` (${diffText(stat)})`
    const verb = t(lang, tool === 'Write' ? 'riskWrites' : 'riskEdits')
    if (SENSITIVE_PATH.test(path)) return { level: 'high', what: `${verb} ${name}${counts} · ${t(lang, 'riskSensitive')}` }

    return { level: 'low', what: `${verb} ${name}${counts}` }
  }
  if (tool === 'WebFetch' && typeof args.url === 'string') {
    const host = /^https?:\/\/([^/?#]+)/i.exec(args.url)?.[1]

    return host === undefined ? undefined : { level: 'low', what: `${t(lang, 'riskOpens')} ${host}` }
  }
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)
  if (mcp !== null) return { level: 'medium', what: `${t(lang, 'riskMcp')} ${mcp[1]} · ${mcp[2]}` }

  return undefined
}

/**
 * The risk line under the permission dialog: the level's mark and word, then
 * what the call does (the command, the file with its +N −M, the host, the
 * external tool), e.g. "⚠ rischio alto · cancella file in modo ricorsivo ·
 * rm -rf build"; undefined when there is nothing readable to say. Plain text:
 * the dialog is the app's, so the theme cannot colour it, the mark carries the level.
 */
export const riskTagline = (tool: string, input: unknown, lang: string): string | undefined => {
  const risk = riskOf(tool, input, lang)
  if (risk === undefined) return undefined
  const key = risk.level === 'high' ? 'riskHigh' : risk.level === 'medium' ? 'riskMedium' : 'riskLow'
  const line = `${RISK_MARKS[risk.level]} ${t(lang, key)} · ${risk.what}`

  return line.length > RISK_LINE_MAX ? `${line.slice(0, RISK_LINE_MAX - 1)}…` : line
}

/** When to try the line after the check said "ask": the dialog opens a moment later, and a call not open is refused. */
export const NOTICE_TRIES_MS: readonly number[] = [150, 600, 1500]

// ── Claude's colour cycle (Unicorno) ───────────────────────────────────────

/** One colour set of a cycle: the accent, the label's gradient, the bubble's mesh, its edge. */
export type CycleSet = { accent: string; label?: string[]; mesh?: string[]; edge?: string }

/**
 * Unicorno's own cycle, used when a Unicorno template gives none: pink,
 * violet, sky blue, mint, butter yellow, then again. Each reply of Claude's
 * takes the next.
 */
export const UNICORNO_CYCLE: readonly CycleSet[] = [
  // the owner's palette (sampled from their image): pink, lilac, periwinkle, cornflower; white the light
  { accent: '#FBB0FA', label: ['#FFFFFF', '#FBB0FA'], mesh: ['#FBB0FA', '#FFFFFF', '#FBB0FA', '#C9A4F5'] },
  { accent: '#C9A4F5', label: ['#FFFFFF', '#C9A4F5'], mesh: ['#C9A4F5', '#FFFFFF', '#C9A4F5', '#A4A5F4'] },
  { accent: '#A4A5F4', label: ['#FFFFFF', '#A4A5F4'], mesh: ['#A4A5F4', '#FFFFFF', '#A4A5F4', '#A2BCF4'] },
  { accent: '#A2BCF4', label: ['#FFFFFF', '#A2BCF4'], mesh: ['#A2BCF4', '#FFFFFF', '#A2BCF4', '#FBB0FA'] },
]
/** Unicorno's luminous pastels: the reply's text floor (WCAG AA on the brightest blob), the light base, the mesh's ceiling. */
export const UNICORNO_LOOK = { floor: 3.5, baseAlpha: 0.16, strength: 1.8 } as const

/** The cycle's set for a reply at `order` (its place in the conversation): in turn, then again. */
export const cycleSetAt = <T,>(sets: readonly T[], order: number): T | undefined => (sets.length === 0 ? undefined : sets[((Math.floor(order) % sets.length) + sets.length) % sets.length])

/**
 * The highest mesh strength (up to `strength`) at which the app's text keeps
 * 7:1 on the brightest blob at its peak (MESH's 0.425) over the bubble's
 * base and the app's dark background: a pastel set is held down so the reply
 * stays legible.
 */
export const safeMeshStrength = (colors: readonly string[], baseAlpha: number, strength: number, tint: string, floor = 7): number => {
  const ground = mix(APP_BACKGROUND.dark, tint, baseAlpha)
  for (let s = strength; s > 0.05; s -= 0.02) {
    if (colors.every(hex => contrast(APP_TEXT.dark, mix(ground, hex, Math.min(1, 0.425 * s))) >= floor)) return Math.round(s * 100) / 100
  }

  return 0.05
}

/**
 * The most a faint overlay (Fosforo's rain glyphs) may show, up to `max`,
 * so the app's text keeps `floor` over the brightest blob with a glyph of
 * each colour on it.
 */
export const overlayAlpha = (unders: readonly string[], inks: readonly string[], max: number, floor = 7): number => {
  for (let a = max; a > 0.01; a -= 0.005) {
    if (unders.every(under => inks.every(ink => contrast(APP_TEXT.dark, mix(under, ink, a)) >= floor))) return Math.round(a * 1000) / 1000
  }

  return 0.01
}

/** The candy interior's alpha: the most (up to 0.6) at which the app's text keeps 3.5:1 over each colour on the dark app. */
export const candyAlpha = (colors: readonly string[], floor = UNICORNO_LOOK.floor): number => {
  for (let a = 0.6; a > 0.04; a -= 0.01) {
    if (colors.every(hex => contrast(APP_TEXT.dark, mix(APP_BACKGROUND.dark, hex, a)) >= floor)) return Math.round(a * 100) / 100
  }

  return 0.04
}

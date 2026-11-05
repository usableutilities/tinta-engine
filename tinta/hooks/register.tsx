import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement } from 'claude-code'

import { SALVIA, SALVIA_FILE } from './seed'
import { TEMPLATES, TEMPLATE_FILE, setTemplates } from './catalogo'
import { MARGIN_UNIT_PX, CELL_PX, CLEAR, bubbleArt, fillsFor, glowWidth, meshColors, shadowArt } from './fills'
import { wrapText, GLOW_PAD as BUBBLE_GLOW_PAD_XY, USER_GLOW, USER_MESH, breakPrompt, bubbleWidest, exactGlowArt, isCollapsed, glowFillFor, hueShift, userBubbleSize, userGlowArt, userTwinArt } from './glow'
import { firstAppleLanguage, localeOf, pickLocale, t } from './i18n'
import { alertsDue, figuresOf, healthParts, limitName } from './salute'
import type { Figures } from './salute'
import { clearDone, notificationsIn, statusFrom, taskEnded, taskFromCall, taskStarted } from './attivita'
import type { Task, TaskKind } from './attivita'
import { pageRainDrawing, phaseLock, steadyFrame, waveKindDrawing } from './animazioni'
import { isOwnBackdrop, pagePlan } from './fx-page'
import { decodeOverlay, isPlainProse } from './decodifica'
import { enforcement, isSealed, machineId, onWindows, openTheme, sealHome, sealHomeFrom, secretFrom } from './sigillo'
import type { SealContext } from './sigillo'
import { bandHealthDrawing, bandTimerDrawing, bandWhoDrawing, clockText } from './fascia'
import { HEADING_EFFECTS, headingDrawing as fxHeading } from './fx-headings'
import { overlayAlpha, UNICORNO_CYCLE, UNICORNO_LOOK, candyAlpha, cycleSetAt, safeMeshStrength, CLAUDE_COOL, NOTICE_TRIES_MS, SPINNER_MODES, TASK_END_ICONS, footerText, riskTagline, tokensText, writtenFile, checkboxDrawing, cleanTaskText, durationText, newlyDone, pillDrawing, planAfter, planCount, ringDrawing, taskEnd, todosOf } from './esperimenti'
import type { PlanItem, TurnStats } from './esperimenti'
import { CODE_MAX, codeArt, codeSource, diffColors, diffStatOf, diffstatDrawing, diffText, fenceInfo, HEADING_RHYTHM, HEADING_RULE_SHARE, headingArt, headingColors, headingDrawing, headingText, roomPx } from './reply'
import { DIVIDER_ROOM, LABEL_GAP, LABEL_HEIGHT, LABEL_SPACE, REPLY_RULE_GAP, metaDrawing, meterDrawing, blankDrawing, dotDrawing, RULE_CAP, RULE_WIDTH, besideDrawing, colorAt, sliceFill, chipDrawing, CHIP_TOP, iconForTool, pendingDrawing, slotDrawing, waveDrawing, personDrawing, personOutlineDrawing, replyRuleDrawing, sparkDrawing, claudeDrawing, CLAUDE_TERRACOTTA, dividerDrawing, glyphDrawing, initialDrawing, labelDrawing, orbDrawing, padBottom, spacerDrawing } from './svg'
import type { Drawing } from './svg'
import { APP_TEXT, APP_BACKGROUND, APP_BUBBLE, BUBBLE_PAD, alphaEdge, featureOn, readableOnBoth, tries, bubbleFor, MIME, SOUND_EVENTS, systemTone, appearanceFor, mix, readable, initialOf, appearanceOf, describeCall, fill, joinPath, lookFor, parseTheme, tintaDir } from './theme'
import type { Border, Look, SoundEvent, Surface, Theme } from './theme'

const isOff = atom({ plugin: 'tinta', key: 'isOff' } as const, false)
const source = atom({ plugin: 'tinta', key: 'source' } as const, '')
const turn = atom({ plugin: 'tinta', key: 'turn' } as const, 0)
const themes = atom({ plugin: 'tinta', key: 'themes' } as const, [])
const current = atom({ plugin: 'tinta', key: 'theme' } as const, null)
const appearance = atom({ plugin: 'tinta', key: 'appearance' } as const, null)
const owner = atom({ plugin: 'tinta', key: 'owner' } as const, null)
const heartbeat = atom({ plugin: 'tinta', key: 'heartbeat' } as const, 0)
const sessionInfo = atom({ plugin: 'tinta', key: 'session' } as const, null)
const workStart = atom({ plugin: 'tinta', key: 'workStart' } as const, null)
const now = atom({ plugin: 'tinta', key: 'now' } as const, 0)
const tasks = atom({ plugin: 'tinta', key: 'tasks' } as const, [])
const alerted = atom({ plugin: 'tinta', key: 'alerted' } as const, [])
const locale = atom({ plugin: 'tinta', key: 'locale' } as const, 'en')
const stamps = atom({ plugin: 'tinta', key: 'stamps' } as const, {})
/** A theme's sound volume when it names none. */
const VOLUME = 0.6
const tasksNow = atom({ plugin: 'tinta', key: 'tasksNow' } as const, 0)
const tasksDoneOpen = atom({ plugin: 'tinta', key: 'tasksDoneOpen' } as const, false)
const plan = atom({ plugin: 'tinta', key: 'plan' } as const, [])
const replyOrder = atom({ plugin: 'tinta', key: 'replyOrder' } as const, {})
const prefs = atom({ plugin: 'tinta', key: 'prefs' } as const, {})
const pageDrawn = atom({ plugin: 'tinta', key: 'pageDrawn' } as const, null)
const streamTick = atom({ plugin: 'tinta', key: 'streamTick' } as const, 0)
const turnStats = atom({ plugin: 'tinta', key: 'turnStats' } as const, { tools: 0, files: [] })

/** The Attività pane. */
export const ATTIVITA = 'tinta-attivita'
/** The tools whose calls can start background work. */
const BACKGROUND_TOOLS = ['Agent', 'Task', 'Bash', 'Monitor', 'Workflow'] as const
/** How many ticks between two checks of the agents' own statuses. */
const AGENT_CHECK_TICKS = 5

const PANE = 'tinta-themes'

/** The avatar's side: the label's own height, so both share one centre line. */
const ORB = LABEL_HEIGHT
/** The label's font size in px, close to the app's own row labels. */
const LABEL_SIZE = 12
/** The px side of the spinner's turning burst. */
const SPINNER_MARK = 16
const POLL_MS = 2000
/** How often the band's session figures are read again between turns. */
const SESSION_MS = 10_000
/** The turn timer's step. */
const TICK_MS = 1000
/** Messages whose first-drawn time is kept; the oldest go first. */
const STAMPS_MAX = 400

/** A short stable hash of `text` (FNV-1a), the key of a message's time. */
export const hashOf = (text: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }

  return (h >>> 0).toString(36)
}

/** `minutes` since midnight as `HH:MM`. */
export const clockOf = (minutes: number): string => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * The local `HH:MM` a message was first drawn in this session, kept by a
 * hash of its text so a redraw keeps it (a render never writes state).
 */
/**
 * A row's time, read from the stamps once and then remembered: every row that
 * reads the stamps atom redraws whenever any new row is stamped (each streamed
 * message, each tool row), which made the finished replies redraw (and their
 * animations stutter) while a new one streamed in.
 */
const TIMES = new Map<string, string>()
/** How many times a row looked for its stamp in vain: after a few it stops looking (a row from before the engine loaded). */
const MISSES = new Map<string, number>()
const LOOKS = 3
const remembered = <T,>(cache: Map<string, T>, id: string, value: T | undefined) => {
  if (value !== undefined) {
    if (cache.size > 2000) cache.delete(cache.keys().next().value as string)
    cache.set(id, value)
  } else MISSES.set(id, (MISSES.get(id) ?? 0) + 1)
}
const timeOf = async ($: Dollar, id: string | undefined): Promise<string | undefined> => {
  if (id === undefined) return undefined
  if (TIMES.has(id)) return TIMES.get(id)
  if ((MISSES.get(`t:${id}`) ?? 0) >= LOOKS) return undefined
  const time = timeFrom((await read($, stamps)) as { [id: string]: number }, id)
  if (time === undefined) MISSES.set(`t:${id}`, (MISSES.get(`t:${id}`) ?? 0) + 1)
  else remembered(TIMES, id, time)

  return time
}

/** Each reply's place in the colour cycle, read once (as the times, the atom changes with every new reply). */
const ORDERS = new Map<string, number>()

/** Whether a turn runs: the engine's own record, read by the rows without subscribing them to the turn's atoms. */
let turnRunning = false

/** A row's "HH:MM" from the stored minutes by id; undefined when its storing was never seen. */
export const timeFrom = (held: { [id: string]: number }, id: string | undefined): string | undefined => {
  const minutes = id === undefined ? undefined : held[id]

  return minutes === undefined ? undefined : clockOf(minutes)
}

/** The stored minutes with `ids` set to `minutes` where unset, the oldest dropped past STAMPS_MAX. */
export const stampsWith = (held: { [id: string]: number }, ids: string[], minutes: number): { [id: string]: number } => {
  const next: { [id: string]: number } = { ...held }
  for (const key of ids) if (next[key] === undefined) next[key] = minutes
  const all = Object.keys(next)

  return all.length > STAMPS_MAX ? Object.fromEntries(all.slice(-STAMPS_MAX).map(key => [key, next[key] as number])) : next
}

/** Notes the minute a row of the conversation was stored, by its id: what the label's time reads. */
const stampRow = async ($: Dollar, ids: (string | undefined)[]) => {
  const keys = ids.filter((id): id is string => typeof id === 'string' && id !== '')
  if (keys.length === 0) return
  const at = new Date(await $.clock.now().catch(() => Date.now()))
  const minutes = at.getHours() * 60 + at.getMinutes()
  await update($, stamps, held => stampsWith(held as { [id: string]: number }, keys, minutes))
}

/** The footer's mode label: the theme's own, else its id in lowercase; none for "". */
export const modeLabelOf = (theme: { id: string; modeLabel?: string } | null): string | undefined =>
  theme === null ? undefined : theme.modeLabel === '' ? undefined : theme.modeLabel ?? (theme.id.toLowerCase() || undefined)

/** Whether a theme shows the time beside the labels on desktop: on unless `meta: false`. */
const showsTime = (theme: { meta?: boolean }) => theme.meta !== false

/** A turn's running time, short: "12s", "2m 05s", "1h 02m". */
export const elapsedOf = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`

  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`
}

/** `#RRGGBB` at `opacity` as `#RRGGBBAA`; unchanged when opaque or not a hex. */
export const withAlpha = (hex: string, opacity?: number): string =>
  opacity === undefined || opacity >= 1 || !/^#[0-9a-f]{6}$/i.test(hex) ? hex : `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0').toUpperCase()}`
/** A drawing copy whose heartbeat is older than this hands over to the other. */
const STALE_MS = 3 * POLL_MS + 1000

type Dollar = EngineInterface

/** The person's home variables, as the host gives them. */
const homeEnv = async ($: Dollar) => ({
  HOME: await $.env.get('HOME'),
  USERPROFILE: await $.env.get('USERPROFILE'),
  HOMEDRIVE: await $.env.get('HOMEDRIVE'),
  HOMEPATH: await $.env.get('HOMEPATH'),
})

/**
 * The person's home folder (not the tinta one). On Windows USERPROFILE first:
 * a Git Bash HOME (`/c/Users/ada`) is neither a path the host's files take nor
 * the one the app seals for.
 */
const homePath = async ($: Dollar) => sealHomeFrom(await homeEnv($), await onWindows($))

const home = async ($: Dollar) => tintaDir(await homePath($))

/**
 * The seal (sigillo.ts) for this session: its secret, home and machine (the
 * Mac's IOPlatformUUID, Windows' MachineGuid). Paid templates in plain text
 * (by id or by content) are refused by the installed copy (the marketplace's),
 * with or without .sigillo; the dev copy and the tests take them as they are.
 */
const sealOf = async ($: Dollar): Promise<SealContext> => {
  const homeDir = (await homePath($)) ?? ''
  let secret: Uint8Array | null = null
  try {
    const text = await $.fs.read(joinPath(tintaDir(homeDir) ?? '', '.sigillo'))
    secret = typeof text === 'string' ? secretFrom(text) : null
  } catch {
    secret = null
  }

  // read once a session ($.process is the CLI's: absent elsewhere, then the weak seal)
  return { secret, home: sealHome(homeDir), machine: await machineId($) }
}
// the installed copy refuses plain paid templates whether .sigillo exists or not (sigillo.ts, enforcement)
const enforced = async ($: Dollar, seal: SealContext) => enforcement($, isInstalledCopy($.plugin.root), await home($), seal)
/** The sealed text of each template as on disk, for writing it on as it is (applyTemplate). */
const RAW_TEMPLATES = new Map<string, string>()
let sealProbed = false

/** The first letter of the account's name, uppercase: the user's chip when the theme sets none. */
const userInitial = async ($: Dollar): Promise<string | undefined> => {
  const names = [
    await $.env.get('USER').catch(() => undefined),
    await $.env.get('USERNAME').catch(() => undefined),
    await $.env.get('LOGNAME').catch(() => undefined),
  ]

  return names.map(name => initialOf((name ?? '').slice(0, 1))).find(value => value !== undefined)
}

/**
 * The px under the app's prompt bubble on desktop: its action row (time,
 * copy, retry, branch). The user's rule ends this far above the row's foot,
 * at the bubble's, and RULE_INSET px shorter, erring short.
 */
export const USER_FOOT = 32
export const RULE_INSET = 4

/**
 * What the app's own prompt row is left drawing when Tinta draws the message
 * (`user.render: "themed"`): next to nothing, so its bubble shrinks to a stub
 * while its hover actions (copy, retry, branch, time, "Send now") stay. The
 * rewrite changes the drawn row only: the stored message, and what copy and
 * retry act on, is the real one. U+2800 (braille blank) is printable and
 * survives a strip of format characters and a trim, so it is the default.
 */
export const USER_STUBS: { [preset: string]: string } = { blank: '\u2800', space: ' ', empty: '', zwsp: '\u200B' }
/** The default stub: a "more actions" handle tucked under the bubble's corner. */
export const USER_STUB = '\u22EF'
/**
 * Prompts this session submitted with attachments (an image pasted with no
 * `[Image #n]` placeholder in its text), by a hash of their words: the
 * UserMessage row carries no attachment signal, so `prompt.submit` notes them
 * and the row keeps the app's drawing. A resumed session's rows are unknown.
 */
const attached = new Set<string>()
const ATTACHED_MAX = 200
/** Prompts this session submitted with an image: the glow skips those (the app draws a card of unknown height above the bubble). */
const imaged = new Set<string>()
/** Whether a prompt row carries an image: an `[Image #1]` placeholder, an image on the event, or one noted at submit. */
/** A prompt's key for the sets above: its shown words, image placeholders and spacing aside, so the submit and the row agree. */
export const promptKey = (text: string): string => hashOf(shownText(text).replace(/\[Image\b[^\]]*#\d+[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim())

export const hasImage = (e: { props: { text: string }; attachments?: readonly { type?: string }[] }, key: string): boolean =>
  imaged.has(key) || (e.attachments ?? []).some(item => item?.type === 'image') || ((e.props as { attachments?: readonly { type?: string }[] }).attachments ?? []).some(item => item?.type === 'image') || /\[Image\b[^\]]*#\d+[^\]]*\]/i.test(e.props.text)
/**
 * Whether every prompt's glow is anchored at its row's foot (as an image
 * prompt's always is) rather than at its top: off until the owner has seen a
 * bottom-anchored glow sit right under the app's bubble.
 */
export const GLOW_ANCHOR_BOTTOM = false
/**
 * Whether the band offers the theme dropdown (or the picker button): off
 * until it returns as two menus, palette and style (minimal, outline, solid,
 * gradient), once every palette has its style variants. Off, the band shows
 * the theme's dot and name as plain text.
 */
export const BAND_THEME_MENU = false
/** The band's columns under which the timer, then the limits, are left out (one row at any width from 48). */
export const BAND_ROOM = { timer: 64, limits: 56 } as const

/**
 * The band's two template menus (palette, style) over the v2 templates, for
 * trying them in the chat: off, themes are applied only from the Tinta app
 * (the owner's call); a developer's session (TINTA_DEV=1) has them, and
 * /tinta-prova.
 */
export const BAND_TEMPLATE_MENU = false

/** The kind of the theme's display face (typography.display), for an effect heading without its own font. */
const displayKind = (stack: string | undefined): 'mono' | 'serif' | undefined =>
  stack === undefined ? undefined : /mono|menlo|courier|consolas/i.test(stack) ? 'mono' : /serif/i.test(stack.replace(/sans-serif/gi, '')) ? 'serif' : undefined

/** A developer's session: TINTA_DEV=1 in the environment. */
const isDev = async ($: Dollar): Promise<boolean> => (await $.env.get('TINTA_DEV').catch(() => undefined)) === '1'

/** The v2 templates' styles, in their order, with the words a person may type for each. */
export const TEMPLATE_STYLES: readonly { id: string; words: readonly string[] }[] = [
  { id: 'minimal', words: ['minimal', 'minimale'] },
  { id: 'outline', words: ['outline', 'contorno', 'filo'] },
  { id: 'solid', words: ['solid', 'solido', 'pieno'] },
  { id: 'sfumature', words: ['sfumature', 'gradient', 'gradients', 'sfumato'] },
]

/** The palettes the bundled templates have, in name order. */
export const templatePalettes = (): string[] =>
  [...new Set(Object.keys(TEMPLATES).map(file => file.replace(/-[a-z]+\.json$/, '')))].sort()

/** A template id ("tinta-solid") as palette and style, or undefined. */
export const templateOf = (id: string | undefined): { palette: string; style: string } | undefined => {
  const m = /^([a-z0-9]+)-([a-z]+)$/.exec(id ?? '')

  return m && TEMPLATES[`${m[1]}-${m[2]}.json`] !== undefined ? { palette: m[1] as string, style: m[2] as string } : undefined
}

/**
 * What /tinta-prova's words ask for, from the active template: a palette and
 * a style ("tinta sfumature"), one of them (the other kept), "avanti"/"next"
 * (the next style, then the next palette); undefined when they name none.
 */
export const templateFor = (args: string, current: string | undefined): string | undefined => {
  const words = args.toLowerCase().split(/\s+/).filter(Boolean)
  const palettes = templatePalettes()
  const now = templateOf(current) ?? { palette: palettes[0] ?? 'tinta', style: 'solid' }
  if (words.length === 1 && /^(avanti|next|prossimo|successivo)$/.test(words[0] as string)) {
    const at = TEMPLATE_STYLES.findIndex(one => one.id === now.style)
    const next = (at + 1) % TEMPLATE_STYLES.length
    const palette = next === 0 ? (palettes[(palettes.indexOf(now.palette) + 1) % palettes.length] as string) : now.palette

    return `${palette}-${(TEMPLATE_STYLES[next] as { id: string }).id}.json`
  }
  let palette: string | undefined
  let style: string | undefined
  for (const word of words) {
    if (palettes.includes(word)) palette = word
    const named = TEMPLATE_STYLES.find(one => one.words.includes(word))
    if (named) style = named.id
  }
  if (palette === undefined && style === undefined) return undefined
  const file = `${palette ?? now.palette}-${style ?? now.style}.json`

  return TEMPLATES[file] === undefined ? undefined : file
}
const remember = (set: Set<string>, key: string) => {
  set.add(key)
  if (set.size > ATTACHED_MAX) set.delete(set.values().next().value as string)
}
/**
 * stubMode hidden: rows between the foot of the app's prompt bubble and the
 * end of its row: the hover action row (time, copy, retry, branch) and the
 * app's spacing around it. Calibrated on the owner's desktop: pulled up by 3
 * rows our bubble lay on the stub's lowest ~12 px of ~52 (2.5 rows under the
 * stub); pulled up by 5 the stub still showed ~75% above ours and our foot
 * lay on the action row, so 2 rows more sit there: 4.5 rows. Our bubble
 * keeps this much margin below itself, so the action row stays uncovered.
 */
export const USER_ACTION_ROWS = 4.5
/** stubMode hidden: rows of the app's prompt bubble around its text (its padding above and below). */
export const USER_STUB_PAD_ROWS = 1.5
/** stubMode hidden: the most lines the app's stub is grown to. */
export const USER_STUB_LINES_MAX = 60
/**
 * stubMode hidden: how many lines our bubble's text wraps to, estimated from
 * the words and the cells the bubble has (the column less the padding and
 * the edge, one character a cell, erring long on a narrow window).
 */
export const userLines = (text: string, columns: number): number => {
  const width = Math.max(8, Math.floor(columns - 2 * BUBBLE_PAD.x - 2))
  const lines = text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil([...line].length / width)), 0)

  return Math.max(1, Math.min(USER_STUB_LINES_MAX, lines))
}
/**
 * stubMode hidden: the stub the app's row is left drawing, as tall as our
 * bubble: the stub on the first line, a braille blank on every other, so the
 * app's bubble grows to our bubble's height and our cover is exact.
 */
export const userStubFor = (stub: string, lines: number): string =>
  [stub === '' ? '\u2800' : stub, ...Array.from({ length: Math.max(0, lines - 1) }, () => '\u2800')].join('\n')
/**
 * stubMode hidden: rows our bubble is pulled up by over the app's row,
 * computed from the lines: the app's stub bubble (its padding and `lines`)
 * and its action row below it, so our bubble starts at the stub's top and
 * covers the stub exactly; `USER_ACTION_ROWS` of margin below ours keep the
 * action row uncovered. -7 for a one-line prompt.
 */
export const USER_STUB_COVER = (lines = 1): number => -(USER_STUB_PAD_ROWS + Math.max(1, lines) + USER_ACTION_ROWS)
/**
 * stubMode segment: cells the app's stub bubble is wide with a blank stub
 * (its padding, 1.75 cells a side, and the blank), the end-cap it leaves over
 * our bubble's right end.
 */
export const USER_STUB_CELLS = 2 * BUBBLE_PAD.x + 1
/**
 * stubMode hidden / segment: rows of padding our filled bubble adds above and
 * below its text over the plain one; the stub grows by as many blank lines,
 * so it stays as tall as ours and the cover keeps our top on the stub's.
 */
export const USER_EXTRA_PAD_Y = 1
/**
 * stub "same": how much the app's bubble outgrows ours, in cells (x, its
 * width, taken on our left: the right edges are the row's) and rows (y, above
 * and below): the owner saw its grey ring ~3-4 px around ours, so 3.5 px at
 * 11.2 px a cell and 22 px a row (BUBBLE_PAD's measures).
 */
export const USER_TWIN_GROW = { x: 0.3, y: 0.15 }
/**
 * stub "same": the share of the row the app's prompt bubble may take (measured
 * on the owner's desktop: about 80%). Ours is capped there too, so our
 * invisible words wrap where the app's do and the two bubbles are one size.
 */
export const USER_TWIN_WIDTH = 0.8
/** stubMode segment: our bubble's right padding, the end-cap's width and a cell clear of it. */
export const USER_SEGMENT_PAD = USER_STUB_CELLS + 1
/** stubMode hidden: how far our bubble's solid fill leans toward the user's accent, per appearance. */
export const USER_FILL_TINT: { dark: number; light: number } = { dark: 0.5, light: 0.35 }
/** stubMode hidden: the solid fill, the app's bubble grey with the user's accent in it. */
export const userFillFor = (accent: string | undefined, mode: 'dark' | 'light'): string =>
  accent && /^#[0-9a-f]{6}$/i.test(accent) ? (mode === 'dark' ? mix('#000000', accent, 0.72) : mix(APP_BUBBLE[mode], accent, USER_FILL_TINT[mode])) : APP_BUBBLE[mode]
/**
 * stubMode hidden applies only to a prompt the person typed (the composer, or
 * the desktop app's own sdk or bridge origins) with no attachment of any kind: no placeholder, none on the event or the
 * row's props, none noted at submit.
 */
export const hidesStub = (e: { props: { text: string; origin?: { kind?: string } }; attachments?: readonly unknown[] }, known: boolean): boolean =>
  ['composer', 'sdk', 'bridge'].includes(e.props.origin?.kind ?? '') && !hasAttachments(e) && !known
/** The text the app's row is left drawing for a theme's `stub`. */
export const stubText = (stub: string | undefined): string => (stub === undefined ? USER_STUB : USER_STUBS[stub] ?? stub)

/** Whether a prompt carries attachments (an `[Image #1]` placeholder, a pasted file): those keep the app's drawing. */
export const hasAttachments = (e: { props: { text: string }; attachments?: readonly unknown[] }) =>
  (e.attachments?.length ?? 0) > 0 || ((e.props as { attachments?: readonly unknown[] }).attachments?.length ?? 0) > 0 || /\[(Image|Pasted text|File|PDF|Document)\b[^\]]*#\d+[^\]]*\]/i.test(e.props.text)

/**
 * A prompt's words as the app's bubble shows them: HTML comments gone (the
 * app's `<!-- reply N -->` marker before a quoted reply), blank edges trimmed;
 * the rest is Markdown (a quote's "> " lines, bold, lists).
 */
export const shownText = (text: string): string =>
  text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*\n+/, '')
    .replace(/\n+[ \t]*$/, '')
    .trim()

/** The longest prompt Tinta draws itself; a longer one keeps the app's drawing. */
export const USER_TEXT_MAX = 20000

/** A reply cut around its GFM tables, ATX headings and fenced code: Markdown chunks and the parts Tinta draws, in order. */
export type ReplyPart =
  | { kind: 'markdown'; text: string }
  | { kind: 'table'; header: string[]; align: ('left' | 'right' | 'center')[]; rows: string[][] }
  /** `#` to `###`: `text` with its marks, `raw` the line as written (what the app's Markdown draws when Tinta cannot). */
  | { kind: 'heading'; level: 1 | 2 | 3; text: string; raw: string }
  /** A closed fence at the left margin: its info read (language, file name), the code, and the fence as written. */
  | { kind: 'code'; language?: string; title?: string; source: string; raw: string }

/** What replyParts cuts out: tables (the default, alone), headings, fenced code. */
export type ReplyCuts = { tables?: boolean; headings?: boolean; code?: boolean }

const cellsOf = (line: string): string[] => {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let cell = ''
  let code = false
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i] as string
    if (ch === '\\' && inner[i + 1] === '|') {
      cell += '|'
      i++
    } else if (ch === '`') {
      code = !code
      cell += ch
    } else if (ch === '|' && !code) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += ch
    }
  }
  cells.push(cell.trim())

  return cells
}

const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

/**
 * `text` cut around its top-level GFM tables (a header row, a separator
 * row, body rows; never inside a code fence): Markdown chunks keep every
 * other line as written, so their spacing stays the app's.
 */
export const replyParts = (text: string, cuts: ReplyCuts = { tables: true }): ReplyPart[] => {
  const lines = text.split('\n')
  const parts: ReplyPart[] = []
  let chunk: string[] = []
  let fence: string | undefined
  const flush = () => {
    const body = chunk.join('\n').replace(/^\n+|\n+$/g, '')
    if (body.trim() !== '') parts.push({ kind: 'markdown', text: body })
    chunk = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    const mark = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    // a closed fence at the left margin, cut out whole; an open one (still streaming) stays Markdown
    if (cuts.code && fence === undefined && mark && line.startsWith(mark)) {
      const info = line.slice(mark.length)
      const close = info.includes('`') && mark[0] === '`' ? -1 : lines.findIndex((one, j) => j > i && new RegExp(`^ {0,3}${mark[0] === '`' ? '`' : '~'}{${mark.length},}\\s*$`).test(one))
      if (close > i) {
        flush()
        parts.push({ kind: 'code', ...fenceInfo(info), source: lines.slice(i + 1, close).join('\n'), raw: lines.slice(i, close + 1).join('\n') })
        i = close
        continue
      }
    }
    if (mark && (fence === undefined || (mark[0] === fence[0] && mark.length >= fence.length))) {
      fence = fence === undefined ? mark : undefined
      chunk.push(line)
      continue
    }
    const heading = cuts.headings && fence === undefined ? /^ {0,3}(#{1,3})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line) : null
    if (heading && (heading[2] ?? '').trim() !== '') {
      flush()
      parts.push({ kind: 'heading', level: (heading[1] as string).length as 1 | 2 | 3, text: (heading[2] as string).trim(), raw: line })
      continue
    }
    const next = lines[i + 1]
    if (cuts.tables !== false && fence === undefined && line.includes('|') && next !== undefined && SEPARATOR.test(next)) {
      const header = cellsOf(line)
      const align = cellsOf(next).map(c => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'))
      if (header.length >= 1 && align.length === header.length) {
        const rows: string[][] = []
        let j = i + 2
        while (j < lines.length && (lines[j] as string).includes('|') && (lines[j] as string).trim() !== '') {
          const cells = cellsOf(lines[j] as string)
          rows.push(header.map((_, k) => cells[k] ?? ''))
          j++
        }
        flush()
        parts.push({ kind: 'table', header, align, rows })
        i = j - 1
        continue
      }
    }
    chunk.push(line)
  }
  flush()

  return parts
}

/** Probe lines already written this session: a render hook fires again and again, each line goes once. */
const probed = new Set<string>()
/** The probe file's most lines. */
const PROBE_MAX = 400

/**
 * A probe line (what the desktop hands a hook): to the debug log, and once
 * per session appended to ~/.claude/tinta/probe.log, where it can be read
 * without the app's debug mode.
 */
const probe = ($: Dollar, line: string) => {
  $.ui.log(line, { to: 'debug' })
  if (probed.has(line)) return
  remember(probed, line)
  void (async () => {
    const dir = await home($)
    if (dir === undefined) return
    const path = joinPath(dir, 'probe.log')
    const held = await readText($, path)
    const at = new Date(await $.clock.now().catch(() => Date.now())).toISOString()
    const lines = `${held}${at} ${line}\n`.split('\n').filter(Boolean).slice(-PROBE_MAX)
    await $.fs.write(path, `${lines.join('\n')}\n`)
  })().catch(() => undefined)
}

/** The app's diff pane at `path`, through its own MCP server (experiment diffButton); the answer logged to debug, a failure toasted. */
const openDiff = async ($: Dollar, path: string) => {
  try {
    const answer = await $.mcp.call(DIFF_PANE.server, DIFF_PANE.tool, { pane: 'diff', path })
    probe($, `tinta diff ${path}: ${JSON.stringify(answer).slice(0, 300)}`)
    if (answer.isError === true) $.ui.toast(t(await read($, locale), 'diffFailed'))
  } catch (error) {
    probe($, `tinta diff ${path}: ${String(error)}`)
    $.ui.toast(t(await read($, locale), 'diffFailed'))
  }
}

/** The desktop's own view server and its tool that shows a side pane (experiment diffButton). */
export const DIFF_PANE = { server: 'ccd_view', tool: 'show_pane' } as const

/**
 * userBreaks: the row's text with Tinta's line breaks, or undefined when the
 * prompt fits one line a paragraph, carries an image, or our breaks would
 * make the app fold it where it would not have.
 */
const BUBBLE_GLOW_PAD = BUBBLE_GLOW_PAD_XY.x

export const userBreaksFor = (text: string, columns: number): string | undefined => {
  const words = shownText(text)
  if (words === '' || /\[Image\b/i.test(words)) return undefined
  const size = userBubbleSize(words, columns)
  if (!size.full || size.collapsed) return undefined
  const broken = breakPrompt(text, bubbleWidest(columns) - 2 * BUBBLE_GLOW_PAD)
  if (broken === text || (isCollapsed(shownText(broken)) && !isCollapsed(words))) return undefined

  return broken
}

/**
 * The user glow's styleHints: a thin ring in place of the fill (glowStroke,
 * with glowFill "none" the ring alone), the fill's own opacity (fillAlpha).
 */
const glowHints = (theme: Look): { stroke?: { color: string; alpha: number; width: number }; noFill?: true; opacity?: number } => {
  const user = theme.hints?.user

  return {
    ...(user?.glowStroke ? { stroke: user.glowStroke } : {}),
    ...(user?.glowFill === 'none' ? { noFill: true as const } : {}),
    ...(user?.fillAlpha !== undefined ? { opacity: user.fillAlpha } : {}),
  }
}

/**
 * Claude's bubble's visible edge, #RRGGBBAA: styleHints.assistant.bubble.border,
 * else (only where the theme draws lines) the bubble's border at the borders'
 * alpha; none without lines.
 */
const bubbleEdgeOf = (theme: Look, border: string | undefined): string | undefined => {
  const hint = theme.hints?.bubble?.border
  // a decorative edge (Unicorno's iridescent rim) is drawn whatever the theme's lines
  if (hint && (hint as { decorative?: boolean }).decorative) return withAlpha(hint.color, hint.alpha)
  if (!linesOn(theme)) return undefined
  if (hint) return withAlpha(hint.color, hint.alpha)
  const base = border && /^#[0-9a-f]{6}/i.test(border) ? border.slice(0, 7) : undefined

  return base === undefined || theme.hints?.borders?.alpha === undefined ? undefined : withAlpha(base, theme.hints.borders.alpha)
}

/** The user's label ring (styleHints.user.labelChip "outline"): the accent at the borders' alpha and width. */
const labelOutlineOf = (theme: Look): { color: string; alpha: number; width: number } | undefined =>
  theme.hints?.user?.labelChip === 'outline' && theme.user?.accent
    ? { color: theme.user.accent, alpha: theme.hints.borders?.alpha ?? 0.25, width: theme.hints.borders?.width ?? 1 }
    : undefined

/**
 * A look with Claude's colours for reply `order` of its cycle (the theme's
 * `cycle`, else Unicorno's own for a Unicorno template): the accent, the
 * label's gradient (and so the burst and the headings), the bubble's mesh
 * at a strength that keeps the text at 7:1, the edge; what a style has, it
 * cycles (Outline the edge, Minimal the label).
 */
/**
 * Vetro Gradient's bubble mesh: deep blues and cyans that shade visibly at 7:1 under the frost (the template's pale
 * #DCEFFF held the whole mesh down, and the old glass laid a light veil over it: a flat grey-blue)
 */
export const VETRO_MESH = ['#1F5FFF', '#0B8FBF', '#4B5BFF', '#1E7FD0'] as const

export const cycledLook = (base: Look, order: number): Look => {
  const sets = base.hints?.cycle ?? (/^unicorno-/.test(base.id) ? UNICORNO_CYCLE : undefined)
  const set = sets ? cycleSetAt(sets, order) : undefined
  // Fosforo: the bubble's phosphor as bright as the text's 7:1 allows (no cycle)
  if (set === undefined && /^fosforo-/.test(base.id) && base.hints?.bubble?.mesh) {
    const accent = base.assistant?.accent ?? base.palette.accent ?? '#39FF88'
    // a little headroom over 7:1 (7.6) so the rain's glyphs can show on top
    return { ...base, hints: { ...base.hints, bubble: { ...base.hints.bubble, meshStrength: safeMeshStrength(base.hints.bubble.mesh, base.hints.bubble.meshBaseAlpha ?? 0.09, 1.8, accent, 7.6) } } }
  }
  // Vetro Gradient: sky blues and frosted cyans clearly shaded under a light frost (the glass), the text at 7:1 with
  // the frost on top (8 before the frost)
  if (set === undefined && base.id === 'vetro-sfumature' && base.hints?.bubble?.mesh) {
    const accent = base.assistant?.accent ?? base.palette.accent ?? '#6098C6'

    return { ...base, hints: { ...base.hints, bubble: { ...base.hints.bubble, mesh: [...VETRO_MESH], meshStrength: safeMeshStrength(VETRO_MESH, base.hints.bubble.meshBaseAlpha ?? 0.09, 1.8, accent, 8) } } }
  }
  if (set === undefined || base.assistant === undefined) return base
  const style = templateOf(base.id)?.style
  const label = set.label && set.label.length >= 2 ? { gradient: { type: 'linear' as const, angle: 90, stops: set.label.map((hex, i, all) => [hex, i / (all.length - 1)] as [string, number]) } } : { solid: set.accent }
  if (style === 'minimal') return { ...base, assistant: { ...base.assistant, labelFill: label, labelColor: set.accent } }
  const mesh = set.mesh ?? base.hints?.bubble?.mesh
  // Unicorno: luminous pastels, a light base, the text held at 4.5:1 (AA) on the brightest blob instead of 7:1
  const luminous = /^unicorno-/.test(base.id)
  const meshBase = luminous ? UNICORNO_LOOK.baseAlpha : base.hints?.bubble?.meshBaseAlpha ?? 0.09
  const strength = mesh ? safeMeshStrength(mesh, meshBase, luminous ? UNICORNO_LOOK.strength : base.hints?.bubble?.meshStrength ?? 1, set.accent, luminous ? UNICORNO_LOOK.floor : 7) : undefined
  // Unicorno (the owner's call: no luminous edges outside Outline): a clean candy interior, one diagonal gradient in
  // this reply's colour toward the next, as bright as the text's 3.5:1 allows over the dark app (no grey base, no
  // shadow behind the translucent bubble, which showed as a dark rim); white and pastel stars twinkling in the
  // padding; the label a vivid pink, lilac, periwinkle gradient with a white highlight, no glow
  const bubble = base.assistant.bubble
  const next = cycleSetAt(sets ?? [], order + 1) ?? set
  const candy = luminous ? { from: set.accent, to: next.accent, alpha: candyAlpha([set.accent, next.accent]) } : undefined
  const calm = luminous && bubble !== false && bubble !== undefined ? { bubble: { ...bubble, halo: false, shadow: undefined } } : {}
  const vivid = luminous ? { labelFill: { gradient: { type: 'linear' as const, angle: 90, stops: [['#FFFFFF', 0], ['#FBB0FA', 0.22], ['#C9A4F5', 0.6], ['#A4A5F4', 1]] as [string, number][] } }, labelGlow: false } : { labelFill: label }

  return {
    ...base,
    assistant: { ...base.assistant, accent: set.accent, labelColor: set.accent, ...vivid, ...calm },
    hints: {
      ...base.hints,
      bubble: {
        ...base.hints?.bubble,
        ...(mesh ? { mesh, meshStrength: strength, ...(luminous ? { meshBaseAlpha: meshBase } : {}) } : {}),
        ...(style === 'outline' || set.edge ? { border: { color: set.edge ?? set.accent, alpha: base.hints?.borders?.alpha ?? 0.25, width: 1 } } : {}),
        ...(candy ? { candy, sparkle: next.accent } : {}),
        ...(style === 'solid' ? { fill: set.accent } : {}),
      },
    },
  }
}

/** Fosforo's rain: few glyphs, this faint at most (the text kept at 7:1 over them, checked in the suite). */
export const RAIN_ALPHA = 0.25
/** The contrast the app's text keeps over Fosforo's rain. */
export const RAIN_FLOOR = 4.5

/**
 * The bubble's backdrop for a look: its own (styleHints.assistant.bubble
 * .backdrop), else rain for Fosforo Sfumature (glass for Vetro Sfumature,
 * when drawn); its colours the palette's mesh.
 */
export const backdropOf = (theme: Look): { kind: 'rain' | 'glass'; colors: string[]; alpha: number } | undefined => {
  const kind = theme.hints?.bubble?.backdrop ?? (theme.id === 'fosforo-sfumature' ? 'rain' : theme.id === 'vetro-sfumature' ? 'glass' : 'none')
  if (kind === 'none') return undefined
  const colors = theme.hints?.wave?.colors ?? theme.hints?.bubble?.mesh ?? [theme.palette.accent ?? '#39FF88']
  // as faint as keeps the text at 7:1 over the brightest blob with a glyph on it
  const accent = theme.assistant?.accent ?? theme.palette.accent ?? '#39FF88'
  const ground = mix(APP_BACKGROUND.dark, accent, theme.hints?.bubble?.meshBaseAlpha ?? 0.09)
  const unders = (theme.hints?.bubble?.mesh ?? [accent]).map(blob => mix(ground, blob, 0.425 * (theme.hints?.bubble?.meshStrength ?? 1)))

  // the rain: the leading glyph up to 25% at the edges (under half that behind the words), the text kept at 4.5:1
  // over the brightest blob with a glyph on it (relaxed from 7:1 for this effect, the owner's call)
  return { kind, colors, alpha: overlayAlpha(unders, ['#A8FFD0', ...colors], RAIN_ALPHA, RAIN_FLOOR) }
}

/** The hover group of the rows that touched `path` (experiment hoverScope): one string per file, under 64 characters. */
export const fileScope = (path: string): string => `file:${hashOf(path.replace(/\\/g, '/'))}`

/** A cell's inline runs: **bold**, `code` and plain text. */
export const runsOf = (cell: string): { text: string; bold?: boolean; code?: boolean }[] => {
  const runs: { text: string; bold?: boolean; code?: boolean }[] = []
  const pattern = /\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`/g
  let last = 0
  for (const m of cell.matchAll(pattern)) {
    if ((m.index ?? 0) > last) runs.push({ text: cell.slice(last, m.index) })
    if (m[3] !== undefined) runs.push({ text: m[3], code: true })
    else runs.push({ text: (m[1] ?? m[2]) as string, bold: true })
    last = (m.index ?? 0) + m[0].length
  }
  if (last < cell.length) runs.push({ text: cell.slice(last) })

  return runs.length > 0 ? runs : [{ text: '' }]
}

/** The cells a cell's text takes once drawn: its runs without their marks. */
const drawnLength = (cell: string) => runsOf(cell).reduce((n, run) => n + run.text.length, 0)

const NUMERIC = /^[-+−]?[\d.,']+\s?(%|€|\$|k|M|ms|s|px|GB|MB|KB)?$/

/**
 * Column widths in cells: each its content, plus a cell of padding a side,
 * shrunk (widest first) until the table fits `room` cells.
 */
export const columnWidths = (header: string[], rows: string[][], room: number): number[] => {
  const widths = header.map((h, k) => Math.max(3, drawnLength(h), ...rows.map(r => drawnLength(r[k] ?? ''))) + 2)
  const frame = 2
  while (widths.reduce((a, b) => a + b, 0) + frame > room) {
    const widest = widths.indexOf(Math.max(...widths))
    if ((widths[widest] as number) <= 6) break
    widths[widest] = (widths[widest] as number) - 1
  }

  return widths
}

/** Whether `root` is the copy installed from the marketplace (the plugin cache). */
export const isInstalledCopy = (root: string) => /[\\/]plugins[\\/]cache[\\/]/.test(root)

const rootOf = ($: Dollar): string => $.plugin.root

/**
 * One copy of the engine draws per session. When the dev copy and the
 * installed plugin both load, both would hook every row (two labels, two
 * toasts, two pollers); the first to claim holds the session, a dev copy
 * takes it from the installed one, and a holder that stops beating (its
 * folder unloaded) is replaced at the next poll of the other.
 */
const claim = async ($: Dollar): Promise<boolean> => {
  const root = rootOf($)
  const now = await $.clock.now().catch(() => 0)
  const held = await read($, owner)
  const beat = await read($, heartbeat)
  const mine =
    held === null || held.root === root || now - Math.max(held.at, beat) > STALE_MS || (isInstalledCopy(held.root) && !isInstalledCopy(root))
  if (mine) {
    // who draws changes only on a handover; the beat goes to its own atom: every row reads `owner` (drawsHere), and a
    // beat written there every poll redrew every row every 2 s (a table's selection cleared, animations restarted)
    if (held === null || held.root !== root) await update($, owner, () => ({ root, at: now }))
    await update($, heartbeat, () => now)
  }

  return mine
}

/** Whether this copy draws: read only, never a write on a render. */
const drawsHere = async ($: Dollar): Promise<boolean> => {
  const held = await read($, owner).catch(() => null)

  return held === null || held.root === rootOf($)
}

/** The theme to draw with, or null when off or missing. */
const active = async ($: Dollar): Promise<Theme | null> => ((await read($, isOff)) ? null : await read($, current))

/** The share of the accent in a label's time: in the theme's colour, a step behind the name. */
export const TIME_ACCENT = 0.7

/**
 * A label's time in its role's accent, 70% of the way from the muted text,
 * kept at 3:1 or better on the app's background in the appearance drawn.
 */
const timeInk = async ($: Dollar, drawn: Look, accent: string | undefined, surface: Surface): Promise<string> => {
  const muted = drawn.palette.muted ?? '#8A8A8A'
  if (accent === undefined || !/^#[0-9a-f]{6}$/i.test(accent) || !/^#[0-9a-f]{6}$/i.test(muted)) {
    return muted
  }
  const theme = await read($, current)
  const mode = theme === null ? 'dark' : appearanceFor(theme, (await read($, appearance)) ?? undefined, surface)

  return readable(mix(muted, accent, TIME_ACCENT), APP_BACKGROUND[mode], drawn.palette.text) ?? muted
}

/**
 * The themed user bubble's edge: the app's bubble grey leaning toward the
 * user's accent by the same share Claude's bubble leans toward his.
 */
const userEdge = async ($: Dollar, accent: string | undefined, surface: Surface): Promise<string> => {
  const theme = await read($, current)
  if (surface === 'desktop' && theme?.appearance === undefined) return alphaEdge(accent)
  const mode = theme === null ? 'dark' : appearanceFor(theme, (await read($, appearance)) ?? undefined, surface)

  return bubbleFor(undefined, accent, mode).border
}

/** stubMode hidden: our bubble's solid fill in the appearance drawn now. */
const userFill = async ($: Dollar, accent: string | undefined, surface: Surface): Promise<string> => {
  const theme = await read($, current)
  const mode = theme === null ? 'dark' : appearanceFor(theme, (await read($, appearance)) ?? undefined, surface)

  return userFillFor(accent, mode)
}

/** The look to draw on `surface`: variant, safety rules and contrast applied. */
const lookOn = async ($: Dollar, theme: Theme | null, surface: Surface): Promise<Look | null> =>
  theme === null ? null : lookFor(theme, appearanceFor(theme, (await read($, appearance)) ?? undefined, surface), surface)

const look = async ($: Dollar, surface: Surface) => lookOn($, await active($), surface)

/** Reads the app appearance from the `/config` theme row, where there is one. */
const detectAppearance = async ($: Dollar) => {
  const rows = await $.config.list().catch(() => [])
  const mode = appearanceOf(rows.find(row => row.key === 'theme')?.value)
  await update($, appearance, () => mode ?? null)
}

const showStatus = ($: Dollar, theme: Theme | null) =>
  $.ui.status(theme?.statusLine ? fill(theme.statusLine, theme) : undefined)

const readText = async ($: Dollar, path: string) => {
  try {
    const text = await $.fs.read(path)

    return typeof text === 'string' ? text : ''
  } catch {
    return ''
  }
}

/** Seeds active.json and themes/salvia-sfumature.json (the free theme), each only when missing. */
const seed = async ($: Dollar) => {
  const dir = await home($)
  if (dir === undefined) {
    return
  }
  for (const path of [joinPath(dir, 'active.json'), joinPath(dir, 'themes', SALVIA_FILE)]) {
    if (!(await $.fs.exists(path).catch(() => true))) {
      await $.fs.write(path, SALVIA).catch(() => undefined)
    }
  }
}

/** Re-reads active.json and stores the theme when its text changed. */
/** The person's own preferences (~/.claude/tinta/preferenze.json), over every theme and template. */
export type Prefs = { userBubble?: 'app' | 'theme'; sounds?: 'on' | 'off' }

/** preferenze.json read: only the fields known, anything else dropped. */
export const prefsOf = (text: string): Prefs => {
  try {
    const raw = JSON.parse(text) as { userBubble?: unknown; sounds?: unknown }

    return {
      ...(raw.userBubble === 'app' || raw.userBubble === 'theme' ? { userBubble: raw.userBubble } : {}),
      ...(raw.sounds === 'on' || raw.sounds === 'off' ? { sounds: raw.sounds } : {}),
    }
  } catch {
    return {}
  }
}

const load = async ($: Dollar) => {
  const dir = await home($)
  if (dir === undefined) {
    return
  }
  const seal = await sealOf($)
  if (!sealProbed) {
    sealProbed = true
    probe($, `tinta sigillo macchina ${seal.machine ? 'sì' : 'no'}`)
  }
  await loadTemplates($, dir, seal).catch(() => undefined)
  // the person's preferences, read at every poll (they outlive any template switch)
  const wanted = prefsOf(await readText($, joinPath(dir, 'preferenze.json')))
  if (JSON.stringify(wanted) !== JSON.stringify(await read($, prefs))) await update($, prefs, () => wanted)
  let text = await readText($, joinPath(dir, 'active.json'))
  // a template since renamed (Claude Reloaded is Terracotta): the active one moved to its successor
  const renamed = renamedTemplate((/"id"\s*:\s*"([^"]+)"/.exec(text) ?? [])[1])
  if (renamed !== undefined && TEMPLATES[renamed] !== undefined) {
    await applyTemplate($, renamed)

    return
  }
  const before = await read($, source)
  if (text === before) {
    return
  }
  // a sealed theme opened (the raw text stays the source, so a poll compares without opening it again); one refused
  // draws the free theme (Salvia), with a quiet line in probe.log
  const opened = text === '' ? { text: '' } : openTheme(text, seal, await enforced($, seal))
  const sealedId = isSealed(text) ? (/"id"\s*:\s*"([^"]+)"/.exec(text) ?? [])[1] ?? '?' : undefined
  if (opened.text === null) probe($, `tinta sigillo fallito ${sealedId ?? 'active.json'}: ${opened.reason}`)
  else if (sealedId !== undefined) probe($, `tinta sigillo aperto ${sealedId} (${seal.machine ? 'firma del Mac' : 'firma debole'})`)
  const plain = opened.text ?? SALVIA
  const theme = plain === '' ? null : parseTheme(plain, await read($, locale))
  await update($, source, () => text)
  await update($, current, () => theme)
  await syncPage($).catch(() => undefined)
  if (!(await read($, isOff))) {
    showStatus($, theme)
  }
  if (theme?.toasts?.onApply && before !== '') {
    $.ui.toast(fill(theme.toasts.onApply, theme))
  }
}

/**
 * The template catalogue from ~/.claude/tinta/themes: a file is read when it
 * first appears or its size or time changes, dropped when it goes.
 */
const TEMPLATE_STAMPS = new Map<string, string>()
const loadTemplates = async ($: Dollar, dir: string, seal: SealContext) => {
  const entries = await $.fs.list(joinPath(dir, 'themes'))
  const found: { [file: string]: string } = {}
  const seen = new Set<string>()
  for (const entry of entries) {
    if (entry.kind !== 'file' || !TEMPLATE_FILE.test(entry.name)) continue
    seen.add(entry.name)
    const stamp = `${entry.size}:${entry.mtimeMs}`
    if (TEMPLATE_STAMPS.get(entry.name) === stamp && TEMPLATES[entry.name] !== undefined) {
      found[entry.name] = TEMPLATES[entry.name] as string
      continue
    }
    const text = await readText($, joinPath(dir, 'themes', entry.name))
    if (text === '') continue
    const opened = openTheme(text, seal, await enforced($, seal))
    if (opened.text === null) {
      probe($, `tinta sigillo ${entry.name}: ${opened.reason}`)
      continue
    }
    found[entry.name] = opened.text
    RAW_TEMPLATES.set(entry.name, text)
    TEMPLATE_STAMPS.set(entry.name, stamp)
  }
  for (const file of [...TEMPLATE_STAMPS.keys()]) if (!seen.has(file)) TEMPLATE_STAMPS.delete(file)
  for (const file of [...RAW_TEMPLATES.keys()]) if (!seen.has(file)) RAW_TEMPLATES.delete(file)
  setTemplates(found)
}

const listThemes = async ($: Dollar) => {
  const dir = await home($)
  if (dir === undefined) {
    return
  }
  const entries = await $.fs.list(joinPath(dir, 'themes')).catch(() => [])
  const seal = await sealOf($)
  const found: { file: string; name: string; id: string }[] = []
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) {
      continue
    }
    const theme = parseTheme(openTheme(await readText($, joinPath(dir, 'themes', entry.name)), seal, await enforced($, seal)).text ?? '', await read($, locale))
    if (theme !== null) {
      found.push({ file: entry.name, name: theme.name, id: theme.id })
    }
  }
  found.sort((a, b) => a.name.localeCompare(b.name))
  await update($, themes, () => found)
}

/** Reads the band's session figures again (the context window's fill), stored only when they changed. */
const refreshSession = async ($: Dollar) => {
  const usage = await $.session.usage().catch(() => undefined)
  await storeFigures($, figuresOf(usage))
}

/** Stores the band's figures when they changed. */
const storeFigures = async ($: Dollar, figures: Figures | null) => {
  const held = await read($, sessionInfo)
  if (JSON.stringify(held ?? null) !== JSON.stringify(figures)) {
    await update($, sessionInfo, () => figures)
  }
}

/** A toast and the theme's alert sound for each 80% / 90% crossing not given yet this session. */
const giveAlerts = async ($: Dollar, figures: Figures | null) => {
  const due = alertsDue(figures, (await read($, alerted)) as string[], await read($, locale))
  if (due.length === 0) return
  await update($, alerted, given => [...new Set([...(given as string[]), ...due.flatMap(one => one.keys)])].slice(-100))
  for (const one of due) $.ui.toast(one.text)
  await sound($, 'alert')
}

/** A v2 template id renamed since (reloaded-* is terracotta-*): its successor's file, or undefined. */
export const renamedTemplate = (id: string | undefined): string | undefined => {
  const m = /^reloaded-([a-z]+)$/.exec(id ?? '')

  return m ? `terracotta-${m[1]}.json` : undefined
}

/** Writes a bundled template to ~/.claude/tinta/themes and makes it the active theme. */
const applyTemplate = async ($: Dollar, file: string) => {
  const dir = await home($)
  const text = TEMPLATES[file]
  if (dir === undefined || text === undefined) return
  // a sealed template goes to active.json sealed, as it is; its file in themes/ is left alone
  const raw = RAW_TEMPLATES.get(file)
  if (raw !== undefined && isSealed(raw)) {
    await $.fs.write(joinPath(dir, 'active.json'), raw)
    await load($)

    return
  }
  const pretty = JSON.stringify(JSON.parse(text), null, 2)
  await $.fs.write(joinPath(dir, 'themes', file), pretty).catch(() => undefined)
  await $.fs.write(joinPath(dir, 'active.json'), pretty)
  await load($)
}

const applyTheme = async ($: Dollar, file: string) => {
  const dir = await home($)
  if (dir === undefined || !/^[\w .-]+\.json$/.test(file)) {
    return
  }
  const text = await readText($, joinPath(dir, 'themes', file))
  // checked opened, copied as it is (sealed stays sealed)
  const seal = await sealOf($)
  if (parseTheme(openTheme(text, seal, await enforced($, seal)).text ?? '') === null) {
    $.ui.toast(t(await read($, locale), 'badTheme', { file }))

    return
  }
  await $.fs.write(joinPath(dir, 'active.json'), text)
  await load($)
}

/** When each heading first appeared (its reply, place and words): its one-shot effect plays once from there. */
const BORN = new Map<string, number>()
const bornOf = (key: string, now: number): number => {
  const held = BORN.get(key)
  if (held !== undefined) return held
  if (BORN.size > 500) BORN.delete(BORN.keys().next().value as string)
  BORN.set(key, now)

  return now
}

/** How long a reply's text must not grow before its decoding stops, ms; the longest reply decoded. */
export const DECODE_QUIET_MS = 1200
export const DECODE_MAX = 600
/** Each reply's length and when it last grew, by its id; the newest reply of the running turn. */
const STREAMS = new Map<string, { length: number; at: number }>()
let newestReply: string | undefined

/**
 * Whether reply `id` is streaming: the newest of the running turn, its text
 * grown within DECODE_QUIET_MS. A row that is streaming asks for a redraw
 * once it can have gone quiet (streamTick), so it swaps back to Markdown.
 */
const streamingNow = async ($: Dollar, id: string, text: string): Promise<boolean> => {
  const held = STREAMS.get(id)
  // a finished reply, or no turn running: nothing read, so nothing of the turn's redraws it
  if (!turnRunning || (held !== undefined && newestReply !== id)) {
    if (held === undefined) STREAMS.set(id, { length: text.length, at: 0 })
    return false
  }
  await read($, streamTick)
  const at = await $.clock.now().catch(() => 0)
  const working = turnRunning
  if (held === undefined && working) newestReply = id
  const grew = held === undefined ? working : text.length > held.length
  const since = grew ? at : held?.at ?? 0
  STREAMS.set(id, { length: text.length, at: since })
  if (STREAMS.size > 200) STREAMS.delete(STREAMS.keys().next().value as string)
  const streaming = working && newestReply === id && at - since < DECODE_QUIET_MS
  if (streaming) $.clock.after(DECODE_QUIET_MS + 100, () => void update($, streamTick, n => n + 1))

  return streaming
}

/**
 * The page the engine tries for a template without its own `page` (the
 * designer moves them into the files): Fosforo Sfumature's digital rain,
 * Tinta Sfumature's and Noir's mesh.
 */
export const DEFAULT_PAGES: { [id: string]: NonNullable<Look['page']> } = {
  'fosforo-sfumature': { kind: 'rain' },
  'tinta-sfumature': { kind: 'mesh', strength: 0.35 },
  noir: { kind: 'mesh', strength: 0.35 },
}

/** The page behind the conversation for a look: the backdrop's arguments and its drawing; undefined for none. */
export type Page = { args: { id: string; glass: { blur: number; opacity: number; tint?: string } | false }; base: string; source: string; alt: string; rain: boolean }
export const pageFor = (theme: Look | null, mode: 'dark' | 'light'): Page | undefined => {
  if (theme === null) return undefined
  const raw = theme.page ?? DEFAULT_PAGES[theme.id]
  if (raw === undefined) return undefined
  const own = typeof raw === 'string' ? { kind: raw } : raw
  if (own.kind === 'rain') {
    // the rain's glyphs weighed as dots (a point of colour at twice the strength): fx-page holds them legible under
    // every frosted panel; the head glyph at that point's alpha
    const colors = own.colors ?? theme.hints?.wave?.colors ?? [theme.palette.accent ?? '#39FF88']
    const plan = pagePlan({ ...own, kind: 'dots', colors, motion: false, id: own.id ?? `tinta-${theme.id}` }, theme.palette, mode, theme.id)
    if (plan === undefined) return undefined
    const alpha = Math.round(Math.min(1, plan.spec.strength * 2) * 1000) / 1000
    const rain = pageRainDrawing(colors, alpha, theme.motion !== false && own.motion !== false, plan.drawing.base)

    return { args: plan.args, base: plan.drawing.base, source: rain.source, alt: plan.drawing.alt, rain: true }
  }
  const plan = pagePlan(own, theme.palette, mode, theme.id)

  return plan && { args: plan.args, base: plan.drawing.base, source: plan.drawing.source, alt: plan.drawing.alt, rain: false }
}

/** What the backdrop was last set to this session (its arguments), so a poll sets it only on a change. */
let pageSent: string | undefined

/** Sets (or clears) the session's backdrop for the active theme, and logs what the surface said. */
const syncPage = async ($: Dollar, force = false) => {
  const theme = await look($, 'desktop')
  const page = pageFor(theme, (await read($, appearance)) ?? 'dark')
  const key = JSON.stringify(page?.args ?? null)
  if (!force && key === pageSent) return
  pageSent = key
  const set = await $.ui.backdrop(page?.args).catch((error: unknown) => ({ isDrawn: false as const, reason: String(error) }))
  probe($, `backdrop ${theme?.id ?? 'none'} ${page?.args.id ?? 'cleared'}: ${JSON.stringify(set)}`)
  await update($, pageDrawn, () => (page === undefined ? null : set.isDrawn))
}

/** Whether the page backdrop already rains behind everything: then Claude's bubbles keep their mesh without rain. */
const pageRains = async ($: Dollar, theme: Look): Promise<boolean> =>
  (await read($, pageDrawn)) === true && pageFor(theme, (await read($, appearance)) ?? 'dark')?.rain === true

/** Opens the theme picker pane over a fresh list of ~/.claude/tinta/themes. */
const openPicker = async ($: Dollar) => {
  await listThemes($)
  await $.ui.open({ id: PANE, title: t(await read($, locale), 'pickerTitle') })
}

const toggleTheme = async ($: Dollar, want?: boolean) => {
  const off = await update($, isOff, value => (want === undefined ? !value : !want))
  showStatus($, off ? null : await read($, current))
  await syncPage($).catch(() => undefined)

  return off
}

/**
 * Whether Tinta is silent: always, unless the person turned sounds on
 * (preferenze.json "sounds": "on", off when absent, over every theme and
 * template); when on, the theme's `sounds.muted`.
 */
const isMuted = async ($: Dollar, theme: Theme | null): Promise<boolean> => ((await read($, prefs)) as Prefs).sounds !== 'on' || (theme?.sounds?.muted ?? false)

/** The band's ♪: turns the person's sounds preference over, written to preferenze.json with the rest kept. */
const toggleSounds = async ($: Dollar) => {
  const dir = await home($)
  if (dir === undefined) return
  const path = joinPath(dir, 'preferenze.json')
  let raw: { [key: string]: unknown } = {}
  try {
    const parsed = JSON.parse(await readText($, path)) as unknown
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) raw = parsed as { [key: string]: unknown }
  } catch {
    raw = {}
  }
  const next = raw.sounds === 'on' ? 'off' : 'on'
  await $.fs.write(path, `${JSON.stringify({ ...raw, sounds: next }, null, 2)}\n`).catch(() => undefined)
  await update($, prefs, value => ({ ...(value as Prefs), sounds: next }))
}

/** Plays the active theme's sound for `event`, unless muted or another copy draws. */
const sound = async ($: Dollar, event: SoundEvent) => {
  const theme = await active($)
  const name = theme?.sounds?.[event]
  if (typeof name !== 'string' || (await isMuted($, theme)) || !(await drawsHere($))) return
  await playSound($, name, theme?.sounds?.volume ?? VOLUME).catch(() => undefined)
}

/** Plays `name` from ~/.claude/tinta, its themes/, or the engine's own sounds/, at `volume`. */
const playSound = async ($: Dollar, name: string, volume = VOLUME) => {
  const dir = await home($)
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const mime = MIME[ext]
  if (mime === undefined) {
    return
  }
  const gain = Math.max(0, Math.min(1, volume))
  for (const path of dir === undefined ? [] : [joinPath(dir, name), joinPath(dir, 'themes', name)]) {
    if (await $.fs.exists(path).catch(() => false)) {
      const bytes = await $.fs.read(path, { as: 'bytes' })
      await $.audio.play({ base64: bytes.base64, mime }, { gain })

      return
    }
  }
  if (/^[\w-]+\.[a-z0-9]+$/i.test(name) && (await $.fs.exists(joinPath($.plugin.root, 'sounds', name)).catch(() => false))) {
    await $.audio.play({ asset: `sounds/${name}` }, { gain })
  }
}

/**
 * Whether the theme draws visible border lines (`style.borders: true`): off
 * by default, so bubbles, tables, system rows and chips keep their rounded
 * corners with a fully transparent edge and depth comes from fills and glow.
 */
export const linesOn = (theme: Look | null | undefined): boolean => theme?.style?.borders === true

/** Box props for a theme border, with the hover color when given; with `lines` off, the edge transparent (corners kept, no line, no hover line). */
const frame = (border: Border | undefined, lines: boolean) => {
  if (border === undefined || border.style === 'none') {
    return {}
  }
  if (!lines) return { borderStyle: border.style, borderColor: CLEAR }

  return {
    borderStyle: border.style,
    ...(border.color ? { borderColor: border.color } : {}),
    ...(border.hoverColor ? { hover: { borderColor: border.hoverColor } } : {}),
  }
}

/** The kinds of activity row, each with its drawn icon (svg.ts ACTIVITY_ICONS). */
export type ActivityKind = 'tool' | 'agent' | 'task' | 'command' | 'result' | 'search' | 'edit' | 'terminal' | 'web' | 'warning' | 'auto'
/** A kind's word before the app's text, where the app's own words do not say it. */
export const ACTIVITY_WORDS: { [kind in ActivityKind]?: 'wordTask' | 'wordCommand' | 'wordAuto' } = { task: 'wordTask', command: 'wordCommand', auto: 'wordAuto' }

/**
 * An activity row on desktop: tools, results, commands, background tasks and
 * agents' messages, told apart from Claude's words. A small chip, the kind's
 * line icon in the accent on a faint square of it, 8 px of room, a short word
 * where the app's text does not say the kind, then the row itself: the app's
 * drawing or Tinta's, untouched, so its clicks and expansion stay. Undefined
 * when the theme turns activity off or the surface has no Svg.
 */
const activityRow = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { [name: string]: any },
  theme: Look | null,
  kind: ActivityKind,
  body: unknown,
  mode: 'dark' | 'light' = 'dark',
  lang = 'en',
  pending?: Drawing,
  extra?: ActivityExtra,
): RenderElement | undefined => {
  const style = theme?.activity
  if (theme === null || style?.show === false || !('Svg' in els)) {
    return undefined
  }
  const row = activityInner(els, theme, kind, body, lang, pending, extra)

  return systemFrame(els, theme, mode, row)
}

/**
 * A system row's quiet frame: a rounded edge one step off the app's
 * background and a faint fill, a cell of room a side, in the flow at its
 * natural width (no size prop: the engine's row may be inside). Off with
 * `activity.background: false`. A fill can hide the selection's highlight.
 */
const systemFrame = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { [name: string]: any },
  theme: Look,
  mode: 'dark' | 'light',
  row: unknown,
): RenderElement => {
  // off unless the theme asks; then an edge only: a fill hid the selection
  if (theme.activity?.background !== true) return row as RenderElement
  const { Box } = els
  const edge = !linesOn(theme)
    ? CLEAR
    : mode === 'light' && theme.appearance === 'light'
      ? systemTone(theme.palette.accent, mode).edge
      : alphaEdge(theme.palette.accent ?? theme.palette.muted).replace(/..$/, '40')

  return (
    <Box key="tinta-system" flexDirection="column" borderStyle="round" borderColor={edge} paddingX={0} paddingY={0}>
      {row}
    </Box>
  )
}

/** A group's icon: its most frequent call's (the first on a tie). */
const groupIcon = (calls: readonly { tool: string }[]): ActivityKind => {
  const counts = new Map<string, number>()
  for (const call of calls) counts.set(iconForTool(call.tool), (counts.get(iconForTool(call.tool)) ?? 0) + 1)
  let best = 'tool'
  let most = 0
  for (const [icon, n] of counts) if (n > most) [best, most] = [icon, n]

  return best as ActivityKind
}

/** Whether a tool result has nothing to show: no output, or only empty fields. */
export const isEmptyOutput = (props: { output?: unknown; isErrored?: boolean }): boolean => {
  if (props.isErrored) return false
  const out = props.output
  if (out === undefined || out === null) return true
  if (typeof out === 'string') return out.trim() === ''
  if (typeof out === 'object') return Object.values(out as object).every(v => v === '' || v === null || v === undefined || v === false)

  return false
}

/** A running row's props as the app gets them when Tinta draws the dots: told it is not running, so it draws none. */
export const withoutAppDots = <P extends { isRunning?: boolean; isActive?: boolean }>(props: P): P => ({
  ...props,
  ...('isRunning' in props ? { isRunning: false } : {}),
  ...('isActive' in props ? { isActive: false } : {}),
})

/**
 * A running activity row's dots (svg.ts pendingDrawing) in the theme's
 * gradient (the assistant label's, else the accent), CHIP_TOP down as the
 * chip; undefined where the theme turns them off (`activity.pending: false`)
 * or activity rows are off.
 */
const pendingFor = async (
  $: Dollar,
  theme: Look | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { [name: string]: any },
): Promise<Drawing | undefined> => {
  if (theme === null || theme.activity?.show === false || theme.activity?.pending === false || !('Svg' in els)) return undefined
  const fill = theme.assistant?.labelFill ?? { solid: theme.palette.accent ?? theme.activity?.color ?? '#808080' }
  const now = await $.clock.now().catch(() => Date.now())

  return pendingDrawing([colorAt(fill, 0), colorAt(fill, 0.5), colorAt(fill, 1)], theme.motion !== false, now, CHIP_TOP)
}

/** The prompt origins the person typed themselves: only these wear "TU". */
const MINE = new Set<string>(['composer', 'bridge', 'sdk'])

/** Whether a transcript row is known to draw nothing now (folded away): left untouched. */
const isFolded = (props: { onScreen?: { of?: number } | null; text?: string }) =>
  // of 0 is a defence only (the API reports no such state); an empty text is real
  props.onScreen?.of === 0 || (typeof props.text === 'string' && props.text.trim() === '')

/** The appearance a surface draws in. */
const modeOn = async ($: Dollar, surface: Surface): Promise<'dark' | 'light'> => {
  const theme = await read($, current)

  return theme === null ? 'dark' : appearanceFor(theme, (await read($, appearance)) ?? undefined, surface)
}

const activityInner = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { [name: string]: any },
  theme: Look,
  kind: ActivityKind,
  body: unknown,
  lang = 'en',
  pending?: Drawing,
  extra?: ActivityExtra,
) => {
  const style = theme.activity
  const { Box, Svg, Text, Button } = els
  const accent = extra?.chip?.accent ?? (kind === 'warning' ? theme.palette.danger ?? '#E5484D' : theme.palette.accent ?? style?.color ?? theme.palette.muted ?? '#808080')
  const own = extra?.chip === undefined && (kind === 'tool' || kind === 'agent' || kind === 'task' || kind === 'command') ? style?.glyphs?.[kind] : undefined
  // CHIP_TOP px down, so its centre meets the first text line's
  const chip = chipDrawing(extra?.chip?.icon ?? kind, accent, own, CHIP_TOP)
  const scope = extra?.scope
  const wordKey = ACTIVITY_WORDS[kind]
  const word = wordKey ? t(lang, wordKey) : undefined

  return (
    <Box key="tinta-activity" flexDirection="row" alignItems="flex-start" {...(scope ? { hover: { scope } } : {})}>
      {/* with a scope (the rows that touched one file), hovering any lights every chip of the group */}
      <Box key="tinta-chip" flexShrink={0} {...(scope ? { hover: { scope, backgroundColor: withAlpha(accent, 0.3) } } : {})}>
        <Svg source={chip.source} alt={extra?.chip?.alt ?? word ?? kind} width={chip.width} height={chip.height} />
      </Box>
      {/* a running row: Tinta's dots in the theme's gradient, where the app's were */}
      {pending && (
        <Box key="tinta-pending" flexShrink={0}>
          <Svg source={pending.source} alt="…" width={pending.width} height={pending.height} />
        </Box>
      )}
      {/* beside the chip: an Edit or Write row's diffstat (reply.tsx diffstatDrawing), a task's duration, a list's progress */}
      {(extra?.beside ?? []).map(one => (
        <Box key={one.key} flexShrink={0}>
          <Svg source={one.drawing.source} alt={one.alt} width={one.drawing.width} height={one.drawing.height} />
        </Box>
      ))}
      {word && (
        <Box key="tinta-activity-word" flexShrink={0}>
          <Text color={style?.color ?? theme.palette.muted ?? accent}>{`${word} `}</Text>
        </Box>
      )}
      {/* no size or display prop here: the desktop refuses the engine's own row under one */}
      <Box flexDirection="column" flexGrow={1}>
        {body}
      </Box>
      {extra?.button && Button && (
        <Box key="tinta-row-button" flexShrink={0} paddingLeft={1}>
          <Button key={extra.button.key} label={extra.button.label} onPress={extra.button.onPress} />
        </Box>
      )}
    </Box>
  )
}

/** What an activity row carries besides its kind: drawings beside the chip, the chip's own icon and colour, a hover scope, a button at its end. */
type ActivityExtra = {
  beside?: { key: string; drawing: Drawing; alt: string }[]
  chip?: { icon: string; accent: string; alt?: string }
  scope?: string
  button?: { key: string; label: string; onPress: () => void }
}

type LabelArt = {
  labelFill?: NonNullable<Look['user']>['labelFill']
  labelChip?: NonNullable<Look['user']>['labelChip']
  labelGlow?: boolean
  labelGlass?: boolean
  labelBold?: boolean
  avatarFill?: NonNullable<Look['user']>['avatarFill']
  accent?: string
  avatar?: 'person' | 'person-outline' | 'initial' | 'claude' | 'spark' | 'drop' | 'orb' | 'none'
  avatarColor?: 'theme' | 'original'
  initial?: string
  /** A glass chip's hairline rim: only with the theme's `style.borders`. */
  labelRim?: boolean
  /** styleHints.user.labelChip "outline": the pill as a thin ring. */
  labelOutline?: { color: string; alpha: number; width: number }
}

/**
 * The avatar beside a label: the user's initial on a rounded square, Claude's
 * glyph in a circle, the sphere (the theme's `avatarFill`), or none.
 */
const avatarArt = (style: LabelArt): Drawing | undefined => {
  const accent = style.accent !== undefined ? { solid: style.accent } : undefined
  switch (style.avatar) {
    case 'none':
      return undefined
    case 'initial':
      return initialDrawing(style.initial ?? '?', style.labelChip ?? accent ?? { solid: '#808080' }, style.labelFill ?? { solid: '#FFFFFF' }, ORB)
    case 'person':
      return personDrawing(accent ?? style.labelChip ?? style.labelFill ?? { solid: '#808080' }, ORB)
    case 'person-outline':
      return personOutlineDrawing(accent ?? style.labelChip ?? style.labelFill ?? { solid: '#808080' }, ORB)
    case 'claude':
      return claudeDrawing(style.avatarColor === 'original' ? { solid: CLAUDE_TERRACOTTA } : style.labelFill ?? accent ?? { solid: '#FFFFFF' }, ORB)
    case 'spark':
      return sparkDrawing(style.labelFill ?? accent ?? { solid: '#FFFFFF' }, ORB)
    case 'drop':
      return glyphDrawing(style.avatar, style.labelFill ?? accent ?? { solid: '#FFFFFF' }, ORB)
    default: {
      const fill = style.avatarFill ?? (style.avatar === 'orb' ? accent : undefined)

      return fill ? orbDrawing(fill, ORB) : undefined
    }
  }
}

/** The SVG drawings of a label (gradient text, chip) and its avatar, desktop only. */
const labelArt = (style: LabelArt, label: string, motion: boolean): { text?: Drawing; orb?: Drawing } => ({
  text:
    style.labelFill || style.labelChip
      ? labelDrawing(label, {
          fill: style.labelFill ?? { solid: '#FFFFFF' },
          bold: style.labelBold,
          glow: style.labelGlow,
          chip: style.labelChip,
          glass: style.labelGlass,
          rim: style.labelRim === true,
          outline: style.labelOutline,
          // labels stay still: nothing loops in the transcript (only the band, while Claude works)
          animate: false,
          size: LABEL_SIZE,
          height: LABEL_HEIGHT,
        })
      : undefined,
  orb: avatarArt(style),
})

const textStyle = (color?: string, bold?: boolean) => ({
  ...(color ? { color } : {}),
  ...(bold ? { bold: true } : {}),
})

/**
 * A label row: avatar and name. On desktop both are one drawing on one
 * centre line, LABEL_HEIGHT px tall, LABEL_GAP px apart, with LABEL_SPACE px
 * of room baked in below (a Box margin is a whole row of the code font, far
 * coarser than the app's own spacing). The drawing has no room at its ends,
 * so a right-aligned label ends flush with the bubble's edge and a left one
 * starts flush with the reply's text. A theme's own avatar SVG is never put
 * inside our drawing: it sits beside it, top-aligned, at the same height.
 */
const labelRow = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { Box, Text, Svg }: { Box: any; Text: any; Svg?: any },
  style: LabelArt & { avatarSvg?: string; labelColor?: string },
  label: string,
  motion: boolean,
  box: { key?: string; justifyContent?: 'flex-start' | 'flex-end' } = {},
  meta?: { time: string; color: string; before?: boolean },
) => {
  const named =
    style.labelChip && 'solid' in style.labelChip ? (
      // a cell pill: the user's label on the accent, as on the desktop
      <Text color={style.labelFill && 'solid' in style.labelFill ? style.labelFill.solid : undefined} backgroundColor={style.labelChip.solid} bold>
        {` ${label} `}
      </Text>
    ) : (
      <Text {...textStyle(style.labelColor, style.labelBold)}>{label}</Text>
    )
  // the time, muted, after Claude's name and before the user's
  const plain = meta ? (
    <Text>
      {meta.before && <Text dimColor>{`${meta.time} · `}</Text>}
      {named}
      {!meta.before && <Text dimColor>{` · ${meta.time}`}</Text>}
    </Text>
  ) : (
    named
  )
  if (!Svg) {
    return (
      <Box {...box} flexDirection="row" gap={1} alignItems="center">
        {plain}
      </Box>
    )
  }

  const own = style.avatarSvg
  const drawn = labelArt(own ? { ...style, avatar: 'none' } : style, label, motion)
  // with a time the name is always drawn, in its fill or its plain colour, so both share one line
  // on desktop the name is always a drawing, time or not, so every label row has one height and one font
  const name =
    drawn.text ?? labelDrawing(label, { fill: { solid: style.labelColor ?? style.accent ?? '#808080' }, bold: style.labelBold, size: LABEL_SIZE, height: LABEL_HEIGHT })
  // the dot META_GAP px from the name's ink on either side (a glow's room aside)
  const timed =
    name && meta
      ? meta.before
        ? besideDrawing(metaDrawing(meta.time, meta.color, 'before'), name, 0)
        : besideDrawing(name, metaDrawing(meta.time, meta.color, 'after'), -(name.inset ?? 0))
      : name
  // Claude's: [avatar] name · time; the user's mirrors it: time · name [avatar]
  // the user's side mirrors Claude's: the avatar at the outer end, time or not
  const outerRight = meta?.before ?? box.justifyContent === 'flex-end'
  const joined =
    drawn.orb && timed
      ? outerRight
        ? besideDrawing(timed, drawn.orb)
        : besideDrawing(drawn.orb, timed)
      : drawn.orb
        ? besideDrawing(drawn.orb, spacerDrawing(0))
        : timed
  const art = joined && padBottom(joined, LABEL_SPACE)
  const room = spacerDrawing(LABEL_GAP)
  const alt = meta ? (meta.before ? `${meta.time} · ${label}` : `${label} · ${meta.time}`) : label

  return (
    <Box {...box} flexDirection="row" gap={0} alignItems="flex-start">
      {own && <Svg source={own} alt={label} width={ORB} height={ORB} />}
      {own && <Svg source={room.source} alt="avatar" width={room.width} height={room.height} />}
      {art && <Svg source={art.source} alt={name ? alt : 'avatar'} width={art.width} height={art.height} />}
      {!name && plain}
    </Box>
  )
}

/** Tinta's tables: the header's fill, the accent at this share over the bubble or the app's background. */
export const TABLE_HEAD_TINT = 0.18
/** Tinta's tables: every other body row this much lighter (dark) or darker (light). */
export const TABLE_ZEBRA = 0.04
/** Tinta's tables: the outer edge, the accent this faint (rounded corners need an edge). */
export const TABLE_EDGE = 0.22

/**
 * A reply's table drawn by Tinta on desktop, in the flow: a blank row above
 * and below it, a faint rounded edge, the header on a tint of the accent in
 * the accent, bold, body rows zebra-striped, every cell top-aligned with a
 * cell of padding a side and half a row above and below, numeric columns to
 * the right, **bold** and `code` kept. The fills are translucent, so they
 * suit either background; inside the table they may hide the selection's
 * highlight (accepted for tables).
 */
const tableArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { Box, Text }: { Box: any; Text: any },
  table: Extract<ReplyPart, { kind: 'table' }>,
  tone: { accent: string; line: string; text?: string; muted?: string; mode?: 'dark' | 'light'; lines?: boolean },
  room: number,
  key: string,
) => {
  // widths as shares of the bubble, so a narrow window never cuts the table
  const widths = columnWidths(table.header, table.rows, room)
  const total = widths.reduce((a, b) => a + b, 0) || 1
  const numeric = table.header.map((_, k) => table.rows.length > 0 && table.rows.every(r => (r[k] ?? '') === '' || NUMERIC.test(runsOf(r[k] ?? '').map(x => x.text).join('').trim())))
  const justify = (k: number) => (numeric[k] || table.align[k] === 'right' ? 'flex-end' : table.align[k] === 'center' ? 'center' : 'flex-start')
  const cell = (value: string, k: number, head: boolean) => (
    <Box key={`c${k}`} width={`${Math.max(1, Math.round((100 * (widths[k] as number)) / total))}%`} paddingX={1} paddingY={0.5} flexDirection="row" alignItems="flex-start" justifyContent={justify(k)} flexShrink={1}>
      <Text {...(head ? { color: tone.accent, bold: true } : tone.text ? { color: tone.text } : {})}>
        {runsOf(value).map((run, i) =>
          run.code ? (
            <Text key={`r${i}`} color={tone.accent}>
              {run.text}
            </Text>
          ) : run.bold ? (
            <Text key={`r${i}`} bold>
              {run.text}
            </Text>
          ) : (
            run.text
          ),
        )}
      </Text>
    </Box>
  )

  const zebra = withAlpha(tone.mode === 'light' ? '#000000' : '#FFFFFF', TABLE_ZEBRA)

  return (
    <Box key={key} flexDirection="column" marginTop={1} marginBottom={1} {...(tone.lines === true ? { borderStyle: 'round', borderColor: withAlpha(tone.accent, TABLE_EDGE) } : {})}>
      <Box key="h" flexDirection="row" alignItems="flex-start" backgroundColor={withAlpha(tone.accent, TABLE_HEAD_TINT)}>
        {table.header.map((h, k) => cell(h, k, true))}
      </Box>
      {table.rows.map((row, i) => (
        <Box key={`b${i}`} flexDirection="row" alignItems="flex-start" {...(i % 2 === 1 ? { backgroundColor: zebra } : {})}>
          {row.map((v, k) => cell(v, k, false))}
        </Box>
      ))}
    </Box>
  )
}

/**
 * The user's language, from the most trusted source the host gives: the
 * session's `language` setting, the macOS interface language, then the
 * locale variables; English when none names one.
 */
const detectLocale = async ($: Dollar) => {
  const rows = await $.config.list().catch(() => [])
  const setting = rows.find(row => row.key === 'language')?.value
  const homeDir = (await $.env.get('HOME').catch(() => undefined)) ?? ''
  // `defaults` is macOS only: never on Windows (where a Git Bash HOME is `/c/Users/...` anyway)
  const apple = !(await onWindows($)) && homeDir.startsWith('/Users/')
    ? await $.process
        .run(['defaults', 'read', '-g', 'AppleLanguages'], { timeoutMs: 3000 })
        .then(r => (r.exitCode === 0 ? firstAppleLanguage(r.stdout) : undefined))
        .catch(() => undefined)
    : undefined
  const found = pickLocale([
    typeof setting === 'string' ? setting : undefined,
    apple,
    await $.env.get('LC_ALL').catch(() => undefined),
    await $.env.get('LC_MESSAGES').catch(() => undefined),
    await $.env.get('LANG').catch(() => undefined),
    await $.env.get('LANGUAGE').catch(() => undefined),
  ])
  // the owner's call: every text in English, whatever the system's language (the detection kept for a later choice)
  // TINTA_LOCALE (a developer's or the suite's) still picks another language
  const forced = localeOf((await $.env.get('TINTA_LOCALE').catch(() => undefined)) ?? '')
  const shown = forced ?? (ENGLISH_ONLY ? 'en' : found)
  if ((await read($, locale)) !== shown) await update($, locale, () => shown)
}

/** A template style's name as shown: English (the id `sfumature` is shown as Gradient; ids never change). */
export const STYLE_LABELS: { [id: string]: string } = { sfumature: 'Gradient', solid: 'Solid', outline: 'Outline', minimal: 'Minimal' }
export const styleLabel = (id: string): string => STYLE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1)

/** Every text the engine and the themes show is English, whatever the system's language. */
export const ENGLISH_ONLY = true

/** A tracked task's start, stored once (a known id is kept). */
const startTask = async ($: Dollar, task: Task | undefined) => {
  if (task !== undefined) await update($, tasks, list => taskStarted(list as Task[], task))
}

/** A running task's end, stored once. */
const endTask = async ($: Dollar, id: string | undefined, status: 'done' | 'failed' | 'stopped' | undefined): Promise<boolean> => {
  if (id === undefined || status === undefined) return false
  const list = (await read($, tasks)) as Task[]
  if (!list.some(one => one.status === 'running' && (one.id === id || one.toolUseId === id))) return false
  const at = await $.clock.now().catch(() => Date.now())
  await update($, tasks, held => taskEnded(held as Task[], id, status, at))

  return true
}

/** Ends the tasks a row's task notifications report on. */
const endNotified = async ($: Dollar, text: string) => {
  for (const one of notificationsIn(text)) {
    const status = statusFrom(one.status)
    await endTask($, one.id, status)
    await endTask($, one.toolUseId, status)
  }
}

/** The text of a stored row: its string content or its text blocks. */
const rowText = (message: { content?: unknown }): string => {
  const content = message.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content.map(block => (block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string' ? (block as { text: string }).text : '')).join('\n')
}

/** Asks the engine to stop a background task (the TaskStop tool), then marks it stopped. */
const stopTask = async ($: Dollar, id: string) => {
  const ran = await $.tool.call({ tool: 'TaskStop', task_id: id } as never).catch(() => undefined)
  const r = ran as { deny?: string; isError?: boolean } | undefined
  if (r !== undefined && r.deny === undefined && r.isError !== true) await endTask($, id, 'stopped')
}

/** Opens the Attività pane: on its command or the band's button only. */
const openAttivita = async ($: Dollar) => {
  await $.ui.open({ id: ATTIVITA, title: t(await read($, locale), 'paneTitle') })
}

/** The chip icon of each task kind, the same set as the activity rows. */
const TASK_ICONS: { [kind in TaskKind]: string } = { agent: 'agent', shell: 'terminal', monitor: 'task', workflow: 'workflow' }

/** The glyph a kind or end shows where the surface draws no Svg. */
const TASK_GLYPHS: { [kind: string]: string } = { agent: '↳', terminal: '$', task: '◷', workflow: '⑂', done: '✓', failed: '✗', stopped: '■' }

/** The voice wave's colours: the theme's own, else Claude's gradient stops, then the accents. */
export const waveColors = (theme: Look, wave: true | { colors?: string[] }): string[] => {
  if (wave !== true && wave.colors && wave.colors.length > 0) return wave.colors
  const fill = theme.assistant?.labelFill
  const stops = fill && 'gradient' in fill ? fill.gradient.stops.map(stop => stop[0]) : fill && 'solid' in fill ? [fill.solid] : []
  const all = [...stops, theme.user?.accent, theme.assistant?.accent, theme.palette.accent].filter((one): one is string => typeof one === 'string' && /^#[0-9a-f]{6}$/i.test(one))

  return [...new Set(all.map(one => one.toUpperCase()))].slice(0, 4)
}

/** The spinner's word when the app gives none and the theme has none either. */
export const SPINNER_FALLBACK = 'Working'
/**
 * The theme's shortest spinner word of any mode, else `fallback` (the
 * engine's "Working" in the user's language): with only background work
 * running the row needs a word (empty, the app clips its pill) but the
 * shortest leaves the pill the most room.
 */
export const spinnerFallback = (words: { [mode: string]: string[] }, fallback = SPINNER_FALLBACK): string =>
  Object.values(words)
    .flat()
    .filter(one => one.trim() !== '')
    .reduce<string | undefined>((short, one) => (short === undefined || [...one].length < [...short].length ? one : short), undefined) ?? fallback

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await detectLocale($).catch(() => undefined)
    await $.command
      .register({
        name: 'tinta',
        description: t(await read($, locale), 'cmdTinta'),
        argumentHint: '[on|off|reload|themes]',
      })
      .catch(() => undefined)
    await $.command
      .register({ name: 'tinta-themes', description: t(await read($, locale), 'cmdThemes') })
      .catch(() => undefined)
    await $.command
      .register({ name: 'tinta-attivita', description: t(await read($, locale), 'cmdActivity') })
      .catch(() => undefined)
    // trying templates from the chat: a developer's only (themes are applied from the Tinta app)
    if (await isDev($)) {
      await $.command
        .register({ name: 'tinta-prova', description: t(await read($, locale), 'cmdProva'), argumentHint: '[palette] [minimal|outline|solid|sfumature] | avanti' })
        .catch(() => undefined)
    }
    const mine = await claim($).catch(() => true)
    if (mine) {
      await seed($).catch(() => undefined)
      await detectAppearance($).catch(() => undefined)
      await load($).catch(() => undefined)
      // the page behind the conversation: set again at every session start (it does not outlive one)
      await syncPage($, true).catch(() => undefined)
      await refreshSession($).catch(() => undefined)
      await listThemes($).catch(() => undefined)
      showStatus($, await active($))
    }
    let polls = 0
    $.clock.every(POLL_MS, () => {
      void (async () => {
        if (await claim($)) {
          await load($)
          // the backdrop as well (set only on a change): a reloaded engine sets it without waiting for a new session
          await syncPage($).catch(() => undefined)
          // the band's session figures and theme list, at most every SESSION_MS
          polls = (polls + 1) % Math.round(SESSION_MS / POLL_MS)
          if (polls === 0) {
            await refreshSession($)
            await listThemes($)
          }
        }
      })().catch(() => undefined)
    })
    // the turn timer: a redraw a second, only while a turn runs
    $.clock.every(TICK_MS, () => {
      void (async () => {
        if ((await read($, workStart)) !== null && (await drawsHere($))) {
          const at = await $.clock.now()
          await update($, now, () => at)
        }
      })().catch(() => undefined)
    })

    // the Attivita pane's clock: a redraw a second, only while a task runs;
    // every few ticks the agents' own statuses close what no event closed
    let ticks = 0
    $.clock.every(TICK_MS, () => {
      void (async () => {
        const list = (await read($, tasks)) as Task[]
        const running = list.filter(one => one.status === 'running')
        if (running.length === 0 || !(await drawsHere($))) return
        const at = await $.clock.now()
        await update($, tasksNow, () => at)
        ticks = (ticks + 1) % AGENT_CHECK_TICKS
        if (ticks === 0 && running.some(one => one.kind === 'agent')) {
          const agents = await $.agent.list().catch(() => [])
          for (const one of running.filter(task => task.kind === 'agent')) {
            const seen = agents.find(agent => agent.id === one.id)
            if (seen !== undefined) await endTask($, one.id, statusFrom(seen.status))
          }
        }
      })().catch(() => undefined)
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'tinta-attivita' }, async $ => {
    await openAttivita($)

    return { text: t(await read($, locale), 'replyActivity') }
  })

  // Background work: the calls that start it, the spawns, the stops
  for (const tool of BACKGROUND_TOOLS) {
    on('tool.call', { tool } as never, (async ($: Dollar, e: { tool_use_id?: string; [key: string]: unknown }, next: (e: unknown) => Promise<unknown>) => {
      const ran = (await next(e)) as { deny?: string; isError?: boolean; result?: unknown }
      try {
        if (ran.deny === undefined && ran.isError !== true) {
          const at = await $.clock.now().catch(() => Date.now())
          await startTask($, taskFromCall(tool, e, ran.result, at, e.tool_use_id))
        }
      } catch {
        // tracking never changes the call's result
      }

      return ran
    }) as never)
  }

  on('tool.call', { tool: 'TaskStop' }, async ($, e, next) => {
    const ran = await next(e)
    try {
      if (ran.deny === undefined && ran.isError !== true) {
        await endTask($, (ran.result as { task_id?: string } | undefined)?.task_id ?? e.task_id ?? e.shell_id, 'stopped')
      }
    } catch {
      // tracking never changes the call's result
    }

    return ran
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    try {
      if (e.background && spawned.deny === undefined && spawned.agentId !== undefined) {
        const at = await $.clock.now().catch(() => Date.now())
        await startTask($, { id: spawned.agentId, kind: 'agent', title: (e.description || e.subagentType || 'Agent').slice(0, 200), startedAt: at, endedAt: null, status: 'running', toolUseId: e.tool_use_id })
      }
    } catch {
      // tracking never changes the spawn
    }

    return spawned
  })

  // a task notification folded into a running turn, or any row that carries one
  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    try {
      if (e.agentId === undefined && (e.message.type === 'user' || e.message.type === 'assistant')) {
        const row = e.message as { id?: string; message?: { id?: string } }
        await stampRow($, [e.uuid, stored.uuid, row.id, row.message?.id])
        // Claude's colour cycle: each of its messages remembers the user turn it answers, its colour set's index
        if (e.message.type === 'assistant') {
          const order = await read($, turn)
          const ids = [e.uuid, stored.uuid, row.id, row.message?.id].filter((id): id is string => typeof id === 'string' && id !== '')
          await update($, replyOrder, held => {
            const kept = { ...(held as { [id: string]: number }) }
            for (const id of ids) if (kept[id] === undefined) kept[id] = order
            const keys = Object.keys(kept)

            return keys.length > STAMPS_MAX ? Object.fromEntries(keys.slice(-STAMPS_MAX).map(key => [key, kept[key] as number])) : kept
          })
        }
      }
      const text = rowText(e.message as { content?: unknown })
      if (text.includes('<task-notification>')) await endNotified($, text)
    } catch {
      // tracking never changes the row
    }

    return stored
  })

  // the session's figures, pushed: the band's health and the 80% / 90% alerts
  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    try {
      if (await drawsHere($)) {
        const figures = figuresOf(e)
        await storeFigures($, figures)
        await giveAlerts($, figures)
      }
    } catch {
      // the figures are the band's, never the session's
    }

    return result
  })

  // sounds for moments no other hook sees
  on('classic.PermissionRequest', async ($, e, next) => {
    void sound($, 'permissionRequest').catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  // experiment permissionNotice: a risk line under the permission dialog; a probe as well (the dialog opens after the
  // check, and a notice for a call not open is refused, so it is tried a few times and each try logged to debug)
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    try {
      const id = e.tool_use_id
      if (verdict.decision === 'ask' && id !== undefined && e.agentId === undefined && tries(await active($), 'permissionNotice')) {
        const line = riskTagline(e.tool, e.input, await read($, locale))
        if (line !== undefined) {
          for (const ms of NOTICE_TRIES_MS) {
            $.clock.after(ms, () => {
              try {
                $.ui.notice(id, line)
                probe($, `tinta notice ${id} at ${ms}ms: sent`)
              } catch (error) {
                probe($, `tinta notice ${id} at ${ms}ms: ${String(error)}`)
              }
            })
          }
        }
      }
    } catch {
      // the line never changes the verdict
    }

    return verdict
  }).catch(($, e, next) => next(e))

  // experiment toasts: an API error says how Claude Code classified it
  on('classic.StopFailure', async ($, e, next) => {
    try {
      if (tries(await active($), 'toasts')) $.ui.toast(t(await read($, locale), 'apiError', { category: String(e.error ?? t(await read($, locale), 'unknownCategory')) }))
    } catch {
      // a toast never changes the stop
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    void sound($, 'compaction').catch(() => undefined)
    // experiment toasts: how much the compaction saved
    try {
      if (e.agentId === undefined && result.skip === undefined && typeof result.tokensBefore === 'number' && typeof result.tokensAfter === 'number' && tries(await active($), 'toasts')) {
        $.ui.toast(t(await read($, locale), 'compacted', { before: tokensText(result.tokensBefore), after: tokensText(result.tokensAfter) }))
      }
    } catch {
      // a toast never changes the compaction
    }

    return result
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError === true && e.agentId === undefined) void sound($, 'toolError').catch(() => undefined)
    // experiment turnFooter: the turn's calls and written files
    try {
      if (ran.deny === undefined && e.agentId === undefined) {
        const file = writtenFile(e.tool, e.input)
        await update($, turnStats, held => {
          const one = held as TurnStats

          return { tools: one.tools + 1, files: file === undefined || one.files.includes(file) ? one.files : [...one.files, file].slice(-200) }
        })
      }
    } catch {
      // counting never changes the call
    }
    // experiment todos: the session's plan for the band's "3/7"
    try {
      if (ran.deny === undefined && ran.isError !== true && e.agentId === undefined && /^(TodoWrite|TaskCreate|TaskUpdate|TaskList)$/.test(e.tool)) {
        const held = (await read($, plan)) as PlanItem[]
        const after = planAfter(held, e.tool, e.input, ran.result)
        if (after !== undefined) await update($, plan, () => after)
      }
    } catch {
      // the band's count never changes the call
    }

    return ran
  })

  on('command.run', { command: 'tinta' }, async ($, e) => {
    const arg = (e.args ?? '').trim().toLowerCase()
    if (arg === 'reload') {
      await update($, source, () => '')
      await load($)
      const theme = await read($, current)

      return { text: theme ? t(await read($, locale), 'replyLoaded', { name: theme.name }) : t(await read($, locale), 'replyNoTheme') }
    }
    if (arg === 'themes') {
      await listThemes($)
      await $.ui.open({ id: PANE, title: t(await read($, locale), 'pickerTitle') })

      return { text: t(await read($, locale), 'replyList') }
    }
    const off = await toggleTheme($, arg === 'on' ? true : arg === 'off' ? false : undefined)

    return { text: t(await read($, locale), off ? 'replyOff' : 'replyOn') }
  })

  // /tinta-prova: the v2 templates, palette x style, applied in one go
  on('command.run', { command: 'tinta-prova' }, async ($, e) => {
    if (!(await isDev($))) return { text: '' }
    const lang = await read($, locale)
    const lists = { palettes: templatePalettes().join(', '), styles: TEMPLATE_STYLES.map(one => one.id).join(', ') }
    const args = (e.args ?? '').trim()
    if (args === '') return { text: t(lang, 'replyProva', lists) }
    const file = templateFor(args, (await read($, current))?.id)
    if (file === undefined) return { text: t(lang, 'replyProvaUnknown', { args, ...lists }) }
    await applyTemplate($, file)

    return { text: t(lang, 'replyProvaApplied', { name: (await read($, current))?.name ?? file }) }
  })

  on('command.run', { command: 'tinta-themes' }, async $ => {
    await openPicker($)

    return { text: t(await read($, locale), 'replyList') }
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    if (!('deny' in result && result.deny !== undefined)) {
      await update($, appearance, () => appearanceOf(e.value) ?? null).catch(() => undefined)
    }

    return result
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'task-notification') await endNotified($, e.text).catch(() => undefined)
    // the probe: who submits on this desktop and with what (the image cards' detection hangs on it)
    probe($, `tinta submit origin ${e.origin.kind} attachments ${(e.attachments ?? []).map(item => item.type).join(',') || 'none'}`)
    if (MINE.has(e.origin.kind) || (e.origin.kind as string) === 'user') {
      const key = promptKey(e.text)
      if ((e.attachments?.length ?? 0) > 0) remember(attached, key)
      if ((e.attachments ?? []).some(item => item.type === 'image')) remember(imaged, key)
    }
    await update($, turn, n => (n + 1) % 1_000_000)
    const at = await $.clock.now().catch(() => 0)
    // a prompt queued behind a running turn keeps the turn's start
    await update($, workStart, held => held ?? at)
    await update($, now, () => at)
    turnRunning = true

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    void sound($, 'turnStart').catch(() => undefined)
    turnRunning = true
    if ((await read($, workStart)) === null) {
      const at = await $.clock.now().catch(() => 0)
      await update($, workStart, () => at)
      await update($, now, () => at)
      await update($, turnStats, () => ({ tools: 0, files: [] }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) {
      turnRunning = false
      await update($, workStart, () => null).catch(() => undefined)
      await refreshSession($).catch(() => undefined)
      if (e.reason !== 'aborted') void sound($, e.reason === 'answer' ? 'turnComplete' : 'error').catch(() => undefined)
      // experiment turnFooter: one line closing the turn, as a dim transcript notice
      if (e.reason === 'answer' && tries(await active($), 'turnFooter')) {
        const lang = await read($, locale)
        const stats = (await read($, turnStats)) as TurnStats
        $.ui.log(footerText(e.durationMs, stats, { tools: n => (n === 1 ? t(lang, 'footerTool') : t(lang, 'footerTools', { n })), files: n => (n === 1 ? t(lang, 'footerFile') : t(lang, 'footerFiles', { n })) }))
      }
      // experiment toasts: a refusal says its category
      if (e.reason === 'refusal' && tries(await active($), 'toasts')) {
        const lang = await read($, locale)
        $.ui.toast(t(lang, 'refused', { category: e.refusal.category ?? t(lang, 'unknownCategory') }))
      }
    } else {
      // a background agent's run ended
      const status = e.reason === 'error' || e.reason === 'refusal' ? 'failed' : e.reason === 'aborted' ? 'stopped' : 'done'
      if ((await endTask($, e.agentId, status).catch(() => false)) && status === 'done') void sound($, 'agentDone').catch(() => undefined)
    }

    return result
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!(await drawsHere($))) {
      return next(e)
    }
    const theme = await look($, e.surface)
    const style = theme?.user
    const isMine = MINE.has(e.props.origin.kind) && !e.props.from
    if (!isMine && e.surface === 'desktop') {
      // a background task's notice, another agent's message, a scheduled or
      // relayed prompt: activity with a neutral word, never "TU"
      const origin = e.props.origin.kind
      const kind: ActivityKind = origin === 'task-notification' || origin === 'scheduled-trigger' ? 'task' : e.props.from || origin.startsWith('peer') ? 'agent' : 'auto'
      // a message from another agent keeps its chip with an empty text (the app draws its sender's line, "Messaggio da
      // subagente", in a group): every row of a group the same icon slot, its text in line with the others
      if (e.props.from ? e.props.onScreen?.of === 0 : isFolded(e.props)) return next(e)
      // experiment taskRows: a probe of which rows reach the hook (mid-turn notices?), then the notice's end as its chip
      const tryTask = tries(theme, 'taskRows')
      if (tryTask) $.ui.log(`tinta row origin ${origin}${e.props.task ? ` task ${e.props.task.status ?? '?'} ${e.props.task.durationMs ?? '?'}ms` : ''}`, { to: 'debug' })
      const end = tryTask && origin === 'task-notification' ? taskEnd(e.props.task?.status) : undefined
      if (end !== undefined && theme !== null) {
        const ink = end === 'done' ? theme.palette.success ?? '#3FB950' : end === 'failed' ? theme.palette.danger ?? '#E5484D' : theme.palette.muted ?? '#808080'
        const ms = e.props.task?.durationMs
        const cleaned = cleanTaskText(e.props.text)
        const body = await next(cleaned === e.props.text ? e : { ...e, props: { ...e.props, text: cleaned } })
        const extra: ActivityExtra = {
          chip: { icon: TASK_END_ICONS[end], accent: ink, alt: e.props.task?.status ?? end },
          beside: typeof ms === 'number' && ms >= 0 ? [{ key: 'tinta-task-time', drawing: pillDrawing(durationText(ms), theme.palette.muted ?? '#808080', CHIP_TOP), alt: durationText(ms) }] : [],
        }

        return activityRow($.ui.resolve(e), theme, kind, body, await modeOn($, e.surface), await read($, locale), undefined, extra) ?? body
      }
      const body = await next(e)

      return activityRow($.ui.resolve(e), theme, kind, body, await modeOn($, e.surface), await read($, locale)) ?? body
    }
    if (theme === null || style === undefined || !isMine) {
      return next(e)
    }

    const els = $.ui.resolve(e)
    const { Box, Text } = els
    const Svg = e.surface === 'desktop' && 'Svg' in els ? els.Svg : undefined

    // `align` is filled in per surface by lookFor: right on desktop, where the
    // app draws its own prompt bubble at the right edge of the column.
    const right = style.align === 'right'
    const initial = style.initial ?? (await userInitial($))
    const time = e.surface === 'desktop' && showsTime(theme) ? await timeOf($, e.requestId) : undefined
    const muted = await timeInk($, theme, style.accent ?? style.labelColor, e.surface)
    const meta = time ? { time, color: muted, before: true } : undefined
    const label =
      style.label &&
      labelRow({ Box, Text, Svg }, { ...style, initial, labelRim: linesOn(theme), labelOutline: labelOutlineOf(theme) }, style.label, theme.motion !== false, { key: 'tinta-label', justifyContent: right ? 'flex-end' : 'flex-start' }, meta)

    // On desktop the user's side mirrors Claude's: the row inside is the
    // app's own (its bubble at the right, a queued prompt's "Send now"),
    // untouched; above it, right-aligned, "10:42 · Tu" and the bust, the
    // bust's edge on the bubble's; right of both, in the flow, the accent
    // rule from the label row's top to the bubble's foot, stretched to the
    // row's own height (no estimate) and lifted by the app's action row,
    // the theme's gap from the bubble. Nothing placed over anything.
    if (e.surface === 'desktop') {
      // the vertical rule only where the theme asks for it
      const color = style.rule === true ? style.accent ?? style.border?.color ?? style.labelColor : undefined
      // the name as Claude's is drawn: same size and weight, in the user's accent, never a gradient
      const ink = style.accent ?? style.labelColor ?? theme.palette.accent ?? '#808080'
      const named = { ...style, initial, labelFill: { solid: ink }, labelChip: undefined, labelGlow: false, labelGlass: false, labelBold: theme.assistant?.labelBold ?? style.labelBold }
      const row = style.label
        ? labelRow({ Box, Text, Svg }, { ...named, labelRim: linesOn(theme), labelOutline: labelOutlineOf(theme) }, style.label.toLocaleUpperCase(await read($, locale)), theme.motion !== false, { key: 'tinta-label', justifyContent: 'flex-end' }, meta)
        : undefined
      const spec = { width: theme.rule?.width ?? RULE_WIDTH, gap: theme.rule?.gap ?? REPLY_RULE_GAP }
      const cap = { width: spec.width, gap: 0, opacity: theme.rule?.opacity }
      const head = Svg && color ? replyRuleDrawing({ solid: color }, RULE_CAP, cap, { top: true, bottom: false }) : undefined
      const foot = Svg && color ? replyRuleDrawing({ solid: color }, RULE_CAP, cap, { top: false, bottom: true }) : undefined
      const lift = Svg && color ? blankDrawing(spec.width, USER_FOOT + RULE_INSET) : undefined
      // stubMode glow: the app's row untouched (its words, selection, hover
      // actions), pulled up over a blurred shape in the user's fill larger
      // than its bubble; its translucent grey lets the colour through
      // stubMode twin-fill: the same, the fill sized by a twin of the app's bubble the layout measures
      // preferenze.json userBubble "app": the person's bubble as the app draws it (no glow, no fill, no bubble of
      // ours) in every theme; the label row stays the theme's
      const appBubble = ((await read($, prefs)) as Prefs).userBubble === 'app'
      const glowing = !appBubble && (style.stubMode === 'glow' || style.stubMode === 'twin-fill') && Svg !== undefined
      // render themed: the words drawn by Tinta in the theme's bubble, the app's
      // row below left a stub that still carries its hover actions
      const Markdown = 'Markdown' in els ? els.Markdown : undefined
      const themed =
        !glowing &&
        !appBubble &&
        Markdown !== undefined &&
        style.render === 'themed' &&
        !hasAttachments(e as never) &&
        !attached.has(promptKey(e.props.text)) &&
        shownText(e.props.text) !== '' &&
        e.props.text.length <= USER_TEXT_MAX
      // the edge in the user's own accent, as strong as Claude's bubble edge is in his
      const edge = await userEdge($, style.accent ?? style.labelColor ?? theme.palette.accent, e.surface)
      // stubMode hidden / segment (experimental, opt-in): the app's row first
      // (its stub and hover actions), our bubble after it, filled solid and
      // pulled up by the stub's height and the action row's, so it lies on the
      // stub (grown to our bubble's lines) and leaves the action row below it.
      // hidden: ours positioned, to paint over the stub. segment: the app paints
      // its row over ours, so the stub, blank by default, is kept as an empty
      // end-cap flush with our bubble's right edge, our text padded clear of it.
      // Only on a prompt the person typed (composer, sdk, bridge) with no
      // attachment. Otherwise the app's row stays below ours, in the flow:
      // nothing pulled over it, nothing filled.
      const hides = themed && (style.stubMode === 'hidden' || style.stubMode === 'segment') && hidesStub(e as never, attached.has(promptKey(e.props.text)))
      const segment = hides && style.stubMode === 'segment'
      const stub = stubText(style.stub ?? (segment ? 'blank' : undefined))
      // stub "same": the app's row keeps the real words, so its bubble is ours to
      // the line; ours then matches it exactly: the app's padding (BUBBLE_PAD,
      // measured on its bubble), no extra rows, no end-cap, the cover its height
      const same = hides && style.stub === 'same'
      const extraY = hides && !same ? USER_EXTRA_PAD_Y : 0
      // same: ours grown to the app's bubble (USER_TWIN_GROW): its right edge
      // stays the row's (pushed past it, its corners were cut), so it grows to
      // the left only; above and below it grows outward, pulled up by as much,
      // the margin below shrunk to keep the action row free
      const grow = same ? USER_TWIN_GROW : { x: 0, y: 0 }
      const padRight = segment && !same ? USER_SEGMENT_PAD : BUBBLE_PAD.x
      // as many stub lines as our bubble will have, so the stub is as tall as ours
      const columns = (e as { viewport?: { columns?: number } }).viewport?.columns ?? 100
      const lines = hides ? userLines(shownText(e.props.text), (same ? USER_TWIN_WIDTH * columns : columns) - (padRight - BUBBLE_PAD.x)) : 1
      // our extra padding above and below grown into the stub too, a blank line a row
      const stubLines = lines + 2 * extraY
      const own = themed ? (
        <Box key="tinta-user-own" flexDirection="row" justifyContent="flex-end" {...(hides ? { marginTop: USER_STUB_COVER(stubLines) - grow.y, marginBottom: USER_ACTION_ROWS - grow.y, ...(segment ? {} : { position: 'relative' }) } : {})}>
          {/* same: capped at the app's bubble width, so our words wrap where its do */}
          <Box key="tinta-user-cap" flexDirection="row" justifyContent="flex-end" flexShrink={1} {...(same ? { width: `${Math.round(USER_TWIN_WIDTH * 100)}%` } : {})}>
          <Box
            key="tinta-user-text"
            flexDirection="column"
            flexShrink={1}
            {...(hides ? { backgroundColor: same ? `${(style.accent ?? style.labelColor ?? theme.palette.accent)}D9` : await userFill($, style.accent ?? style.labelColor ?? theme.palette.accent, e.surface) } : {})}
            borderStyle={hides ? 'round' : style.border && style.border.style !== 'none' ? style.border.style : 'round'}
            borderColor={hides ? (same ? CLEAR : await userFill($, style.accent ?? style.labelColor ?? theme.palette.accent, e.surface)) : linesOn(theme) ? edge : CLEAR}
            {...(style.border?.hoverColor && linesOn(theme) ? { hover: { borderColor: style.border.hoverColor } } : {})}
            paddingLeft={BUBBLE_PAD.x + grow.x}
            paddingRight={padRight}
            paddingY={BUBBLE_PAD.y + extraY + grow.y}
          >
            {same ? (
              // same: the app's words show; ours only size the bubble, in the fill's colour
              <Text key="tinta-user-md" color="#00000000" wrap="wrap">
                {shownText(e.props.text)}
              </Text>
            ) : (
              <Markdown key="tinta-user-md" text={shownText(e.props.text)} />
            )}
          </Box>
          </Box>
        </Box>
      ) : undefined
      // experiment userBreaks: a glowing prompt that wraps gets our own line breaks in the row's text (the stored
      // message untouched), each line short of the room, so the app draws exactly our lines and the glow fits them
      // an image prompt (its card above the bubble) is told by the stored text's hash: decided before any rewrite,
      // and never given our breaks (its text, its hash and its bottom-anchored glow stay the app's)
      const imagePrompt = hasImage(e as never, promptKey(e.props.text)) || attached.has(promptKey(e.props.text))
      const broken = glowing && !themed && !imagePrompt && tries(theme, 'userBreaks') ? userBreaksFor(e.props.text, (e as { viewport?: { columns?: number } }).viewport?.columns ?? 100) : undefined
      if (broken !== undefined) probe($, `tinta breaks ${broken.split('\n').length} lines`)
      const body = themed ? await next({ ...e, props: { ...e.props, text: same ? e.props.text : hides ? userStubFor(stub, stubLines) : stub } }) : await next(broken === undefined ? e : { ...e, props: { ...e.props, text: broken } })
      const glow = glowing
        ? (() => {
            const words = shownText(broken ?? e.props.text)
            const glowColumns = (e as { viewport?: { columns?: number } }).viewport?.columns ?? 100
            const tint = style.accent ?? style.labelColor ?? theme.palette.accent
            const fill = style.glowFill ?? glowFillFor(tint && /^#[0-9a-f]{6}$/i.test(tint) ? tint : '#FFB547')
            // an image: the app draws it as a card of unknown height above the text bubble, so the glow is
            // anchored at the row's foot (the action row below the bubble is a known height)
            const withImage = imagePrompt
            // the bubble holds the words only: an [Image #n] placeholder is drawn as the card; no words, no bubble
            const text = words.replace(/\[Image\b[^\]]*#\d+[^\]]*\]\s*/gi, '').trim()
            if (text === '') return undefined
            const bubble = userBubbleSize(text, glowColumns, false)
            // a calibration probe: the row's columns and our estimate, to set against the owner's measured bubbles
            probe($, `tinta glow columns ${glowColumns} → ${bubble.width}x${bubble.height} (${bubble.lines} lines)`)
            const glowSpec = { fill, opacity: style.glowOpacity ?? USER_GLOW.opacity, blur: style.glowBlur ?? USER_GLOW.blur, overshoot: style.glowOvershoot ?? USER_GLOW.overshoot, offsetY: style.glowOffsetY ?? USER_GLOW.offsetY, offsetX: style.glowOffsetX ?? USER_GLOW.offsetX, widthScale: style.glowWidthScale ?? USER_GLOW.widthScale, anchor: withImage || GLOW_ANCHOR_BOTTOM ? ('bottom' as const) : ('top' as const), ...(style.glowMesh === true || theme.hints?.user?.mesh !== undefined ? { mesh: theme.hints?.user?.mesh?.colors ?? USER_MESH, meshBase: theme.hints?.user?.mesh?.base, meshBaseAlpha: theme.hints?.user?.mesh?.baseAlpha } : {}), ...glowHints(theme) }

            // twin-fill: a twin the layout sizes; an image prompt keeps the glow anchored at the row's foot
            if (style.stubMode === 'twin-fill' && !withImage) return userTwinArt({ Box, Svg, Text }, glowSpec, text, glowColumns, body)

            // experiment glowExactWidth: a wrapped prompt's bubble is at its widest, 85% of the row: our own 85% Box
            // clamps a wide drawing to exactly that (no column guess); blur, overshoot and offsets keep the plain glow
            if (bubble.full && !withImage && glowSpec.blur === 0 && glowSpec.overshoot === 0 && (glowSpec.offsetX ?? 0) === 0 && (glowSpec.widthScale ?? 1) === 1 && theme.experiments?.glowExactWidth === true) {
              return exactGlowArt({ Box, Svg }, glowSpec, bubble, body)
            }

            return userGlowArt({ Box, Svg }, glowSpec, bubble, body)
          })()
        : undefined

      return (
        <Box key="tinta-user" flexDirection="row" alignItems="stretch">
          {/* the gap as the column's own padding, in cells, as on Claude's side */}
          {/* no size prop here: the desktop refuses the engine's own row under one */}
          <Box key="tinta-user-body" flexDirection="column" flexGrow={1} gap={0} {...(head ? { paddingRight: Math.max(1, Math.round(spec.gap / 10)) } : {})}>
            {row}
            {glow ?? (hides ? body : own)}
            {glow ? undefined : hides ? own : body}
          </Box>
          {head && foot && lift && color && Svg && (
            <Box key="tinta-rule" flexDirection="column" alignItems="stretch" flexShrink={0}>
              <Svg source={head.source} alt="│" width={head.width} height={head.height} />
              <Box key="tinta-rule-body" flexGrow={1} backgroundColor={withAlpha(color, theme.rule?.opacity)} />
              <Svg source={foot.source} alt="│" width={foot.width} height={foot.height} />
              <Svg source={lift.source} alt="│" width={lift.width} height={lift.height} />
            </Box>
          )}
        </Box>
      )
    }

    const body = <Text {...textStyle(style.textColor)}>{e.props.text}</Text>
    const bubble = (
      <Box
        key="tinta-user"
        flexDirection="column"
        {...frame(style.border, linesOn(theme))}
        {...(style.background ? { backgroundColor: style.background } : {})}
        paddingX={style.paddingX ?? 0}
        paddingY={style.paddingY ?? 0}
        marginY={style.marginY ?? 0}
      >
        {label}
        {body}
      </Box>
    )

    return right ? (
      <Box flexDirection="row" justifyContent="flex-end">
        {bubble}
      </Box>
    ) : (
      bubble
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await drawsHere($))) {
      return next(e)
    }
    // the colour cycle: this reply's set, from its place in the conversation (stored at its append), else its id
    const plainTheme = await look($, e.surface)
    const id = e.requestId ?? ''
    const known = ORDERS.get(id)
    const looks = known === undefined && (MISSES.get(`o:${id}`) ?? 0) < LOOKS
    const stored = looks ? ((await read($, replyOrder)) as { [id: string]: number })[id] : undefined
    if (known === undefined && id !== '') {
      if (stored !== undefined) ORDERS.set(id, stored)
      else if (looks) MISSES.set(`o:${id}`, (MISSES.get(`o:${id}`) ?? 0) + 1)
    }
    const order = known ?? stored ?? (e.requestId ? Number.parseInt(hashOf(e.requestId), 36) : 0)
    const theme = plainTheme === null ? null : cycledLook(plainTheme, order)
    const style = theme?.assistant
    // an empty block draws nothing of ours; a long one keeps its label and bubble
    if (theme === null || style === undefined || e.props.text.trim() === '') {
      return next(e)
    }

    const els = $.ui.resolve(e)
    const { Box, Markdown, Text } = els
    const Svg = e.surface === 'desktop' && 'Svg' in els ? els.Svg : undefined
    const hasLabel = e.props.isFirstOfReply && style.label !== undefined
    const time = hasLabel && e.surface === 'desktop' && showsTime(theme) ? await timeOf($, e.requestId) : undefined
    const label =
      hasLabel && style.label !== undefined
        ? labelRow({ Box, Text, Svg }, { ...style, labelRim: linesOn(theme) }, e.surface === 'desktop' ? style.label.toLocaleUpperCase(await read($, locale)) : style.label, theme.motion !== false, {}, time ? { time, color: await timeInk($, theme, style.accent ?? style.labelColor, e.surface) } : undefined)
        : undefined
    const divider = Svg && e.props.isFirstOfReply && theme.divider?.show === true ? dividerDrawing(theme.divider.fill, Math.max(theme.divider.height, 2 * DIVIDER_ROOM + 2)) : undefined
    const dividerArt = Svg && divider && <Svg source={divider.source} alt="—" height={divider.height} />


    if (e.surface === 'desktop') {
      // On desktop the reply starts where the app's own rows start: no indent,
      // no border, no padding, one Markdown (the app's own spacing), the
      // engine's element, selectable. Left of it, in the flow, the rule: a
      // column stretched to the reply's own height, so no estimate: a rounded
      // cap in the start of the label's fill, the fill's middle colour as the
      // column's background, a rounded cap in its end; then the theme's gap,
      // label and text both shifted by it.
      // Nothing placed over anything.
      const paint = style.rule !== true ? undefined : style.labelFill ?? (style.accent ?? style.labelColor ? { solid: (style.accent ?? style.labelColor) as string } : undefined)
      const spec = { width: theme.rule?.width ?? RULE_WIDTH, gap: theme.rule?.gap ?? REPLY_RULE_GAP }
      const cap = { width: spec.width, gap: 0, opacity: theme.rule?.opacity }
      // tables drawn by Tinta when the theme asks; the rest stays the app's Markdown,
      // one element per stretch between tables, so its spacing stays native
      const columns = (e as { viewport?: { columns?: number } }).viewport?.columns ?? 100
      // past 10,000 characters the reply is one Markdown: no table cutting
      // headings and fenced code too, each behind its own switch (featureOn: on for Tinta unless turned off)
      const cuts = {
        tables: theme.markdown?.tables === 'tinta',
        headings: Svg !== undefined && featureOn(theme.markdown?.headings, theme),
        code: 'Code' in els && featureOn(theme.markdown?.code, theme),
      }
      const cut = (cuts.tables || cuts.headings || cuts.code) && e.props.text.length <= 10000 ? replyParts(e.props.text, cuts) : []
      const parts: ReplyPart[] = cut.some(part => part.kind !== 'markdown') ? cut : [{ kind: 'markdown', text: e.props.text }]
      const tableLook = {
        accent: style.accent ?? theme.palette.accent ?? '#D97757',
        line: theme.toolResult?.border?.color ?? theme.palette.accentSoft ?? theme.palette.muted ?? '#808080',
        muted: theme.palette.muted,
        mode: await modeOn($, e.surface),
        lines: linesOn(theme),
      }
      const head = Svg && paint ? replyRuleDrawing(sliceFill(paint, 0, 0.5), RULE_CAP, cap, { top: true, bottom: false }) : undefined
      // a bubble like the user's, unless the theme turns it off
      const bubble = style.bubble === false ? undefined : style.bubble
      const foot = Svg && paint ? replyRuleDrawing(sliceFill(paint, 0.5, 1), RULE_CAP, cap, { top: false, bottom: true }) : undefined
      // our own Markdown and tables, never the app's row; the bubble's fill in
      // the theme's fillMode (fills.tsx), the text itself never filled
      // the cells the reply's text has across, in its bubble or not
      const cells = Math.max(24, columns - 4 - (bubble ? 2 * (bubble.paddingX ?? BUBBLE_PAD.x) + 2 + glowWidth(bubble.glow) : 0))
      const headingInk = cuts.headings ? headingColors(theme) : []
      const codeTone = {
        accent: tableLook.accent,
        muted: theme.palette.muted,
        // Claude's side: never the user's warm colours; the middle dot the cool cyan
        dots: [theme.palette.danger, theme.id === 'tinta' ? CLAUDE_COOL : hueShift(theme.palette.accent ?? '#A970FF', -90), theme.palette.success].map(hex => hex ?? theme.palette.muted ?? '#808080'),
        lines: tableLook.lines,
      }
      // Fosforo Sfumature's prototype: the newest reply of the running turn, while its text still grows, decodes from
      // falling phosphor glyphs (fx-decode.ts); quiet for DECODE_QUIET_MS it swaps back to the app's Markdown
      const streaming = Svg && e.requestId && theme.id === 'fosforo-sfumature' && theme.experiments?.decodeReply !== false && theme.motion !== false ? await streamingNow($, e.requestId, e.props.text) : false
      let decodeArt: RenderElement | undefined
      if (streaming && Svg && e.props.text.length <= DECODE_MAX && parts.every(part => part.kind === 'markdown') && isPlainProse(e.props.text)) {
        // the app's own text, untouched, with the glyphs falling onto its newest letters laid over it (pulled up by
        // its own height): the letters never change size or place, so nothing jumps when the glyphs are gone
        const overlay = decodeOverlay(e.props.text, roomPx(cells), theme.palette.accent ?? '#39FF88')
        if (overlay) {
          decodeArt = (
            <Box key="tinta-decode" flexDirection="column">
              <Markdown key="tinta-md-0" text={e.props.text} />
              <Box key="tinta-select-stop-0" flexDirection="column" marginBottom={-2}>
                <Markdown key="tinta-stop-0" text={'\u200b'} />
              </Box>
              <Box key="tinta-decode-glyphs" flexDirection="row" marginTop={-Math.round((overlay.height / MARGIN_UNIT_PX) * 100) / 100}>
                <Svg source={overlay.source} alt="…" width={overlay.width} height={overlay.height} />
              </Box>
            </Box>
          )
        }
      }
      const headingNow = await $.clock.now().catch(() => Date.now())
      const body = decodeArt ? [decodeArt] : parts.map((part, i) => {
        if (part.kind === 'table') return tableArt({ Box, Text }, part, tableLook, cells, `tinta-table-${i}`)
        if (part.kind === 'heading') {
          const words = headingText(part.text)
          // a template's heading effect (fx-headings.ts): its own Svg, the ink's left edge on the text's
          const effect = theme.hints?.headings?.effect
          const fx = Svg && words !== '' && HEADING_EFFECTS.includes(effect as never) ? fxHeading({ text: words, level: part.level, width: roomPx(cells), colors: headingInk, effect: effect as (typeof HEADING_EFFECTS)[number], font: theme.hints?.headings?.font ?? displayKind(theme.typography?.display), motion: theme.motion !== false }) : undefined
          if (fx && Svg) {
            const rhythm = HEADING_RHYTHM[part.level] ?? { top: 1, bottom: 0.25 }

            // a level 2 heading keeps its thin underline fading right (as the plain headings), unless the template drops it
            const ink = headingInk.length >= 2 ? headingInk : [headingInk[0] ?? '#A970FF', headingInk[0] ?? '#A970FF']
            const ruleW = part.level === 2 && theme.hints?.headings?.rule !== false ? Math.round(Math.max(8, fx.width - 2 * fx.inset) * HEADING_RULE_SHARE) : 0
            const fade = ink.map((hex, k) => `<stop offset="${(k / (ink.length - 1)).toFixed(2)}" stop-color="${hex}" stop-opacity="${(0.8 * (1 - k / (ink.length - 1))).toFixed(2)}"/>`).join('')
            const rule = `<svg xmlns="http://www.w3.org/2000/svg" width="${ruleW}" height="2" viewBox="0 0 ${ruleW} 2"><defs><linearGradient id="hu" x1="0" y1="0" x2="1" y2="0">${fade}</linearGradient></defs><rect width="${ruleW}" height="1.5" rx="0.75" fill="url(#hu)"/></svg>`

            return (
              <Box key={`tinta-heading-${i}`} flexDirection="column" marginTop={Math.round(((i === 0 ? 0 : rhythm.top) - fx.top / MARGIN_UNIT_PX) * 100) / 100} marginBottom={ruleW > 0 ? rhythm.bottom : Math.round((rhythm.bottom - fx.top / MARGIN_UNIT_PX) * 100) / 100}>
                <Box key="tinta-heading-ink" flexDirection="row" marginLeft={-Math.round((fx.inset / CELL_PX) * 100) / 100}>
                  <Svg source={phaseLock(fx.source, headingNow, bornOf(`${e.requestId ?? ''}:${i}:${words}`, headingNow))} alt={words} width={fx.width} height={fx.height} />
                </Box>
                {ruleW > 0 && (
                  <Box key="tinta-heading-rule" flexDirection="row" marginTop={Math.round(((5 - fx.top) / MARGIN_UNIT_PX) * 100) / 100}>
                    <Svg source={rule} alt="—" width={ruleW} height={2} />
                  </Box>
                )}
              </Box>
            )
          }
          // one that does not fit two lines, or has nothing to draw, is the app's Markdown
          const art = Svg && words !== '' ? headingDrawing(words, part.level, headingInk, roomPx(cells - (head ? Math.max(1, Math.round(spec.gap / 10)) : 0)), theme.typography?.display) : undefined

          return art ? headingArt({ Box, Svg }, art, words, part.level, i === 0, `tinta-heading-${i}`) : <Markdown key={`tinta-md-${i}`} text={part.raw} />
        }
        if (part.kind === 'code') {
          const source = codeSource(part.source)

          return source.trim() === '' || source.length > CODE_MAX ? (
            <Markdown key={`tinta-md-${i}`} text={part.raw} />
          ) : (
            codeArt({ Box, Svg, Text, Code: els.Code }, { ...part, source }, codeTone, i === 0, `tinta-code-${i}`)
          )
        }

        // a zero-width paragraph right after the reply's text, pulled up by its own line: the desktop slots each Markdown
        // into our drawing, and a triple click on a leaf's last paragraph followed by anything of ours (a heading, the
        // drop shadow) selected from the leaf's top instead; with a paragraph of the leaf's own next to it, the
        // selection stays on the clicked one (headless Chrome, scenes/tc.mjs)
        return (
          <Box key={`tinta-md-box-${i}`} flexDirection="column">
            <Markdown key={`tinta-md-${i}`} text={part.text} />
            {Svg && (
              <Box key={`tinta-select-stop-${i}`} flexDirection="column" marginBottom={-2}>
                <Markdown key={`tinta-stop-${i}`} text={'\u200b'} />
              </Box>
            )}
          </Box>
        )
      })

      return (
        <Box key="tinta-assistant" flexDirection="column" {...(style.background ? { backgroundColor: style.background } : {})}>
          {dividerArt}
          <Box flexDirection="row" alignItems="stretch">
            {head && foot && paint && Svg && (
              <Box key="tinta-reply-rule" flexDirection="column" alignItems="stretch" flexShrink={0}>
                <Svg source={head.source} alt="│" width={head.width} height={head.height} />
                <Box key="tinta-reply-rule-body" flexGrow={1} backgroundColor={withAlpha(colorAt(paint, 0.5), theme.rule?.opacity)} />
                <Svg source={foot.source} alt="│" width={foot.width} height={foot.height} />
              </Box>
            )}
            {/* the gap as the column's own padding, in cells (about 8 px each): an
                image spacer collapsed on the desktop */}
            <Box key="tinta-reply" flexDirection="column" flexGrow={1} minWidth={0} {...(head ? { paddingLeft: Math.max(1, Math.round(spec.gap / 10)) } : {})}>
              {style.desktopLabel === false ? undefined : label}
              {/* the reply in its bubble, in the flow: our own Markdown and tables, never the app's row */}
              {bubble
                ? bubbleArt(
                    { Box, Svg },
                    {
                      mode: bubble.fillMode,
                      fill: bubble.fill,
                      fills: fillsFor(theme.hints?.bubble?.fill === 'none' ? undefined : theme.hints?.bubble?.fill ?? bubble.fill, style.accent ?? theme.palette.accent, tableLook.mode, theme.hints?.bubble?.fillAlpha),
                      ...(theme.hints?.bubble?.fill === 'none' ? { noFill: true } : {}),
                      ...(bubbleEdgeOf(theme, bubble.border) ? { edge: bubbleEdgeOf(theme, bubble.border) } : {}),
                      border: bubble.border,
                      paddingX: bubble.paddingX ?? BUBBLE_PAD.x,
                      paddingY: bubble.paddingY ?? BUBBLE_PAD.y,
                      glow: bubble.glow,
                      cells: columns - 4 - glowWidth(bubble.glow),
                      text: e.props.text,
                      mesh: { now: await $.clock.now().catch(() => Date.now()), colors: theme.hints?.bubble?.mesh ?? meshColors(theme, style.accent ?? theme.palette.accent), mode: tableLook.mode, strength: theme.hints?.bubble?.meshStrength, baseAlpha: theme.hints?.bubble?.meshBaseAlpha, highlight: (theme.hints?.bubble as { highlight?: string } | undefined)?.highlight, sparkle: (theme.hints?.bubble as { sparkle?: string } | undefined)?.sparkle, candy: (theme.hints?.bubble as { candy?: { from: string; to: string; alpha: number } } | undefined)?.candy, ...(backdropOf(theme) && !(await pageRains($, theme)) ? { backdrop: { ...(backdropOf(theme) as { kind: 'rain' | 'glass'; colors: string[]; alpha: number }), motion: theme.motion !== false, now: await $.clock.now().catch(() => Date.now()) } } : {}) },
                      halo: bubble.halo,
                      shadow: bubble.shadow,
                      accent: style.accent ?? theme.palette.accent,
                    },
                    body,
                  )
                : <Box key="tinta-bubble" flexDirection="column">{body}</Box>}
              {/* shadow "soft": a blurred Svg in the bubble's tint right after it, tucked onto its bottom padding */}
              {bubble?.shadow === 'soft'
                ? shadowArt({ Box, Svg }, fillsFor(bubble.fill, style.accent ?? theme.palette.accent, tableLook.mode).alpha.slice(0, 7), Math.max(24, columns - 4 - glowWidth(bubble.glow)))
                : undefined}
            </Box>
          </Box>
        </Box>
      )
    }

    return (
      <Box
        key="tinta-assistant"
        flexDirection="column"
        paddingLeft={style.indent ?? 0}
        {...frame(style.border, linesOn(theme))}
        {...(style.background ? { backgroundColor: style.background } : {})}
      >
        {label}
        <Markdown text={e.props.text} />
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await drawsHere($))) {
      return next(e)
    }
    const theme = await look($, e.surface)
    const style = theme?.tools
    const summary = describeCall(e.props.tool, e.props.input)
    const els = $.ui.resolve(e)
    const quiet = e.surface === 'desktop' && theme !== null && theme.activity?.show !== false
    // a row folded away draws nothing: no chip or frame of ours on it
    if (quiet && isFolded(e.props)) {
      return next(e)
    }
    // on desktop the app's own row always stays (its click, expansion, output,
    // error and running state), after the chip; a failed call's chip in danger
    if (quiet) {
      // running: the app's dots off (its row told it is not running), Tinta's in the theme's gradient
      const pending = e.props.isRunning && !e.props.isInterrupted ? await pendingFor($, theme, els) : undefined
      const body = await next(pending ? { ...e, props: withoutAppDots(e.props) } : e)
      const lang = await read($, locale)
      // a finished Edit or Write: its diffstat beside the chip, the app's row untouched
      const wantsStat = !e.props.isRunning && !e.props.isErrored && !e.props.isInterrupted && 'Svg' in els && theme !== null && featureOn(theme.activity?.diffstat, theme)
      const stat = wantsStat ? diffStatOf(e.props.tool, e.props.output, e.props.input) : undefined
      // a probe: what the desktop hands an Edit or Write row (the record, or the model's text)
      if (wantsStat && /^(Edit|Write|MultiEdit)$/.test(e.props.tool)) $.ui.log(`tinta diffstat ${e.props.tool} ${e.props.tool_use_id}: output ${typeof e.props.output === 'string' ? 'text' : e.props.output === undefined ? 'none' : `{${Object.keys(e.props.output as object).join(',')}}`} → ${stat ? diffText(stat) : 'none'}`, { to: 'debug' })
      const fresh = stat?.created ? t(lang, 'wordNew') : undefined
      // the blocks only (and "nuovo"): the app's row already says "+N" itself; the numbers stay in the alt
      const extra: ActivityExtra = stat ? { beside: [{ key: 'tinta-diffstat', drawing: diffstatDrawing(stat, diffColors(theme as Look), fresh, CHIP_TOP, false), alt: fresh ? `${diffText(stat)} · ${fresh}` : diffText(stat) }] } : {}

      // experiment hoverScope: every row that touched one file in one hover group, its chips lit together
      const path = (e.props.input as { file_path?: unknown; notebook_path?: unknown } | undefined)?.file_path ?? (e.props.input as { notebook_path?: unknown } | undefined)?.notebook_path
      if (typeof path === 'string' && path !== '' && /^(Read|Edit|Write|MultiEdit|NotebookEdit)$/.test(e.props.tool) && tries(theme, 'hoverScope')) extra.scope = fileScope(path)
      // experiment diffButton (a probe): "↗ diff" at the end of an Edit or Write row, asking the app's own MCP
      // server (ccd_view, show_pane) for its diff pane at that file; what it answers goes to the debug log
      if (typeof path === 'string' && path !== '' && /^(Edit|Write|MultiEdit)$/.test(e.props.tool) && !e.props.isRunning && !e.props.isErrored && 'Button' in els && tries(theme, 'diffButton')) {
        extra.button = { key: `tinta-diff-${e.props.tool_use_id}`, label: '↗ diff', onPress: () => void openDiff($, path) }
      }
      // experiment todos: TodoWrite as a checklist under its row, its progress as a ring beside the chip
      const list = e.props.tool === 'TodoWrite' && !e.props.isErrored && 'Svg' in els && tries(theme, 'todos') ? todosOf(e.props.input, e.props.output) : undefined
      if (list && list.now.length > 0 && theme !== null) {
        const done = list.now.filter(one => one.status === 'completed').length
        const accent = theme.palette.accent ?? '#A970FF'
        const ok = theme.palette.success ?? '#3FB950'
        const muted = theme.palette.muted ?? '#808080'
        extra.beside = [...(extra.beside ?? []), { key: 'tinta-todo-ring', drawing: ringDrawing(done, list.now.length, done === list.now.length ? ok : accent, withAlpha(muted, 0.3), CHIP_TOP), alt: `${done}/${list.now.length}` }]
        const row = activityRow(els, theme, iconForTool(e.props.tool) as ActivityKind, body, await modeOn($, e.surface), lang, pending, extra) ?? body
        const fresh = newlyDone(list.now, list.before)
        const { Box, Svg, Text } = els

        return (
          <Box key="tinta-todo-row" flexDirection="column">
            {row}
            {/* the items in line with the row's text: the chip's slot (24 px) as cells */}
            <Box key="tinta-todos" flexDirection="column" paddingLeft={Math.round((24 / CELL_PX) * 100) / 100}>
              {list.now.map((one, i) => {
                const box = checkboxDrawing(one.status, { done: ok, doing: accent, todo: muted })
                const lit = fresh.has(one.content)

                return (
                  <Box key={`todo-${i}`} flexDirection="row" alignItems="flex-start" {...(lit ? { backgroundColor: withAlpha(ok, 0.14) } : {})}>
                    <Svg source={box.source} alt={one.status === 'completed' ? '☑' : one.status === 'in_progress' ? '◐' : '☐'} width={box.width} height={box.height} />
                    <Text {...(one.status === 'completed' ? { dimColor: !lit, strikethrough: !lit, bold: lit } : one.status === 'in_progress' ? { color: accent, bold: true } : {})}>{one.content}</Text>
                  </Box>
                )
              })}
            </Box>
          </Box>
        )
      }

      return activityRow(els, theme, (e.props.isErrored ? 'warning' : iconForTool(e.props.tool)) as ActivityKind, body, await modeOn($, e.surface), lang, pending, extra) ?? body
    }
    if (theme === null || style === undefined || summary === undefined) {
      return next(e)
    }

    const { Box, Text } = els
    const own = style.perTool[e.props.tool]
    const icon = own?.icon ?? style.icon ?? '●'
    const iconColor = e.props.isErrored ? theme.palette.danger ?? own?.color ?? style.color : own?.color ?? style.color
    // on desktop a tool call is activity: the muted color, nothing bold, the icon dimmed
    const muted = theme.activity?.color ?? theme.palette.muted ?? style.color
    const row = (
      <Box flexDirection="row" gap={1}>
        {/* on desktop the wrench chip before the row is the mark */}
        {!quiet && (
          <Text {...textStyle(iconColor)} dimColor={e.props.isRunning}>
            {icon}
          </Text>
        )}
        <Text wrap="truncate-end">
          <Text {...(quiet ? textStyle(muted) : textStyle(style.nameColor, true))}>{e.props.tool}</Text>
          <Text {...textStyle(quiet ? muted : style.color)} dimColor={quiet}>{` ${summary}`}</Text>
          {e.props.isInterrupted && <Text dimColor>{' · Interrupted'}</Text>}
        </Text>
      </Box>
    )

    return (quiet && activityRow(els, theme, iconForTool(e.props.tool) as ActivityKind, row, await modeOn($, e.surface), await read($, locale))) || row
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!(await drawsHere($))) {
      return next(e)
    }
    const theme = await look($, e.surface)
    const style = theme?.tools
    const els = $.ui.resolve(e)
    const quiet = e.surface === 'desktop' && theme !== null && theme.activity?.show !== false
    probe($, `tinta group ${e.surface} ${e.props.calls.length} calls [${e.props.calls.map(call => call.tool).join(',')}] expanded ${e.props.isExpanded} active ${e.props.isActive}`)
    // expanded, each call is its own ToolUse row with its own chip: the group adds none
    // (one chip per row, never a double); folded away or empty, it is left alone
    if (e.props.isExpanded || e.props.calls.length === 0 || (quiet && isFolded(e.props))) {
      return next(e)
    }
    // on desktop the app's own group line always stays, after the chip
    if (quiet) {
      const pending = e.props.isActive ? await pendingFor($, theme, els) : undefined
      const body = await next(pending ? { ...e, props: withoutAppDots(e.props) } : e)

      return activityRow(els, theme, e.props.calls.some(call => call.isErrored) ? 'warning' : groupIcon(e.props.calls), body, await modeOn($, e.surface), await read($, locale), pending) ?? body
    }
    if (theme === null || style === undefined) {
      return next(e)
    }

    const { Box, Text } = els
    const counts = new Map<string, number>()
    for (const call of e.props.calls) {
      counts.set(call.tool, (counts.get(call.tool) ?? 0) + 1)
    }
    const hasError = e.props.calls.some(call => call.isErrored)
    const muted = theme.activity?.color ?? theme.palette.muted ?? style.color

    const row = (
      <Box flexDirection="row" gap={2}>
        {[...counts].map(([tool, count]) => {
          const own = style.perTool[tool]

          return (
            <Text key={`tool-${tool}`}>
              {/* on desktop the wrench chip is the row's mark: no dot per tool */}
              {!quiet && <Text {...textStyle(own?.color ?? style.color)}>{`${own?.icon ?? style.icon ?? '●'} `}</Text>}
              <Text {...(quiet ? textStyle(muted) : textStyle(style.nameColor, true))}>{tool}</Text>
              <Text {...textStyle(quiet ? muted : style.color)}>{count > 1 ? ` ×${count}` : ''}</Text>
            </Text>
          )
        })}
        {e.props.isActive && <Text dimColor>…</Text>}
        {hasError && theme.palette.danger && <Text color={theme.palette.danger}>!</Text>}
      </Box>
    )

    return (quiet && activityRow(els, theme, groupIcon(e.props.calls), row, await modeOn($, e.surface), await read($, locale))) || row
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!(await drawsHere($))) {
      return next(e)
    }
    const theme = await look($, e.surface)
    const style = theme?.toolResult
    const quiet = e.surface === 'desktop' && theme !== null && theme.activity?.show !== false
    if (style === undefined && !quiet) {
      return next(e)
    }
    // an empty result (no output, nothing printed) gets no chip
    if (quiet && (isEmptyOutput(e.props) || isFolded(e.props))) {
      return next(e)
    }

    const els = $.ui.resolve(e)
    const { Box } = els
    const engine = await next(e)
    if (quiet && theme !== null) {
      // on desktop a result sits inside its call's row (the app's expansion):
      // the chip and the app's text only, no frame or border of its own (a
      // theme that forces its fills keeps its result frame)
      const kept =
        style === undefined ? (
          engine
        ) : theme.forceBackground === true ? (
          <Box key="tinta-result" flexDirection="column" {...frame(style.border, linesOn(theme))} {...(style.background ? { backgroundColor: style.background } : {})}>
            {engine}
          </Box>
        ) : (
          <Box key="tinta-result" flexDirection="column">
            {engine}
          </Box>
        )

      return activityInner(els, theme, e.props.isErrored ? 'warning' : 'result', kept, await read($, locale))
    }
    const framed =
      style === undefined ? (
        engine
      ) : (
        <Box key="tinta-result" flexDirection="column" {...frame(style.border, linesOn(theme))} {...(style.background ? { backgroundColor: style.background } : {})}>
          {engine}
        </Box>
      )

    return framed
  }).catch(($, e, next) => next(e))

  // A slash command's output on desktop: activity, after the command chip.
  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    if (!(await drawsHere($)) || e.surface !== 'desktop') {
      return next(e)
    }
    const theme = await look($, e.surface)
    if (theme === null || theme.activity?.show === false || e.props.text.trim() === '') {
      return next(e)
    }
    const body = await next(e)

    return activityRow($.ui.resolve(e), theme, 'command', body, await modeOn($, e.surface), await read($, locale)) ?? body
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!(await drawsHere($))) {
      return next(e)
    }
    const drawn = await active($)
    if (drawn === null) {
      return next(e)
    }
    const style = drawn.spinner
    const lang = await read($, locale)
    // the row always carries a word: with none (only background work running)
    // the app clips its "N attività in esecuzione" pill
    const isBare = String(e.props.word ?? '').trim() === ''
    const list = (style?.words[e.props.mode] ?? []).filter(one => one.trim() !== '')
    const keepsStep = e.surface === 'desktop' && (style?.keepAppStepText ?? true) && !isBare && e.props.word !== 'Working'
    const picked = list.length > 0 && !keepsStep ? list[(await read($, turn)) % list.length] : undefined
    const word = picked ?? (isBare ? spinnerFallback(style?.words ?? {}, t(lang, 'working')) : undefined)
    const desktop = e.surface === 'desktop'
    // on desktop the app's own step text, time and caret stay; the theme's
    // suffix glyph read as noise after a real step, so the text goes bare
    const body = await next({
      ...e,
      props: {
        ...e.props,
        ...(word !== undefined ? { word } : {}),
        ...(desktop ? { suffix: '' } : style?.suffix !== undefined ? { suffix: style.suffix } : {}),
      },
    })
    const els = $.ui.resolve(e)
    const Svg = desktop && 'Svg' in els ? els.Svg : undefined
    const theme = Svg ? await look($, e.surface) : null
    if (!Svg || theme === null) {
      return body
    }
    // before the row, Claude's burst in the theme's gradient, turning while
    // the turn runs (still when the theme asks for no motion); with no spinner
    // section the burst is drawn all the same, like every system row's mark
    const assistant = theme.assistant
    const ink =
      assistant?.avatarColor === 'original'
        ? { solid: CLAUDE_TERRACOTTA }
        : assistant?.labelFill ?? (assistant?.accent ? { solid: assistant.accent } : theme.palette.accent ? { solid: theme.palette.accent } : { solid: CLAUDE_TERRACOTTA })
    const moves = theme.motion !== false && style?.mark !== 'still'
    // experiment spinnerModes: the burst's motion and hue per mode (esperimenti.tsx SPINNER_MODES)
    const perMode = tries(theme, 'spinnerModes') ? SPINNER_MODES[e.props.mode] : undefined
    const modeInk = perMode === undefined ? undefined : perMode.hue === 'cool' ? (theme.id === 'tinta' ? CLAUDE_COOL : hueShift(theme.palette.accent ?? '#A970FF', -90)) : perMode.hue === 0 ? undefined : hueShift(theme.palette.accent ?? '#A970FF', perMode.hue)
    // in the icon slot every non-prose row shares: the same x and room as the activity chips
    const mark = slotDrawing(
      perMode
        ? claudeDrawing(modeInk ? { solid: readableOnBoth(modeInk) ?? modeInk } : ink, SPINNER_MARK, moves ? perMode.motion : false, perMode.seconds)
        : claudeDrawing(ink, SPINNER_MARK, moves ? (style?.mark === 'pulse' ? 'pulse' : 'spin') : false),
    )
    // the voice wave, where the theme asks: in its colours, or Claude's gradient and the accents
    // the phase from the clock: a new word re-renders the row, the wave carries on where it was
    // none with only background work running: the app's pill takes the row
    // styleHints.wave.kind: the palette's own waiting motion (rain, curtain, scanline, ...), else the voice
    // Unicorno Sfumature's own: the hopping unicorn (the other Unicorno styles keep their sparkle)
    const kind = theme.id === 'unicorno-sfumature' ? 'comet' : theme.hints?.wave?.kind
    const waveInks = theme.hints?.wave?.colors ?? (style?.wave ? waveColors(theme, style.wave) : [])
    // drawn for the clock at 0, the same source on every render, as a frame (steadyFrame): the desktop keeps a frame
    // whose source is unchanged across its redraws, so the loops run on; an <img> was made again at each redraw (each
    // answer, each change of the host's ink) and started its animations over from a phase computed earlier
    const clockNow = 0
    const wave = isBare || (!style?.wave && kind === undefined) ? undefined : kind !== undefined && kind !== 'voice' ? waveKindDrawing(kind, waveInks, theme.motion !== false, clockNow, theme.hints?.wave?.strokeWidth) : style?.wave ? waveDrawing(waveColors(theme, style.wave), theme.motion !== false, clockNow) : undefined
    const { Box } = els

    // never framed: a box around it squeezed the app's row
    return (
      <Box key="tinta-spinner" flexDirection="row" alignItems="center" gap={0} flexGrow={1}>
        <Box key="tinta-spinner-mark" flexShrink={0}>
          <Svg source={steadyFrame(mark.source)} alt={perMode ? `✻ ${e.props.mode}` : '✻'} width={mark.width} height={mark.height} isInteractive />
        </Box>
        {wave && (
          <Box key="tinta-wave" flexShrink={0} paddingRight={1}>
            <Svg source={steadyFrame(wave.source)} alt={t(lang, 'waveAlt')} width={wave.width} height={wave.height} isInteractive />
          </Box>
        )}
        {/* the app's row in a box that takes the rest of the row and may shrink,
            so its "N attività in esecuzione" pill keeps its width (no minWidth:
            the desktop refuses a size prop over the engine's row) */}
        <Box key="tinta-spinner-body" flexDirection="row" flexGrow={1} flexShrink={1}>
          {body}
        </Box>
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!(await drawsHere($))) {
      return next(e)
    }
    const theme = await lookOn($, await read($, current), e.surface)
    const style = theme?.band
    // a survey holds the band: it always wins
    if (e.props.hasSurvey || theme === null || style === undefined || !style.show) {
      return next(e)
    }
    const off = await read($, isOff)
    if (off && !style.showToggle) {
      return next(e)
    }

    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    const Svg = e.surface === 'desktop' && 'Svg' in els ? els.Svg : undefined
    const lang = await read($, locale)
    // on desktop the band says the theme's plain name; band.text stays the terminal's
    const label = e.surface === 'desktop' ? theme.name : style.text ?? `◆ ${theme.name}`
    const toggle = style.showToggle && (
      <Button key="tinta-toggle" label={t(lang, off ? 'themeOn' : 'themeOff')} onPress={() => void toggleTheme($)} />
    )
    if (off) {
      // switched off: the name, quiet, and the way back on
      return (
        <Box key="tinta-band" flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Text dimColor>{label}</Text>
          {toggle}
        </Box>
      )
    }

    const Select = BAND_THEME_MENU && 'Select' in els ? els.Select : undefined
    // the template menus, desktop only, unless the theme turns its switcher off
    const SelectEl = (BAND_TEMPLATE_MENU || (await isDev($))) && e.surface === 'desktop' && 'Select' in els ? els.Select : undefined
    const menus = SelectEl && style.switcher !== false ? { now: templateOf(theme.id) } : undefined
    const list = style.switcher === false || !Select ? [] : await read($, themes)
    const picked = list.find(one => one.id === theme.id)?.file
    // 2. the quick switch: a dropdown of the themes by name, the active one picked: it says the name
    const dropdown = Select !== undefined && list.length >= 1 && picked !== undefined
    // 1. who: a small still dot in the theme's gradient, DOT_GAP px before the
    // name (the dropdown's, or the theme's own text without one); never moving
    const ink = style.titleFill ?? theme.assistant?.labelFill ?? { solid: style.color ?? theme.palette.accent ?? '#808080' }
    const dot = Svg ? dotDrawing(ink) : undefined
    // 3. the session: the context window's fill and the model, when the session tells them
    const info = await read($, sessionInfo)
    const context = style.context ?? 'bar'
    const percent = context !== 'off' ? info?.percent : undefined
    const meterFill = style.titleFill ?? theme.assistant?.labelFill ?? (theme.palette.accent ? { solid: theme.palette.accent } : undefined)
    const meter = Svg && context === 'bar' && percent !== undefined && meterFill ? meterDrawing(percent, meterFill, theme.palette.muted ?? '#808080') : undefined
    // 4. the turn's time while Claude works
    const began = await read($, workStart)
    const elapsed = style.timer !== false && e.props.isWorking && began !== null ? elapsedOf((await read($, now)) - began) : undefined
    // 5. the background work running: a small button to the Attivita pane, none at 0
    const busy = ((await read($, tasks)) as Task[]).filter(one => one.status === 'running').length
    const planned = tries(theme, 'todos') ? planCount((await read($, plan)) as PlanItem[]) : { done: 0, total: 0 }
    // 6. the session's health: rate-limit windows (never the cost), hot ones in the danger colour
    const health = healthParts(info, await $.clock.now().catch(() => Date.now()), lang)
    // the band's columns: the timer goes first, then the limits, as it narrows
    const room = (e.props as { bodyColumns?: number }).bodyColumns ?? 200
    const danger = theme.palette.danger ?? '#E5484D'
    // 7. the speaker, where the theme has sounds
    const raw = await read($, current)
    const hasSounds = SOUND_EVENTS.some(name => typeof raw?.sounds?.[name] === 'string')
    const silent = hasSounds ? await isMuted($, raw) : false

    // the desktop band, drawn: who (the burst and the name), the session's health in one cluster, the turn's time in
    // its fixed slot, then the buttons (background work, sounds, the theme off) grouped right; nothing moves as the
    // figures tick (fixed slots, tabular digits)
    if (Svg && !menus && !dropdown) {
      const tpl = templateOf(theme.id)
      const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
      const nameInk = readableOnBoth(style.color ?? theme.palette.accent ?? '#D0D0D0') ?? '#D0D0D0'
      const muted = theme.palette.muted ?? '#8A8A8A'
      const whoOf = (withStyle: boolean) => bandWhoDrawing(ink, tpl ? cap(tpl.palette) : theme.name, tpl && withStyle ? styleLabel(tpl.style) : undefined, tpl?.style === 'sfumature', nameInk, muted)
      const allLimits = (info?.limits ?? []).map(one => ({ label: limitName(one.kind, lang), percent: one.percent }))
      const healthOf = (withLimits: boolean, withContext: boolean) =>
        bandHealthDrawing({ percent: withContext ? percent : undefined, limits: withLimits ? allLimits : [], fill: meterFill ?? { solid: theme.palette.accent ?? '#808080' }, track: muted, muted, amber: theme.palette.warning ?? '#E5A50A', danger })
      const clockNow = await read($, now)
      const timerOf = () => bandTimerDrawing(e.props.isWorking && began !== null ? clockText(clockNow - began) : undefined, muted)
      // what fits the band's width (its columns at the code font's ~7.6 px), the native buttons' room set aside: the
      // style's name goes first, then the timer, the limits and the context, so the row never overlaps or wraps
      const buttonsPx = [busy > 0 ? `◷ ${busy}` : '', hasSounds ? `♪ ${t(lang, 'soundOff')}` : '', style.showToggle ? t(lang, 'themeOff') : ''].filter(Boolean).reduce((px, label) => px + label.length * 7.4 + 24, 0)
      const budget = room * 7.6 - buttonsPx - 40
      const steps = [
        [true, true, true, true],
        [false, true, true, true],
        [false, false, true, true],
        [false, false, false, true],
        [false, false, false, false],
      ] as const
      let who = whoOf(true)
      let health = healthOf(true, true)
      let clock: ReturnType<typeof timerOf> | undefined = style.timer !== false ? timerOf() : undefined
      for (const [withStyle, withTimer, withLimits, withContext] of steps) {
        who = whoOf(withStyle)
        health = healthOf(withLimits, withContext)
        clock = style.timer !== false && withTimer ? timerOf() : undefined
        if (who.width + (health?.width ?? 0) + (clock?.width ?? 0) <= budget) break
      }
      const limits = health && health.source.includes('<circle') ? allLimits : []
      const healthAlt = [percent !== undefined ? `${t(lang, 'context')} ${percent}%` : '', ...limits.map(one => `${one.label} ${one.percent}%`)].filter(Boolean).join(' · ')

      return (
        <Box key="tinta-band" flexDirection="row" justifyContent="space-between" alignItems="center" gap={1} {...(style.background ? { backgroundColor: style.background, paddingX: 1 } : {})}>
          <Box key="tinta-band-who" flexDirection="row" alignItems="center">
            <Svg source={who.source} alt={t(lang, 'themeAlt', { name: theme.name })} width={who.width} height={who.height} />
          </Box>
          <Box key="tinta-band-session" flexDirection="row" gap={2} alignItems="center" flexShrink={0}>
            {health && <Svg source={health.source} alt={healthAlt} width={health.width} height={health.height} />}
            {clock && <Svg source={clock.source} alt={elapsed ?? '—'} width={clock.width} height={clock.height} />}
            {planned.total > 0 && (
              <Text key="tinta-plan" {...(planned.done === planned.total && theme.palette.success ? { color: theme.palette.success } : { dimColor: true })}>{`☑ ${planned.done}/${planned.total}`}</Text>
            )}
            <Box key="tinta-band-buttons" flexDirection="row" gap={1} alignItems="center">
              {busy > 0 && <Button key="tinta-attivita" label={`◷ ${busy}`} onPress={() => void openAttivita($)} />}
              {hasSounds && <Button key="tinta-sound" label={`♪ ${t(lang, silent ? 'soundOff' : 'soundOn')}`} {...(silent ? { dimColor: true } : {})} onPress={() => void toggleSounds($)} />}
              {toggle}
            </Box>
          </Box>
        </Box>
      )
    }

    return (
      <Box
        key="tinta-band"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        {...(style.background ? { backgroundColor: style.background, paddingX: 1 } : {})}
      >
        <Box key="tinta-band-who" flexDirection="row" gap={1} alignItems="center">
          <Box key="tinta-band-name" flexDirection="row" gap={0} alignItems="center">
            {dot && Svg && <Svg source={dot.source} alt={t(lang, 'themeAlt', { name: theme.name })} width={dot.width} height={dot.height} />}
            {/* a template active: the menus say its palette and style, only the dot */}
            {!dropdown && !menus?.now && <Text {...textStyle(style.color)} wrap="truncate-end">{label}</Text>}
            {Select && dropdown && (
              <Select
                key="tinta-switch"
                options={list.map(one => ({ value: one.file, label: one.name }))}
                value={picked}
                onSelect={(file: string) => void (file === picked ? undefined : applyTheme($, file))}
              />
            )}
          </Box>
          {/* the template menus: palette and style, each applies at once */}
          {menus && SelectEl && (
            <Box key="tinta-band-templates" flexDirection="row" gap={1} alignItems="center">
              <SelectEl
                key="tinta-template-palette"
                options={templatePalettes().map(one => ({ value: one, label: one.charAt(0).toUpperCase() + one.slice(1) }))}
                {...(menus.now ? { value: menus.now.palette } : {})}
                onSelect={(palette: string) => void applyTemplate($, `${palette}-${menus.now?.style ?? 'solid'}.json`)}
              />
              <SelectEl
                key="tinta-template-style"
                options={TEMPLATE_STYLES.map(one => ({ value: one.id, label: styleLabel(one.id) }))}
                {...(menus.now ? { value: menus.now.style } : {})}
                onSelect={(style: string) => void applyTemplate($, `${menus.now?.palette ?? 'tinta'}-${style}.json`)}
              />
            </Box>
          )}
          {/* an active theme from outside the folder: the picker pane instead */}
          {Select && list.length >= 1 && picked === undefined && <Button key="tinta-switch" label={t(lang, 'themes')} onPress={() => void openPicker($)} />}
        </Box>
        {/* one row, never wrapped: each piece its own width, the lower ones dropped first on a narrow band */}
        <Box key="tinta-band-session" flexDirection="row" gap={1} alignItems="center" flexShrink={0} flexWrap="nowrap">
          {percent !== undefined && (
            <Box key="tinta-context" flexDirection="row" gap={1} alignItems="center">
              {meter && Svg && <Svg source={meter.source} alt={`${t(lang, 'context')} ${percent}%`} width={meter.width} height={meter.height} />}
              {percent > 85 ? (
                <Text color={danger}>{meter ? `${percent}%` : `${t(lang, 'context')} ${percent}%`}</Text>
              ) : (
                <Text dimColor>{meter ? `${percent}%` : `${t(lang, 'context')} ${percent}%`}</Text>
              )}
            </Box>
          )}
          {/* the limits on one line, "5h 57% · 7g 20%": one Text, never stacked */}
          {health.length > 0 && room >= BAND_ROOM.limits && (
            <Text key="tinta-limits" wrap="truncate-end">
              {health.map((part, i) => (
                <Text key={`tinta-${part.key}`} {...(part.isHot ? { color: danger } : { dimColor: true })}>
                  {`${i > 0 ? ' · ' : ''}${part.text}`}
                </Text>
              ))}
            </Text>
          )}
          {elapsed && room >= BAND_ROOM.timer && <Text key="tinta-timer" dimColor wrap="truncate-end">{elapsed}</Text>}
          {/* experiment todos: the plan's progress */}
          {planned.total > 0 && (
            <Text key="tinta-plan" {...(planned.done === planned.total && theme.palette.success ? { color: theme.palette.success } : { dimColor: true })}>{`☑ ${planned.done}/${planned.total}`}</Text>
          )}
          {busy > 0 && <Button key="tinta-attivita" label={`◷ ${busy}`} onPress={() => void openAttivita($)} />}
          {hasSounds && (
            <Button
              key="tinta-sound"
              label={silent ? `♪ ${t(lang, 'soundOff')}` : '♪'}
              {...(silent ? { dimColor: true } : {})}
              onPress={() => void toggleSounds($)}
            />
          )}
          {toggle}
        </Box>
      </Box>
    )
  }).catch(($, e, next) => next(e))

  // the page behind the whole conversation (the desktop alone draws it): only Tinta's own backdrop
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (!isOwnBackdrop(e.props as { plugin?: unknown; id?: unknown })) return next(e)
    const els = $.ui.resolve(e)
    const page = pageFor(await look($, e.surface), (await read($, appearance)) ?? 'dark')
    if (page === undefined || !('Svg' in els)) return next(e)
    const { Box, Svg } = els

    return (
      <Box key="tinta-page" backgroundColor={page.base}>
        <Svg source={phaseLock(page.source, await $.clock.now().catch(() => Date.now()))} alt={page.alt} width={1600} height={1000} />
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (!(await drawsHere($))) {
      return next(e)
    }
    const hint = (await active($))?.promptHint
    if (hint === undefined || e.props.isDraft || e.props.isWorking) {
      return next(e)
    }

    return next({ ...e, props: { ...e.props, hint } })
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (!(await drawsHere($))) {
      return next(e)
    }
    const label = modeLabelOf(await active($))
    if (label === undefined || e.props.modes.includes(label)) {
      return next(e)
    }

    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, label] } })
  }).catch(($, e, next) => next(e))

  // The Attivita pane: Tinta's own view of the background work, in the theme
  on('ui.render', { component: 'Pane', requestId: ATTIVITA }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    const Svg = e.surface === 'desktop' && 'Svg' in els ? els.Svg : undefined
    const theme = await lookOn($, await read($, current), e.surface)
    const accent = theme?.palette.accent ?? '#D97757'
    const muted = theme?.activity?.color ?? theme?.palette.muted ?? '#8A8A8A'
    const danger = theme?.palette.danger ?? '#E5484D'
    const success = theme?.palette.success ?? accent
    const list = (await read($, tasks)) as Task[]
    const running = list.filter(one => one.status === 'running').sort((a, b) => a.startedAt - b.startedAt)
    const done = list.filter(one => one.status !== 'running').sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    const open = await read($, tasksDoneOpen)
    const clock = running.length > 0 ? await read($, tasksNow) : 0
    const lang = await read($, locale)
    const KIND_WORDS: { [kind in TaskKind]: string } = { agent: t(lang, 'kindAgent'), shell: t(lang, 'kindShell'), monitor: t(lang, 'kindMonitor'), workflow: t(lang, 'kindWorkflow') }
    const END_WORDS = { done: t(lang, 'endDone'), failed: t(lang, 'endFailed'), stopped: t(lang, 'endStopped') } as const
    // the kind's chip, the same 18 px slot and line icons as the activity rows
    const chip = (kind: string, ink: string, alt: string) => {
      if (Svg) {
        const art = chipDrawing(kind, ink)

        return (
          <Box key="chip" flexShrink={0}>
            <Svg source={art.source} alt={alt} width={art.width} height={art.height} />
          </Box>
        )
      }

      return (
        <Box key="chip" flexShrink={0} width={2}>
          <Text color={ink}>{TASK_GLYPHS[kind] ?? '·'}</Text>
        </Box>
      )
    }
    const runningRow = (task: Task) => (
      <Box key={`run-${task.id}`} flexDirection="row" alignItems="center" gap={1}>
        {chip(TASK_ICONS[task.kind], accent, KIND_WORDS[task.kind])}
        <Box key="title" flexGrow={1} flexShrink={1} minWidth={0}>
          <Text wrap="truncate-end">{task.title}</Text>
        </Box>
        <Box key="time" flexShrink={0}>
          <Text color={muted}>{elapsedOf(Math.max(clock, task.startedAt) - task.startedAt)}</Text>
        </Box>
        <Button key={`stop-${task.id}`} label={t(lang, 'stop')} onPress={() => void stopTask($, task.id)} />
      </Box>
    )
    const doneRow = (task: Task) => {
      const ink = task.status === 'failed' ? danger : task.status === 'stopped' ? muted : success
      const kind = task.status === 'done' ? 'result' : task.status === 'failed' ? 'warning' : 'stopped'

      return (
        <Box key={`end-${task.id}`} flexDirection="row" alignItems="center" gap={1}>
          {chip(Svg ? kind : task.status, ink, END_WORDS[task.status as keyof typeof END_WORDS] ?? task.status)}
          <Box key="title" flexGrow={1} flexShrink={1} minWidth={0}>
            <Text wrap="truncate-end" color={muted}>{task.title}</Text>
          </Box>
          <Box key="time" flexShrink={0}>
            <Text color={muted}>{elapsedOf((task.endedAt ?? task.startedAt) - task.startedAt)}</Text>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box key="head" flexDirection="row" alignItems="center" gap={1}>
          <Text color={accent} bold>
            {t(lang, 'activity')}
          </Text>
          <Text color={muted}>{running.length > 0 ? t(lang, 'runningCount', { n: running.length }) : t(lang, 'noneRunning')}</Text>
        </Box>
        <Box key="running" flexDirection="column" gap={0}>
          <Text color={muted} bold>
            {t(lang, 'running')}
          </Text>
          {running.length === 0 && <Text color={muted}>{t(lang, 'nothingBackground')}</Text>}
          {running.map(runningRow)}
        </Box>
        <Box key="done" flexDirection="column" gap={0}>
          <Box key="done-head" flexDirection="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Button key="tinta-done-toggle" plain label={`${open ? '▾' : '▸'} ${t(lang, 'finished')} (${done.length})`} onPress={() => void update($, tasksDoneOpen, value => !value)} />
            {done.length > 0 &&  <Button key="tinta-done-clear" label={t(lang, 'clear')} onPress={() => void update($, tasks, held => clearDone(held as Task[]))} />}
          </Box>
          {open && done.map(doneRow)}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, themes)
    const theme = await lookOn($, await read($, current), e.surface)

    return (
      <Box flexDirection="column" gap={0}>
        {list.length === 0 && <Text dimColor>{t(await read($, locale), 'noThemes')}</Text>}
        {list.map(one => (
          <Box key={`theme-${one.file}`} flexDirection="row" gap={1}>
            <Text {...(theme?.id === one.id ? textStyle(theme.palette.accent, true) : { dimColor: true })}>
              {theme?.id === one.id ? '◆' : '◇'}
            </Text>
            <Button key={`apply-${one.file}`} label={one.name} onPress={() => void applyTheme($, one.file)} />
          </Box>
        ))}
      </Box>
    )
  })
}

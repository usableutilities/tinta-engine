/**
 * The session's health as the band shows it: the context window's fill, the
 * account's rate-limit windows (never the session's cost), from
 * `$.session.usage()` or a `session.measure` push; and the alerts given when
 * one crosses 80% or 90%. Pure functions; register.tsx draws and sounds them.
 */

import { t } from './i18n'

export type Limit = { kind: string; percent: number; resetsAt?: string }
export type Figures = { percent?: number; limits?: Limit[] }

/** Past this share a figure is drawn in the theme's danger colour. */
export const HOT = 85
/** From this share a window's reset time is shown. */
export const RESET_FROM = 70
/** The shares an alert is given at, once each per session. */
export const ALERTS = [80, 90] as const

const share = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined

/** The band's figures from what the session reports; a figure it lacks is left out. */
export const figuresOf = (usage: { context?: { percent?: number | null }; rateLimits?: readonly { kind: string; percentUsed: number; resetsAt?: string }[]; cost?: unknown } | undefined): Figures | null => {
  if (usage === undefined) return null
  const percent = share(usage.context?.percent ?? undefined)
  const limits = (usage.rateLimits ?? [])
    .map(one => ({ kind: one.kind, percent: share(one.percentUsed), ...(one.resetsAt ? { resetsAt: one.resetsAt } : {}) }))
    .filter((one): one is Limit => typeof one.kind === 'string' && one.percent !== undefined)
  const figures: Figures = {
    ...(percent !== undefined ? { percent: Math.min(100, percent) } : {}),
    ...(limits.length > 0 ? { limits } : {}),
  }

  return Object.keys(figures).length > 0 ? figures : null
}

/** A window's short name in `lang`: 5h, 7d (7g, 7j, 7T), or the gateway's word. */
export const limitName = (kind: string, lang = 'en'): string =>
  kind === 'five_hour' ? t(lang, 'limit5h') : kind === 'seven_day' ? t(lang, 'limit7d') : kind === 'spend_limit' ? t(lang, 'limitSpend') : kind.replace(/_/g, ' ')

/** When a window resets, local: "14:20" within a day, else "5/11". */
export const resetOf = (iso: string | undefined, now: number): string | undefined => {
  if (iso === undefined) return undefined
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return undefined
  const d = new Date(at)
  if (at - now < 24 * 3600 * 1000) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  return `${d.getDate()}/${d.getMonth() + 1}`
}

/** The band's health parts after the context: "5h 42%" (with "reset 14:20" from 70%); never the cost. */
export const healthParts = (figures: Figures | null, now: number, lang = 'en'): { key: string; text: string; isHot: boolean }[] => {
  if (figures === null) return []
  const parts = (figures.limits ?? []).map(one => {
    const reset = one.percent >= RESET_FROM ? resetOf(one.resetsAt, now) : undefined

    return { key: `limit-${one.kind}`, text: `${limitName(one.kind, lang)} ${one.percent}%${reset ? ` · ${t(lang, 'reset')} ${reset}` : ''}`, isHot: one.percent > HOT }
  })
  // the session cost is never shown: on a subscription it isn't billed and it only alarms

  return parts
}

/**
 * The alerts due: each unit (context, each window) past 80% or 90% not yet
 * alerted, the highest share only (a jump to 92% says 90, and marks 80 given).
 */
export const alertsDue = (figures: Figures | null, given: readonly string[], lang = 'en'): { keys: string[]; text: string }[] => {
  if (figures === null) return []
  const units = [
    ...(figures.percent !== undefined ? [{ unit: 'context', percent: figures.percent, name: '' }] : []),
    ...(figures.limits ?? []).map(one => ({ unit: one.kind, percent: one.percent, name: limitName(one.kind, lang) })),
  ]
  const due: { keys: string[]; text: string }[] = []
  for (const one of units) {
    const crossed = ALERTS.filter(at => one.percent >= at && !given.includes(`${one.unit}:${at}`))
    const top = crossed.at(-1)
    if (top !== undefined) {
      const text = one.unit === 'context' ? t(lang, 'alertContext', { pct: top }) : t(lang, 'alertLimit', { name: one.name, pct: top })
      due.push({ keys: crossed.map(at => `${one.unit}:${at}`), text })
    }
  }

  return due
}

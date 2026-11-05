/**
 * Attivita: the session's background work as Tinta tracks it (background
 * agents, shells, monitors, workflows), from the events a plugin sees. Pure
 * functions over the list kept in $.state (`tinta.tasks`); register.tsx hooks
 * the events and draws the pane.
 */

export type TaskKind = 'agent' | 'shell' | 'monitor' | 'workflow'
export type TaskStatus = 'running' | 'done' | 'failed' | 'stopped'
export type Task = {
  id: string
  kind: TaskKind
  title: string
  startedAt: number
  endedAt: number | null
  status: TaskStatus
  toolUseId?: string
}

/** Finished tasks kept; the oldest go first. */
export const DONE_MAX = 30
/** The longest title kept. */
const TITLE_MAX = 200

const titleOf = (text: unknown, fallback: string): string => {
  const line = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''

  return (line || fallback).slice(0, TITLE_MAX)
}

/** The list with `task` added (a known id is kept as it is), finished ones capped. */
export const taskStarted = (list: readonly Task[], task: Task): Task[] =>
  list.some(one => one.id === task.id) ? [...list] : capDone([...list, task])

/** The list with a running task ended in `status` at `at`; a finished or unknown one untouched. */
export const taskEnded = (list: readonly Task[], idOrToolUse: string, status: Exclude<TaskStatus, 'running'>, at: number): Task[] => {
  let changed = false
  const next = list.map(one => {
    if (one.status !== 'running' || (one.id !== idOrToolUse && one.toolUseId !== idOrToolUse)) return one
    changed = true

    return { ...one, status, endedAt: Math.max(at, one.startedAt) }
  })

  return changed ? capDone(next) : [...list]
}

/** Only the running tasks: "Svuota". */
export const clearDone = (list: readonly Task[]): Task[] => list.filter(one => one.status === 'running')

/** At most DONE_MAX finished tasks, the newest kept. */
const capDone = (list: Task[]): Task[] => {
  const done = list.filter(one => one.status !== 'running').sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
  if (done.length <= DONE_MAX) return list
  const dropped = new Set(done.slice(DONE_MAX).map(one => one.id))

  return list.filter(one => !dropped.has(one.id))
}

/** A task status from the engine's words (`completed`, `failed`, `killed`, ...); undefined while it runs. */
export const statusFrom = (word: string | undefined): Exclude<TaskStatus, 'running'> | undefined => {
  const w = (word ?? '').toLowerCase().trim()
  if (/^(completed?|done|success(ful)?|finished|exited)$/.test(w)) return 'done'
  if (/^(failed|failure|error(ed)?|timed?_?out|timeout)$/.test(w)) return 'failed'
  if (/^(killed|stopped|cancell?ed|aborted|interrupted)$/.test(w)) return 'stopped'

  return undefined
}

/** The task notifications a row's text carries: `{ id, toolUseId, status }` each. */
export const notificationsIn = (text: string): { id?: string; toolUseId?: string; status?: string }[] => {
  if (!text.includes('<task-notification>')) return []
  const found: { id?: string; toolUseId?: string; status?: string }[] = []
  for (const m of text.matchAll(/<task-notification>([\s\S]*?)<\/task-notification>/g)) {
    const body = m[1] ?? ''
    const tag = (name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(body)?.[1]?.trim()
    found.push({ id: tag('task-id'), toolUseId: tag('tool-use-id'), status: tag('status') })
  }

  return found
}

/**
 * The background task a finished tool call started, or undefined: an Agent
 * launched in the background, a Bash command in the background (asked, or
 * moved there with ctrl+b), a Monitor, a Workflow.
 */
export const taskFromCall = (
  tool: string,
  input: { [key: string]: unknown },
  result: unknown,
  at: number,
  toolUseId?: string,
): Task | undefined => {
  const r = (typeof result === 'object' && result !== null ? result : {}) as { [key: string]: unknown }
  const base = { startedAt: at, endedAt: null, status: 'running' as const, ...(toolUseId ? { toolUseId } : {}) }
  const id = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)
  switch (tool) {
    case 'Agent':
    case 'Task': {
      const agentId = id(r.agentId)
      if (r.status !== 'async_launched' || agentId === undefined) return undefined

      return { ...base, id: agentId, kind: 'agent', title: titleOf(r.description ?? input.description, 'Agent') }
    }
    case 'Bash': {
      const taskId = id(r.backgroundTaskId)
      if (taskId === undefined) return undefined

      return { ...base, id: taskId, kind: 'shell', title: titleOf(input.description ?? input.command, 'Bash') }
    }
    case 'Monitor': {
      const taskId = id(r.taskId)
      if (taskId === undefined) return undefined

      return { ...base, id: taskId, kind: 'monitor', title: titleOf(input.description ?? input.command, 'Monitor') }
    }
    case 'Workflow': {
      const taskId = id(r.taskId)
      if (taskId === undefined) return undefined

      return { ...base, id: taskId, kind: 'workflow', title: titleOf(r.workflowName ?? input.name ?? r.summary, 'Workflow') }
    }
    default:
      return undefined
  }
}

/** A finished task's run, short: "12s", "2m 05s", "1h 02m". */
export const spanOf = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`

  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`
}

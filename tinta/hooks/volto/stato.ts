import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Face, Mood } from './tipi'

/** I valori del volto, condivisi tra i moduli. */
const face = atom({ plugin: 'tinta', key: 'voltoFace' } as const, { mood: 'idle', prev: 'idle' } as Face, { shape: 'face-1' })

export const RELAX_MS = 4500

// l'umore gia' scritto, per non riscrivere lo stesso a ogni pezzo dello stream
let shown: Mood | undefined
let relax: { cancel: () => void } | undefined

export const shownMood = () => shown

// chi vuole sapere ogni cambio d'umore (il registro della voce)
let moodLog: ((mood: Mood) => void) | undefined
export const onMood = (fn: (mood: Mood) => void) => {
  moodLog = fn
}

export async function setMood($: EngineInterface, mood: Mood) {
  relax?.cancel()
  relax = undefined
  if (shown === mood) return
  shown = mood
  moodLog?.(mood)
  await update($, face, f => (f.mood === mood ? f : { mood, prev: f.mood })).catch(() => undefined)
}

/** Un umore che dopo `ms` torna a riposo, se nel frattempo non e' cambiato. */
export async function moodThenIdle($: EngineInterface, mood: Mood, ms: number) {
  await setMood($, mood)
  relax = $.clock.after(ms, () => void setMood($, 'idle'))
}

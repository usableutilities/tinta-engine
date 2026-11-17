/**
 * Tinta Pro per il volto: la stessa prova dei modelli a pagamento sigillati (sigillo.ts, entitledPalettes),
 * un modello a pagamento in themes/ sigillato per questa installazione (l'app scrive solo quelli sbloccati).
 * La sessione di chi sviluppa (TINTA_DEV=1) lo ha sempre.
 */
import { atom, read } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { entitledPalettes, machineId, onWindows, sealHome, sealHomeFrom, secretFrom } from '../sigillo'
import { joinPath, tintaDir } from '../theme'

// lo stesso valore di register.tsx: la copia del motore che disegna (claim)
const owner = atom({ plugin: 'tinta', key: 'owner' } as const, null)

/** Tinta Pro su questa installazione. */
export async function isPro($: EngineInterface): Promise<boolean> {
  if ((await $.env.get('TINTA_DEV').catch(() => undefined)) === '1') return true
  const windows = await onWindows($)
  const home = sealHomeFrom(
    {
      HOME: await $.env.get('HOME').catch(() => undefined),
      USERPROFILE: await $.env.get('USERPROFILE').catch(() => undefined),
      HOMEDRIVE: await $.env.get('HOMEDRIVE').catch(() => undefined),
      HOMEPATH: await $.env.get('HOMEPATH').catch(() => undefined),
    },
    windows,
  )
  const dir = tintaDir(home)
  if (home === undefined || dir === undefined) return false

  // il sigillo di questa installazione, come lo legge register.tsx (sealOf)
  const text = await $.fs.read(joinPath(dir, '.sigillo')).catch(() => undefined)
  const secret = typeof text === 'string' ? secretFrom(text) : null
  if (secret === null) return false

  return (await entitledPalettes($, dir, { secret, home: sealHome(home), machine: await machineId($) })).size > 0
}

/** Questa copia del motore disegna (register.tsx, drawsHere): solo lei ha il volto. */
export async function drawsHere($: EngineInterface): Promise<boolean> {
  const held = await read($, owner).catch(() => null)

  return held === null || held.root === $.plugin.root
}

/**
 * Quando il volto (e la sua voce) c'e': solo con Tinta Pro, solo nella copia del motore che disegna, e mai
 * mentre il vecchio plugin a parte (volto@…) e' ancora acceso, altrimenti il volto girerebbe due volte.
 *
 * Senza Pro ogni hook del volto passa dritto al successivo: nessun comando, nessun pulsante, nessun file
 * scritto, nessuna sezione nel prompt (nessun token in piu').
 */

/** La variabile che forza il volto: "0" sempre spento, "1" acceso anche con il vecchio plugin (serve sempre Pro). */
export const VOLTO_ENV = 'TINTA_VOLTO'

/** Il vecchio plugin a parte (volto@<marketplace>) e' acceso in queste impostazioni (settings.json). */
export const legacyVoltoIn = (settings: string): boolean => {
  try {
    const parsed = JSON.parse(settings) as { enabledPlugins?: unknown }
    const enabled = parsed.enabledPlugins
    if (typeof enabled !== 'object' || enabled === null) return false

    return Object.entries(enabled as { [id: string]: unknown }).some(([id, on]) => /^volto@/.test(id) && on === true)
  } catch {
    return false
  }
}

/** Le condizioni del volto in questa sessione. */
export type Gate = {
  /** Tinta Pro: lo stesso diritto dei modelli sigillati (sigillo.ts, entitledPalettes). */
  pro: boolean
  /** Questa copia del motore disegna (register.tsx, claim). */
  draws: boolean
  /** Il vecchio plugin a parte e' acceso. */
  legacy: boolean
  /** TINTA_VOLTO. */
  override?: string
}

/** Se il volto c'e'. */
export const voltoOn = (g: Gate): boolean => {
  if (g.override === '0') return false
  if (!g.pro || !g.draws) return false

  return g.override === '1' || !g.legacy
}

/** Perche' il volto non c'e' (per il registro di prova), o undefined se c'e'. */
export const whyOff = (g: Gate): string | undefined =>
  voltoOn(g) ? undefined : g.override === '0' ? `${VOLTO_ENV}=0` : !g.pro ? 'senza Tinta Pro' : !g.draws ? "disegna l'altra copia del motore" : 'il vecchio plugin volto e\' ancora acceso'

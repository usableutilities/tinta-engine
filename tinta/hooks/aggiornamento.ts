/**
 * Gli aggiornamenti del motore (docs/AGGIORNAMENTI.md): nessun comando da dare, mai.
 *
 * L'ospite dei plugin carica la versione installata all'avvio di ogni sessione nuova. Una sessione gia' aperta
 * resta sulla sua: quando la versione installata (plugins/installed_plugins.json) diventa piu' nuova di
 * quella che gira, il motore lo dice una volta sola, con discrezione: "apri una nuova sessione".
 * Solo la copia installata (la cache dei plugin) lo dice; la copia di sviluppo e i test no.
 */
/** L'id del motore installato: "<plugin>@<marketplace>". */
export const ENGINE_ID = 'tinta@tinta'
/** Ogni quanto si guarda se e' arrivata una versione nuova. */
export const UPDATE_POLL_MS = 5 * 60_000
/** Quanto resta l'avviso. */
export const NOTICE_MS = 10_000

/** Le parti numeriche di una versione ("0.3.99" -> [0, 3, 99]); undefined se non e' una versione. */
export const versionParts = (v: string | undefined): number[] | undefined => {
  const m = /^\s*v?(\d+(?:\.\d+)*)/.exec(v ?? '')

  return m ? (m[1] as string).split('.').map(Number) : undefined
}

/** Se `a` e' piu' nuova di `b` (0.4.0 > 0.3.99); false se una delle due non si legge. */
export const isNewer = (a: string | undefined, b: string | undefined): boolean => {
  const x = versionParts(a)
  const y = versionParts(b)
  if (!x || !y) return false
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0
  }

  return false
}

/** La versione di plugin.json. */
export const manifestVersion = (text: string): string | undefined => {
  try {
    const v = (JSON.parse(text) as { version?: unknown }).version

    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

/** La versione del motore installata adesso (installed_plugins.json, la voce dell'utente prima), o undefined. */
export const installedVersion = (text: string, id = ENGINE_ID): string | undefined => {
  try {
    const all = (JSON.parse(text) as { plugins?: { [id: string]: unknown } }).plugins?.[id]
    const list = Array.isArray(all) ? (all as { scope?: unknown; version?: unknown }[]) : []
    const pick = list.find(one => one.scope === 'user') ?? list[0]

    return typeof pick?.version === 'string' ? pick.version : undefined
  } catch {
    return undefined
  }
}

/** Il testo da mostrare, se c'e' da mostrarlo: la versione installata e' piu' nuova di questa e non e' gia' stata detta. */
export const noticeFor = (running: string | undefined, installed: string | undefined, told: string | undefined): string | undefined =>
  installed !== undefined && installed !== told && isNewer(installed, running) ? installed : undefined

/**
 * Il controllo di una sessione: `running` la versione che gira, `installed` legge installed_plugins.json,
 * `say` mostra l'avviso (una riga breve, una volta per versione). Lo chiama register.tsx all'avvio e ogni
 * UPDATE_POLL_MS, solo nella copia installata.
 */
export const updateWatcher = (opts: { running: string | undefined; installed: () => Promise<string>; say: (version: string) => void | Promise<void> }) => {
  let told: string | undefined

  return async () => {
    if (opts.running === undefined) return
    const version = noticeFor(opts.running, installedVersion(await opts.installed().catch(() => '')), told)
    if (version === undefined) return
    told = version
    await opts.say(version)
  }
}

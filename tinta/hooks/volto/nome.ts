import type { EngineInterface } from 'claude-code'

/**
 * Il nome leggibile della sessione, per la finestra del volto (stato.json "session_name"): il titolo che la
 * barra laterale mostra. Il plugin non ha una domanda per il titolo: lo si legge dalla trascrizione della
 * sessione, dove l'ospite scrive il titolo dato dalla persona ("customTitle") e quello proposto ("aiTitle");
 * vince l'ultimo della persona, poi l'ultimo proposto. Senza titolo: il nome della cartella del progetto.
 */

/** La cartella delle trascrizioni di un progetto: il suo percorso con ogni carattere che non e' lettera o cifra come '-'. */
export const projectFolder = (root: string) => root.replace(/[^A-Za-z0-9]/g, '-')

/** Il titolo tra le righe trovate nella trascrizione (`"customTitle":"…"` o `"aiTitle":"…"`, una per riga). */
export const titleOf = (found: string): string | undefined => {
  let custom: string | undefined
  let ai: string | undefined
  for (const line of found.split('\n')) {
    const m = /^"(customTitle|aiTitle)":("(?:[^"\\]|\\.)*")$/.exec(line.trim())
    if (!m) continue
    let value: unknown
    try {
      value = JSON.parse(m[2] as string)
    } catch {
      continue
    }
    if (typeof value !== 'string' || value.trim() === '') continue
    if (m[1] === 'customTitle') custom = value
    else ai = value
  }

  return clean(custom ?? ai)
}

/** Una riga sola, senza caratteri di controllo, al massimo 120 caratteri. */
const clean = (s: string | undefined) => {
  const one = s?.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()

  return one ? one.slice(0, 120) : undefined
}

/** L'ultima parte di un percorso (la cartella del progetto). */
export const folderName = (path: string) => clean(path.replace(/\/+$/, '').split('/').pop())

/** Il nome della sessione adesso: il titolo della trascrizione, o la cartella del progetto. */
export async function sessionName($: EngineInterface): Promise<string | undefined> {
  const home = await $.env.get('HOME').catch(() => undefined)
  const id = await $.session.id().catch(() => '')
  const root = await $.session.root().catch(() => '')
  const cwd = await $.session.cwd().catch(() => '')
  if (home && id && /^[\w-]+$/.test(id)) {
    for (const dir of [...new Set([root, cwd].filter(Boolean))]) {
      const file = `${home}/.claude/projects/${projectFolder(dir)}/${id}.jsonl`
      if (!(await $.fs.exists(file).catch(() => false))) continue
      const out = await $.process
        .run(['/usr/bin/grep', '-o', '-E', '"(customTitle|aiTitle)":"([^"\\\\]|\\\\.)*"', file])
        .then(r => (typeof r.stdout === 'string' ? r.stdout : ''), () => '')
      const title = titleOf(out)
      if (title) return title
      break
    }
  }

  return folderName(root || cwd)
}

import { Colorizer } from './colorito'
import type { Voice } from './tipi'

/**
 * La voce: una riga breve detta alla fine di ogni risposta.
 *
 * La riga arriva nel testo della risposta come definizione di riferimento
 * Markdown, `[voce]: # (...)`: nessun renderer CommonMark la disegna, quindi
 * resta invisibile anche dove il nostro hook non arriva; dove arriva, la togliamo.
 */

export const SECTION_ID = 'volto:voce'

export const SECTION_TEXT = [
  'The person has turned on a spoken line: after each final reply to them, a short line of it is read aloud.',
  'End every final reply to the person with a blank line and then one last line exactly in this form:',
  '[voce]: # (LINE)',
  'where LINE is a single short sentence of at most 25 words that tells the person, for listening, what the reply says or what happened;',
  'plain spoken words only: no code, file paths, URLs, markdown, numbers in tables, parentheses or quotes; in the language the person is using.',
  'Do not mention or explain this line. Leave it out of messages that only call tools.',
].join('\n')

// la riga, anche incompleta mentre arriva: da `[voce]:` in fondo al testo
const LINE = /\n?[ \t]*\[voce\]:[ \t]*#[ \t]*\(([^\n]*?)\)?[ \t]*$/
const LINE_ANYWHERE = /^[ \t]*\[voce\]:[ \t]*#[ \t]*\(([^\n]*)\)[ \t]*$/gm

/** La riga da dire, se il modello l'ha scritta. */
export const spokenLine = (answer: string): string | undefined => {
  const all = [...answer.matchAll(LINE_ANYWHERE)]
  const last = all[all.length - 1]?.[1]?.trim()

  return last ? clean(last) : undefined
}

/** Il testo da mostrare: senza la riga (anche a meta' mentre arriva). */
export const withoutLine = (text: string): string => {
  const cut = text.replace(LINE_ANYWHERE, '').replace(LINE, '').replace(/\n[ \t]*\[(v(o(c(e(\](:[ \t]*#?)?)?)?)?)?)?$/, '')

  return cut === text ? text : cut.replace(/\s+$/, '')
}

const clean = (s: string) =>
  s
    .replace(/[`*_~#>[\]()"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Se la riga manca: la prima frase in prosa, senza codice, tabelle, elenchi, percorsi e indirizzi, al massimo 30 parole. */
export const fallbackLine = (answer: string): string | undefined => {
  const prose = withoutLine(answer)
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .split('\n')
    .filter(line => !/^\s*(\||[-*+]\s|\d+[.)]\s|#{1,6}\s|>)/.test(line))
    .join(' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/(^|\s)(~|\.{1,2})?\/?[\w.-]+(\/[\w.-]+)+\/?/g, ' ')
    .replace(/[*_~>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
  if (prose === '') return undefined
  const sentence = /^(.+?[.!?])(\s|$)/.exec(prose)?.[1] ?? prose
  const words = sentence.split(' ')

  return words.length > 30 ? `${words.slice(0, 30).join(' ')}…` : sentence
}

// --- lingua e voce ---


const STOP: { [lang: string]: string[] } = {
  it: ['il', 'che', 'non', 'per', 'una', 'sono', 'della', 'gli', 'questo', 'fatto', 'ho', 'è', 'con', 'del', 'di', 'la', 'le', 'lo', 'un', 'nel', 'nella', 'ora', 'anche', 'se', 'ma', 'più', 'tutto', 'tutti', 'ci', 'sì', 'come', 'quando', 'dove', 'perché', 'già', 'adesso', 'poi', 'cosa', 'puoi', 'vuoi', 'fai', 'sei', 'era', 'stato', 'ancora', 'dei', 'delle', 'alla', 'sul', 'qui'],
  en: ['the', 'and', 'is', 'to', 'of', 'it', 'that', 'this', 'with', 'you', 'have', 'done', 'are'],
  es: ['el', 'que', 'los', 'una', 'para', 'por', 'con', 'está', 'esto', 'hecho', 'las', 'del'],
  fr: ['le', 'les', 'est', 'une', 'pour', 'que', 'des', 'avec', 'pas', 'fait', 'dans', 'vous'],
  de: ['der', 'die', 'und', 'ist', 'nicht', 'das', 'mit', 'ich', 'ein', 'eine', 'auf', 'fertig'],
  pt: ['o', 'que', 'não', 'uma', 'para', 'com', 'os', 'está', 'isso', 'feito', 'você', 'das'],
}

/** La lingua di una frase, a occhio: le parole piu' comuni. */
export const languageOf = (text: string): string | undefined => {
  const words = text.toLowerCase().split(/[^\p{L}]+/u)
  let best: string | undefined
  let score = 0
  for (const [lang, list] of Object.entries(STOP)) {
    const hits = words.filter(w => list.includes(w)).length
    if (hits > score) {
      best = lang
      score = hits
    }
  }

  return best
}

/** Le voci da `say -v ?`: nome, locale. */
export const parseVoices = (out: string): Voice[] =>
  out
    .split('\n')
    .map(line => /^(.+?)\s+([a-z]{2,3}_[A-Z0-9]{2,4})\s+#/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => ({ name: (m[1] ?? '').trim(), locale: (m[2] ?? '').replace('-', '_') }))

// voci giocattolo di macOS: mai scelte da sole
export const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Fred|Kathy|Grandma|Grandpa|Rocko|Shelley|Sandy|Flo|Eddy|Reed)\b/

/** La voce per una lingua: la scelta della persona, o la prima seria installata per quella lingua. */
export const voiceFor = (voices: readonly Voice[], lang: string | undefined, picked: string | undefined): string | undefined => {
  if (picked && voices.some(v => v.name === picked)) return picked
  if (!lang) return undefined
  const fits = voices.filter(v => v.locale.toLowerCase().startsWith(`${lang}_`))
  const serious = fits.filter(v => !NOVELTY.test(v.name))
  const best = serious.find(v => /Premium|Enhanced|Migliorat/i.test(v.name)) ?? serious[0] ?? fits[0]

  return best?.name
}

// --- le voci della voce comune (l'app Tinta, o l'aiuto di sviluppo): gli id Kokoro, per lingua ---

/** Le voci Kokoro offerte nel pannello (italiano) e quella per ogni lingua. */
export const KOKORO_ITALIAN = [
  { id: 'if_sara', label: 'Sara' },
  { id: 'im_nicola', label: 'Nicola' },
] as const

const KOKORO_BY_LANG: { [lang: string]: string } = { it: 'if_sara', en: 'af_heart', fr: 'ff_siwis', es: 'ef_dora', pt: 'pf_dora', ja: 'jf_alpha', zh: 'zf_xiaobei', hi: 'hf_alpha' }

/** La voce Kokoro per la lingua (la scelta vale per l'italiano); undefined se Kokoro non parla quella lingua. */
export const kokoroVoiceFor = (lang: string | undefined, picked: string | undefined): string | undefined => {
  const l = lang ?? 'it'
  if (l === 'it' && picked && KOKORO_ITALIAN.some(v => v.id === picked)) return picked

  return KOKORO_BY_LANG[l]
}

/** Le voci di sistema da offrire: al massimo `max` (il desktop ne accetta 64 in un menu), serie prima, la scelta sempre dentro. */
export const voiceOptions = (voices: readonly Voice[], picked: string | undefined, max = 60): Voice[] => {
  const serious = voices.filter(v => !NOVELTY.test(v.name))
  const list = serious.slice(0, max)
  const chosen = voices.find(v => v.name === picked)
  if (chosen && !list.includes(chosen)) list[list.length - 1] = chosen

  return list
}

// --- lettura in streaming: frasi complete, pulite, man mano che la risposta arriva ---

/**
 * I nomi con un punto dentro (index.html, package.json, os.path, v1.2): il punto non si legge, le parti si dicono
 * una dopo l'altra ("index html"). Solo i nomi che cominciano con una lettera: i numeri (3.5, 3.5GB) restano.
 */
const DOTTED = /(?<![\p{L}\p{N}_.@])[\p{L}_][\p{L}\p{N}_-]*(\.[\p{L}\p{N}_-]+)+/gu

/** Una frase pronta da dire: niente codice, link, percorsi, simboli markdown; titoli ed elenchi come frasi. */
export const speakable = (line: string): string | undefined => {
  if (/^\s*\|/.test(line)) return undefined // tabelle
  if (/^\s*\[voce\]:/.test(line)) return undefined
  if (/^\s*([-*_]\s*){3,}$/.test(line)) return undefined // righe orizzontali
  remember(line)
  const s = line
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/^\s*([-*+]|\d+[.)])\s+/, '')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/(^|\s)(~|\.{1,2})?\/?[\w.-]+(\/[\w.-]+)+\/?/g, ' ')
    .replace(DOTTED, name => name.replace(/\./g, ' '))
    .replace(/[*_~#|<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()

  return /[\p{L}\p{N}]/u.test(s) ? s : undefined
}

/**
 * Raccoglie il testo che arriva a pezzi e ne restituisce i tratti da dire, il prima possibile:
 * il primo appena c'e' una pausa (virgola, punto e virgola, due punti, trattino, fine frase) dopo
 * almeno 4 parole, o dopo 8 parole senza punteggiatura a fine parola; i successivi a ogni pausa,
 * senza frammenti sotto le 3 parole (si attaccano al tratto dopo). Una riga finita e' un tratto.
 * Salta i blocchi di codice e le tabelle.
 */
export class SentenceStream {
  private line = ''
  private fence = false
  private first = true

  push(text: string): string[] {
    const out: string[] = []
    this.line += text
    let nl = this.line.indexOf('\n')
    while (nl !== -1) {
      const rest = this.line.slice(nl + 1)
      this.takeLine(this.line.slice(0, nl), out)
      this.line = rest
      nl = this.line.indexOf('\n')
    }
    if (!this.fence && !/^\s*(```|~~~|\|)/.test(this.line)) this.cutOpen(out)

    return out
  }

  /** Il resto, a fine passo. */
  end(): string[] {
    const out: string[] = []
    if (this.line.trim() !== '') this.takeLine(this.line, out)
    this.line = ''

    return out
  }

  private takeLine(line: string, out: string[]) {
    if (/^\s*(```|~~~)/.test(line)) {
      this.fence = !this.fence

      return
    }
    if (this.fence || /^\s*\|/.test(line)) return
    this.line = line
    this.cutOpen(out)
    this.say(this.line, out)
    this.line = ''
  }

  /**
   * I tratti gia' completi nella riga ancora aperta. Solo il primo tratto della risposta si taglia a una
   * virgola (per partire presto); poi si taglia a fine frase, e a una virgola solo se la frase supera
   * 220 caratteri: ogni tratto e' un'emissione a se', e le virgole come confini suonano spezzate.
   */
  private cutOpen(out: string[]) {
    for (;;) {
      const pause = this.first ? /[,;:.!?…](?=\s)|\s[—–-](?=\s)/g : /[.!?…](?=\s)/g
      let cut = -1
      for (let m = pause.exec(this.line); m; m = pause.exec(this.line)) {
        const end = m.index + m[0].length
        const head = this.line.slice(0, end)
        // le pause dentro il codice (tra backtick, tra parentesi o graffe) e tra due numeri ("1, 2 e 3") non contano
        const after = this.line.slice(end)
        if (m[0] === ',' && /\d,$/.test(head) && /^\s*$/.test(after)) break // dopo la virgola puo' arrivare un numero
        if (insideCode(head) || (m[0] === ',' && /\d,$/.test(head) && /^\s*\d/.test(after))) continue
        if (this.first ? longEnough(head) : words(head) >= 3) {
          cut = end
          break
        }
      }
      if (cut < 0 && !this.first && this.line.length > 220) {
        const head = this.line.slice(0, 220)
        const comma = Math.max(head.lastIndexOf(', '), head.lastIndexOf('; '), head.lastIndexOf(': '))
        if (comma > 40) cut = comma + 1
      }
      if (cut < 0 && this.first && /\s$/.test(this.line) && words(this.line) >= 8 && !insideCode(this.line)) cut = this.line.length
      if (cut < 0) return
      this.say(this.line.slice(0, cut), out)
      this.line = this.line.slice(cut).replace(/^\s+/, '')
    }
  }

  private say(text: string, out: string[]) {
    const s = speakable(text)
    if (!s) return
    out.push(s)
    this.sources.push(text)
    this.first = false
  }

  // the raw Markdown each spoken line was cut from, in order (the reply's text shows it: lettura.ts finds it there)
  private sources: string[] = []

  /** The raw text of the lines handed out since the last call, one per line. */
  takeSources(): string[] {
    const out = this.sources
    this.sources = []

    return out
  }
}

/** A spoken line and the raw Markdown it was cut from. */
export type SpokenLine = { line: string; source: string }

const paired = (lines: string[], sources: string[]): SpokenLine[] => lines.map((line, i) => ({ line, source: sources[i] ?? line }))

/** A whole reply's lines with their sources (the Ascolta button). */
export const spokenLinesOf = (text: string): SpokenLine[] => {
  const s = new SentenceStream()
  const lines = [...s.push(text), ...s.end()]

  return paired(lines, s.takeSources())
}

const words = (text: string) => text.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length

/**
 * Se il primo tratto puo' finire qui: almeno 4 parole, o almeno 20 caratteri in almeno 2 parole
 * ("Ho controllato tutto," si'; "Si'," o "Allora, vediamo," no: restano attaccati a quello che segue).
 */
const longEnough = (head: string) => {
  const n = words(head)

  return n >= 4 || (n >= 2 && head.trim().length >= 20)
}

/** Se la fine del testo cade dentro codice: un backtick aperto, o parentesi tonde, quadre o graffe non chiuse. */
const insideCode = (text: string) => {
  if (((text.match(/`/g) ?? []).length & 1) === 1) return true
  let depth = 0
  for (const c of text.replace(/`[^`]*`/g, '')) {
    if (c === '(' || c === '[' || c === '{') depth++
    else if ((c === ')' || c === ']' || c === '}') && depth > 0) depth--
  }

  return depth > 0
}

/** I tratti di un passo del modello: tutto si legge, anche il testo prima di una chiamata a strumento. */
export class StepReader {
  private stream = new SentenceStream()
  // il tono colorito (se acceso): le stesse esclamazioni del testo mostrato, decise mentre il testo arriva
  private color: Colorizer

  constructor(lang = 'it') {
    this.color = new Colorizer(lang)
  }

  text(chunk: string): string[] {
    return this.stream.push(this.color.push(chunk))
  }

  /** Un passo che chiama uno strumento: il testo gia' letto resta, si continua a leggere (un blocco nuovo). */
  tool(): string[] {
    const rest = this.color.flush()

    return rest === '' ? [] : this.stream.push(rest)
  }

  /** Il passo e' finito: il resto. */
  end(_isAnswer: boolean): string[] {
    const rest = this.color.flush()

    return [...(rest === '' ? [] : this.stream.push(rest)), ...this.stream.end()]
  }
  /** text(), tool(), end() with each line's raw source. */
  textLines(chunk: string): SpokenLine[] {
    return paired(this.text(chunk), this.stream.takeSources())
  }

  toolLines(): SpokenLine[] {
    return paired(this.tool(), this.stream.takeSources())
  }

  endLines(isAnswer: boolean): SpokenLine[] {
    return paired(this.end(isAnswer), this.stream.takeSources())
  }
}

/** Quante parole tipiche di ogni lingua ci sono nel testo. */
export const languageScores = (text: string): { [lang: string]: number } => {
  const words = text.toLowerCase().split(/[^\p{L}]+/u)
  const out: { [lang: string]: number } = {}
  for (const [lang, list] of Object.entries(STOP)) out[lang] = words.filter(w => list.includes(w)).length

  return out
}

/** Le lingue della voce, scelte dalla persona (mai indovinate), con le voci Kokoro di ciascuna. */
export const LANGUAGES = [
  { id: 'it', label: 'Italiano', system: 'it', voices: [{ id: 'if_sara', label: 'Sara' }, { id: 'im_nicola', label: 'Nicola' }] },
  { id: 'en-us', label: 'English US', system: 'en_US', voices: [{ id: 'af_heart', label: 'Heart' }, { id: 'am_michael', label: 'Michael' }] },
  { id: 'en-gb', label: 'English UK', system: 'en_GB', voices: [{ id: 'bf_emma', label: 'Emma' }, { id: 'bm_george', label: 'George' }] },
  { id: 'fr', label: 'Français', system: 'fr', voices: [{ id: 'ff_siwis', label: 'Siwis' }] },
  { id: 'es', label: 'Español', system: 'es', voices: [{ id: 'ef_dora', label: 'Dora' }, { id: 'em_alex', label: 'Alex' }] },
  { id: 'pt', label: 'Português BR', system: 'pt_BR', voices: [{ id: 'pf_dora', label: 'Dora' }, { id: 'pm_alex', label: 'Alex' }] },
  { id: 'ja', label: '日本語', system: 'ja', voices: [{ id: 'jf_alpha', label: 'Alpha' }, { id: 'jm_kumo', label: 'Kumo' }] },
  { id: 'zh', label: '中文', system: 'zh', voices: [{ id: 'zf_xiaobei', label: 'Xiaobei' }, { id: 'zm_yunjian', label: 'Yunjian' }] },
  { id: 'hi', label: 'हिन्दी', system: 'hi', voices: [{ id: 'hf_alpha', label: 'Alpha' }, { id: 'hm_omega', label: 'Omega' }] },
] as const

export const languageOfId = (id: string | undefined) => LANGUAGES.find(one => one.id === id) ?? LANGUAGES[0]

/** La lingua del sistema da una variabile come LANG (it_IT.UTF-8 -> it, en_GB -> en-gb); se non c'e', l'italiano. */
export const systemLanguage = (value: string | undefined): string => {
  const m = /^([a-z]{2})(?:_([A-Z]{2}))?/.exec(value ?? '')
  const lang = m?.[1]?.toLowerCase()
  if (lang === 'en') return m?.[2] === 'GB' ? 'en-gb' : 'en-us'

  return LANGUAGES.some(one => one.id === lang) ? (lang as string) : 'it'
}

/** La voce Kokoro da usare: quella scelta se e' della lingua, se no la prima della lingua. */
export const kokoroVoiceOf = (lang: string | undefined, picked: string | undefined) => {
  // una voce clonata dall'app parla ogni lingua
  if (isClonedId(picked)) return picked as string
  const l = languageOfId(lang)
  if ((l.voices as readonly { id: string }[]).some(v => v.id === picked)) return picked as string
  // una voce da file (~/.claude/tinta/voce/voci) della stessa lingua
  if (picked !== undefined && customVoices.some(v => v.id === picked && v.lang === l.id)) return picked

  return l.voices[0].id
}

/**
 * Voci da file (<nome>.voice.npy): spente. Il codice resta; con false non si elencano, non si usano (la voce
 * scelta torna a quella di serie della lingua) e le richieste dell'app si ignorano. Le voci clonate ("clone:")
 * sono un'altra cosa: le crea, le elenca e le sintetizza l'app; qui sono un id di voce come gli altri.
 */
export const CUSTOM_VOICES = false

/** Una voce da file: <nome>.voice.npy in ~/.claude/tinta/voce/voci, con accanto <nome>.voice.json {name, lang}. */
export type CustomVoice = { id: string; name: string; lang: string; path: string; kind?: 'file' | 'clone'; langs?: string[] }
let customVoices: CustomVoice[] = []
export const setCustomVoices = (list: CustomVoice[]) => {
  customVoices = CUSTOM_VOICES ? list : []
}
export const customVoiceOf = (id: string | undefined) => customVoices.find(v => v.id === id)
/** Un id di voce da file ("file:<nome>"). */
export const isCustomId = (id: string | undefined) => typeof id === 'string' && /^file:/.test(id)
/** Una voce clonata dall'app ("clone:<nome>"): l'app la fa e la sintetizza (Kokoro + convertitore di timbro). */
export const isClonedId = (id: string | undefined) => typeof id === 'string' && /^clone:[\w.-]+$/.test(id)

/** Le voci per lingua, per il menu Voce dell'app: Kokoro, quelle da file, e la voce di sistema. */
export const voiceCatalog = (hasKokoro: boolean) =>
  Object.fromEntries(
    LANGUAGES.map(l => [
      l.id,
      [
        ...(hasKokoro ? l.voices.map(v => ({ id: v.id, name: v.label })) : []),
        ...(hasKokoro
          ? customVoices.filter(v => v.lang === l.id).map(v => ({ id: v.id, name: v.name, kind: v.kind ?? 'file', langs: v.langs ?? [v.lang] }))
          : []),
        { id: 'sys', name: 'Sistema' },
      ],
    ]),
  )

/** La voce di sistema per la lingua: quella scelta, o la prima seria installata. */
export const systemVoiceOf = (voices: readonly Voice[], lang: string | undefined, picked: string | undefined) =>
  voiceFor(voices, languageOfId(lang).system.slice(0, 2), picked)

// --- il tono di ogni frase detta, e le parole da sottolineare (nessun modello: punteggiatura e parole chiave) ---

export type Tone = 'curioso' | 'contento' | 'preoccupato' | 'concentrato' | 'neutro'

// le righe lette di recente, con le parole in grassetto e se erano una voce di elenco
const recent: { plain: string; bold: string[]; list: boolean }[] = []

function remember(line: string) {
  const bold = [...line.matchAll(/\*\*([^*]+)\*\*|__([^_]+)__/g)].flatMap(m => (m[1] ?? m[2] ?? '').split(/\s+/)).filter(w => w !== '')
  const list = /^\s*([-*+]|\d+[.)])\s+/.test(line)
  const plain = line.replace(/[*_`]/g, '')
  recent.push({ plain, bold, list })
  if (recent.length > 40) recent.shift()
}

const TONE_WORDS: { [lang: string]: { good: string[]; bad: string[]; explain: string[] } } = {
  it: {
    good: ['fatto', 'funziona', 'perfetto', 'ottimo', 'riuscit', 'risolt', 'sistemat', 'pronto', 'pronta', 'passano', 'tutto bene', 'finito'],
    bad: ['errore', 'purtroppo', 'non funziona', 'fallit', 'problema', 'rotto', 'non riesco', 'non parte', 'attenzione', 'manca', 'guasto'],
    explain: ['perche', 'perché', 'quindi', 'cioe', 'cioè', 'per esempio', 'prima', 'poi', 'infine'],
  },
  en: {
    good: ['done', 'works', 'working', 'perfect', 'great', 'fixed', 'ready', 'passes', 'passing', 'success', 'all good'],
    bad: ['error', 'unfortunately', 'fail', "doesn't work", 'broken', 'problem', 'issue', 'cannot', "can't", 'missing', 'warning'],
    explain: ['because', 'so ', 'that is', 'for example', 'first', 'then', 'finally'],
  },
  fr: {
    good: ['fait', 'fonctionne', 'marche', 'parfait', 'excellent', 'réussi', 'corrigé', 'prêt'],
    bad: ['erreur', 'malheureusement', 'ne fonctionne pas', 'échoué', 'échec', 'problème', 'cassé', 'manque'],
    explain: ['parce que', 'donc', "c'est-à-dire", 'par exemple', "d'abord", 'ensuite', 'enfin'],
  },
  es: {
    good: ['hecho', 'funciona', 'perfecto', 'genial', 'listo', 'arreglado', 'resuelto', 'correcto'],
    bad: ['error', 'lamentablemente', 'no funciona', 'fallado', 'fallo', 'problema', 'roto', 'falta'],
    explain: ['porque', 'entonces', 'es decir', 'por ejemplo', 'primero', 'luego', 'finalmente'],
  },
  pt: {
    good: ['feito', 'funciona', 'perfeito', 'ótimo', 'pronto', 'corrigido', 'resolvido', 'certo'],
    bad: ['erro', 'infelizmente', 'não funciona', 'falhou', 'falha', 'problema', 'quebrado', 'falta'],
    explain: ['porque', 'então', 'ou seja', 'por exemplo', 'primeiro', 'depois', 'finalmente'],
  },
}

const TONE_IT = { good: [] as string[], bad: [] as string[], explain: [] as string[], ...TONE_WORDS.it }
const hits = (text: string, words: string[]) => words.filter(w => text.includes(w)).length

/** Il tono della frase e la sua forza (0..1). Un problema vince su tutto; poi domanda, poi buona notizia. */
export function toneOf(line: string, lang: string | undefined): { type: Tone; strength: number } {
  const text = ` ${line.toLowerCase()} `
  const table = TONE_WORDS[(lang ?? 'it').slice(0, 2)] ?? TONE_IT
  const english = TONE_WORDS.en ?? TONE_IT
  // le parole di un problema anche in inglese (i messaggi d'errore lo sono spesso)
  const bad = hits(text, table.bad) + (table === english ? 0 : hits(text, english.bad.filter(w => w.length > 4)))
  // "non funziona" contiene "funziona": la buona notizia conta solo se non e' dentro un problema
  const good = hits(text, table.good.filter(w => !table.bad.some(b => b.includes(w) && text.includes(b))))
  const bang = /!\s*$/.test(line)
  const entry = recent.find(one => one.plain.includes(line.slice(0, 40)))
  if (bad > 0) return { type: 'preoccupato', strength: Math.min(1, 0.55 + 0.2 * (bad - 1) + (bang ? 0.15 : 0)) }
  if (/\?\s*$/.test(line)) return { type: 'curioso', strength: Math.min(1, 0.6 + (good > 0 ? 0.1 : 0)) }
  if (good > 0 || bang) return { type: 'contento', strength: Math.min(1, 0.5 + 0.2 * good + (bang ? 0.2 : 0)) }
  if (entry?.list || /:\s*$/.test(line) || hits(text, table.explain) > 0) return { type: 'concentrato', strength: entry?.list ? 0.6 : 0.45 }

  return { type: 'neutro', strength: 0 }
}

/** Le parole da sottolineare nella frase, nell'ordine: in grassetto nel testo, in MAIUSCOLO, i numeri. */
export function emphasisOf(line: string): string[] {
  const entry = recent.find(one => one.plain.includes(line.slice(0, 40)))
  const bold = new Set((entry?.bold ?? []).map(w => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()).filter(w => w !== ''))
  const out: string[] = []
  for (const raw of line.split(/\s+/)) {
    const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    if (w === '') continue
    const caps = w.length >= 2 && /\p{Lu}/u.test(w) && w === w.toUpperCase() && /\p{L}/u.test(w)
    if (bold.has(w.toLowerCase()) || caps || /^\d/.test(w)) out.push(w)
  }

  return out
}

// --- i gesti di una frase: parole (e faccine) che chiedono un cenno del volto, legati alla parola detta ---

export type Gesture = 'assenso' | 'diniego' | 'risata' | 'dubbio' | 'riflessione' | 'stupore'
type GestureTable = { [g in Gesture]: string[] }

// le parole di risposta (si', no, certo...) valgono solo da sole: a inizio frase o dopo una pausa, e seguite da
// una pausa o dalla fine ("Si', certo." si'; "un certo punto", "non lo so", "no problem" no)
const ANSWER: Gesture[] = ['assenso', 'diniego']
const GESTURE_WORDS: { [lang: string]: GestureTable } = {
  it: {
    assenso: ['sì', 'certo', 'esatto', 'esattamente', 'giusto', 'ok', 'okay', 'va bene', "d'accordo", 'proprio così', 'certamente', 'senz\'altro'],
    diniego: ['no', 'per niente', 'assolutamente no', 'non è così', 'niente affatto', 'macché'],
    risata: ['che ridere', 'lol'],
    dubbio: ['mah', 'boh', 'dipende', 'forse', 'non saprei', 'chissà'],
    riflessione: ['hmm', 'mmm', 'hm', 'vediamo', 'aspetta', 'fammi pensare', 'ci penso'],
    stupore: ['wow', 'incredibile', 'accidenti', 'pazzesco', 'caspita', 'non ci credo', 'mamma mia'],
  },
  en: {
    assenso: ['yes', 'yeah', 'yep', 'sure', 'exactly', 'right', 'of course', 'ok', 'okay', 'absolutely', 'indeed', 'agreed'],
    diniego: ['no', 'nope', 'nah', 'not at all', 'absolutely not', "that's not right", 'not really'],
    risata: ['lol', 'lmao', 'that\'s funny'],
    dubbio: ['it depends', 'maybe', 'perhaps', 'dunno', 'not sure', 'who knows'],
    riflessione: ['hmm', 'mmm', 'hm', 'let me think', "let's see", 'wait'],
    stupore: ['wow', 'whoa', 'incredible', 'amazing', 'no way', 'unbelievable'],
  },
  fr: {
    assenso: ['oui', 'exactement', "d'accord", 'bien sûr', 'ok', 'voilà', 'tout à fait'],
    diniego: ['non', 'pas du tout', 'absolument pas', "ce n'est pas ça"],
    risata: ['mdr', 'ptdr', 'trop drôle'],
    dubbio: ['bof', 'ça dépend', 'peut-être', 'je ne sais pas'],
    riflessione: ['hmm', 'mmm', 'voyons', 'attends', 'laisse-moi réfléchir'],
    stupore: ['wow', 'waouh', 'incroyable', "c'est dingue", 'oh là là'],
  },
  es: {
    assenso: ['sí', 'claro', 'exacto', 'vale', 'de acuerdo', 'ok', 'por supuesto'],
    diniego: ['no', 'para nada', 'en absoluto', 'de ninguna manera'],
    risata: ['jaja', 'jajaja', 'jeje', 'qué risa'],
    dubbio: ['depende', 'quizás', 'quizá', 'tal vez', 'no sé'],
    riflessione: ['hmm', 'mmm', 'a ver', 'espera', 'déjame pensar'],
    stupore: ['guau', 'wow', 'increíble', 'qué fuerte', 'madre mía'],
  },
  pt: {
    assenso: ['sim', 'claro', 'exato', 'certo', 'tudo bem', 'ok', 'com certeza'],
    diniego: ['não', 'de jeito nenhum', 'nada disso'],
    risata: ['kkk', 'kkkk', 'rsrs'],
    dubbio: ['depende', 'talvez', 'sei lá'],
    riflessione: ['hmm', 'mmm', 'vamos ver', 'espera', 'deixa eu pensar'],
    stupore: ['uau', 'nossa', 'incrível', 'caramba'],
  },
}
// "no" seguito da queste non e' un rifiuto ("no problem", "no, grazie" lo e')
const NOT_DENIAL = ['problem', 'problema', 'problemo', 'worries', 'way', 'matter']
const EMOJI_GESTURE: [RegExp, Gesture, number][] = [
  [/[😂🤣]/u, 'risata', 1],
  [/[😄😆😁😃😀😅]/u, 'risata', 0.7],
  [/[😮😲🤯😱]/u, 'stupore', 0.9],
  [/[🤔]/u, 'riflessione', 0.8],
  [/[🤷]/u, 'dubbio', 0.8],
  [/[👍👌✅]/u, 'assenso', 0.7],
  [/[👎❌]/u, 'diniego', 0.7],
]
const LAUGH = /^(?=.{4,})a?(ha|ah|he|hi|ja|je|ji)+h?$|^k{3,}$/u
const PICTO = /\p{Extended_Pictographic}/u
const cleanWord = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '').replace(/’/g, "'")

/** Il testo da dire senza faccine (non si leggono). */
export const withoutEmoji = (line: string) =>
  line.replace(/\p{Extended_Pictographic}️?(‍\p{Extended_Pictographic}️?)*/gu, ' ').replace(/\s+/g, ' ').trim()

/**
 * I gesti della frase: [indice della parola nel testo detto (senza faccine), gesto, forza]. Le faccine cadono
 * sulla parola dopo (o sull'ultima, a fine frase).
 */
export function gesturesOf(line: string, lang: string | undefined): [number, Gesture, number][] {
  const table = GESTURE_WORDS[(lang ?? 'it').slice(0, 2)] ?? GESTURE_WORDS.it
  if (!table) return []
  const raw = line.split(/\s+/).filter(t => t !== '')
  // le parole dette, con il loro indice; le faccine sole non sono parole
  const words: { text: string; raw: string; index: number }[] = []
  const emoji: { at: number; g: Gesture; s: number }[] = []
  for (const t of raw) {
    for (const [re, g, s] of EMOJI_GESTURE) if (re.test(t)) emoji.push({ at: words.length, g, s })
    const spoken = withoutEmoji(t)
    // anche un trattino da solo e' una parola per chi legge il testo (stessi indici dell'aiuto)
    if (spoken !== '') words.push({ text: cleanWord(spoken), raw: spoken, index: words.length })
  }
  const out: [number, Gesture, number][] = []
  const taken = new Set<number>()
  const pausedBefore = (i: number) => i === 0 || /[.,!?;:…]$/.test(words[i - 1]?.raw ?? '')
  const pausedAfter = (i: number, n: number) => i + n >= words.length || /[.,!?;:…]$/.test(words[i + n - 1]?.raw ?? '')
  const bang = (i: number, n: number) => /!/.test(words[i + n - 1]?.raw ?? '')
  for (let i = 0; i < words.length; i++) {
    if (taken.has(i)) continue
    let hit: [Gesture, number] | undefined
    for (const g of Object.keys(table) as Gesture[]) {
      for (const phrase of table[g]) {
        const parts = phrase.split(' ')
        if (!parts.every((p, k) => words[i + k]?.text === p)) continue
        if (ANSWER.includes(g) && parts.length === 1) {
          // una parola di risposta: da sola, e "no" non davanti a "problem"/"way"...
          if (!pausedBefore(i) || (!pausedAfter(i, 1) && words[i + 1]?.text !== parts[0])) continue
          if (g === 'diniego' && NOT_DENIAL.includes(words[i + 1]?.text ?? '')) continue
        }
        if (!hit || parts.length > hit[1]) hit = [g, parts.length]
      }
    }
    const text = words[i]?.text ?? ''
    if (!hit && LAUGH.test(text)) hit = ['risata', 1]
    if (!hit) continue
    const [g, n] = hit
    for (let k = 0; k < n; k++) taken.add(i + k)
    const long = g === 'risata' ? Math.min(0.3, text.length / 30) : 0
    out.push([i, g, Math.round(Math.min(1, 0.7 + long + (bang(i, n) ? 0.2 : 0)) * 100) / 100])
  }
  for (const e of emoji) out.push([Math.min(e.at, Math.max(0, words.length - 1)), e.g, e.s])
  out.sort((a, b) => a[0] - b[0])

  return out.filter((one, k) => k === 0 || one[0] !== out[k - 1]?.[0] || one[1] !== out[k - 1]?.[1])
}
export const hasEmoji = (line: string) => PICTO.test(line)

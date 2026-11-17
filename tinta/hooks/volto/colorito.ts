/**
 * "Tono colorito": esclamazioni colorite (parolacce d'uso comune, mai bestemmie, insulti o offese a persone o
 * gruppi) all'inizio di qualche frase delle risposte, uguali nel testo mostrato e nella voce.
 *
 * Tutto si decide frase per frase, dalle sue prime 4 parole: se mettere l'esclamazione (in media una frase su
 * 4, 2 o 1, secondo la frequenza) e quale (secondo il tono di quelle parole: buona notizia, problema, stupore).
 * Le stesse parole danno sempre la stessa scelta, quindi un ridisegno non cambia nulla, e la voce (che legge
 * il testo mentre arriva) decide come il testo mostrato. Mai nei blocchi di codice, nelle righe di elenco, nei
 * titoli, nelle citazioni, nelle tabelle, ne' davanti a codice, percorsi, numeri o virgolette.
 */

export type ColorFreq = 'ogni_tanto' | 'spesso' | 'raffica'
// i momenti di una frase, dal piu' forte: ciascuna frase ne prende al massimo uno
export const MOMENTS = ['errore', 'problema', 'stupore', 'domanda', 'successo', 'attesa', 'inizio', 'any'] as const
type Bucket = (typeof MOMENTS)[number]
type Lists = { [b in Bucket]: string[] }
export type ColorSettings = { on: boolean; freq: ColorFreq; custom: Lists; onlyCustom: boolean }

const DEFAULTS: { [lang: string]: Partial<Lists> & { any: string[] } } = {
  it: {
    successo: ['Figata', 'Che figata', 'Cazzo, sì', 'Grande', 'Evvai'],
    errore: ['Porca miseria', 'Cazzo', 'Mannaggia', 'Che palle'],
    problema: ['Che palle', 'Uffa', 'Mannaggia', 'Porca vacca'],
    stupore: ['Minchia', 'Cazzo', 'Porca vacca'],
    attesa: ['Dai', 'Forza', 'E vabbè'],
    inizio: ['Allora', 'Cazzo', 'Ok, minchia'],
    domanda: ['Senti', 'Dimmi un po\'', 'Oh'],
    any: ['Cavolo', 'Accidenti', 'Cazzo', 'Porca miseria', 'Minchia', 'Mannaggia'],
  },
  en: {
    successo: ['Hell yeah', 'Damn right', 'Sweet'],
    errore: ['Damn it', 'Crap', 'Ugh, shit'],
    problema: ['Bloody hell', 'Ugh', 'Crap'],
    stupore: ['Holy shit', 'Damn', 'Holy crap'],
    attesa: ['Alright', 'Come on'],
    inizio: ['Right', 'Damn', 'Okay, hell'],
    domanda: ['Listen', 'Hey'],
    any: ['Damn', 'Hell', 'Holy crap', 'Shit'],
  },
  fr: {
    successo: ['Trop bien', 'Putain, génial', 'Énorme'],
    errore: ['Merde', 'Putain'],
    problema: ['Fait chier', 'Merde', 'Zut'],
    stupore: ['Putain', 'La vache', 'Oh purée'],
    attesa: ['Allez', 'Bon'],
    inizio: ['Bon', 'Putain'],
    domanda: ['Dis-moi', 'Écoute'],
    any: ['Putain', 'Merde', 'Punaise', 'Zut'],
  },
  es: {
    successo: ['Qué guay', 'De puta madre', 'Brutal'],
    errore: ['Joder', 'Mierda'],
    problema: ['Qué putada', 'Joder', 'Vaya'],
    stupore: ['Joder', 'Madre mía', 'Coño'],
    attesa: ['Venga', 'Vale'],
    inizio: ['Bueno', 'Joder'],
    domanda: ['Oye', 'Dime'],
    any: ['Joder', 'Coño', 'Ostras', 'Caramba', 'Leches'],
  },
  pt: {
    successo: ['Que massa', 'Do caralho', 'Show'],
    errore: ['Porra', 'Merda'],
    problema: ['Que saco', 'Porra', 'Droga'],
    stupore: ['Caralho', 'Puta merda', 'Nossa'],
    attesa: ['Bora', 'Vamos lá'],
    inizio: ['Então', 'Porra'],
    domanda: ['Olha', 'Diz aí'],
    any: ['Caramba', 'Porra', 'Caraca', 'Droga'],
  },
}

// le parole chiave dei momenti, nelle prime 4 parole della frase (il classificatore del tono, ristretto)
type Cues = { [b in Exclude<Bucket, 'any'>]: string[] }
const CUES: { [lang: string]: Cues } = {
  it: {
    errore: ['errore', 'errori', 'bug', 'fallit', 'falliscono', 'crash', 'eccezione', 'non funziona', 'si rompe', 'rotto'],
    problema: ['purtroppo', 'problema', 'non riesco', 'non posso', 'manca', 'bloccat', 'limite', 'non parte', 'difficile'],
    stupore: ['wow', 'incredibile', 'pazzesco', 'accidenti', 'caspita', 'sorpresa', 'strano'],
    domanda: ['vuoi', 'preferisci', 'posso', 'devo', 'ti va', 'che ne dici', 'procedo', 'ti serve'],
    successo: ['fatto', 'funziona', 'perfetto', 'ottimo', 'risolto', 'sistemato', 'pronto', 'tutto bene', 'passano', 'finito'],
    attesa: ['aspetta', 'vediamo', 'controllo', 'verifico', 'guardo', 'sto ', 'adesso', 'ora ', 'un attimo', 'lancio', 'provo'],
    inizio: ['comincio', 'cominciamo', 'inizio', 'iniziamo', 'parto', 'partiamo', 'vado', 'andiamo', 'eccomi', 'mi metto', 'per prima cosa', 'per cominciare', 'per iniziare'],
  },
  en: {
    errore: ['error', 'bug', 'fail', 'crash', 'exception', "doesn't work", 'broken'],
    problema: ['unfortunately', 'problem', 'issue', "can't", 'cannot', 'missing', 'blocked', 'limit'],
    stupore: ['wow', 'whoa', 'incredible', 'amazing', 'surprising', 'weird'],
    domanda: ['do you', 'would you', 'shall i', 'should i', 'want me', 'can i'],
    successo: ['done', 'works', 'perfect', 'great', 'fixed', 'ready', 'passes', 'all good'],
    attesa: ['wait', "let's see", 'let me', 'checking', 'looking', 'now i', 'running'],
    inizio: ['let me start', 'let me begin', "let's start", "let's begin", "let's go", 'start', 'begin', "i'll start", 'first i', 'here i go', 'here we go', 'kicking off', 'getting started', 'to start', 'first things first'],
  },
  fr: {
    errore: ['erreur', 'bug', 'échoué', 'échec', 'plantage', 'cassé'],
    problema: ['malheureusement', 'problème', 'impossible', 'manque', 'bloqué'],
    stupore: ['wow', 'incroyable', 'étonnant', 'bizarre'],
    domanda: ['veux-tu', 'tu veux', 'je peux', 'dois-je', 'préfères'],
    successo: ['fait', 'fonctionne', 'parfait', 'corrigé', 'prêt', 'réussi'],
    attesa: ['attends', 'voyons', 'je regarde', 'je vérifie', 'maintenant'],
    inizio: ['je commence', 'commençons', 'je démarre', "c'est parti", "j'y vais", 'me voilà', 'pour commencer'],
  },
  es: {
    errore: ['error', 'bug', 'falla', 'fallo', 'roto'],
    problema: ['lamentablemente', 'problema', 'no puedo', 'falta', 'bloqueado'],
    stupore: ['wow', 'increíble', 'sorprendente', 'raro'],
    domanda: ['quieres', 'prefieres', 'puedo', 'debo'],
    successo: ['hecho', 'funciona', 'perfecto', 'listo', 'arreglado', 'resuelto'],
    attesa: ['espera', 'a ver', 'miro', 'compruebo', 'ahora'],
    inizio: ['empiezo', 'empecemos', 'comienzo', 'comencemos', 'voy a', 'vamos', 'aquí estoy', 'para empezar'],
  },
  pt: {
    errore: ['erro', 'bug', 'falhou', 'falha', 'quebrado'],
    problema: ['infelizmente', 'problema', 'não consigo', 'falta', 'bloqueado'],
    stupore: ['uau', 'incrível', 'nossa', 'estranho'],
    domanda: ['quer', 'prefere', 'posso', 'devo'],
    successo: ['feito', 'funciona', 'perfeito', 'pronto', 'corrigido', 'resolvido'],
    attesa: ['espera', 'vamos ver', 'vou ver', 'verifico', 'agora'],
    inizio: ['começo', 'começando', 'vou começar', 'vamos começar', 'bora', 'aqui estou', 'para começar'],
  },
}

// le frasi che chiedono alla persona di scegliere o decidere, anche senza "?" (in tutta la frase, non solo all'inizio)
const ASKS: { [lang: string]: string[] } = {
  it: ['dimmi tu', 'dimmi quale', 'dimmi se', 'fammi sapere', 'decidi tu', 'scegli tu', 'a te la scelta', 'vedi tu'],
  en: ['let me know', 'your call', 'up to you', 'you decide', 'you choose', 'tell me which', 'tell me if', 'which do you', 'which one do you'],
  fr: ['dis-moi', 'à toi de choisir', 'tu choisis', 'tu décides'],
  es: ['dime', 'tú decides', 'tú eliges', 'avísame'],
  pt: ['me diz', 'você decide', 'você escolhe', 'me avisa'],
}
// quanta parte della frase si guarda per capire se e' una domanda (la voce aspetta al massimo fin qui)
const LOOK = 160

// i nomi di prima dei momenti, per chi li ha gia' scritti in comando.json
const OLD: { [k: string]: Bucket } = { contento: 'successo', preoccupato: 'problema' }

const EVERY: { [f in ColorFreq]: number } = { ogni_tanto: 4, spesso: 2, raffica: 1 }
const empty = (): Lists => Object.fromEntries(MOMENTS.map(m => [m, [] as string[]])) as unknown as Lists
let settings: ColorSettings = { on: false, freq: 'ogni_tanto', custom: empty(), onlyCustom: false }

export const colorSettings = () => settings

/** Le scelte da comando.json "colorful": {on, freq, custom: {any, contento, preoccupato, stupore}, only_custom}. */
export function setColorful(raw: unknown) {
  const c = typeof raw === 'object' && raw !== null ? (raw as { on?: unknown; freq?: unknown; custom?: unknown; only_custom?: unknown }) : {}
  const freq: ColorFreq = c.freq === 'spesso' || c.freq === 'raffica' ? c.freq : 'ogni_tanto'
  const custom = empty()
  let left = 50
  const given = typeof c.custom === 'object' && c.custom !== null ? (c.custom as { [k: string]: unknown }) : {}
  for (const key of [...MOMENTS, ...Object.keys(OLD)]) {
    const b: Bucket = OLD[key] ?? (key as Bucket)
    const list = Array.isArray(given[key]) ? (given[key] as unknown[]) : []
    for (const w of list) {
      if (typeof w !== 'string' || left <= 0) continue
      const t = w.replace(/\s+/g, ' ').trim().slice(0, 40)
      if (t === '' || custom[b].includes(t)) continue
      custom[b].push(t)
      left -= 1
    }
  }
  settings = { on: c.on === true, freq, custom, onlyCustom: c.only_custom === true }
}

/** Le parole di un tipo: quelle della persona, con o al posto di quelle di serie della lingua. */
function wordsFor(lang: string, b: Bucket): string[] {
  const base = DEFAULTS[lang.slice(0, 2)] ?? DEFAULTS.it ?? { any: [] }
  const mine = settings.custom[b]
  const list = settings.onlyCustom ? mine : [...mine, ...(base[b] ?? [])]
  if (list.length > 0 || b === 'any') return list

  return wordsFor(lang, 'any')
}

// FNV-1a: stesso testo, stesso numero
const hash = (s: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// dove comincia la prima parola chiave nel testo, o -1
const firstAt = (t: string, list: string[]) => list.reduce((at, w) => {
  const k = t.indexOf(w)
  return k !== -1 && (at === -1 || k < at) ? k : at
}, -1)

// una parola chiave a inizio parola ("ora" non in "finora", "parto" non in "riparto", "start" non in "restart");
// quelle scritte con lo spazio finale ("sto ", "ora ") solo come parola intera
const at = (w: string) => ` ${w.trimStart()}`

/**
 * Il momento della frase dalle sue prime parole; "any" se nessuna parola chiave c'e' (anche alla prima frase:
 * l'inizio e' solo per le frasi che cominciano davvero qualcosa).
 * `question`: la frase finisce con "?" o chiede di scegliere (allora e' sempre una domanda).
 */
export const momentOf = (prefix: string, lang: string, _first = false, question = false): Bucket => {
  if (question) return 'domanda'
  const cues = CUES[lang.slice(0, 2)] ?? CUES.it
  const t = ` ${prefix} `
  if (!cues) return 'any'
  for (const m of ['errore', 'problema', 'stupore', 'domanda', 'successo'] as const) if (cues[m].some(w => t.includes(at(w)))) return m
  // inizio e attesa: vince la parola che viene prima ("comincio adesso" e' un inizio, "aspetta, comincio" un'attesa)
  const start = firstAt(t, cues.inizio.map(at))
  const wait = firstAt(t, cues.attesa.map(at))
  if (start !== -1 && (wait === -1 || start <= wait)) return 'inizio'

  return wait !== -1 ? 'attesa' : 'any'
}

/** Se la frase (i suoi primi LOOK caratteri) e' una domanda: finisce con "?" o chiede alla persona di scegliere. */
const isQuestion = (sentence: string, lang: string) => {
  const end = /[.!?…]+(?=\s|$)/.exec(sentence)
  if (end && end.index < LOOK && end[0].includes('?')) return true
  const head = sentence.slice(0, LOOK)
  const t = ` ${head.toLowerCase().replace(/[^\p{L}\p{N}' -]+/gu, ' ').replace(/\s+/g, ' ')} `

  return (ASKS[lang.slice(0, 2)] ?? ASKS.it ?? []).some(w => t.includes(` ${w}`))
}

const keyOf = (prefix: string) => prefix.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim()

/**
 * Se una frase che comincia con queste parole puo' prendere un'esclamazione (la frequenza scelta lo decide
 * dalle sole prime parole); se no, non serve aspettarne la fine per sapere se e' una domanda.
 */
const mayExclaim = (prefix: string, lang: string) => {
  const key = keyOf(prefix)

  return key !== '' && hash(`${lang.slice(0, 2)}|${key}`) % EVERY[settings.freq] === 0
}

/** L'esclamazione per una frase che comincia con queste parole, o '' se non ne va messa. */
export function exclamationFor(prefix: string, lang: string, first = false, question = false): string {
  const key = keyOf(prefix)
  if (!mayExclaim(prefix, lang)) return ''
  const h = hash(`${lang.slice(0, 2)}|${key}`)
  const list = wordsFor(lang, momentOf(key, lang, first, question))
  if (list.length === 0) return ''
  // una frase intera, cosi' come e' scritta; a inizio frase con la maiuscola ("bella zio" -> "Bella zio!")
  const picked = list[(h >>> 7) % list.length] ?? ''
  const word = picked.charAt(0).toLocaleUpperCase() + picked.slice(1)

  return word === '' ? '' : /[!?.,…]$/.test(word) ? `${word} ` : `${word}! `
}

// righe in cui non si mette nulla: titoli, citazioni, elenchi, tabelle, righe rientrate (codice), la riga della voce
const NOT_PROSE = /^\s*(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\||\[voce\]:)|^( {4}|\t)/
// una frase che comincia con codice, un percorso, un numero, virgolette o parentesi: niente
const NOT_OPENER = /^[`/~\\\d"'«“‘([{<*_$@#]/

/**
 * Il testo con le esclamazioni; con final false (testo che sta ancora arrivando) solo la parte gia' decisa:
 * `used` e' quanta parte del testo in ingresso e' gia' tutta in `out`.
 */
export function colorize(text: string, lang: string, final = true): { out: string; used: number } {
  if (!settings.on) return { out: text, used: text.length }
  let out = ''
  let fence = false
  let i = 0
  let first = true
  while (i < text.length) {
    const nl = text.indexOf('\n', i)
    const lineEnd = nl === -1 ? text.length : nl + 1
    const line = text.slice(i, lineEnd)
    const whole = nl !== -1 || final
    // l'inizio della riga serve per capire che riga e': si aspetta di averne abbastanza
    if (!whole && line.trim().length < 4) return { out, used: i }
    if (/^\s*(```|~~~)/.test(line)) {
      if (!whole) return { out, used: i }
      fence = !fence
      out += line
      i = lineEnd
      continue
    }
    if (fence || NOT_PROSE.test(line)) {
      out += line
      if (!whole) return { out, used: lineEnd }
      i = lineEnd
      continue
    }
    // le frasi della riga: all'inizio della riga e dopo . ! ? … seguiti da spazio
    let j = 0
    const body = line
    while (j < body.length) {
      // gli spazi prima della frase
      const lead = /^\s*/.exec(body.slice(j))?.[0] ?? ''
      out += lead
      j += lead.length
      if (j >= body.length) break
      const rest = body.slice(j)
      const endM = /[.!?…]+(?=\s|$)/.exec(rest)
      const sentence = endM ? rest.slice(0, endM.index + endM[0].length) : rest
      const done = endM !== null && (endM.index + endM[0].length < rest.length || whole)
      const all = sentence.split(/\s+/).filter(w => w !== '')
      // la scelta si fa con le prime 4 parole intere (l'ultima, se il testo sta ancora arrivando, puo' crescere),
      // o con la frase intera se e' piu' corta e gia' finita
      const words = done || whole || /\s$/.test(sentence) ? all : all.slice(0, -1)
      if (words.length < 4 && !done && !whole) return { out, used: i + j }
      const opener = words[0] ?? ''
      const eligible = !NOT_OPENER.test(opener) && /\p{L}/u.test(opener)
      // per sapere se e' una domanda serve la fine della frase: si aspetta fino a LOOK caratteri (se la fine
      // arriva dopo, non e' una domanda col "?", ne' per la voce ne' per il testo mostrato)
      if (!done && !whole && (endM ? endM.index < LOOK : rest.length <= LOOK)) {
        // la prima frase che non prende esclamazioni passa subito, cosi' com'e': la voce parte alla prima virgola
        // (la scelta non cambia: dipende solo dalle prime 4 parole, gia' arrivate)
        if (first && !(eligible && mayExclaim(words.slice(0, 4).join(' '), lang))) return { out: out + rest, used: i + j + rest.length }

        return { out, used: i + j }
      }
      if (eligible) {
        const added = exclamationFor(words.slice(0, 4).join(' '), lang, first, isQuestion(sentence, lang))
        if (added !== '') noteExclamation(added)
        out += added
      }
      first = false
      out += sentence
      j += sentence.length
      if (!endM && !whole) return { out, used: i + j }
    }
    i = lineEnd
  }

  return { out, used: text.length }
}

// le esclamazioni messe di recente, per dire all'app quale parola colorita apre una frase detta
const ADDED: string[] = []
const noteExclamation = (added: string) => {
  const word = added.trim()
  if (ADDED.includes(word)) return
  ADDED.push(word)
  if (ADDED.length > 40) ADDED.shift()
}

/** L'esclamazione colorita con cui comincia una frase detta (messa da colorize), o undefined. */
export const lastExclamation = (line: string): string | undefined => {
  const head = line.trimStart()
  const found = ADDED.filter(word => head.startsWith(word) && !/[\p{L}\p{N}]/u.test(head.charAt(word.length))).sort((a, b) => b.length - a.length)[0]

  return found
}

/** Lo stesso, per il testo che arriva a pezzi (la voce): restituisce solo il nuovo testo gia' deciso. */
export class Colorizer {
  private raw = ''
  private sent = 0
  constructor(private lang: string) {}

  push(chunk: string): string {
    if (!settings.on) return chunk
    this.raw += chunk
    const { out } = colorize(this.raw, this.lang, false)
    const delta = out.slice(this.sent)
    this.sent = out.length

    return delta
  }

  /** La fine di un blocco di testo: il resto, deciso fino in fondo; poi si ricomincia da capo. */
  flush(): string {
    if (!settings.on && this.raw === '') return ''
    const { out } = colorize(this.raw, this.lang, true)
    const delta = out.slice(this.sent)
    this.raw = ''
    this.sent = 0

    return delta
  }
}

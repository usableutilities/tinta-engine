import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Voice, VoiceSetting } from './tipi'
import { RELAX_MS, moodThenIdle, setMood } from './stato'
import { lastExclamation } from './colorito'
import { READING_DEFAULT } from '../lettura'
import type { Reading, ReadingMode } from '../lettura'
import { LANGUAGES, customVoiceOf, isClonedId, emphasisOf, gesturesOf, withoutEmoji, kokoroVoiceOf, languageOfId, systemVoiceOf, toneOf } from './voce'

/**
 * La voce del volto, una sola per tutto il Mac: ogni sessione scrive le sue frasi nella
 * stessa cartella (spool), e chi sintetizza le dice in ordine. Una risposta che comincia a
 * parlare in qualunque sessione alza la "generazione" e chi sintetizza butta tutto il resto.
 *
 * Chi sintetizza (docs/VOCE.md):
 * - l'app Tinta, quando in comando.json dice `"synth": 1` (e il suo battito `app_t` e' fresco):
 *   legge le frasi, le sintetizza, le suona e scrive le labbra; il motore non avvia nulla;
 * - un aiuto di sviluppo, solo se la variabile TINTA_VOICE_HELPER ne indica il percorso: il
 *   motore lo avvia sulla cartella comune (e, se non parte, una frase alla volta);
 * - altrimenti la sintesi di sistema ($.audio.speak).
 */

const voce = atom({ plugin: 'tinta', key: 'voltoVoce' } as const, { on: false } as VoiceSetting, { shape: 'voce-2' })
const voices = atom({ plugin: 'tinta', key: 'voltoVoices' } as const, [] as Voice[], { shape: 'voices-1' })
const kokoro = atom({ plugin: 'tinta', key: 'voltoKokoro' } as const, false, { shape: 'kokoro-1' })
// la risposta che si sta ascoltando a mano (il suo pulsante dice Ferma); '' nessuna
const ascolto = atom({ plugin: 'tinta', key: 'voltoAscolto' } as const, '', { shape: 'ascolto-1' })
// il volume della voce che sta suonando (0 nessuno, 1..4): la bocca lo segue
const level = atom({ plugin: 'tinta', key: 'voltoLevel' } as const, 0, { shape: 'level-1' })
// la frase che si sente adesso, per la risposta in chat (lettura.ts): il suo testo grezzo e come mostrarla
const lettura = atom({ plugin: 'tinta', key: 'voltoLettura' } as const, { text: '', mode: READING_DEFAULT } as Reading, { shape: 'lettura-1' })

// tutto sotto ~/.claude/tinta/voce: l'app Tinta (con sandbox) legge da li' la voce e le labbra
const SPOOL = '.claude/tinta/voce/spool'
const BEAT_MS = 10_000
const WATCH_MS = 150

// --- la lettura in chat: quale frase della risposta si sente adesso ---

// il testo grezzo di ogni mia frase scritta nella cartella, per numero (seq): la chat lo ritrova nella risposta
const spans = new Map<number, string>()
// le frasi fino a questo numero sono di risposte di prima (un nuovo messaggio): non si evidenziano piu'
let floorSeq = 0
let readingMode: ReadingMode = READING_DEFAULT
let readingShown = ''

/** comando.json "reading": come la chat mostra la lettura (segno, evidenza, entrambi, spento). */
export async function setReadingMode($: EngineInterface, mode: ReadingMode) {
  if (mode === readingMode) return
  readingMode = mode
  await showReading($, readingShown, true)
}

/** Per i test: la frase mostrata adesso e i testi delle frasi. */
export const readingState = () => ({ text: readingShown, mode: readingMode, floorSeq, spans: new Map(spans) })

// la frase si tiene anche a "spento": la chat non mostra niente, ma il pulsante Ascolta sa che si sta leggendo
async function showReading($: EngineInterface, text: string, force = false) {
  const next = text
  if (next === readingShown && !force) return
  readingShown = next
  dbg($, `lettura: ${next === '' ? 'nessuna' : `«${next.slice(0, 80)}»`} (${readingMode})`)
  await update($, lettura, () => ({ text: next, mode: readingMode })).catch(() => undefined)
}

/** La frase che suona adesso, dal nome che l'app scrive (`<gen>-<n>`, n = seq * 100 + pezzo): il suo testo grezzo. */
export const readingOf = (name: string | undefined, gen: number, floor: number, texts: ReadonlyMap<number, string>): string | undefined => {
  const m = /^(\d+)-(\d+)$/.exec(name ?? '')
  if (!m || Number(m[1]) !== gen) return undefined
  const at = Math.floor(Number(m[2]) / 100)

  return at > floor ? texts.get(at) : undefined
}

let dir: string | undefined
let sid = ''
let myGen = -1 // la generazione della mia risposta che sta parlando (-1: nessuna)
let seq = 0
let pending = 0 // frasi mie non ancora finite
let replyOpen = false
// la risposta in corso e' stata fermata da qui (Ferma, il pannello chiuso): tace fino alla prossima risposta
let hushed = false
let replyLang: string | undefined
let helper: { return: () => Promise<unknown> } | undefined
let watch: { cancel: () => void } | undefined
let beat: { cancel: () => void } | undefined
let sysGen = 0
let chain: Promise<void> = Promise.resolve()
let visible = true

/** La variabile che indica l'aiuto di sviluppo (mai usato se non c'e'). */
export const HELPER_ENV = 'TINTA_VOICE_HELPER'
/** La versione del contratto con l'app che questo motore parla (comando.json "synth"). */
export const SYNTH_VERSION = 1
/** Il battito dell'app vale per questo tempo (comando.json "app_t"). */
const APP_FRESH_MS = 5000
// il percorso dell'aiuto di sviluppo, se la variabile lo indica e il file c'e'
let helperPath: string | undefined
// chi dice le frasi della cartella comune adesso
let synth: 'app' | 'helper' | 'none' = 'none'
// chi diceva le frasi mie ancora in coda (per capire quando sono finite)
let spoolBy: 'app' | 'helper' | undefined

/** Chi sintetizza adesso: l'app (se lo dice ed e' viva), l'aiuto di sviluppo, o nessuno (allora il sistema). */
export const synthMode = () => synth
export const helperOf = () => helperPath

/** L'app sintetizza: comando.json fresco (app_t 0 e' l'app che si chiude) con "synth" di una versione che il motore conosce. */
export const appSynthesizes = (cmd: { synth?: unknown; app_t?: unknown }, now: number) =>
  typeof cmd.app_t === 'number' && cmd.app_t > 0 && now - cmd.app_t < APP_FRESH_MS && typeof cmd.synth === 'number' && cmd.synth >= SYNTH_VERSION

/** Rilegge chi sintetizza (dal comando dell'app gia' letto); true se e' cambiato. */
export function setSynth(cmd: { synth?: unknown; app_t?: unknown } | undefined, now: number): boolean {
  const next = cmd && appSynthesizes(cmd, now) ? 'app' : helperPath ? 'helper' : 'none'
  if (next === synth) return false
  synth = next

  return true
}

/** L'aiuto di sviluppo: il percorso dalla variabile TINTA_VOICE_HELPER, se il file c'e'. */
export async function findHelper($: EngineInterface) {
  const path = (await $.env.get('TINTA_VOICE_HELPER').catch(() => undefined))?.trim()
  helperPath = path && path.startsWith('/') && (await $.fs.exists(path).catch(() => false)) ? path : undefined
  if (synth !== 'app') synth = helperPath ? 'helper' : 'none'

  return helperPath
}

/** L'id breve di questa sessione (quello delle frasi e del battito). */
export const sessionTag = () => sid

/** La voce sta ancora dicendo qualcosa di questa sessione? (allora il volto resta a parlare) */
export const isSpeaking = () => pending > 0

/** Per i test: lo stato interno, e un azzeramento. */
export const speechState = () => ({ dir, sid, myGen, seq, pending, replyOpen })
export const resetSpeech = () => {
  dir = undefined
  hushed = false
  helperPath = undefined
  synth = 'none'
  spoolBy = undefined
  sid = ''
  myGen = -1
  seq = 0
  pending = 0
  replyOpen = false
  replyLang = undefined
  spans.clear()
  floorSeq = 0
  readingMode = READING_DEFAULT
  readingShown = ''
  helper = undefined
  watch = undefined
  beat = undefined
  visible = true
}

/** All'inizio della sessione: la cartella comune e il battito di questa sessione. */
export async function voiceStart($: EngineInterface) {
  const home = await $.env.get('HOME').catch(() => undefined)
  if (!home) return
  dir = `${home}/${SPOOL}`
  logPath = `${home}/.claude/tinta/voce/debug.log`
  const id = await $.session.id().catch(() => '')
  sid = (id.replace(/[^\w]/g, '').slice(0, 12) || `s${Math.floor(Math.random() * 1e9)}`)
  await heartbeat($)
  await update($, level, l => (l === 0 ? l : 0)).catch(() => undefined)
  dbg($, `sessione avviata, cartella ${dir}`)
  beat?.cancel()
  beat = $.clock.every(BEAT_MS, () => void heartbeat($).catch(() => undefined))
}

async function heartbeat($: EngineInterface) {
  if (!dir) return
  const now = await $.clock.now()
  await $.fs.write(`${dir}/sessions/${sid}`, String(now / 1000)).catch(() => undefined)
}

/** Fine della sessione: lascia la sua coda; l'aiuto si spegne da solo quando non resta nessuno. */
export async function voiceEnd($: EngineInterface) {
  await stopMine($)
  beat?.cancel()
  if (dir) await $.fs.write(`${dir}/sessions/${sid}`, '0').catch(() => undefined)
  const h = helper
  helper = undefined
  void h?.return().catch(() => undefined)
}

// dove sta il volto: nel pannello Attivita' (di Tinta, che non e' tra i nostri pannelli) o nel suo.
// Si parla finche' non arriva un segnale certo che il volto non si vede (il suo pannello chiuso).
let place: 'attivita' | 'separato' = 'attivita'
let attivitaOpen = true

export function setPlace(p: 'attivita' | 'separato') {
  place = p
}

/** Il pannello Attivita' ha disegnato il volto (true) o e' stato chiuso (false). */
export function attivitaShown(open: boolean) {
  attivitaOpen = open
}

/** Il pannello del volto si e' disegnato: si vede. */
export function shown() {
  visible = true
}

/** Il pannello del volto e' stato chiuso: zitto subito. */
export function hidden() {
  visible = false
}

// il volto nella finestra dell'app (agganciato o in primo piano): si vede li', qualunque pannello sia aperto qui
let nativeShown = false
export const setNativeShown = (on: boolean) => {
  nativeShown = on
}
const isVisible = () => nativeShown || (place === 'attivita' ? attivitaOpen : visible)

// --- registro per capire cosa succede: ~/.claude/tinta/voce/debug.log, ultime 300 righe ---

let logPath: string | undefined
let logLines: string[] = []
let logChain: Promise<void> = Promise.resolve()

/** Una riga nel registro (mai un errore se non si puo' scrivere). */
export function dbg($: EngineInterface, text: string) {
  if (!logPath) return
  const path = logPath
  logChain = logChain
    .then(async () => {
      const at = new Date(await $.clock.now()).toISOString()
      logLines.push(`${at} [${sid}] ${text}`)
      if (logLines.length > 300) logLines = logLines.slice(-300)
      await $.fs.write(path, `${logLines.join('\n')}\n`)
    })
    .catch(() => undefined)
}

/** Scalda l'aiuto comune (modello caricato e prima sintesi fatta) prima che serva. */
export async function warmUp($: EngineInterface) {
  const setting = await voiceSetting($)
  if (setting.on && synth === 'helper' && engineOf(setting.engine, await read($, kokoro)) === 'kokoro' && (await read($, kokoro))) await ensureHelper($)
}

/** Una nuova richiesta: zitto, e si prepara la prossima risposta (l'aiuto si scalda mentre il modello pensa). */
export function replyBegin($: EngineInterface): Promise<void> {
  lines = lines.then(() => beginNow($)).catch(() => undefined)

  return lines
}

async function beginNow($: EngineInterface) {
  // un nuovo messaggio non interrompe la voce: la risposta nuova si mette in coda dopo, nella stessa
  // generazione. Se intanto la voce e' passata a un'altra sessione, o l'app e' gia' oltre, o la voce di prima
  // e' finita, la prossima frase la riprende con una generazione nuova: myGen non resta mai oltre la sua risposta
  if (dir && myGen >= 0 && (pending === 0 || (await readGen($)).gen !== myGen || (await appGen($)) > myGen)) myGen = -1
  // la risposta di prima smette di essere evidenziata (la voce, se continua, la finisce)
  floorSeq = seq
  await showReading($, '')
  hushed = false
  replyOpen = true
  replyLang = undefined
  const setting = await voiceSetting($)
  if (setting.on && synth === 'helper' && engineOf(setting.engine, await read($, kokoro)) === 'kokoro' && isVisible()) await ensureHelper($)
}

/** La risposta e' finita: se non c'e' piu' niente da dire, il volto sorride e torna a riposo. */
export async function replyEnd($: EngineInterface) {
  // le ultime frasi della risposta devono essere gia' in coda
  await lines
  replyOpen = false
  if (pending === 0) return false
  return true
}

const engineOf = (engine: 'kokoro' | 'sistema' | undefined, hasKokoro: boolean) => engine ?? (hasKokoro ? 'kokoro' : 'sistema')

// le frasi passano una alla volta, nell'ordine in cui arrivano: niente gare sulla generazione
let lines: Promise<void> = Promise.resolve()

/** Dice una frase della risposta (gia' pulita), dopo quelle prima. */
export function sayLine($: EngineInterface, line: string, force = false, source?: string): Promise<void> {
  lines = lines.then(() => sayNow($, line, force, source)).catch(() => undefined)

  return lines
}

/**
 * Ascolta a mano una risposta (il pulsante sotto di lei): anche a voce spenta, con la voce e la velocita'
 * scelte; ferma quello che si stava dicendo. Il pulsante resta "Ferma" finche' non ha finito.
 */
export async function listen($: EngineInterface, chunks: (string | { line: string; source: string })[], key: string) {
  await stopMine($)
  hushed = false
  manualKey = key
  replyLang = undefined
  floorSeq = seq
  await update($, ascolto, () => key).catch(() => undefined)
  for (const one of chunks) void (typeof one === 'string' ? sayLine($, one, true) : sayLine($, one.line, true, one.source))
}

/** Ferma l'ascolto a mano. */
export async function stopListening($: EngineInterface) {
  await stopMine($)
}

let manualKey = ''

async function endListening($: EngineInterface) {
  if (manualKey === '') return
  manualKey = ''
  await update($, ascolto, () => '').catch(() => undefined)
}

async function sayNow($: EngineInterface, line: string, force = false, source?: string) {
  // fermata a meta': il resto di questa risposta non si dice (la prossima risposta riprende la voce)
  if (hushed && !force) return void dbg($, `frase saltata: lettura fermata («${line.slice(0, 40)}»)`)
  const setting = await voiceSetting($)
  const hasKokoro = await read($, kokoro)
  const engine = engineOf(setting.engine, hasKokoro)
  dbg($, `frase: voce=${setting.on ? 'si' : 'no'} dove=${nativeShown ? "finestra dell'app" : place} visibile=${isVisible() ? 'si' : 'no'} motore=${engine} sintesi=${synth} kokoro=${hasKokoro ? 'c\'e\'' : 'manca'}${kokoroBroken ? ` (rotto: ${kokoroBroken})` : ''} cartella=${dir ? 'si' : 'no'} «${line.slice(0, 60)}»`)
  if (!force && (!setting.on || !isVisible())) {
    dbg($, `frase saltata: ${!setting.on ? 'voce spenta' : `volto non visibile (dove=${place}, pannello ${place === 'attivita' ? (attivitaOpen ? 'aperto' : 'chiuso') : visible ? 'aperto' : 'chiuso'})`}`)

    return
  }
  // la lingua e la voce le sceglie la persona: si usano sempre quelle, senza indovinare
  replyLang = setting.lang ?? 'it'
  if (engine === 'kokoro' && hasKokoro) {
    const voice = kokoroVoiceOf(replyLang, setting.kokoro)
    if (voice && dir && (synth === 'app' || !kokoroBroken) && (await kokoroSay($, line, voice, setting.speed ?? 1, false, source))) return
    // la cartella comune non va: l'aiuto di sviluppo una frase alla volta, come la prima versione (che funzionava)
    if (voice && synth === 'helper' && !oneShotBroken) return oneShotSay($, withoutEmoji(line), voice, setting.speed ?? 1)
    dbg($, `kokoro non usato (voce per ${replyLang ?? '?'}: ${voice ?? 'nessuna'}): parla il sistema`)
  }
  systemSay($, withoutEmoji(line), systemVoiceOf(await read($, voices), replyLang, setting.voice), setting.speed ?? 1, source)
}

/** La generazione a cui e' l'app (spool/state, la sua prima parola); 0 se non la dice. */
async function appGen($: EngineInterface): Promise<number> {
  const g = Number(String(await $.fs.read(`${dir}/state`).catch(() => '')).trim().split(/\s+/)[0])

  return Number.isFinite(g) && g > 0 ? g : 0
}

/** La generazione nuova di chi prende la voce: oltre quella di spool/gen e oltre quella dell'app (che butta le minori). */
export const nextGen = (spoolGen: number, stateGen: number) => Math.max(spoolGen, stateGen) + 1

async function readGen($: EngineInterface): Promise<{ gen: number; owner: string }> {
  try {
    const [g, owner] = String(await $.fs.read(`${dir}/gen`)).trim().split(/\s+/)
    const gen = Number(g)

    return { gen: Number.isFinite(gen) ? gen : 0, owner: owner ?? '' }
  } catch {
    return { gen: 0, owner: '' }
  }
}

/** Scrive la frase per l'aiuto comune; false se non si puo' (e allora parla il sistema). */
async function kokoroSay($: EngineInterface, line: string, voice: string, speed: number, preview = false, source?: string) {
  if (!dir || synth === 'none') return false
  const by = synth
  const now = await readGen($)
  if (myGen < 0) {
    // la mia risposta comincia a parlare: prende la voce, chi parlava tace
    // mai sotto la generazione dell'app: le frasi di una minore le butterebbe senza dirlo
    const app = await appGen($)
    myGen = nextGen(now.gen, app)
    await $.fs.write(`${dir}/gen`, `${myGen} ${sid}`)
    dbg($, `prendo la voce: generazione ${myGen} (prima ${now.gen} ${now.owner || '-'}${app > now.gen ? `, l'app era a ${app}` : ''})`)
  } else if (now.gen !== myGen) {
    // un'altra sessione ha preso la parola: questa risposta non parla piu'
    dbg($, `la voce e' di ${now.owner || 'nessuno'} (generazione ${now.gen}): taccio`)
    return true
  }
  if (by === 'helper') await ensureHelper($)
  seq += 1
  if (source !== undefined) {
    spans.set(seq, source)
    if (spans.size > 400) spans.delete(spans.keys().next().value as number)
  }
  const name = `${myGen}-${String(seq).padStart(6, '0')}-${sid}.txt`
  // il tono della frase e le parole da sottolineare, per le microespressioni dell'app (se le vuole)
  const cues = toneCues ? cuesHeader(line) : ''
  // le faccine non si leggono (ma i loro gesti restano, sulla parola vicina)
  const spoken = withoutEmoji(line)
  await $.fs.write(`${dir}/${name}`, sentenceFile({ voice, lang: by === 'app' ? replyLang ?? 'it' : undefined, speed, preview, cues, colorful: by === 'app' ? lastExclamation(line) : undefined, text: spoken }))
  dbg($, `scritto ${name} (${voice}, ${speed}x, per ${by === 'app' ? "l'app" : "l'aiuto"})`)
  spoolBy = by
  // la cartella si e' rotta mentre si scriveva: questa frase la dice l'aiuto da solo
  if (by === 'helper' && kokoroBroken) {
    oneShotSay($, line, voice, speed)

    return true
  }
  if (by === 'helper' && !helperReady) unconfirmed.push({ line, voice, speed })
  pending += 1
  await setMood($, 'talking')
  startWatch($)

  return true
}

/**
 * Il file di una frase nella cartella comune (docs/VOCE.md): le intestazioni, una per riga, poi il testo da dire
 * su una riga sola, poi "#fine" (un file senza e' ancora in scrittura). `lang` e `colorful` solo per l'app:
 * l'aiuto di sviluppo conosce solo le altre intestazioni (una sconosciuta la direbbe ad alta voce).
 */
export const sentenceFile = (s: { voice: string; lang?: string; speed: number; preview?: boolean; cues?: string; colorful?: string; text: string }) =>
  `voice: ${s.voice}\n${s.lang ? `lang: ${s.lang}\n` : ''}${s.speed === 1 ? '' : `speed: ${s.speed}\n`}${s.preview ? 'preview: 1\n' : ''}${s.cues ?? ''}${s.colorful ? `colorful: ${s.colorful.replace(/[\n|]/g, ' ')}\n` : ''}${s.text.replace(/\n/g, ' ')}\n#fine\n`

/**
 * La voce scelta adesso, per l'aiuto comune (impostazioni: {"voice","speed","t"}): le frasi gia' in coda, anche
 * gia' sintetizzate ma non ancora suonate, si rifanno con questa, dalla prossima frase.
 */
export async function publishVoiceSetting($: EngineInterface, voice: string, speed: number) {
  if (!dir) return
  const body = JSON.stringify({ voice, speed, t: await $.clock.now() })
  await $.fs.write(`${dir}/impostazioni.tmp`, body).catch(() => undefined)
  const moved = await $.process.run(['/bin/mv', '-f', `${dir}/impostazioni.tmp`, `${dir}/impostazioni`]).then(r => r.exitCode === 0, () => false)
  if (!moved) await $.fs.write(`${dir}/impostazioni`, body).catch(() => undefined)
  dbg($, `voce per l'aiuto: ${voice} ${speed}x`)
}

// la scelta di voce di adesso, anche dentro un passo del modello gia' cominciato (che vede lo stato di quando
// e' partito): la voce accesa dall'app a meta' risposta vale dalla frase dopo
let liveVoice: VoiceSetting | undefined
export const setLiveVoice = (s: VoiceSetting) => {
  liveVoice = s
}
async function voiceSetting($: EngineInterface): Promise<VoiceSetting> {
  return liveVoice ?? (await read($, voce))
}

let toneCues = true
/** comando.json "tone_cues": false spegne tono ed enfasi nelle tracce. */
export const setToneCues = (on: boolean) => {
  toneCues = on
}

const cuesHeader = (line: string) => {
  const tone = toneOf(line, replyLang)
  const words = emphasisOf(line).filter(w => !/[|\n]/.test(w))
  // i gesti: indice della parola nel testo detto, gesto, forza
  const gest = gesturesOf(line, replyLang).map(([i, g, s]) => `${i}:${g}:${s.toFixed(2)}`)

  return `${tone.type === 'neutro' ? '' : `tone: ${tone.type} ${tone.strength.toFixed(2)}\n`}${words.length > 0 ? `emphasis: ${words.join('|')}\n` : ''}${gest.length > 0 ? `gestures: ${gest.join('|')}\n` : ''}`
}

const SAMPLE: { [lang: string]: string } = {
  it: 'Ciao, questa e\' la mia voce. Ho controllato il progetto e i test passano.',
  'en-us': 'Hi, this is my voice. I checked the project and the tests pass.',
  'en-gb': 'Hello, this is my voice. I checked the project and the tests pass.',
  fr: 'Bonjour, voici ma voix. J\'ai vérifié le projet et les tests passent.',
  es: 'Hola, esta es mi voz. He revisado el proyecto y las pruebas pasan.',
  pt: 'Olá, esta é a minha voz. Verifiquei o projeto e os testes passam.',
}

/** La prova di una voce chiesta dall'app: una frase breve, subito, anche a voce spenta. */
export async function previewVoice($: EngineInterface, asked: string) {
  // l'app scrive le voci Kokoro come "k:<id>"
  const voiceId = asked.replace(/^k:/, '')
  const setting = await voiceSetting($)
  const custom = customVoiceOf(voiceId)
  const lang = custom?.lang ?? languageOfId(setting.lang).id
  const owner = custom ? undefined : LANGUAGES.find(l => (l.voices as readonly { id: string }[]).some(v => v.id === voiceId))
  const sampleLang = custom?.lang ?? owner?.id ?? lang
  replyLang = sampleLang
  const line = SAMPLE[sampleLang] ?? SAMPLE.it ?? ''
  await stopMine($)
  if (voiceId === 'sys') return systemSay($, line, systemVoiceOf(await read($, voices), sampleLang, setting.voice), setting.speed ?? 1)
  if (dir && (synth === 'app' || !kokoroBroken) && (await kokoroSay($, line, voiceId, setting.speed ?? 1, true))) return
  if (synth === 'helper') oneShotSay($, line, voiceId, setting.speed ?? 1)
}

// l'aiuto non parte: perche' (le frasi vanno a Kokoro una per volta), detto una volta nella riga di stato
let kokoroBroken: string | undefined
let warned = false
let helperReady = false
// frasi scritte nella cartella prima che l'aiuto dicesse "ready": se non arriva, si ridicono una per volta
let unconfirmed: { line: string; voice: string; speed: number }[] = []
const READY_MS = 12_000

/** L'aiuto e' vivo se il suo battito e' fresco; se no lo avvia questa sessione. */
async function ensureHelper($: EngineInterface) {
  // solo l'aiuto di sviluppo, e solo se la variabile lo indica: mai un percorso scritto qui
  if (!dir || kokoroBroken || synth !== 'helper' || !helperPath) return
  try {
    const [, t] = String(await $.fs.read(`${dir}/alive`)).trim().split(/\s+/)
    // un battito scritto prima che il mio aiuto uscisse e' di un morto
    if ((await $.clock.now()) / 1000 - Number(t) < 2 && Number(t) * 1000 > diedAt) {
      helperReady = true
      unconfirmed = []

      return
    }
  } catch {
    // nessun battito: si avvia
  }
  if (helper) return
  helperReady = false
  const argv = [helperPath, '--voice', 'if_sara', '--spool', dir]
  dbg($, `avvio l'aiuto: ${argv.join(' ')}`)
  let stream: ReturnType<EngineInterface['process']['spawn']>
  try {
    stream = $.process.spawn({ argv })
  } catch (error) {
    return failed($, `spawn rifiutato: ${error instanceof Error ? error.message : String(error)}`)
  }
  helper = stream as never
  // se l'aiuto non e' pronto in tempo: un tentativo fallito (al secondo di fila, una frase alla volta)
  $.clock.after(READY_MS, () => {
    if (helperReady || helper !== (stream as never)) return
    helper = undefined
    void stream.return(undefined as never).catch(() => undefined)
    void failed($, `nessun "ready" in ${READY_MS / 1000} s`)
  })
  void (async () => {
    let err = ''
    let out = ''
    try {
      let step = await stream.next()
      while (!step.done) {
        const piece = step.value
        if (piece.stream === 'stderr') err += piece.text
        else {
          out += piece.text
          if (/\bready\b/.test(piece.text)) {
            helperReady = true
            fails = 0
            unconfirmed = []
            dbg($, 'aiuto pronto')
          }
          if (/\bbusy\b/.test(piece.text)) dbg($, `c'e' gia' un aiuto: ${piece.text.trim()}`)
        }
        step = await stream.next()
      }
      const end = step.value
      dbg($, `aiuto finito: codice ${end.code ?? '-'} segnale ${end.signal ?? '-'}${err ? ` stderr: ${err.trim().slice(0, 300)}` : ''}`)
      const mine = helper === (stream as never)
      if (mine) {
        helper = undefined
        helperReady = false
        diedAt = await $.clock.now()
      }
      // uscito dopo essere stato pronto (fermato da fuori, 143, cambio di uscita audio...): non e' un guasto,
      // si riavvia alla prossima frase, o subito se ne restano da dire. Guasto solo se non arriva mai a "ready"
      const wasReady = /\bready\b/.test(out)
      if (!wasReady && !/\bbusy\b/.test(out) && mine) await failed($, err.trim().split('\n').pop() || `uscito con ${end.code ?? end.signal}`)
      else if (mine && pending > 0) $.clock.after(300, () => void ensureHelper($).catch(() => undefined))
    } catch (error) {
      if (helper === (stream as never)) helper = undefined
      await failed($, `non parte: ${error instanceof Error ? error.message : String(error)}`)
    }
  })()
}

// tentativi di fila finiti male (avvio rifiutato, uscito prima di "ready", "ready" che non arriva)
let fails = 0
// quando e' uscito il mio aiuto: i battiti piu' vecchi non contano
let diedAt = 0

/** Un tentativo andato male: al secondo di fila la cartella comune si lascia; prima, si riprova. */
async function failed($: EngineInterface, why: string) {
  fails += 1
  dbg($, `aiuto: tentativo ${fails} non riuscito (${why})`)
  if (fails >= 2) return broken($, why)
  if (pending > 0) $.clock.after(300, () => void ensureHelper($).catch(() => undefined))
}

/** La cartella comune non funziona: si dice una volta perche', l'aiuto si ferma, e Kokoro parla una frase alla volta. */
async function broken($: EngineInterface, why: string) {
  if (kokoroBroken) return
  kokoroBroken = why
  // la guardia della cartella comune non serve piu': le frasi le conta la via una per volta
  watch?.cancel()
  watch = undefined
  dbg($, `cartella comune non va: ${why}; Kokoro una frase alla volta`)
  const h = helper
  helper = undefined
  void h?.return().catch(() => undefined)
  // le frasi gia' scritte non le dira' nessuno: via dalla cartella (generazione nuova) e ridette una per volta
  if (dir && myGen >= 0) await $.fs.write(`${dir}/gen`, `${myGen + 1} -`).catch(() => undefined)
  myGen = -1
  const again = unconfirmed
  unconfirmed = []
  for (const one of again) oneShotSay($, one.line, one.voice, one.speed)
  if (!warned) {
    warned = true
    $.ui.status(`Volto: Kokoro condiviso non parte (${why.slice(0, 60)}), lo uso frase per frase`)
    $.clock.after(10_000, () => $.ui.status(undefined))
  }
}

// --- Kokoro una frase alla volta: un processo per frase, il testo su stdin (la via della prima versione) ---

const ESPEAK: { [lang: string]: string } = { it: 'it', 'en-us': 'en-us', 'en-gb': 'en-gb', fr: 'fr-fr', es: 'es', pt: 'pt-br', ja: 'ja', zh: 'cmn', hi: 'hi' }
let oneShotBroken = false
// i numeri delle tracce delle labbra di una frase alla volta (100 per frase: una frase lunga ne fa piu' d'una)
let oneShotSeq = 0
let oneShot: { return: () => Promise<unknown> } | undefined

function oneShotSay($: EngineInterface, line: string, voice: string, speed: number) {
  const helper = helperPath
  // senza l'aiuto di sviluppo non c'e' una frase alla volta: parla il sistema
  if (!helper) return systemSay($, line, undefined, speed)
  const gen = sysGen
  pending += 1
  void setMood($, 'talking')
  chain = chain.then(async () => {
    if (gen !== sysGen) return
    // le labbra per la finestra dell'app: la generazione di adesso nella cartella comune, numeri sempre nuovi
    const lips = dir ? [`--labbra`, dir.replace(/\/spool$/, '/labbra'), '--gen', String((await readGen($)).gen), '--seq', String((oneShotSeq += 100))] : []
    // una voce da file: il suo tensore e la sua lingua
    const custom = customVoiceOf(voice)
    // una voce clonata la sa fare solo l'app: qui, una frase alla volta, la voce di serie della lingua
    const pick = isClonedId(voice) ? ['--voice', kokoroVoiceOf(replyLang, undefined)] : custom?.kind === 'clone' ? ['--voice', kokoroVoiceOf(custom.lang, undefined)] : custom ? ['--voice-file', custom.path, '--lang', ESPEAK[custom.lang] ?? 'it'] : ['--voice', voice]
    const argv = [helper, ...pick, ...(speed === 1 ? [] : ['--speed', String(speed)]), ...lips]
    dbg($, `kokoro una frase: «${line.slice(0, 60)}»`)
    // la bocca parla mentre il processo della frase suona, e si chiude quando esce
    void setMood($, 'talking')
    await gapMouth($, false, 'una frase alla volta: parte')
    let ok = false
    let err = ''
    try {
      const stream = $.process.spawn({ argv, input: line })
      oneShot = stream as never
      let step = await stream.next()
      while (!step.done) {
        if (step.value.stream === 'stderr') err += step.value.text
        step = await stream.next()
      }
      ok = step.value.code === 0 || step.value.signal !== null
      if (!ok) dbg($, `kokoro una frase: codice ${step.value.code} ${err.trim().slice(0, 200)}`)
    } catch (error) {
      dbg($, `kokoro una frase non parte: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      oneShot = undefined
      await gapMouth($, true, 'una frase alla volta: finita')
    }
    if (!ok && gen === sysGen) {
      oneShotBroken = true
      await $.audio.speak(line).catch(() => undefined)
    }
    if (gen !== sysGen) return
    pending -= 1
    if (pending <= 0) await drained($)
  })
}

/** Controlla quando le mie frasi sono finite, o se un'altra sessione ha preso la parola. */
function startWatch($: EngineInterface) {
  if (watch) return
  quiet = 0
  watch = $.clock.every(WATCH_MS, () => void check($).catch(() => undefined))
  lipTimer?.cancel()
  if (LIPSYNC) lipTimer = $.clock.every(LIP_MS, () => void lip($).catch(() => undefined))
}

/**
 * Labbra a tempo con il volume: spento. Sul desktop i ridisegni a ogni livello non arrivano con regolarita'
 * (la bocca si fermava dopo mezzo secondo); per tutta la riproduzione resta l'umore "parla", con il suo ritmo.
 */
const LIPSYNC = false

// ogni 200 ms: la macchina del proprietario e' carica
const LIP_MS = 200

async function check($: EngineInterface) {
  if (!dir || pending === 0) return drained($)
  if (!isVisible()) return stopMine($)
  // l'app che diceva le mie frasi non c'e' piu' (chiusa): nessuno le dira', la voce e' finita
  if (spoolBy === 'app' && synth !== 'app') {
    dbg($, "l'app non sintetizza piu': le mie frasi in coda non le dice nessuno")
    pending = 0

    return drained($)
  }
  const { gen } = await readGen($)
  if (gen !== myGen) return drained($)
  const left = (await $.fs.list(dir).catch(() => [])).some(f => f.name.startsWith(`${myGen}-`) && f.name.endsWith(`-${sid}.txt`))
  const raw = String(await $.fs.read(`${dir}/state`).catch(() => '')).trim()
  const [g, playing, busy, , until] = raw.split(/\s+/)
  const mine = Number(g) === myGen
  // l'orologio dell'aiuto: fin quando suona l'audio gia' mandato all'uscita (0 con un aiuto vecchio)
  const end = Number(until) || 0
  const now = await $.clock.now()
  const more = Number(busy) > 0
  // la bocca parla finche' l'audio suona davvero (+100 ms); tra un tratto e l'altro si chiude solo per un
  // silenzio vero, di almeno 250 ms. Un ridisegno per inizio e fine, non di piu'
  // quando suona l'app (comando.json "player": "app"), la bocca segue il suo rapporto "playing", e finche'
  // restano suoi file audio di questa risposta la voce non e' finita
  const app = await appPlayback($, now)
  // la frase che si sente: il nome in spool/state, o il tratto di "playing" in comando.json; tra due frasi resta la prima
  const heard = readingOf(mine ? playing : undefined, myGen, floorSeq, spans) ?? readingOf(app?.name, myGen, floorSeq, spans)
  if (heard !== undefined) await showReading($, heard)
  const sounding = app ? app.sounding : mine && ((playing !== '-' && playing !== 'wait') || now <= end + (more ? 250 : 100))
  await gapMouth($, !sounding, app ? `app ${app.why}` : `${raw} (${end > 0 ? `${Math.round(now - end)} ms dalla fine` : 'senza orologio'})`)
  if (left || (app && (app.sounding || app.waiting)) || (mine && (playing !== '-' || more || (!app && now <= end + 100)))) {
    quiet = 0

    return
  }
  // tra un tratto e l'altro l'aiuto puo' sembrare fermo per un attimo: si smette solo dopo tre controlli
  quiet += 1
  if (quiet < 3) return
  pending = 0
  await drained($)
}

/** Se suona l'app: la sua voce suona adesso (per questa risposta), e se ha ancora tratti da suonare. */
async function appPlayback($: EngineInterface, now: number): Promise<{ sounding: boolean; waiting: boolean; why: string; name?: string } | undefined> {
  if (!dir) return undefined
  const base = dir.replace(/\/spool$/, '')
  let cmd: { player?: unknown; app_player?: unknown; app_t?: unknown; playing?: unknown } = {}
  try {
    cmd = JSON.parse(String(await $.fs.read(`${base}/comando.json`)))
  } catch {
    return undefined
  }
  const fresh = typeof cmd.app_t === 'number' && now - cmd.app_t < 5000
  if (!fresh || !(cmd.player === 'app' || cmd.app_player === true)) return undefined
  const p = typeof cmd.playing === 'object' && cmd.playing !== null ? (cmd.playing as { gen?: unknown; n?: unknown; t?: unknown; until?: unknown }) : undefined
  const ours = p !== undefined && p.gen === myGen
  const t = typeof p?.t === 'number' ? p.t : 0
  const until = typeof p?.until === 'number' ? p.until : 0
  const files = await $.fs.list(`${base}/audio`).catch(() => [])
  const played = new Set(Array.isArray((cmd as { played?: unknown }).played) ? ((cmd as { played: unknown[] }).played.filter(x => typeof x === 'string') as string[]) : [])
  const waiting = files.some(f => f.name.startsWith(`${myGen}-`) && f.name.endsWith('.wav') && !played.has(f.name))
  // un'app che non dice "playing": la bocca parla finche' ci sono tratti suoi non ancora suonati
  if (p === undefined) return { sounding: waiting, waiting, why: waiting ? 'senza "playing", tratti in coda' : 'senza "playing", niente in coda' }
  const sounding = ours && (until > 0 ? now <= until + 100 : now - t < 400)

  return { sounding, waiting, why: ours ? `tratto ${String(p?.n)}${until > 0 ? `, ${Math.round(now - until)} ms dalla fine` : ''}` : 'ferma', ...(ours && sounding && typeof p?.n === 'number' ? { name: `${myGen}-${p.n}` } : {}) }
}

let quiet = 0
let closedShown = false

/** Bocca chiusa nelle pause tra i tratti (livello 1 = labbra chiuse), aperta al suo ritmo mentre suona (0). */
async function gapMouth($: EngineInterface, closed: boolean, why = '') {
  if (closed === closedShown) return
  closedShown = closed
  dbg($, `bocca: ${closed ? 'chiusa' : 'parla'}${why ? `, stato ${why}` : ''}`)
  lipShown = closed ? 1 : 0
  await update($, level, () => (closed ? 1 : 0)).catch(() => undefined)
  levelHook?.()
}
// chi vuole sapere quando cambia il livello (il controllo del ridisegno)
let levelHook: (() => void) | undefined
export const onLevel = (fn: () => void) => {
  levelHook = fn
}
let lipTimer: { cancel: () => void } | undefined
let lipShown = 0

/** Il volume della voce, letto spesso mentre parla: muove le labbra. */
async function lip($: EngineInterface) {
  if (!dir) return
  const [g, l] = String(await $.fs.read(`${dir}/level`).catch(() => '')).trim().split(/\s+/)
  const next = Number(g) === myGen ? Math.max(0, Math.min(4, Number(l) || 0)) : 0
  if (next === lipShown) return
  lipShown = next
  dbg($, `voce: livello ${next}`)
  await update($, level, () => next).catch(() => undefined)
  levelHook?.()
}

/** Niente piu' da dire: a risposta finita il volto sorride e torna a riposo. */
async function drained($: EngineInterface) {
  if (watch) dbg($, 'voce finita')
  watch?.cancel()
  watch = undefined
  lipTimer?.cancel()
  lipTimer = undefined
  pending = 0
  closedShown = false
  lipShown = 0
  await update($, level, l => (l === 0 ? l : 0)).catch(() => undefined)
  await showReading($, '')
  await endListening($)
  if (!replyOpen) await moodThenIdle($, 'happy', RELAX_MS)
}

/** La sintesi di sistema: in coda, una frase dopo l'altra; uno stop salta quelle non ancora dette. */
function systemSay($: EngineInterface, line: string, voice: string | undefined, speed: number, source?: string) {
  const gen = sysGen
  pending += 1
  void setMood($, 'talking')
  chain = chain.then(async () => {
    if (gen !== sysGen) return
    // la sintesi di sistema non ha un'opzione di velocita': su macOS `say` legge il comando [[rate N]] nel testo
    const text = speed === 1 ? line : `[[rate ${Math.round(185 * speed)}]] ${line}`
    dbg($, `sistema: «${line.slice(0, 60)}»${voice ? ` con ${voice}` : ''}`)
    // la sintesi di sistema non dice a che punto e': la frase si mostra mentre la si dice
    if (source !== undefined) await showReading($, source)
    await $.audio.speak(text, voice ? { voice } : undefined).catch(async (error: unknown) => {
      dbg($, `sistema, voce rifiutata: ${error instanceof Error ? error.message : String(error)}`)
      await $.audio.speak(text).catch((again: unknown) => dbg($, `sistema muto: ${again instanceof Error ? again.message : String(again)}`))
    })
    if (gen !== sysGen) return
    pending -= 1
    if (pending <= 0) await drained($)
  })
}

/** Zitta la mia voce: Kokoro si ferma subito; il sistema finisce la frase in corso e salta le altre. */
export async function stopMine($: EngineInterface) {
  // una risposta ancora in arrivo, fermata: le sue frasi dopo non riprendono la voce
  if (replyOpen) hushed = true
  await endListening($)
  sysGen += 1
  lipTimer?.cancel()
  lipTimer = undefined
  closedShown = false
  lipShown = 0
  await update($, level, l => (l === 0 ? l : 0)).catch(() => undefined)
  const one = oneShot
  oneShot = undefined
  void one?.return().catch(() => undefined)
  watch?.cancel()
  watch = undefined
  pending = 0
  await showReading($, '')
  if (dir && myGen >= 0) {
    const now = await readGen($)
    if (now.gen === myGen) await $.fs.write(`${dir}/gen`, `${myGen + 1} -`).catch(() => undefined)
  }
  myGen = -1
}

/** Spegnere la voce ferma anche l'aiuto, se l'ha avviato questa sessione e non serve ad altri. */
export async function voiceOff($: EngineInterface) {
  await stopMine($)
}

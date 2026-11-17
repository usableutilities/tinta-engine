import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderInput } from 'claude-code'

import type { Face, Look, Mood, Place, Voice, VoiceSetting, Who } from './tipi'
import { backdropOf, characterSvg, isCharacter } from './characters'
import { FACE_TEXT, FALLBACK, knownPalette, paletteOf, publishedPalette, themeIdOf } from './face'
import type { Palette } from './face'
import { PANE_ID } from './ids'
import { colorSettings, colorize, setColorful } from './colorito'
import { attivitaShown, dbg, findHelper, helperOf, hidden, isSpeaking, listen, onLevel, previewVoice, publishVoiceSetting, setLiveVoice, setNativeShown, setSynth, synthMode, replyBegin, sessionTag, setReadingMode, setToneCues, stopListening, replyEnd, sayLine, setPlace, shown, stopMine, voiceEnd, voiceStart, warmUp } from './parla'
import { legacyVoltoIn, voltoOn, whyOff } from './attivo'
import { drawsHere, isPro } from './pro'
import { frameFor, heightFor } from './rig'
import { RELAX_MS, moodThenIdle, onMood, setMood, shownMood } from './stato'
import { CUSTOM_VOICES, LANGUAGES, StepReader, customVoiceOf, isClonedId, isCustomId, kokoroVoiceOf, parseVoices, setCustomVoices, spokenLinesOf, systemLanguage, voiceCatalog, withoutLine } from './voce'
import type { CustomVoice } from './voce'
import { LISTEN_ICON, READING_DEFAULT, findSpan, listenIconDrawing, readingModeOf } from '../lettura'
import type { Reading } from '../lettura'
import { steadyFrame } from '../animazioni'
import { readableOnBoth } from '../theme'
import { sessionName } from './nome'

export const PANE = PANE_ID
const TITLE = 'Volto'
const STORE_WHO = 'volto.who'
const STORE_VOCE = 'volto.voce'
// quando e' stato applicato l'ultimo comando dell'app (o fatta l'ultima scelta nel pannello)
const STORE_COMANDO_T = 'volto.comando_t'
const STORE_DOVE = 'volto.dove'
// il pannello Attivita' del motore Tinta
const ATTIVITA = 'tinta-attivita'
let attivitaDrawn = false
// l'ultimo righello disegnato, per il registro
let lastDrawn = ''
let settingsOpen = false
// i permessi chiesti, in attesa di capire se aspettano davvero la persona
const waits = new Map<string, { cancel: () => void }>()
let drawnAt = 0
let redrawCheck: { cancel: () => void } | undefined

/**
 * Dopo un cambio d'umore o di voce il volto deve ridisegnarsi. Se entro 600 ms non succede (il pannello
 * Attivita' e' di Tinta, e il desktop potrebbe non sapere che il volto ha cambiato), lo si chiede.
 */
function expectRedraw($: EngineInterface, what: 'umore' | 'livello') {
  const asked = Date.now()
  redrawCheck?.cancel()
  redrawCheck = $.clock.after(600, () => {
    if (drawnAt >= asked) return
    if (settingsOpen && what === 'livello') {
      dbg($, 'livello non disegnato: impostazioni aperte (la bocca segue il suo ritmo)')

      return
    }
    dbg($, `nessun ridisegno dopo il cambio di ${what}: lo chiedo`)
    $.ui.invalidate('ui.render')
  })
}
// gli stessi valori di stato.ts e parla.ts: ogni file nomina i suoi (lo scan li vuole qui)
const face = atom({ plugin: 'tinta', key: 'voltoFace' } as const, { mood: 'idle', prev: 'idle' } as Face, { shape: 'face-1' })
const who = atom({ plugin: 'tinta', key: 'voltoWho' } as const, 'astratto' as Who, { shape: 'who-1' })
const voce = atom({ plugin: 'tinta', key: 'voltoVoce' } as const, { on: false } as VoiceSetting, { shape: 'voce-2' })
const voices = atom({ plugin: 'tinta', key: 'voltoVoices' } as const, [] as Voice[], { shape: 'voices-1' })
const look = atom({ plugin: 'tinta', key: 'voltoLook' } as const, { ...FALLBACK } as Look, { shape: 'look-1' })
const kokoro = atom({ plugin: 'tinta', key: 'voltoKokoro' } as const, false, { shape: 'kokoro-1' })
const dove = atom({ plugin: 'tinta', key: 'voltoDove' } as const, 'attivita' as Place, { shape: 'dove-1' })
// le impostazioni aperte o chiuse: solo per questa sessione (stato, non store)
const gear = atom({ plugin: 'tinta', key: 'voltoGear' } as const, false, { shape: 'gear-1' })
const level = atom({ plugin: 'tinta', key: 'voltoLevel' } as const, 0, { shape: 'level-1' })
// le risposte finite (testo normalizzato, le ultime 30): solo sotto di loro il pulsante Ascolta
const finals = atom({ plugin: 'tinta', key: 'voltoFinals' } as const, [] as string[], { shape: 'finals-1' })
const ascolto = atom({ plugin: 'tinta', key: 'voltoAscolto' } as const, '', { shape: 'ascolto-1' })
// la frase che la voce legge adesso (parla.ts): il pulsante di quella risposta dice Ferma
const lettura = atom({ plugin: 'tinta', key: 'voltoLettura' } as const, { text: '', mode: READING_DEFAULT } as Reading, { shape: 'lettura-1' })

const norm = (text: string) => withoutLine(text).replace(/\s+/g, ' ').trim()

/** Una chiave breve e stabile per il testo di una risposta. */
const keyOf = (text: string) => {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0

  return h.toString(36)
}

/** I tratti da dire di una risposta intera (stessa pulizia della lettura in streaming), con il testo da cui vengono. */
const chunksOf = (text: string) => spokenLinesOf(withoutLine(text))

// strumenti che aspettano la persona: il volto la guarda
const ASKS_PERSON = new Set(['AskUserQuestion', 'ExitPlanMode'])
const WORRY_MS = 7000

/** Un righello trasparente: la sua altezza dice l'umore al riquadro accanto; la larghezza la prende dal pannello. */
const ruler = (height: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="${height}" viewBox="0 0 1 ${height}"/>`

/**
 * Lo stato del volto per la finestra dell'app Tinta: ~/.claude/tinta/voce/stato.json, scritto di colpo
 * (un file accanto, poi rinominato) a ogni cambio di umore, personaggio o voce.
 */
async function writeStato($: EngineInterface) {
  const home = await $.env.get('HOME').catch(() => undefined)
  if (!home) return
  const dir = `${home}/.claude/tinta/voce`
  const setting = await read($, voce)
  // le scelte della persona (personaggio, voce...) le fa l'app: qui solo l'eco di cio' che il plugin sta usando,
  // sotto "using", da non riprendere mai come scelta nuova; "t" e' quando e' stato scritto questo file, non una
  // scelta. L'unica scelta fatta qui (il 🔊 del pannello) va in "pane_change", con il suo momento
  const body = JSON.stringify({
    v: 2,
    session: sessionTag(),
    // il nome leggibile della sessione (il titolo della barra laterale, o la cartella): la finestra del volto lo mostra
    ...(shownName ? { session_name: shownName } : {}),
    mood: (await read($, face)).mood,
    using: {
      character: await read($, who),
      voice_on: setting.on,
      lang: setting.lang ?? 'it',
      voice: setting.engine === 'sistema' ? 'sys' : kokoroVoiceOf(setting.lang, setting.kokoro),
      speed: setting.speed ?? 1,
    },
    ...(paneChange ? { pane_change: paneChange } : {}),
    // le voci per lingua (Kokoro, da file, di sistema), per il menu Voce dell'app (le clonate le elenca l'app)
    voices: voiceCatalog(await read($, kokoro)),
    t: await $.clock.now(),
  })
  const tmp = `${dir}/stato.json.tmp`
  await $.fs.write(tmp, body).catch(() => undefined)
  const moved = await $.process.run(['/bin/mv', '-f', tmp, `${dir}/stato.json`]).then(r => r.exitCode === 0, () => false)
  if (!moved) await $.fs.write(`${dir}/stato.json`, body).catch(() => undefined)
}

let colorfulSeen = 'null'
// il nome della sessione scritto in stato.json; si rilegge all'avvio, a ogni risposta finita e ogni 30 s
let shownName: string | undefined
async function refreshName($: EngineInterface) {
  const name = await sessionName($).catch(() => undefined)
  if (name === undefined || name === shownName) return
  shownName = name
  dbg($, `nome della sessione: ${name}`)
  await writeStato($)
}
// l'ultima scelta fatta nel pannello (il 🔊): l'app la puo' riprendere, con questo momento
let paneChange: { voice_on: boolean; t: number } | undefined

// comando.json si guarda spesso, ma solo la sua data: lo si rilegge quando cambia (o ogni 2 s comunque)
const COMMAND_POLL_MS = 300
let commandStamp = ''
let commandReadAt = 0

async function commandChanged($: EngineInterface) {
  const home = await $.env.get('HOME').catch(() => undefined)
  if (!home) return
  const list = await $.fs.list(`${home}/.claude/tinta/voce`).catch(() => [])
  const f = list.find(one => one.name === 'comando.json')
  const stamp = f ? `${f.mtimeMs} ${f.size}` : ''
  const now = await $.clock.now()
  if (stamp === commandStamp && now - commandReadAt < 2000) return
  commandStamp = stamp
  commandReadAt = now
  await readCommand($)
}

// l'ultimo comando dell'app gia' applicato (la voce accesa o spenta dalla barra dei menu)
let commandAt = 0
// dove l'app mostra il volto: 'dentro' (nel pannello di Code, come sempre) o nella sua finestra nativa
let appPlace: 'dentro' | 'agganciato' | 'primo_piano' = 'dentro'
const nativeFace = () => appPlace !== 'dentro'

/** Mostra o nasconde la finestra del volto dell'app: scrive "show" in comando.json, lasciando il resto com'e'. */
async function toggleNative($: EngineInterface) {
  const home = await $.env.get('HOME').catch(() => undefined)
  if (!home) return false
  const path = `${home}/.claude/tinta/voce/comando.json`
  let cmd: { [key: string]: unknown } = {}
  try {
    cmd = JSON.parse(String(await $.fs.read(path))) as { [key: string]: unknown }
  } catch {
    cmd = {}
  }
  const show = cmd.show !== true
  await $.fs.write(path, JSON.stringify({ ...cmd, show, show_t: await $.clock.now() }))
  dbg($, `finestra dell'app: ${show ? 'mostra' : 'nascondi'}`)

  return show
}

/** Legge ~/.claude/tinta/voce/comando.json e accende o spegne la voce se l'app l'ha chiesto dopo l'ultima volta. */
async function readCommand($: EngineInterface) {
  const home = await $.env.get('HOME').catch(() => undefined)
  if (!home) return
  const text = await $.fs.read(`${home}/.claude/tinta/voce/comando.json`).catch(() => '')
  try {
    const cmd = JSON.parse(String(text)) as { synth?: unknown; voice_on?: unknown; t?: unknown; place?: unknown; app_t?: unknown; show?: unknown; lang?: unknown; voice?: unknown; speed?: unknown; character?: unknown; calibrate?: unknown; tone_cues?: unknown; reading?: unknown; colorful?: unknown; clone?: unknown; preview?: unknown; delete_voice?: unknown }
    // l'app e' viva se il suo battito e' fresco; dove mostra il volto
    const now = await $.clock.now()
    const alive = typeof cmd.app_t === 'number' && now - cmd.app_t < 5000
    // chi sintetizza: l'app, se lo dice (docs/VOCE.md); se cambia, il menu Voce dell'app lo sa da stato.json
    if (setSynth(cmd, now)) {
      dbg($, `sintesi: ${synthMode()}`)
      await update($, kokoro, () => synthMode() !== 'none').catch(() => undefined)
      void writeStato($).catch(() => undefined)
    }
    const place = alive && (cmd.place === 'agganciato' || cmd.place === 'primo_piano') ? cmd.place : 'dentro'
    if (place !== appPlace) dbg($, `finestra dell'app: ${place}`)
    appPlace = place
    setNativeShown(place !== 'dentro')
    if (typeof cmd.calibrate === 'number') void calibrateIfAsked($, home, cmd.calibrate, now)
    if (typeof cmd.tone_cues === 'boolean') setToneCues(cmd.tone_cues)
    // "reading": come la chat segue la voce (lettura.ts); senza, quello di serie
    await setReadingMode($, readingModeOf(cmd.reading) ?? READING_DEFAULT)
    // "colorful": {on, freq, custom, only_custom}, scelta dell'app: vale sempre l'ultima scritta
    if (JSON.stringify(cmd.colorful ?? null) !== colorfulSeen) {
      colorfulSeen = JSON.stringify(cmd.colorful ?? null)
      setColorful(cmd.colorful)
      dbg($, `tono colorito: ${colorSettings().on ? `acceso, ${colorSettings().freq}` : 'spento'}`)
      $.ui.invalidate('ui.render')
    }
    await voiceRequests($, home, cmd, now)
    const at = typeof cmd.t === 'number' ? cmd.t : 0
    // la voce (lingua, voce, velocita', accesa) e' sempre quella scritta adesso in comando.json, qualunque siano
    // personaggio e posto; la voce salvata qui vale solo se l'app non ne dice nessuna. Unica eccezione: il 🔊
    // del pannello premuto dopo l'ultima scelta dell'app
    const setting = await read($, voce)
    const paneWins = paneChange !== undefined && paneChange.t > at
    const chosen = fromCommand(setting, { ...cmd, voice_on: paneWins ? undefined : cmd.voice_on })
    if (JSON.stringify(chosen) !== JSON.stringify(setting)) {
      dbg($, `comando dall'app: voce ${chosen.on ? 'accesa' : 'spenta'}, lingua ${chosen.lang ?? '-'}, ${chosen.engine === 'sistema' ? 'sistema' : (chosen.kokoro ?? 'voce della lingua')}, ${chosen.speed ?? 1}×`)
      await setVoice($, chosen, true)
    }
    // il resto (personaggio, posto): vince il piu' recente tra il comando dell'app e l'ultima scelta fatta qui
    if (at <= commandAt) return
    commandAt = at
    await $.store.set(STORE_COMANDO_T, at).catch(() => undefined)
    // il personaggio, e il posto nel pannello di Code (Attivita' o a parte), scelti nell'app
    if (typeof cmd.character === 'string' && isCharacter(cmd.character) && cmd.character !== (await read($, who))) {
      dbg($, `comando dall'app: personaggio ${cmd.character}`)
      await choose($, cmd.character)
    }
    if ((cmd.place === 'attivita' || cmd.place === 'separato') && cmd.place !== (await read($, dove))) {
      dbg($, `comando dall'app: volto ${cmd.place === 'attivita' ? "nel pannello Attivita'" : 'a parte'}`)
      await setDove($, cmd.place)
    }
  } catch {
    // nessun comando, o non leggibile: nessuna app che sintetizza
    if (setSynth(undefined, 0)) {
      dbg($, `sintesi: ${synthMode()}`)
      await update($, kokoro, () => synthMode() !== 'none').catch(() => undefined)
    }
  }
}

/**
 * Le scelte di voce scritte dall'app in comando.json: accesa, lingua (un id della tabella), voce (una voce
 * Kokoro, o "sys" per quella di sistema) e velocita' (la piu' vicina tra quelle del pannello). Il resto resta.
 */
function fromCommand(s: VoiceSetting, cmd: { voice_on?: unknown; lang?: unknown; voice?: unknown; speed?: unknown }): VoiceSetting {
  let out: VoiceSetting = { ...s }
  if (typeof cmd.voice_on === 'boolean') out.on = cmd.voice_on
  const lang = typeof cmd.lang === 'string' ? LANGUAGES.find(one => one.id === cmd.lang) : undefined
  if (lang && lang.id !== out.lang) out = { ...out, lang: lang.id, kokoro: undefined }
  if (cmd.voice === 'sys' || cmd.voice === 'sistema') out.engine = 'sistema'
  else if (typeof cmd.voice === 'string') {
    const id = cmd.voice.replace(/^k:/, '')
    // una voce clonata dall'app: parla la lingua scelta, qualunque sia
    if (isClonedId(id)) out = { ...out, engine: 'kokoro', kokoro: id }
    const custom = customVoiceOf(id)
    const owner = custom ? LANGUAGES.find(one => one.id === custom.lang) : LANGUAGES.find(one => (one.voices as readonly { id: string }[]).some(v => v.id === id))
    // una voce di un'altra lingua porta con se' la sua lingua, se l'app non ne ha detta una
    if (owner && (!lang || owner.id === lang.id)) out = { ...out, engine: 'kokoro', kokoro: id, lang: owner.id }
  }
  if (typeof cmd.speed === 'number' && Number.isFinite(cmd.speed)) {
    const x = cmd.speed
    out.speed = SPEEDS.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a)).x
  }

  return out
}

// --- le voci da file: elenco, prova, eliminazione (richieste dell'app) ---
// (le voci clonate le crea e le tiene l'app, dentro di se': qui arrivano solo come voce scelta o da provare)

// richieste piu' vecchie di 2 minuti: ignorate
const REQUEST_STALE_MS = 120_000

/** Rilegge ~/.claude/tinta/voce/voci: ogni <nome>.voice.npy, con nome e lingua da <nome>.voice.json. */
async function scanVoices($: EngineInterface, home: string) {
  if (!CUSTOM_VOICES) return []
  const dir = `${home}/.claude/tinta/voce/voci`
  const files = await $.fs.list(dir).catch(() => [])
  const list: CustomVoice[] = []
  for (const f of files) {
    const m = /^([\w.-]+)\.voice\.npy$/.exec(f.name)
    if (!m) continue
    let meta: { name?: unknown; lang?: unknown } = {}
    try {
      meta = JSON.parse(String(await $.fs.read(`${dir}/${m[1]}.voice.json`)))
    } catch {
      // senza descrizione: il nome del file, in italiano
    }
    const lang = typeof meta.lang === 'string' && LANGUAGES.some(l => l.id === meta.lang) ? meta.lang : 'it'
    list.push({ id: `file:${m[1]}`, name: typeof meta.name === 'string' ? meta.name : (m[1] ?? 'voce'), lang, path: `${dir}/${m[1]}.voice.npy`, kind: 'file' })
  }
  list.sort((a, b) => a.name.localeCompare(b.name))
  setCustomVoices(list)

  return list
}

/** Un numero di richiesta nuovo (non ancora fatto, non vecchio): lo segna come fatto. */
async function fresh($: EngineInterface, key: string, at: unknown, now: number) {
  if (typeof at !== 'number') return false
  const done = await $.store.get(key).catch(() => undefined)
  if (typeof done === 'number' && at <= done) return false
  await $.store.set(key, at).catch(() => undefined)
  if (now - at > REQUEST_STALE_MS) {
    dbg($, `${key}: richiesta di ${Math.round((now - at) / 1000)} s fa, ignorata`)

    return false
  }

  return true
}

async function voiceRequests($: EngineInterface, home: string, cmd: { clone?: unknown; preview?: unknown; delete_voice?: unknown }, now: number) {
  if (!CUSTOM_VOICES) return voiceRequestsOff($, cmd, now)
  const base = `${home}/.claude/tinta/voce`
  const preview = typeof cmd.preview === 'object' && cmd.preview !== null ? (cmd.preview as { voice?: unknown; t?: unknown }) : undefined
  if (preview && typeof preview.voice === 'string' && (await fresh($, 'volto.preview_t', preview.t, now))) {
    await scanVoices($, home)
    dbg($, `prova della voce ${preview.voice}`)
    await previewVoice($, preview.voice)
  }
  const del = cmd.delete_voice
  const delId = typeof del === 'string' ? del : typeof del === 'object' && del !== null ? (del as { id?: unknown }).id : undefined
  const delT = typeof del === 'object' && del !== null ? (del as { t?: unknown }).t : undefined
  if (typeof delId === 'string' && /^file:[\w.-]+$/.test(delId)) {
    const slug = delId.slice(5)
    const files = [`${base}/voci/${slug}.voice.npy`, `${base}/voci/${slug}.voice.json`]
    const exists = await $.fs.exists(files[0] ?? '').catch(() => false)
    // senza un numero di richiesta, basta che la voce ci sia ancora
    if (exists && (delT === undefined || (await fresh($, 'volto.delete_t', delT, now)))) {
      dbg($, `elimino la voce ${delId}`)
      await $.process.run(['/bin/rm', '-f', ...files]).catch(() => undefined)
      await scanVoices($, home)
      const setting = await read($, voce)
      if (setting.kokoro === delId) await setVoice($, { ...setting, kokoro: undefined })
      else await writeStato($)
    }
  }
}

/** Voci da file spente: si dice nel registro e non si fa nulla (nessun file toccato); le altre prove restano. */
async function voiceRequestsOff($: EngineInterface, cmd: { clone?: unknown; preview?: unknown; delete_voice?: unknown }, now: number) {
  const clone = typeof cmd.clone === 'object' && cmd.clone !== null ? (cmd.clone as { t?: unknown }) : undefined
  if (clone && (await fresh($, 'volto.clone_t', clone.t, now))) dbg($, "richiesta \"clone\" ignorata: le voci clonate le crea l'app")
  const preview = typeof cmd.preview === 'object' && cmd.preview !== null ? (cmd.preview as { voice?: unknown; t?: unknown }) : undefined
  if (preview && typeof preview.voice === 'string' && (await fresh($, 'volto.preview_t', preview.t, now))) {
    if (isCustomId(preview.voice)) dbg($, `voci da file disattivate: prova di ${preview.voice} ignorata`)
    else await previewVoice($, preview.voice)
  }
  const del = cmd.delete_voice
  const delId = typeof del === 'string' ? del : typeof del === 'object' && del !== null ? (del as { id?: unknown }).id : undefined
  if (typeof delId === 'string' && isCustomId(delId) && !deleteLogged.has(delId)) {
    deleteLogged.add(delId)
    dbg($, `voci da file disattivate: eliminazione di ${delId} ignorata (nessun file toccato)`)
  }
}
const deleteLogged = new Set<string>()

const STORE_CALIBRA_T = 'volto.calibra_t'
// una richiesta di taratura piu' vecchia di cosi' non si esegue piu'
const CALIBRATE_STALE_MS = 30_000
let calibrating = false

/**
 * La taratura delle labbra chiesta dall'app (che, in sandbox, non puo' avviare l'aiuto): una volta per
 * richiesta, fra tutte le sessioni, sull'uscita predefinita; le richieste vecchie si ignorano.
 */
async function calibrateIfAsked($: EngineInterface, home: string, asked: number, now: number) {
  if (calibrating) return
  calibrating = true
  try {
    const done = await $.store.get(STORE_CALIBRA_T).catch(() => undefined)
    if (typeof done === 'number' && asked <= done) return
    await $.store.set(STORE_CALIBRA_T, asked).catch(() => undefined)
    if (now - asked > CALIBRATE_STALE_MS) {
      dbg($, `taratura: richiesta di ${Math.round((now - asked) / 1000)} s fa, ignorata`)

      return
    }
    // la taratura la fa chi sintetizza: l'app da se'; qui solo l'aiuto di sviluppo
    const helper = helperOf()
    if (synthMode() === 'app' || !helper) {
      dbg($, `taratura: ${synthMode() === 'app' ? "la fa l'app" : 'nessun aiuto di sviluppo'}`)

      return
    }
    const argv = [helper, '--calibrate', '--out', `${home}/.claude/tinta/voce/calibrazione.json`]
    dbg($, `taratura: ${argv.join(' ')}`)
    const run = $.process.spawn({ argv })
    let out = ''
    let step = await run.next()
    while (!step.done) {
      out += step.value.text
      step = await run.next()
    }
    dbg($, `taratura finita: codice ${step.value.code ?? '-'} ${out.trim().replace(/\s+/g, ' ').slice(0, 200)}`)
  } catch (error) {
    dbg($, `taratura non partita: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    calibrating = false
  }
}

/** Il 🔊 del pannello: una scelta vera della persona, segnata come tale in stato.json ("pane_change"). */
async function paneVoice($: EngineInterface, next: VoiceSetting) {
  paneChange = { voice_on: next.on, t: await $.clock.now() }
  await setVoice($, next)
}

/** Sceglie il personaggio e lo ricorda tra le sessioni. */
async function choose($: EngineInterface, id: Who) {
  await update($, who, () => id)
  await $.store.set(STORE_WHO, id).catch(() => undefined)
  await writeStato($)
}

/** Rilegge il tema attivo fuori dal disegno: il disegno legge solo valori gia' pronti. */
async function refreshLook($: EngineInterface) {
  const info = await themeInfo($).catch(() => undefined)
  if (!info) return
  const next: Look = { ...info.palette, ...(info.id ? { themeId: info.id } : {}) }
  await update($, look, old => (JSON.stringify(old) === JSON.stringify(next) ? old : next)).catch(() => undefined)
}

const isSetting = (v: unknown): v is VoiceSetting => {
  if (typeof v !== 'object' || v === null) return false
  const s = v as VoiceSetting
  const str = (x: unknown) => x === undefined || typeof x === 'string'

  return typeof s.on === 'boolean' && str(s.voice) && str(s.kokoro) && str(s.lang) && (s.speed === undefined || typeof s.speed === 'number') && (s.engine === undefined || s.engine === 'kokoro' || s.engine === 'sistema')
}

/** Accende, spegne o cambia la voce, e la ricorda tra le sessioni. */
async function setVoice($: EngineInterface, next: VoiceSetting, fromApp = false) {
  // una scelta fatta qui e' piu' recente di ogni comando gia' scritto dall'app (una dell'app no: non sposta nulla)
  if (!fromApp) {
    commandAt = Math.max(commandAt, await $.clock.now())
    await $.store.set(STORE_COMANDO_T, commandAt).catch(() => undefined)
  }
  const was = await read($, voce)
  await update($, voce, () => next)
  setLiveVoice(next)
  // voce, lingua o velocita' nuove: l'aiuto comune rifa' subito le frasi in coda con quella nuova
  const voiceNow = (s: VoiceSetting) => (s.engine === 'sistema' ? 'sys' : kokoroVoiceOf(s.lang, s.kokoro))
  if (next.engine !== 'sistema' && (voiceNow(was) !== voiceNow(next) || (was.speed ?? 1) !== (next.speed ?? 1))) {
    await publishVoiceSetting($, voiceNow(next), next.speed ?? 1)
  }
  await $.store.set(STORE_VOCE, next).catch(() => undefined)
  await writeStato($)
  if (was.on && !next.on) await stopMine($)
  if (next.on) {
    await loadVoices($)
    void warmUp($).catch(() => undefined)
  }
}

/** Le voci installate (macOS: `say -v ?`); nessun elenco dove non c'e'. */
async function loadVoices($: EngineInterface) {
  if ((await read($, voices)).length > 0) return
  try {
    const out = await $.process.run(['say', '-v', '?'])
    if (out.exitCode === 0) await update($, voices, () => parseVoices(out.stdout).slice(0, 200))
  } catch {
    // niente elenco: la voce predefinita del sistema
  }
}

/** Dove sta il volto, ricordato tra le sessioni. */
async function setDove($: EngineInterface, place: Place) {
  await update($, dove, () => place)
  await $.store.set(STORE_DOVE, place).catch(() => undefined)
  setPlace(place)
  if (place === 'attivita') {
    const panes = await $.ui.panes().catch(() => [])
    if (panes.some(pane => pane.id === PANE)) await $.ui.close({ id: PANE }).catch(() => undefined)
    await openAttivita($)
  } else {
    await $.ui.open({ id: PANE, title: TITLE })
  }
}

/** Apre il pannello Attivita' di Tinta (con il volto in cima); senza Tinta, il pannello del volto. */
async function openAttivita($: EngineInterface) {
  const done = await $.command.run({ command: 'tinta-attivita', args: '' } as never).then(() => true, () => false)
  if (!done) await $.ui.open({ id: PANE, title: TITLE })
}

/** C'e' qualcosa di vero in un albero altrui (non solo il segnaposto del motore o Box vuoti)? */
const hasContent = (tree: unknown): boolean => {
  if (typeof tree === 'string') return tree.trim() !== ''
  if (typeof tree !== 'object' || tree === null) return false
  const one = tree as { type?: unknown; children?: unknown[] }
  if (one.type === 'engine' || one.type === 'fragment' && !one.children?.length) return false
  if (one.type !== 'Box' && one.type !== 'fragment') return true

  return (one.children ?? []).some(hasContent)
}

async function toggle($: EngineInterface) {
  if (nativeFace()) return toggleNative($)
  if ((await read($, dove)) === 'attivita') {
    await openAttivita($)

    return true
  }
  const isUp = (await $.ui.panes()).some(pane => pane.id === PANE)
  if (isUp) {
    // chiuso da noi: il volto non si vede, la voce tace subito
    hidden()
    await stopMine($).catch(() => undefined)
    await $.ui.close({ id: PANE })

    return false
  }
  await $.ui.open({ id: PANE, title: TITLE })

  return true
}

// le velocita' della voce: quella chiesta dall'app si porta alla piu' vicina
const SPEEDS = [
  { x: 0.85, label: 'Lenta 0.85×' },
  { x: 1, label: 'Normale 1×' },
  { x: 1.2, label: 'Veloce 1.2×' },
  { x: 1.4, label: 'Molto veloce 1.4×' },
] as const

/** Il volto e la sua barra; `compact` dentro il pannello Attivita' (meno alto, niente altezza piena). */
async function drawFace($: EngineInterface, e: RenderInput<'Pane'>, compact: boolean) {
  const els = $.ui.resolve(e)
  const { Box, Button, Text } = els
    // solo valori gia' pronti: nessun file, nessun processo mentre si disegna
    const gearOpen = false
    settingsOpen = gearOpen
    const mood = (await read($, face)).mood
    const stored = await read($, who)
    // un personaggio tolto (o sconosciuto) torna al primo della galleria
    const current = isCharacter(stored) ? stored : 'astratto'
    const palette = await read($, look)
    const setting = await read($, voce)
    const bg = backdropOf(current, palette)
    // tutte le scelte del volto stanno nell'app Tinta: qui resta solo la voce si'/no, piccola
    const bar = (
      <Box key="volto-bar" flexDirection="row" justifyContent="flex-end" width="100%">
        <Button key="volto-voce" label={setting.on ? '🔊' : '🔇'} plain onPress={() => void paneVoice($, { ...setting, on: !setting.on })} />
      </Box>
    )

    if (e.surface === 'desktop' && 'Svg' in els) {
      const { Svg } = els
      // un solo riquadro per tutta la vita del pannello: la sorgente non cambia con l'umore;
      // il righello ne cambia l'altezza (esatta, in px) e il disegno la legge con le media query.
      // Largo quanto il pannello: righello e riquadro hanno width 4096 e il desktop li limita al 100%.
      // nel pannello Attivita' il volto occupa poco meno di meta' altezza, sopra l'elenco
      const rows = compact ? Math.max(12, Math.floor(e.props.scroll.bodyRows * 0.45)) : e.props.scroll.bodyRows
      const frame = { ...frameFor(e.props.bodyColumns, rows), tempo: setting.on ? (setting.speed ?? 1) : 1 }
      // la voce che suona apre e chiude le labbra: solo il righello cambia, il riquadro resta
      // a impostazioni aperte la bocca segue il suo ritmo (livello 0), senza leggere il volume
      // il righello porta solo "bocca chiusa" nelle pause tra i tratti (1) o "parla al suo ritmo" (0): due ridisegni
      // per tratto; a impostazioni aperte niente (i menu non si rifanno)
      const height = heightFor(mood, frame.h, mood === 'talking' && !gearOpen ? Math.min(1, await read($, level)) : 0)
      // l'altezza piu' grande che il riquadro puo' prendere; la differenza va negli spaziatori
      const tallest = heightFor('worried', frame.h, 0) + 4
      const padTop = 1 + Math.floor((tallest - height) / 2)
      const padBottom = 1 + Math.ceil((tallest - height) / 2)
      const source = characterSvg(current, palette, frame)
      const drawn = `${compact ? 'attivita' : 'pannello'} ${mood} ${height}px, ${current} ${new TextEncoder().encode(source).length} byte`
      drawnAt = Date.now()
      if (drawn !== lastDrawn) {
        lastDrawn = drawn
        dbg($, `disegno: ${drawn}`)
      }
      const face = (
        <Box key="volto-content" flexDirection="column" width="100%" {...(compact ? {} : { height: '100%' })} justifyContent="space-between">
          <Box key="volto-middle" flexGrow={1} flexDirection="column" justifyContent="center" width="100%">
            {/* l'umore cambia l'altezza del riquadro di qualche px: due spaziatori sopra e sotto la riportano sempre
                alla stessa, cosi' barra ed elenco non si muovono e il centro del volto resta fermo */}
            <Svg source={ruler(padTop)} alt="Volto" width={1} height={padTop} />
            <Box key="volto-stage" width="100%">
              <Svg source={ruler(height)} alt="Volto" width={4096} height={height} />
              <Box key="volto-frame" position="absolute" top={0} left={0} right={0} bottom={0}>
                <Svg source={source} alt="Volto" width={4096} isInteractive />
              </Box>
            </Box>
            <Svg source={ruler(padBottom)} alt="Volto" width={1} height={padBottom} />
          </Box>
          {bar}
        </Box>
      )
      if (compact) {
        return (
          <Box key="volto-compact" flexDirection="column" width="100%" backgroundColor={bg}>
            {face}
          </Box>
        )
      }

      // il margine del pannello (circa 16 px) resta del desktop: gli scostamenti accettano solo celle intere
      return (
        <Box key="volto-full" flexDirection="column" width="100%" height="100%" backgroundColor={bg}>
          {face}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" alignItems="center">
        <Text color={palette.accent}>{FACE_TEXT[mood]}</Text>
        {bar}
      </Box>
    )
}

// il volto c'e' in questa sessione (Pro, la copia che disegna, il vecchio plugin spento); avviato una volta
let enabled = false
let started = false
let gateTimer: { cancel: () => void } | undefined
const GATE_MS = 30_000

/** Per i test: il volto c'e'? */
export const voltoEnabled = () => enabled

/** Le condizioni del volto adesso. */
async function gateOf($: EngineInterface) {
  const home = await $.env.get('HOME').catch(() => undefined)
  const settings = home ? String(await $.fs.read(`${home}/.claude/settings.json`).catch(() => '')) : ''
  const override = await $.env.get('TINTA_VOLTO').catch(() => undefined)
  const gate = { pro: await isPro($).catch(() => false), draws: await drawsHere($).catch(() => false), legacy: legacyVoltoIn(settings), override }

  return gate
}

/** Rilegge le condizioni: il volto si accende (Pro appena sbloccato, il vecchio plugin spento) o si spegne. */
async function regate($: EngineInterface) {
  const gate = await gateOf($)
  const on = voltoOn(gate)
  if (on === enabled) return
  enabled = on
  if (on) {
    await startVolto($)
    $.ui.invalidate('ui.render')
  } else {
    await stopMine($).catch(() => undefined)
    $.ui.invalidate('ui.render')
  }
  $.ui.log(`tinta volto: ${whyOff(gate) ?? 'acceso'}`, { to: 'debug' })
}

/** L'avvio del volto in questa sessione, una volta sola. */
async function startVolto($: EngineInterface) {
  if (started) return
  started = true
  await $.command.register({ name: 'volto', description: 'Mostra o nasconde il volto che reagisce alla sessione' }).catch(() => undefined)
  // la scelta della persona vince; senza scelta, il tema Fosforo porta il suo volto
  const kept = await $.store.get(STORE_WHO).catch(() => undefined)
  if (isCharacter(kept)) await update($, who, () => kept)
  else if ((await themeInfo($)).id?.startsWith('fosforo')) await update($, who, () => 'fosforo')
  await refreshLook($)
  // chi sintetizza: l'aiuto di sviluppo solo se TINTA_VOICE_HELPER lo indica; l'app lo dice in comando.json
  await findHelper($)
  await update($, kokoro, () => synthMode() !== 'none')
  const said = await $.store.get(STORE_VOCE).catch(() => undefined)
  if (isSetting(said)) await update($, voce, () => said)
  // la prima volta la lingua e' quella del sistema; poi resta quella scelta
  const held = await read($, voce)
  if (!held.lang) {
    const lang = systemLanguage((await $.env.get('LANG').catch(() => undefined)) ?? (await $.env.get('LC_ALL').catch(() => undefined)))
    const chosen = { ...held, lang }
    await update($, voce, () => chosen)
    await $.store.set(STORE_VOCE, chosen).catch(() => undefined)
  }
  const before = await read($, voce)
  if (!CUSTOM_VOICES && isCustomId(before.kokoro)) {
    dbg($, `voci da file disattivate: la voce ${before.kokoro} torna a quella di serie della lingua`)
    const back = { ...before, kokoro: undefined }
    await update($, voce, () => back)
    await $.store.set(STORE_VOCE, back).catch(() => undefined)
  }
  setLiveVoice(await read($, voce))
  if (isSetting(said) && said.on) void loadVoices($)
  const place = await $.store.get(STORE_DOVE).catch(() => undefined)
  if (place === 'attivita' || place === 'separato') await update($, dove, () => place)
  setPlace(await read($, dove))
  await voiceStart($).catch(() => undefined)
  // voci da file spente: se l'aiuto comune ha ancora una voce da file, gli si da' quella di adesso
  if (!CUSTOM_VOICES) {
    const homeNow = await $.env.get('HOME').catch(() => undefined)
    const was = homeNow ? String(await $.fs.read(`${homeNow}/.claude/tinta/voce/spool/impostazioni`).catch(() => '')) : ''
    if (/"voice"\s*:\s*"file:/.test(was)) {
      const now = await read($, voce)
      dbg($, "voci da file disattivate: l'aiuto comune torna alla voce di serie")
      await publishVoiceSetting($, kokoroVoiceOf(now.lang, now.kokoro), now.speed ?? 1)
    }
  }
  await update($, gear, () => false).catch(() => undefined)
  onMood(mood => {
    dbg($, `umore: ${mood}`)
    expectRedraw($, 'umore')
    void writeStato($).catch(() => undefined)
  })
  // i comandi dell'app: quelli piu' recenti dell'ultimo applicato (anche tra una sessione e l'altra, cosi' a
  // app chiusa valgono le ultime scelte fatte li'); poi un controllo ogni 2 s
  const lastAt = await $.store.get(STORE_COMANDO_T).catch(() => undefined)
  commandAt = typeof lastAt === 'number' ? lastAt : 0
  await readCommand($)
  $.clock.every(COMMAND_POLL_MS, () => void commandChanged($).catch(() => undefined))
  const homeDir = await $.env.get('HOME').catch(() => undefined)
  if (homeDir) await scanVoices($, homeDir)
  void writeStato($).catch(() => undefined)
  void refreshName($).catch(() => undefined)
  $.clock.every(30_000, () => void refreshName($).catch(() => undefined))
  onLevel(() => expectRedraw($, 'livello'))
  $.clock.every(15_000, () => void refreshLook($).catch(() => undefined))
  // voci da file aggiunte a mano o da un'altra sessione
  $.clock.every(15_000, () => void (async () => {
    const home = await $.env.get('HOME').catch(() => undefined)
    if (!home) return
    const before = JSON.stringify(voiceCatalog(await read($, kokoro)))
    await scanVoices($, home)
    if (JSON.stringify(voiceCatalog(await read($, kokoro))) !== before) await writeStato($)
  })().catch(() => undefined))
  // l'aiuto pronto prima della prima risposta
  void warmUp($).catch(() => undefined)

}

export const registerVolto = (on: On) => {
  // matchers that take every event: one plugin hooks an event once per matcher, and the engine's own hooks
  // above these have none (the face's sit beneath them, as when it was a plugin of its own)
  on('session.start', { cwd: /(?:)/ }, async ($, e, next) => {
    const gate = await gateOf($)
    enabled = voltoOn(gate)
    $.ui.log(`tinta volto: ${whyOff(gate) ?? 'acceso'}`, { to: 'debug' })
    if (enabled) await startVolto($)
    gateTimer?.cancel()
    gateTimer = $.clock.every(GATE_MS, () => void regate($).catch(() => undefined))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    gateTimer?.cancel()
    if (started) await voiceEnd($).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'volto' }, async $ => (enabled ? { text: (await toggle($)) ? 'Volto aperto.' : 'Volto chiuso.' } : { text: 'Il volto fa parte di Tinta Pro.' }))

  on('prompt.submit', { text: /(?:)/ }, async ($, e, next) => {
    if (enabled && e.command === undefined && e.isMeta !== true) {
      if (!isSpeaking()) void setMood($, 'listening')
      void refreshLook($)
      // una nuova richiesta: la voce della risposta di prima tace subito
      void replyBegin($).catch(() => undefined)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // lo stream del modello: pensiero, testo, chiamate a strumenti; e la voce, frase per frase
  on('turn.step', async function* ($, e, next) {
    // senza il volto lo stream passa com'e'
    if (!enabled) return yield* next(e)
    const main = e.agentId === undefined
    // si legge sempre la risposta: se la voce si accende a meta' (dall'app), le frasi dopo si dicono; a voce
    // spenta ogni frase e' saltata (e lo dice il registro)
    const reader = main ? new StepReader((await read($, voce)).lang ?? 'it') : undefined
    // il primo passo di ogni turno e' una risposta nuova: riprende la voce se quella di prima e' finita, passata ad
    // altri o l'app e' oltre. Qui e non in prompt.submit: quel gancio (con il suo matcher sul testo) non arriva mai
    // al volto, e myGen restava alla prima risposta della sessione; e cosi' vale anche per notifiche e messaggi isMeta
    if (main && e.index === 0) void replyBegin($).catch(() => undefined)
    for await (const chunk of next(e)) {
      if (main) {
        // mentre la voce parla, la bocca resta a parlare: pensiero e lavoro non la fermano
        if (chunk.kind === 'thinking' && !isSpeaking()) void setMood($, 'thinking')
        else if (chunk.kind === 'text' && chunk.text.trim() !== '') void setMood($, 'talking')
        else if (chunk.kind === 'tool' && !isSpeaking()) void setMood($, 'working')
      }
      if (reader) {
        // ogni frase con il testo da cui viene: la chat la ritrova nella risposta mentre la si sente
        if (chunk.kind === 'text') for (const one of reader.textLines(chunk.text)) void sayLine($, one.line, false, one.source)
        else if (chunk.kind === 'tool') for (const one of reader.toolLines()) void sayLine($, one.line, false, one.source)
        else if (chunk.kind === 'stop') for (const one of reader.endLines(chunk.stopReason !== 'tool_use')) void sayLine($, one.line, false, one.source)
      }
      yield chunk
    }
  })

  // un permesso da chiedere alla persona
  on('tool.check', { tool: /(?:)/ }, async ($, e, next) => {
    const verdict = await next(e)
    if (enabled && verdict.decision === 'ask' && e.tool_use_id !== undefined && e.approver === 'person') {
      // un permesso approvato subito (una regola, la modalita') non e' un'attesa: lo si guarda dopo 1,5 s
      const id = e.tool_use_id
      waits.get(id)?.cancel()
      // mentre la voce parla la bocca non si ferma per un permesso: lo si riguarda a voce finita
      const arm = () =>
        waits.set(id, $.clock.after(1500, () => {
          if (isSpeaking()) return void arm()
          waits.delete(id)
          dbg($, `umore waiting: permesso per ${e.tool} ancora in attesa`)
          void setMood($, 'waiting')
        }))
      arm()
    }

    return verdict
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: /(?:)/ }, async ($, e, next) => {
    if (!enabled) return next(e)
    // lo strumento parte: il permesso non aspetta piu'
    if (e.tool_use_id) {
      waits.get(e.tool_use_id)?.cancel()
      waits.delete(e.tool_use_id)
    }
    if (ASKS_PERSON.has(e.tool)) dbg($, `umore waiting: ${e.tool}`)
    if (ASKS_PERSON.has(e.tool) || !isSpeaking()) void setMood($, ASKS_PERSON.has(e.tool) ? 'waiting' : 'working')
    const ran = await next(e)
    if (ran.deny !== undefined || ('isError' in ran && ran.isError === true)) void setMood($, 'worried')
    else if (ASKS_PERSON.has(e.tool) && !isSpeaking()) void setMood($, 'working')

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', { reason: /(?:)/ }, async ($, e, next) => {
    if (!enabled) return next(e)
    if (e.agentId === undefined && e.reason === 'answer' && norm(e.answer) !== '') {
      const done = norm(e.answer)
      await update($, finals, list => [...list.filter(one => one !== done), done].slice(-30)).catch(() => undefined)
    }
    if (e.agentId === undefined) {
      void refreshName($).catch(() => undefined)
      const stillTalking = await replyEnd($)
      if (e.reason === 'answer') {
        // se la voce sta ancora parlando, il sorriso arriva quando ha finito
        if (!stillTalking) await moodThenIdle($, shownMood() === 'worried' ? 'worried' : 'happy', shownMood() === 'worried' ? WORRY_MS : RELAX_MS)
      } else if (e.reason === 'aborted') {
        await stopMine($)
        await setMood($, 'idle')
      } else await moodThenIdle($, 'worried', WORRY_MS)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // il pannello chiuso: il volto non si vede, la voce tace
  on('ui.close', async ($, e, next) => {
    if (enabled && (e.id === PANE || e.id === ATTIVITA)) {
      if (e.id === ATTIVITA) attivitaShown(false)
      else hidden()
      await stopMine($).catch(() => undefined)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // il vecchio segno della riga detta non si vede mai in conversazione
  on('ui.render', { component: 'AssistantMessage', surface: /(?:)/ }, async ($, e, next) => {
    if (!enabled) return next(e)
    // il tono colorito (se acceso) anche nel testo mostrato: le stesse esclamazioni che dice la voce
    const original = withoutLine(e.props.text)
    const text = colorize(original, (await read($, voce)).lang ?? 'it').out
    const below = await (text === e.props.text ? next(e) : next({ ...e, props: { ...e.props, text } }))
    if (e.surface !== 'desktop') return below
    // sempre lo stesso involucro sul desktop: chi disegna sotto (i titoli animati di Tinta) non cambia antenati
    const { Box, Button } = $.ui.resolve(e)
    // le risposte finite si riconoscono dal testo originale (senza esclamazioni)
    const mine = norm(original)
    const isFinal = mine !== '' && (await read($, finals)).some(one => one === mine || one.endsWith(mine))
    const key = keyOf(mine)
    // Ferma mentre la voce legge questa risposta: ascoltata a mano, o letta da sola mentre arrivava
    const heard = await read($, lettura).catch(() => undefined)
    const playing = (await read($, ascolto)) === key || (heard !== undefined && heard.text.trim() !== '' && findSpan(original, heard.text) !== undefined)
    const tint = await read($, look).catch(() => FALLBACK as Look)
    const icon = listenIconDrawing(playing ? 'stop' : 'play', [tint.accent, tint.accent2 ?? tint.accent].map(hex => readableOnBoth(hex) ?? hex))
    const { Svg } = $.ui.resolve(e) as { Svg?: (props: object) => never }

    return (
      <Box key="volto-msg" flexDirection="column">
        {below}
        {isFinal && (
          <Box key="volto-ascolta-row" flexDirection="row" justifyContent="flex-end">
            {/* a slot of one width for both words, the glyph at its start: Ascolta and Ferma swap with nothing moving */}
            <Box key="volto-ascolta-slot" flexDirection="row" alignItems="center" width={11}>
              {Svg && <Svg source={steadyFrame(icon.source)} alt={playing ? '■' : '▶'} width={LISTEN_ICON.size} height={LISTEN_ICON.size} isInteractive />}
              <Button key={`volto-ascolta-${key}`} plain label={Svg ? (playing ? 'Ferma' : 'Ascolta') : playing ? '■ Ferma' : '▶ Ascolta'} onPress={() => void (playing ? stopListening($) : listen($, chunksOf(text), key))} />
            </Box>
          </Box>
        )}
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (!enabled) return next(e)
    try {
      shown()
    return await drawFace($, e, false)
    } catch (error) {
      const { Text } = $.ui.resolve(e)

      // mai un pannello vuoto: almeno il perche'
      return <Text dimColor>Volto non disponibile: {error instanceof Error ? error.message : String(error)}</Text>
    }
  }).catch(($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text dimColor>Volto non disponibile (il disegno non ha risposto)</Text>
  })

  // il volto dentro il pannello Attivita' di Tinta: in cima, sopra l'elenco (in qualunque ordine stiano i due)
  on('ui.render', { component: 'Pane', requestId: ATTIVITA, surface: /(?:)/ }, async ($, e, next) => {
    const below = await next(e)
    if (!enabled || (await read($, dove)) !== 'attivita' || nativeFace()) return below
    if (!attivitaDrawn) dbg($, `il volto si disegna nel pannello Attivita' (${hasContent(below) ? 'sopra l\'elenco' : 'da solo, Tinta lo mette in cima'})`)
    attivitaDrawn = true
    attivitaShown(true)
    const { Box } = $.ui.resolve(e)
    const faceTree = (
      <Box key="volto-in-attivita" flexDirection="column" width="100%">
        {await drawFace($, e, true)}
      </Box>
    )
    // sotto c'e' gia' l'elenco (Tinta sta sotto di noi): il volto sopra; se no, Tinta mettera' il volto in cima
    if (hasContent(below)) {
      return (
        <Box key="volto-attivita" flexDirection="column" gap={1}>
          {faceTree}
          <Box key="volto-attivita-below" flexDirection="column">
            {below}
          </Box>
        </Box>
      )
    }

    return faceTree
  }).catch(($, e, next) => next(e))

  // il pulsante nella fascia sopra il prompt, accanto a quello che disegna chi sta sotto
  on('ui.render', { component: 'AbovePrompt', surface: /(?:)/ }, async ($, e, next) => {
    if (!enabled || e.props.hasSurvey) return next(e)
    const below = await next(e)
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box key="volto-band" flexDirection="row" alignItems="center" gap={1}>
        <Box key="volto-below" flexGrow={1} flexShrink={1} minWidth={0}>
          {below}
        </Box>
        <Button key="volto-toggle" label="☺ Volto" onPress={() => void toggle($)} />
      </Box>
    )
  }).catch(($, e, next) => next(e))
}

/** Il tema Tinta attivo: id e colori; se e' sigillato, il tema in chiaro con lo stesso id, la sua base o una palette nota. */
async function themeInfo($: EngineInterface): Promise<{ id: string | undefined; palette: Palette }> {
  const home = await $.env.get('HOME').catch(() => undefined)
  if (!home) return { id: undefined, palette: FALLBACK }
  const dir = `${home}/.claude/tinta`
  const text = async (path: string) => {
    try {
      const got = await $.fs.read(path)

      return typeof got === 'string' ? got : ''
    } catch {
      return ''
    }
  }
  // i colori che il motore pubblica in chiaro (anche dei temi sigillati), se ci sono
  const published = publishedPalette(await text(`${dir}/active-colors.json`))
  if (published) return { id: published.id, palette: published.palette }
  const active = await text(`${dir}/active.json`)
  const id = themeIdOf(active)
  const direct = paletteOf(active)
  if (direct) return { id, palette: direct }
  if (id === undefined) return { id, palette: FALLBACK }
  for (const name of [id, id.split('-')[0]]) {
    const found = paletteOf(await text(`${dir}/themes/${name}.json`))
    if (found) return { id, palette: found }
  }

  return { id, palette: knownPalette(id) ?? FALLBACK }
}

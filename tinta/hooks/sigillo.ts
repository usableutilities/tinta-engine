/**
 * Il sigillo dei modelli a pagamento (docs/SIGILLO.md): un file sigillato è
 * leggibile solo sul Mac e nell'installazione per cui l'app lo ha scritto.
 * Protezione leggera: ferma la copia casuale, non chi legge questo codice.
 *
 * Tutto sincrono e senza rete: SHA-256 e HMAC sono scritti qui perché
 * `crypto.subtle` dell'ambiente ha solo `digest`.
 */
import type { EngineInterface } from 'claude-code'

import { homeFrom, joinPath, tintaDir } from './theme'

/** La prima chiave di un file sigillato, e la versione del formato. */
export const SEAL_KEY = 'tinta-sigillo'
const VERSION = 1
const LABEL = `tinta-sigillo/${VERSION}`

/** Le palette a pagamento (ThemeLibrary.paletteOrder senza le gratuite), più il vecchio nome di Terracotta. */
export const PAID_PALETTES = ['tinta', 'aurora', 'vetro', 'noir', 'neon', 'avorio', 'fosforo', 'terracotta', 'unicorno', 'root', 'reloaded'] as const
/** Gli stili dei modelli v2 (TemplateStyle). */
export const STYLES = ['minimal', 'outline', 'solid', 'sfumature'] as const

/** La palette a pagamento di un id `<palette a pagamento>-<stile>`, o undefined (Salvia, gratuita, e i temi propri). */
export const paidPaletteOfId = (id: string | undefined): string | undefined => {
  if (id === undefined) return undefined
  for (const style of STYLES) {
    if (!id.endsWith(`-${style}`)) continue
    const palette = id.slice(0, -style.length - 1)

    return (PAID_PALETTES as readonly string[]).includes(palette) ? palette : undefined
  }

  return undefined
}

/** Un modello a pagamento: `<palette a pagamento>-<stile>`. Salvia (gratuita) e i temi propri no. */
export const isPaidTemplateId = (id: string | undefined): boolean => paidPaletteOfId(id) !== undefined

// ---------------------------------------------------------------- SHA-256 / HMAC

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])
const W = new Uint32Array(64)

/** SHA-256 dei pezzi concatenati. */
export const sha256 = (...parts: Uint8Array[]): Uint8Array => {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const padded = new Uint8Array((((length + 9 + 63) >> 6) << 6))
  let at = 0
  for (const part of parts) {
    padded.set(part, at)
    at += part.length
  }
  padded[length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000))
  view.setUint32(padded.length - 4, (length * 8) >>> 0)
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(block + i * 4)
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15] as number, b = W[i - 2] as number
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10)
      W[i] = ((W[i - 16] as number) + s0 + (W[i - 7] as number) + s1) >>> 0
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + (K[i] as number) + (W[i] as number)) >>> 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0
  }
  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  ;[h0, h1, h2, h3, h4, h5, h6, h7].forEach((word, i) => outView.setUint32(i * 4, word))

  return out
}

/** HMAC-SHA256 (RFC 2104). */
export const hmacSha256 = (key: Uint8Array, message: Uint8Array): Uint8Array => {
  const block = new Uint8Array(64)
  block.set(key.length > 64 ? sha256(key) : key)
  const inner = block.map(byte => byte ^ 0x36)
  const outer = block.map(byte => byte ^ 0x5c)

  return sha256(outer, sha256(inner, message))
}

const utf8 = (text: string) => new TextEncoder().encode(text)
export const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
const unb64 = (text: string): Uint8Array | null => {
  try {
    return Uint8Array.from(atob(text), char => char.charCodeAt(0))
  } catch {
    return null
  }
}
/** Confronto a tempo costante di due stringhe esadecimali. */
const same = (a: string, b: string) => {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)

  return diff === 0
}

// ---------------------------------------------------------------- chiavi

/** Quello che lega un sigillo a un'installazione: il segreto di `.sigillo`, la home, l'UUID del Mac. */
export type SealContext = {
  /** 32 byte di `~/.claude/tinta/.sigillo`; null quando il file manca o non si legge. */
  secret: Uint8Array | null
  /** La home reale, senza `/` o `\` finale (su Windows sempre USERPROFILE). */
  home: string
  /** IOPlatformUUID (Mac) o MachineGuid (Windows) in maiuscolo; null quando il motore non ha potuto leggerlo. */
  machine: string | null
}

type Keys = { enc: Uint8Array; weak: Uint8Array; strong: Uint8Array | null }

/** La home come entra nella chiave: senza separatori finali (`/` sul Mac, `\` o `/` su Windows). */
export const sealHome = (home: string) => home.replace(/[\\/]+$/, '')

const keysOf = (ctx: SealContext & { secret: Uint8Array }): Keys => {
  const base = sha256(utf8(`${LABEL}\n${sealHome(ctx.home)}\n`), ctx.secret)

  return {
    enc: sha256(utf8('enc'), base),
    weak: sha256(utf8('weak'), base),
    strong: ctx.machine === null ? null : sha256(utf8('strong'), base, utf8(ctx.machine.toUpperCase())),
  }
}

const xorStream = (key: Uint8Array, nonce: Uint8Array, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(data.length)
  const counter = new Uint8Array(4)
  const view = new DataView(counter.buffer)
  for (let at = 0, i = 0; at < data.length; at += 32, i++) {
    view.setUint32(0, i)
    const block = sha256(key, nonce, counter)
    for (let j = 0; j < 32 && at + j < data.length; j++) out[at + j] = (data[at + j] as number) ^ (block[j] as number)
  }

  return out
}

const messageOf = (id: string, nonce: string, payload: string) => utf8(`${LABEL}|${id}|${nonce}|${payload}`)

/** L'id di un tema in chiaro, o undefined. */
const idOf = (text: string): string | undefined => {
  try {
    const id = (JSON.parse(text) as { id?: unknown }).id

    return typeof id === 'string' ? id : undefined
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------- formato

/** Un file sigillato: ha la chiave `tinta-sigillo` (in qualunque ordine, anche riscritto da un altro programma). */
export const isSealed = (text: string) => /"tinta-sigillo"\s*:/.test(text)

// ---------------------------------------------------------------- riconoscere un modello a pagamento dal contenuto

/**
 * I colori della palette (scura e chiara) di ogni modello a pagamento, come
 * impronte: SHA-256 di `tinta-colore|#RRGGBB`, primi 12 caratteri. Così un
 * modello in chiaro con un altro id (o senza id) si riconosce lo stesso.
 * Generate da themes/v2; nessun tema è scritto qui.
 */
const PAID_COLOURS: readonly (readonly [string, string])[] = [
  ['aurora', '1dd8fc2d02e2 1e84112281ad 1f0b8724e501 2308d55b0562 4afaa293aee1 cdd04ad0cd9c eb3fee0f7110 f0ca4fef08bc'],
  ['aurora', '0e1c39f446d5 12e76cd9e6df 137b87dc62e9 4eadcaeb725d 6a49abc049e2 7737e137f196 860cb477afcd 8e89d280fb98'],
  ['avorio', '01383ad3a5c6 04b043ee2746 4ed2bfe97fb5 5f00788461a7 bd50fb3a3750 dfa439c15e80 f55c28289196 fccb83425836'],
  ['avorio', '132c4bf1c446 3e976727eab7 6137b391217a 77d2894b6c24 926649ed6329 c8cccf41ab1e d0b10ef8547a e96e828801f5'],
  ['fosforo', '1ec53e7ab19e 32e4d9377c7d 366fe34acc89 3bf6d42e7fc6 77d5b0eb7854 78e6cd1aec18 e0f7f8feddfd f684ea31d8ea'],
  ['fosforo', '4eadcaeb725d 4eb4e37e059d 5335fbe31fc4 6b5f805ec598 7118a3a10c56 9e42abefed48 ab96935133c0 eace61b86f6b'],
  ['neon', '18552c44d0b8 2c1ba3bf3525 37fb0ea9e485 726f3cc1fe26 80bafe01f024 ba7568933995 c6358a190934 e8ba0a76a861'],
  ['neon', '38bd0c52205c 4eadcaeb725d 51a79904389b 6bbd0eb2e591 7d9e7ef7c08e 89c6e54cca26 8dfb595d8b03 92a2e7e194e5'],
  ['noir', '3481c81eada9 3ab14ee66e95 71cbbc640c8f 8f364dae0658 8fa8c486c873 ba83b3af1dad c5e91e1b8236 e777220a3c47'],
  ['noir', '0cd5fbdf6f58 1fec930435c4 30c096334434 3cbd504e0a0a 4a1e1153e0d4 4eadcaeb725d 6907ded5a461 c6b109160e11'],
  ['root', '0fd5a2e6a684 103a8b5e975f 6f9eebf9d3ea 9f64bf5dc368 b50a786d5468 c23ac8b6d185 e42d880542db f633bad0c995'],
  ['root', '05c4d9410e6a 2d8edf32671f 48a603589452 4eadcaeb725d 5b121c6b53f0 6bbd0eb2e591 80b1c1fc204f d292a97756e4'],
  ['terracotta', '0c5c56ca63f7 0d8636b6f97b 352be3a0fc6a 61b11f3ca239 6f65c0a477ca 738ab94169ba 9c7ad2363657 d08b0fe6e1a8'],
  ['terracotta', '1e775581931d 1fec930435c4 28fdf32ab8a5 4eadcaeb725d 8800a245d67a df148a84ab20 e974c2243761 f863fefb33a7'],
  ['tinta', '054fe4bf34ad 0ddd1b506d0b 653b1ac60212 7165a219418e 75e0235b230d b7cd5a005576 d9d9fac42824 ee8ee8e529e8'],
  ['tinta', '497b29fd9a52 4eadcaeb725d 5a0b0a19928a 6bbd0eb2e591 9288bb2060dd ab284761bb87 d86a68d834cc f8920bf49508'],
  ['tinta', '0ddd1b506d0b 2479a5496cff 7165a219418e 75e0235b230d 9cae217e0801 b7cd5a005576 d9d9fac42824 ee8ee8e529e8'],
  ['unicorno', '0213723422f4 070720b890b7 132a96084f41 3445fe259a81 9e6344f634b6 abd71812fb67 b0aa2bc0d19a f74615ba36c6'],
  ['unicorno', '1fda6c2f0a69 1fec930435c4 293794c37913 4eadcaeb725d 74b87546b6bd 999340a7c780 b95e64e99cbe e18a2a1cfd2b'],
  ['vetro', '0643e509ab3e 17c19d063a54 26490edb8f54 62e986f8c747 71e7cc98fa35 e9b7185fdbf6 f1a85cfb4a77 f1f2a93c6f43'],
  ['vetro', '45d33c8f7208 4eadcaeb725d 6ef9d7cee7f6 71aafa11c451 860cb477afcd a388a10deba0 c54d5570a449 d4b14a0b415d'],
]
/** Quanti colori della palette devono coincidere con quelli di un modello a pagamento (fra due palette diverse ne coincidono al più 2). */
const PAID_MATCH = 5
const PALETTE_KEYS = ['ink', 'surface', 'text', 'muted', 'accent', 'accentSoft', 'success', 'danger'] as const

/** Un colore come entra nell'impronta: `#RRGGBB` maiuscolo (anche da `#rgb` e `#rrggbbaa`), o undefined. */
const colourOf = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const v = value.trim().toUpperCase()
  if (/^#[0-9A-F]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  if (/^#[0-9A-F]{6}([0-9A-F]{2})?$/.test(v)) return v.slice(0, 7)

  return undefined
}

const PAID_PRINTS = PAID_COLOURS.map(([palette, prints]) => ({ palette, prints: new Set(prints.split(' ')) }))

/** La palette a pagamento di cui `palette` (un oggetto `palette` del tema) ha i colori, o undefined. */
const paidPaletteOfColours = (palette: unknown): string | undefined => {
  if (palette === null || typeof palette !== 'object') return undefined
  const prints = new Set<string>()
  for (const key of PALETTE_KEYS) {
    const colour = colourOf((palette as { [key: string]: unknown })[key])
    if (colour !== undefined) prints.add(hex(sha256(utf8(`tinta-colore|${colour}`))).slice(0, 12))
  }
  if (prints.size < PAID_MATCH) return undefined
  for (const paid of PAID_PRINTS) {
    let same = 0
    for (const print of prints) if (paid.prints.has(print)) same++
    if (same >= PAID_MATCH) return paid.palette
  }

  return undefined
}

/**
 * La palette a pagamento di un tema in chiaro, qualunque sia il suo id:
 * dall'id, dal suggerimento `styleHints.palette`, o dai colori della palette
 * scura o chiara. Undefined per Salvia e per i temi propri.
 */
export const paidPaletteOf = (text: string): string | undefined => {
  let theme: { id?: unknown; palette?: unknown; styleHints?: { palette?: unknown }; variants?: { light?: { palette?: unknown } } }
  try {
    theme = JSON.parse(text) as typeof theme
  } catch {
    return undefined
  }
  if (theme === null || typeof theme !== 'object') return undefined
  const byId = paidPaletteOfId(typeof theme.id === 'string' ? theme.id : undefined)
  if (byId !== undefined) return byId
  const hinted = theme.styleHints?.palette
  if (typeof hinted === 'string' && (PAID_PALETTES as readonly string[]).includes(hinted)) return hinted

  return paidPaletteOfColours(theme.palette) ?? paidPaletteOfColours(theme.variants?.light?.palette)
}

/** Il risultato di `openTheme`: il JSON in chiaro, oppure null e il motivo (per probe.log). */
export type Opened = { text: string } | { text: null; reason: string }

/**
 * Come il motore tratta i temi in chiaro: `enforce` rifiuta i modelli a
 * pagamento; `entitled` sono le palette di cui questa installazione ha un
 * modello sigillato valido (l'app installa solo quelle sbloccate).
 */
export type Enforcement = { enforce: boolean; entitled?: ReadonlySet<string> }

/**
 * Il JSON in chiaro da dare a `parseTheme`, o il rifiuto.
 *
 * - in chiaro, quando `enforce`: un id `<palette a pagamento>-<stile>` è
 *   sempre rifiutato (l'app li scrive solo sigillati); un tema con un altro id
 *   riconosciuto dal contenuto come una palette a pagamento (`paidPaletteOf`)
 *   passa solo se quella palette è in `entitled` (la copia che la persona ha
 *   fatto di un modello comprato), altrimenti è rifiutato. Il resto passa;
 * - sigillato: con l'UUID serve la firma forte, senza basta la debole; poi
 *   si decifra e l'id interno deve essere quello esterno.
 */
export const openTheme = (text: string, ctx: SealContext, options: Enforcement): Opened => {
  if (!isSealed(text)) {
    if (!options.enforce) return { text }
    const id = idOf(text)
    if (isPaidTemplateId(id)) return { text: null, reason: `modello a pagamento in chiaro (${id})` }
    const palette = paidPaletteOf(text)
    if (palette !== undefined && !(options.entitled?.has(palette) ?? false)) {
      return { text: null, reason: `modello a pagamento in chiaro riconosciuto dal contenuto (${palette}, id ${id ?? '?'})` }
    }

    return { text }
  }
  let sealed: { [key: string]: unknown }
  try {
    sealed = JSON.parse(text) as { [key: string]: unknown }
  } catch {
    return { text: null, reason: 'sigillo illeggibile' }
  }
  const { id, nonce, payload, mac, mac2 } = sealed
  if (sealed[SEAL_KEY] !== VERSION) return { text: null, reason: `versione del sigillo ${String(sealed[SEAL_KEY])}` }
  if (typeof id !== 'string' || typeof nonce !== 'string' || typeof payload !== 'string') return { text: null, reason: 'sigillo incompleto' }
  if (ctx.secret === null) return { text: null, reason: `${id}: manca .sigillo` }
  const keys = keysOf({ ...ctx, secret: ctx.secret })
  const message = messageOf(id, nonce, payload)
  const valid =
    keys.strong !== null
      ? same(hex(hmacSha256(keys.strong, message)), typeof mac === 'string' ? mac : '')
      : same(hex(hmacSha256(keys.weak, message)), typeof mac2 === 'string' ? mac2 : '')
  if (!valid) return { text: null, reason: `${id}: firma non valida su questo Mac${keys.strong === null ? ' (senza UUID)' : ''}` }
  const nonceBytes = unb64(nonce)
  const data = unb64(payload)
  if (nonceBytes === null || data === null) return { text: null, reason: `${id}: base64 non valido` }
  const plain = new TextDecoder('utf-8').decode(xorStream(keys.enc, nonceBytes, data))
  if (idOf(plain) !== id) return { text: null, reason: `${id}: id interno diverso` }

  return { text: plain }
}

// ---------------------------------------------------------------- contesto dal motore

/** L'UUID dall'output di `ioreg -rd1 -c IOPlatformExpertDevice`. */
export const machineFromIoreg = (out: string): string | null => {
  const m = /"IOPlatformUUID"\s*=\s*"([0-9A-Fa-f-]{36})"/.exec(out)

  return m ? (m[1] as string).toUpperCase() : null
}

/** Il MachineGuid dall'output di `reg.exe query HKLM\SOFTWARE\Microsoft\Cryptography /v MachineGuid /reg:64`. */
export const machineFromReg = (out: string): string | null => {
  const m = /MachineGuid\s+REG_SZ\s+([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})/.exec(out)

  return m ? (m[1] as string).toUpperCase() : null
}

/** Windows: `OS` vale `Windows_NT` (l'API dei mod non dice il sistema; la variabile c'è sempre su Windows). */
export const isWindowsEnv = (os: string | undefined) => os === 'Windows_NT'

/** Il comando che legge l'identità della macchina: `reg.exe` (vista a 64 bit) su Windows, `ioreg` sul Mac. */
export const machineArgv = (windows: boolean, systemRoot?: string): string[] =>
  windows
    ? [`${(systemRoot ?? '').trim() !== '' ? (systemRoot as string).replace(/[\\/]+$/, '') : 'C:\\Windows'}\\System32\\reg.exe`, 'query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64']
    : ['/usr/sbin/ioreg', '-rd1', '-c', 'IOPlatformExpertDevice']

/** Se il motore gira su Windows (letto dall'ambiente; false se l'ambiente non risponde). Una dichiarazione: il motore la segue da register.tsx con `$`. */
export async function onWindows($: EngineInterface): Promise<boolean> {
  try {
    return isWindowsEnv(await $.env.get('OS'))
  } catch {
    return false
  }
}

/**
 * La home della chiave del sigillo: su Windows sempre USERPROFILE (poi
 * HOMEDRIVE + HOMEPATH), mai una HOME di Git Bash come `/c/Users/ada`; altrove
 * quella di `homeFrom`.
 */
export const sealHomeFrom = (
  env: { HOME?: string; USERPROFILE?: string; HOMEDRIVE?: string; HOMEPATH?: string },
  windows: boolean,
): string | undefined => (windows ? homeFrom({ USERPROFILE: env.USERPROFILE, HOMEDRIVE: env.HOMEDRIVE, HOMEPATH: env.HOMEPATH }) : homeFrom(env))

/**
 * L'identità di questa macchina, letta una volta per modulo (null senza
 * `$.process`, che è solo del CLI e manca nel kit di `claude plugin test`, o se
 * il comando fallisce). Una dichiarazione: il motore la segue da register.tsx con `$`.
 */
let machineOnce: Promise<string | null> | undefined
export function machineId($: EngineInterface): Promise<string | null> {
  machineOnce ??= (async () => {
    try {
      const windows = await onWindows($)
      const systemRoot = windows ? await $.env.get('SystemRoot') : undefined
      const { exitCode, stdout } = await $.process.run(machineArgv(windows, systemRoot), { timeoutMs: 3000 })
      if (exitCode !== 0) return null

      return windows ? machineFromReg(stdout) : machineFromIoreg(stdout)
    } catch {
      return null
    }
  })()

  return machineOnce
}

/** Solo per i test: dimentica l'UUID letto. */
export const forgetMachine = () => {
  machineOnce = undefined
}

/** Il segreto di `.sigillo` (base64 di 32 byte), o null. */
export const secretFrom = (text: string): Uint8Array | null => {
  const bytes = unb64(text.trim())

  return bytes !== null && bytes.length === 32 ? bytes : null
}

/** Il contesto del sigillo per questa sessione: `home` è la home (non la cartella tinta). */
export const sealContext = async ($: EngineInterface, home: string): Promise<SealContext> => {
  const dir = tintaDir(home) as string
  let secret: Uint8Array | null = null
  try {
    const text = await $.fs.read(joinPath(dir, '.sigillo'))
    secret = typeof text === 'string' ? secretFrom(text) : null
  } catch {
    secret = null
  }

  return { secret, home: sealHome(home), machine: await machineId($) }
}

/** L'ultima risposta di `entitledPalettes`: la sua chiave (i file e il sigillo) e le palette. */
let entitledOnce: { key: string; palettes: ReadonlySet<string> } | undefined

/**
 * Le palette a pagamento per cui `themes/` ha un modello sigillato che si apre
 * con il sigillo di questa installazione: l'app scrive solo quelle sbloccate,
 * sigillate per questo Mac. Senza `.sigillo` nessuna. Ricalcolate solo quando
 * cambiano i file o il sigillo.
 */
export async function entitledPalettes($: EngineInterface, dir: string, seal: SealContext): Promise<ReadonlySet<string>> {
  if (seal.secret === null) return new Set()
  const entries = await $.fs.list(joinPath(dir, 'themes')).catch(() => [])
  const paid = entries.filter(entry => entry.kind === 'file' && entry.name.endsWith('.json') && isPaidTemplateId(entry.name.slice(0, -5)))
  const key = [hex(sha256(seal.secret)), seal.home, seal.machine ?? '', ...paid.map(entry => `${entry.name}:${entry.size}:${entry.mtimeMs}`)].join('|')
  if (entitledOnce?.key === key) return entitledOnce.palettes
  const palettes = new Set<string>()
  for (const entry of paid) {
    try {
      const text = await $.fs.read(joinPath(dir, 'themes', entry.name))
      if (typeof text !== 'string' || !isSealed(text)) continue
      const opened = openTheme(text, seal, { enforce: true })
      const palette = opened.text === null ? undefined : paidPaletteOfId(idOf(opened.text))
      if (palette !== undefined) palettes.add(palette)
    } catch {
      // unreadable: not a proof of purchase
    }
  }
  entitledOnce = { key, palettes }

  return palettes
}

/**
 * La regola del motore per questa sessione: la copia installata (dal
 * marketplace) rifiuta i modelli a pagamento in chiaro, che `.sigillo` ci sia
 * o no; la copia di sviluppo e i test li prendono come sono.
 */
export async function enforcement($: EngineInterface, installed: boolean, dir: string | undefined, seal: SealContext): Promise<Enforcement> {
  if (!installed) return { enforce: false }

  return { enforce: true, entitled: dir === undefined ? new Set() : await entitledPalettes($, dir, seal) }
}

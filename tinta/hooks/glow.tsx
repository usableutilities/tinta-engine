import type { TintaFill } from '../types'
import { paint } from './svg'
import { meshPaint } from './fills'

/**
 * stubMode glow: the user's prompt keeps the app's own row, real words,
 * selection and hover actions; under it Tinta draws one blurred, rounded
 * shape in the user's fill, larger than the app's bubble on every side, and
 * pulls the app's row up over it. The app's bubble grey is translucent, so
 * the shape shows through it and the bubble reads in the user's colour; the
 * blur and the overshoot hide any error in the estimate of its size.
 *
 * Defaults, each a theme field on `user`: `glowOpacity` (0 to 1),
 * `glowBlur` (stdDeviation, px), `glowOvershoot` (px past the bubble's
 * left, top and bottom edges; the right edge is the row's), `glowFill`.
 */
export const USER_GLOW = { opacity: 0.9, blur: 10, overshoot: 14, offsetY: 0, offsetX: 0, widthScale: 1 } as const
/**
 * Every length here is a true CSS px of the desktop's page. The app runs at
 * zoom 1.2 (Chromium's per-host zoom), so a screenshot px is 1.2 CSS px:
 * the old fitted numbers (9.74, 12.2, 17.78, 727, 1.17 / 1.19 Svg scales)
 * were these values seen through it. Read from the desktop's live web
 * bundle: a mod Svg is drawn at its props exactly (style width/height in
 * px); a Box's horizontal unit is 1ch of the surface's sans font, its
 * vertical unit var(--engine-row-unit, .5lh).
 */
export const DESKTOP_ZOOM = 1.2
/** The prompt bubble's share of the row (max-width 85%). */
export const GLOW_BUBBLE_SHARE = 0.85
/**
 * The transcript column's measure, CSS px (--chat-column-measure): the row
 * is the viewport's columns x 1ch up to it. The bubble's widest is
 * GLOW_BUBBLE_SHARE of the row: the owner's 6-line lorem was 625 CSS px wide
 * (0.85 x 735), an older one 606, so no fixed cap (the old 612 cut the first).
 */
export const GLOW_MEASURE_PX = 768
/** The transcript column's gutter a side, CSS px: the row is the measure less two (768 − 32 = 736). */
export const GLOW_GUTTER_PX = 16
/**
 * How the desktop counts `viewport.columns` (its measureViewport, read from
 * the app's bundle): columns = max(1, floor(W / ch)), W the transcript
 * column's content width (clientWidth less its padding), ch the 1ch of a
 * hidden probe in the code font (font-mono, text-code). So W lies in
 * [columns x ch, (columns + 1) x ch). The owner's two narrow lorems (88
 * columns: 571 CSS px = 0.85 x 671.8; 93: 606 = 0.85 x 712.9) bound ch to
 * (7.584, 7.634]: GLOW_COLUMN_PX is in it, and the row is read a quarter of
 * a column into its bracket, toward the low end, so a full-width glow errs
 * inside the app's rim.
 */
export const GLOW_COLUMN_PX = 7.584
/** Where in its one-column bracket the row is taken: 0 its low end, 1 its high end. */
export const GLOW_COLUMN_BIAS = 0
/** The transcript row's width from `columns`, CSS px, before the measure caps it. */
export const rowPx = (columns: number): number => (Math.max(1, columns) + GLOW_COLUMN_BIAS) * GLOW_COLUMN_PX
/**
 * The prompt bubble's widest in a row of `columns` cells, CSS px: 85% of
 * the row, up to the 768 px measure less 16 a side (0.3.48's 98 columns:
 * 625 CSS px).
 */
export const bubbleWidest = (columns: number): number => GLOW_BUBBLE_SHARE * Math.min(GLOW_MEASURE_PX - 2 * GLOW_GUTTER_PX, rowPx(Math.max(20, columns)))
/** The prompt bubble's widest at the measure, CSS px. */
export const GLOW_MAX_PX = GLOW_BUBBLE_SHARE * (GLOW_MEASURE_PX - 2 * GLOW_GUTTER_PX)
/** The prompt bubble's font: Anthropic Sans 15 px, line-height 21 px. */
export const GLOW_FONT_PX = 15
/** The prompt's line pitch, CSS px. */
export const GLOW_LINE_PX = 21
/** The prompt bubble's padding, CSS px: 16 a side, 12 above and below (comfortable density); no border. */
export const GLOW_PAD = { x: 16, y: 12 } as const
/** A short bubble's width past its words, CSS px. */
export const GLOW_WIDTH_PAD = 2 * GLOW_PAD.x
/**
 * The prompt bubble's corner radius, CSS px: --cds-radius .5rem + .25rem.
 * The epitaxy override's 24 drew a full pill where the owner's 0.3.37
 * sample shows visibly smaller corners.
 */
export const GLOW_RADIUS = 12
/**
 * The glow Svg's height prop over the CSS px it should cover: 1. The
 * owner's 0.3.47 samples settle it: an Svg is drawn at its props in CSS px
 * on both axes (180 props drawn 216 screen pt, 54 drawn 65), so the 1.2 of
 * 0.3.39 overshot. The 0.3.37 reading (45 props seen 45 pt) was the old
 * radius: a 23 px pill under the app's 12 px corners leaves the native's
 * top band showing at the sides, read as the shape's top.
 */
export const GLOW_SVG_Y = 1
/** A Box's horizontal unit (margin, padding, width 1), CSS px: 1ch, the "0" of Anthropic Sans at 15 px. */
export const GLOW_UNIT_PX = 0.605 * GLOW_FONT_PX
/** A Box's vertical unit (margin, padding 1), CSS px: half the 21 px line. */
export const GLOW_MARGIN_PX = GLOW_LINE_PX / 2
/** The characters GLOW_EM_WIDTHS covers: ASCII, Latin-1, Latin Extended-A and typographic punctuation. */
const GLOW_EM_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſ‘’“”–—…•€"
/** Their advance widths in em, read from the app's own font file (AnthropicSans-Romans-Variable at wght 375, opsz 16, the kerning below from the same instance: one harfbuzz pass, fit to the owner's one-line bubbles and the two wrapped lorems' widest lines; 400 and 430 came out ~1% wide). */
const GLOW_EM_WIDTHS = [0.2125,  0.2325,  0.398,  0.64,  0.523,  0.9895,  0.678,  0.2325,  0.403,  0.403,  0.4885,  0.64,  0.2325,  0.36,  0.2325,  0.332,  0.607,  0.37,  0.58,  0.5575,  0.613,  0.5635,  0.5705,  0.5315,  0.562,  0.5705,  0.2325,  0.2325,  0.64,  0.64,  0.64,  0.5395,  0.872,  0.7335,  0.6545,  0.76,  0.7405,  0.6385,  0.594,  0.794,  0.74,  0.2705,  0.536,  0.681,  0.5775,  0.9355,  0.7865,  0.816,  0.6085,  0.816,  0.6805,  0.5845,  0.5775,  0.726,  0.7335,  1.0085,  0.6645,  0.676,  0.66,  0.403,  0.332,  0.403,  0.64,  0.5,  0.5,  0.5435,  0.6175,  0.549,  0.6175,  0.577,  0.415,  0.5685,  0.594,  0.2495,  0.2495,  0.5615,  0.2495,  0.8675,  0.594,  0.5805,  0.6175,  0.6175,  0.3995,  0.5115,  0.415,  0.5895,  0.5585,  0.8185,  0.563,  0.5665,  0.502,  0.403,  0.303,  0.403,  0.64,  0.2125,  0.2325,  0.57,  0.64,  0.64,  0.64,  0.303,  0.64,  0.5,  0.64,  0.4945,  0.398,  0.64,  0.0,  0.64,  0.5,  0.4795,  0.64,  0.365,  0.3535,  0.5,  0.6015,  0.64,  0.2325,  0.5,  0.313,  0.526,  0.398,  0.8465,  0.8295,  0.8875,  0.5395,  0.7335,  0.7335,  0.7335,  0.7335,  0.7335,  0.7335,  1.0985,  0.76,  0.6385,  0.6385,  0.6385,  0.6385,  0.2705,  0.2705,  0.2705,  0.2705,  0.819,  0.7865,  0.816,  0.816,  0.816,  0.816,  0.816,  0.64,  0.816,  0.726,  0.726,  0.726,  0.726,  0.676,  0.6085,  0.6325,  0.5435,  0.5435,  0.5435,  0.5435,  0.5435,  0.5435,  0.902,  0.549,  0.577,  0.577,  0.577,  0.577,  0.2495,  0.2495,  0.2495,  0.2495,  0.5805,  0.594,  0.5805,  0.5805,  0.5805,  0.5805,  0.5805,  0.64,  0.5805,  0.5895,  0.5895,  0.5895,  0.5895,  0.5665,  0.6175,  0.5665,  0.7335,  0.5435,  0.7335,  0.5435,  0.7335,  0.5435,  0.76,  0.549,  0.76,  0.549,  0.76,  0.549,  0.76,  0.549,  0.7405,  0.6175,  0.819,  0.6175,  0.6385,  0.577,  0.6385,  0.577,  0.6385,  0.577,  0.6385,  0.577,  0.6385,  0.577,  0.794,  0.5685,  0.794,  0.5685,  0.794,  0.5685,  0.794,  0.5685,  0.74,  0.594,  0.78,  0.594,  0.2705,  0.2495,  0.2705,  0.2495,  0.2705,  0.2495,  0.2705,  0.2495,  0.2705,  0.2495,  0.5835,  0.5065,  0.536,  0.2495,  0.681,  0.5615,  0.5615,  0.5775,  0.2495,  0.5775,  0.2495,  0.5775,  0.2495,  0.5775,  0.3435,  0.656,  0.4095,  0.7865,  0.594,  0.7865,  0.594,  0.7865,  0.594,  0.7525,  0.7865,  0.594,  0.816,  0.5805,  0.816,  0.5805,  0.816,  0.5805,  1.058,  0.9805,  0.6805,  0.3995,  0.6805,  0.3995,  0.6805,  0.3995,  0.5845,  0.5115,  0.5845,  0.5115,  0.5845,  0.5115,  0.5845,  0.5115,  0.5775,  0.415,  0.5775,  0.415,  0.5775,  0.415,  0.726,  0.5895,  0.726,  0.5895,  0.726,  0.5895,  0.726,  0.5895,  0.726,  0.5895,  0.726,  0.5895,  1.0085,  0.8185,  0.676,  0.5665,  0.676,  0.66,  0.502,  0.66,  0.502,  0.66,  0.502,  0.415,  0.2325,  0.2325,  0.3975,  0.3975,  0.5,  1.0,  1.0,  0.5,  0.64]
/** The app's prompt font's character widths, in em; anything else (an emoji, a symbol) GLOW_EM_OTHER. */
export const GLOW_EM: { [ch: string]: number } = Object.fromEntries([...GLOW_EM_CHARS].map((c, i) => [c, GLOW_EM_WIDTHS[i] ?? 0.55]))
/** An unknown character's width, em (an emoji is about this). */
export const GLOW_EM_OTHER = 1.25
/**
 * The font's kerning (its GPOS "kern" pairs at wght 375, opsz 16, the advances' instance): the
 * characters in left classes, in right classes, and for each left class the
 * right classes it kerns with, "class:font units" (GLOW_KERN_UPM to an em).
 * The app kerns its prompt: without it a caps line is ~8 px too wide.
 */
const GLOW_KERN_LEFT: readonly string[] = ["\"'’”", ",.", "-­–—", "2", "38", "4", "5", "6", "7", "9", ":;", "AÀÁÂÃÄÅĀĂĄ", "B", "CÇĆĈĊČ", "DÐĎĐ", "EÆÈÉÊËĒĔĖĘĚŊŒ", "F", "GĜĞĠĢ", "JĴ", "KĶ", "LĹĻĽĿŁ", "OQÒÓÔÕÖØŌŎŐ", "P", "RŔŖŘ", "SŚŜŞŠ", "TŢŤŦ", "UÍÙÚÛÜĲŨŪŬŮŰŲ", "V", "WŴ", "X", "YÝŶŸ", "ZŹŻŽ", "aàáâãäåāăą", "beopæèéêëòóôõöøþēĕėęěōŏőœ", "cçćĉċč", "f", "gĝğġģ", "hnñĥħńņňŉ", "kķĸ", "m", "rŕŗř", "sśŝşš", "tţťŧ", "uùúûüũūŭůűų", "vyýÿŷ", "wŵ", "x", "zźżž", "‘“"]
const GLOW_KERN_RIGHT: readonly string[] = ["\"'’”", ",.", "-–—", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":;", "AÀÁÂÃÄÅÆĀĂĄ", "CGOQÇÒÓÔÕÖØĆĈĊČĜĞĠĢŌŎŐŒ", "JĴ", "SŚŜŞŠ", "TŢŤŦ", "UÍÙÚÛÜĲŨŪŬŮŰŲ", "V", "WŴ", "X", "YÝŶŸ", "ZŹŻŽ", "aàáâãäåæāăą", "bhklĥħķĺļľŀ", "cdeoqçèéêëòóôõöøćĉċčďđēĕėęěōŏőœ", "f", "gĝğġģ", "ijìíîïĩīĭįĳĵ", "mnprñıĸńņňŕŗř", "sśŝşš", "tţťŧ", "uùúûüũūŭůűų", "v", "wŵ", "xzźżž", "yýÿŷ"]
const GLOW_KERN_PAIRS: readonly string[] = ["24:-175 26:-190 28:-200 30:-115 31:-200", "0:-50 14:-80 17:-220 18:-60 19:-250 20:-150 22:-240 26:-55 27:-75 32:-125 33:-25 34:-150 35:-125 37:-150", "13:-60 17:-180 19:-60 20:-30 21:-165 22:-180 23:-90 36:-90", "6:-50", "3:-20 4:-15 9:-40", "3:-20 9:-30 11:-10", "3:-50 4:-30 9:-30", "3:-70 9:-80 11:-70", "5:-30 6:-150 7:-70 8:-100 10:-20", "6:-30 8:-50", "17:-180 19:-120 20:-80 22:-150", "0:-180 2:-60 14:-95 16:-45 17:-200 18:-50 19:-200 20:-180 22:-200 26:-75 27:-60 31:-25 32:-75 33:-30 34:-130 35:-90 37:-115", "17:-60 19:-75 20:-65 21:-40 22:-100 27:-40 32:-40 34:-40 35:-35 36:-45 37:-30", "13:-45 14:-25 17:-75 19:-45 20:-30 21:-60 22:-110 27:-35 32:-35 34:-45 35:-40 36:-50 37:-45", "1:-120 13:-80 15:-45 17:-115 19:-80 20:-65 21:-100 22:-120 23:-75 24:-30 28:-50 36:-55", "2:-60 14:-35 16:-40 26:-60 27:-70 28:-30 31:-25 32:-70 33:-30 34:-105 35:-70 37:-90", "1:-270 13:-185 14:-30 15:-120 16:-40 21:-50 23:-50 24:-110 26:-70 27:-65 28:-110 30:-70 31:-80 32:-65 33:-70 34:-60 35:-50 36:-120 37:-60", "13:-35 17:-145 19:-75 20:-60 22:-125 27:-40 32:-40 34:-70 35:-55 37:-70", "1:-65 13:-55 21:-65", "14:-120 16:-35 18:-40 24:-60 26:-70 27:-110 31:-65 32:-155 33:-65 34:-145 35:-120 37:-120", "0:-240 2:-240 14:-130 16:-35 17:-200 18:-80 19:-220 20:-200 22:-250 26:-40 27:-55 31:-35 32:-100 33:-30 34:-145 35:-100 37:-150", "1:-80 13:-95 17:-110 19:-95 20:-70 21:-100 22:-140 23:-30 28:-30 36:-55", "1:-300 13:-205 15:-180 17:-25 19:-30 21:-140 22:-40 23:-35 24:-115 26:-105 28:-115 31:-80 36:-95", "14:-35 16:-45 17:-90 19:-85 20:-35 22:-95 24:-45 26:-40 27:-50 28:-25 31:-45 32:-50 33:-50 34:-30 35:-20 37:-30", "13:-35 17:-70 19:-100 20:-75 21:-70 22:-125 23:-30 27:-40 32:-45 34:-55 35:-30 36:-65 37:-55", "1:-220 2:-180 12:-180 13:-200 14:-110 15:-200 16:-70 21:-35 23:-30 24:-240 26:-240 27:-45 28:-260 30:-160 31:-240 32:-45 33:-150 34:-180 35:-180 36:-180 37:-180", "1:-60 13:-50 21:-75", "1:-250 2:-60 12:-120 13:-200 14:-95 15:-200 16:-70 24:-200 26:-180 27:-60 28:-210 30:-125 31:-170 32:-75 33:-110 34:-80 35:-70 36:-100 37:-80", "1:-150 2:-30 12:-90 13:-180 14:-70 15:-165 16:-70 24:-175 26:-160 27:-60 28:-215 30:-105 31:-140 32:-75 33:-95 34:-75 35:-65 36:-110 37:-75", "2:-165 14:-100 16:-80 17:-35 18:-75 26:-70 27:-90 31:-25 32:-110 33:-50 34:-120 35:-100 37:-100", "1:-240 2:-180 12:-150 13:-200 14:-140 15:-225 16:-100 23:-30 24:-180 25:-30 26:-220 27:-70 28:-220 29:-60 30:-150 31:-200 32:-70 33:-165 34:-150 35:-140 36:-150 37:-150", "2:-90 14:-30 24:-20 26:-80 27:-30 28:-35 31:-50 32:-30 33:-25 34:-90 35:-70 37:-90", "0:-130 26:-25 27:-50 28:-20 32:-40 34:-85 35:-65 37:-85", "0:-70 1:-55 27:-40 28:-20 32:-45 34:-45 35:-40 36:-80 37:-50", "34:-30 35:-20 36:-60 37:-20", "1:-235 24:-80 26:-90 27:-45 28:-110 31:-75 32:-45", "1:-50 24:-45 26:-30 28:-40 31:-25 36:-25", "0:-35 27:-30 32:-35 34:-50 35:-25 37:-50", "2:-60 24:-40 26:-55 31:-30 33:-50", "32:-25 34:-25 35:-15 37:-35", "1:-180 24:-45 28:-45 31:-25 36:-35", "0:-40 27:-35 32:-55 34:-45 35:-30 36:-35 37:-45", "26:-20 27:-45 32:-45", "1:-25 28:-30 36:-20", "1:-150 24:-60 26:-45 28:-100 31:-45 36:-55", "1:-125 24:-55 26:-40 28:-80 31:-30 36:-55", "2:-60 24:-35 26:-80 27:-35 28:-50 31:-30 32:-40 33:-20", "26:-40 28:-30", "1:-50 13:-200 15:-150 16:-20 21:-20 23:-20 24:-130 26:-70 28:-80 31:-40"]
const GLOW_KERN_UPM = 2000
const kernLeft = new Map(GLOW_KERN_LEFT.flatMap((chars, i) => [...chars].map(c => [c, i] as const)))
const kernRight = new Map(GLOW_KERN_RIGHT.flatMap((chars, j) => [...chars].map(c => [c, j] as const)))
const kernPairs = GLOW_KERN_PAIRS.map(row => new Map(row.split(' ').filter(Boolean).map(entry => entry.split(':').map(Number) as [number, number])))
/** em the font kerns `a` followed by `b` by (negative: closer). */
export const kernEm = (a: string, b: string): number => {
  const i = kernLeft.get(a)
  const j = kernRight.get(b)

  return i === undefined || j === undefined ? 0 : (kernPairs[i]?.get(j) ?? 0) / GLOW_KERN_UPM
}
/** px `text` takes in the app's prompt font: each character's advance and the kerning between neighbours. */
export const textPx = (text: string): number => {
  const chars = [...text]

  return chars.reduce((px, ch, i) => px + ((GLOW_EM[ch] ?? (/\p{L}/u.test(ch) ? 0.58 : GLOW_EM_OTHER)) + (i > 0 ? kernEm(chars[i - 1] ?? '', ch) : 0)) * GLOW_FONT_PX, 0)
}
/** px a character of the prompt font takes, on average (8.3 screen px before). */
export const GLOW_CHAR_PX = 8.3 / DESKTOP_ZOOM
/** Lines added for an attachment (a chip or a thumbnail in the bubble). */
export const GLOW_ATTACH_LINES = 3
/** The default gradient's direction: top left to bottom right. */
export const GLOW_ANGLE = 135
/** Room round the shape, in blurs, so the blur fades out inside the drawing (no flat edge). */
export const GLOW_FADE = 3
/**
 * px under the app's prompt bubble to its row's foot on desktop: its action
 * row (time, copy, retry, branch); register.tsx USER_FOOT, the same value. A
 * glow anchored at the bottom (a prompt with an image, whose card above the
 * bubble has no known height) is placed from the row's foot by it.
 */
// the app's tokens (comfortable density): the bubble, gap-xs (.5rem = 8 px), the MessageActions toolbar at its
// small control height (1.5rem = 24 px): 32 CSS px. The old 32 was read as screen px and divided by the zoom: the
// owner's image prompt showed our glow ~8 px too low at the foot
export const GLOW_FOOT_PX = 8 + 24
/** glowFill "mesh": the warm half of the brand, in MESH.glows' order (lower centre-right, lower left, top right, a highlight top left). */
export const USER_MESH: readonly string[] = ['#FF6F91', '#FF9671', '#FFD27A', '#FFC75F']
/** glowFill "mesh": the blobs' strength over Claude's (the app's grey bubble lies over them), and the warm base under them. */
export const USER_MESH_LOOK = { scale: 1.6, base: '#FF8F7A', baseAlpha: 0.5 } as const

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** `hex` with its HSL hue turned by `degrees`, saturation and lightness kept. */
export const hueShift = (hex: string, degrees: number): string => {
  const n = Number.parseInt(hex.slice(1, 7), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const h0 = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  const h = ((((h0 * 60 + degrees) % 360) + 360) % 360) / 60
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h % 2) - 1))
  const [r1, g1, b1] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  const m = l - c / 2

  return `#${[r1, g1, b1].map(v => Math.round(clamp(v + m, 0, 1) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** The default fill: the user's accent to a neighbouring, warmer hue, diagonal. */
export const glowFillFor = (accent: string): TintaFill => ({
  gradient: { type: 'linear', angle: GLOW_ANGLE, stops: [[accent, 0], [hueShift(accent, -20), 0.5], [hueShift(accent, -40), 1]] },
})

/** How many lines `line` wraps to at `inner` px, word by word, each character its GLOW_EM width. */
/**
 * The widths, px, of the lines `line` breaks into at `inner` px, word by
 * word (a space at a break hangs, uncounted), each with the font's
 * advances and kerning: what the app's shrink-wrap measures.
 */
export const wrapText = (line: string, inner: number): string[] => {
  const room = Math.max(GLOW_FONT_PX, inner)
  const lines: string[] = []
  let current = ''
  for (const word of line.split(' ')) {
    const next = current === '' ? word : `${current} ${word}`
    if (current === '' || textPx(next) <= room) {
      current = next
      continue
    }
    lines.push(current)
    current = word
  }
  lines.push(current)

  return lines
}

/** The widths of wrapText's lines, px (a long word's no wider than the room). */
export const wrapWidths = (line: string, inner: number): number[] => {
  const room = Math.max(GLOW_FONT_PX, inner)

  return wrapText(line, inner).map(one => Math.min(textPx(one), room))
}

export const wrapLines = (line: string, inner: number): number => {
  const room = Math.max(GLOW_FONT_PX, inner)
  const space = textPx(' ')
  let lines = 1
  let used = 0
  for (const word of line.split(' ')) {
    let length = textPx(word)
    const need = used === 0 ? length : used + space + length
    if (need <= room) {
      used = need
      continue
    }
    if (used > 0) lines++
    // a word longer than the line breaks across lines
    while (length > room) {
      length -= room
      lines++
    }
    used = length
  }

  return lines
}

/**
 * The app's prompt bubble, CSS px, everything in px: `columns` the row's
 * cells (GLOW_UNIT_PX each). The widest bubble is GLOW_BUBBLE_SHARE of the
 * row, its words wrapped inside its padding; a short one shrinks to its
 * words. Height: lines x GLOW_LINE_PX plus the padding; a quote's lines a
 * third taller, attachments GLOW_ATTACH_LINES more.
 */
/**
 * The app folds a long prompt (its bundle: a length over 1200, each line
 * counting at least 75): the words held to 16rem (256 px) fading out over
 * the last 3rem, then a "Show more" button (xxs ghost, 5 px below). The
 * expanded state is the app's alone: the folded one, its default, is drawn.
 */
export const COLLAPSE = { length: 1200, line: 75, content: 256, gap: 5, button: 20 } as const
/** The app's measure of a prompt's length for folding: each line its characters, at least COLLAPSE.line. */
export const collapseLength = (text: string): number => text.split('\n').reduce((n, line) => n + Math.max(COLLAPSE.line, [...line].length), 0)
/** Whether the app folds the prompt. */
export const isCollapsed = (text: string): boolean => collapseLength(text) > COLLAPSE.length
/**
 * A folded bubble's height, CSS px: the 16rem cap is the whole bubble's
 * (its padding inside it), the "Show more" button below its fill: the
 * owner's sample, the native's outer edge 307 screen pt = 256 CSS px.
 */
export const COLLAPSED_PX = COLLAPSE.content

/**
 * How the app lays out a prompt's quotes (its bundle): each run of "> "
 * lines a blockquote (border-s-2, ps-sm: 2 + 8 px before the words, the
 * same 15/21 text, muted), the rest one pre-wrap text whose own blank lines
 * are lines; quotes and text stacked with a 5 px gap (gap-1.25), the blank
 * lines between them not drawn.
 */
/** The quote's text is text-body (14 px) inside the prompt's text-heading (15 px): its words this much narrower. */
export const QUOTE = { rule: 2, pad: 8, gap: 5, scale: 14 / 15 } as const

/** A prompt's blocks as the app draws them: quote runs and text runs, the blank lines between a quote and its neighbours dropped. */
export const promptBlocks = (text: string): { quote: boolean; lines: string[] }[] => {
  const blocks: { quote: boolean; lines: string[] }[] = []
  for (const line of text.split('\n')) {
    const quote = /^\s*>/.test(line)
    const words = quote ? line.replace(/^\s*(>\s?)+/, '') : line
    const last = blocks[blocks.length - 1]
    if (last && last.quote === quote) last.lines.push(words)
    else blocks.push({ quote, lines: [words] })
  }
  // a text run's blank lines at its ends sit between blocks: the gap, not lines
  return blocks
    .map(block => (block.quote ? block : { ...block, lines: block.lines.join('\n').replace(/^\n+|\n+$/g, '').split('\n') }))
    .filter(block => block.lines.some(line => line.trim() !== ''))
}

export const userBubbleSize = (text: string, columns: number, attached = false): { width: number; height: number; lines: number; full?: true; collapsed?: true } => {
  const widest = bubbleWidest(columns)
  const inner = Math.max(40, widest - 2 * GLOW_PAD.x)
  const indent = QUOTE.rule + QUOTE.pad
  let longest = 0
  let widestLine = 0
  let count = 0
  const blocks = promptBlocks(text)
  // the row is known to a column of the code font (viewport.columns); it is read at the low end of that bracket
  // (GLOW_COLUMN_PX the smallest ch the samples allow, no bias), so a borderline word breaks early: the glow comes
  // out narrower (hidden under the app's rim) and never a line short
  for (const block of blocks) {
    for (const line of block.lines) {
      // a quote's words at 14 px: measured at 15 against a room as much wider, then scaled back
      const scale = block.quote ? QUOTE.scale : 1
      const room = (block.quote ? inner - indent : inner) / scale
      longest = Math.max(longest, textPx(line) * scale + (block.quote ? indent : 0))
      count += wrapLines(line, room)
      // the app shrink-wraps its bubble to the widest line as laid out (its ShrinkWrap: max-width inline, in px)
      widestLine = Math.max(widestLine, ...wrapWidths(line, room).map(width => width * scale + (block.quote ? indent : 0)))
    }
  }
  count += attached ? GLOW_ATTACH_LINES : 0
  // the words' own width (fractional, as the browser lays it out) plus the padding
  // wrapped: the widest laid-out line, rounded up as the app's ShrinkWrap does, plus the padding
  const width = longest > inner ? Math.min(widest, Math.ceil(widestLine) + GLOW_WIDTH_PAD) : Math.min(widest, longest + GLOW_WIDTH_PAD)
  const folded = isCollapsed(text)
  const height = count * GLOW_LINE_PX + Math.max(0, blocks.length - 1) * QUOTE.gap + 2 * GLOW_PAD.y

  return { width: Math.round(width * 100) / 100, height: folded ? COLLAPSED_PX : Math.round(height), lines: count, ...(longest > inner ? { full: true } : {}), ...(folded ? { collapsed: true } : {}) }
}

export type GlowSpec = { fill: TintaFill; opacity: number; blur: number; overshoot: number; offsetY?: number; offsetX?: number; widthScale?: number; mesh?: readonly string[]; meshBase?: string; meshBaseAlpha?: number; anchor?: 'top' | 'bottom'; stroke?: { color: string; alpha: number; width: number }; noFill?: true }

/**
 * The glow's drawing for a bubble `bubble` px big: one rounded shape
 * `overshoot` past the bubble on every side, blurred, with GLOW_FADE blurs
 * of room round it so the whole blur lies inside the drawing. `inset` is
 * the room plus the overshoot: where the bubble's top-left lies in it.
 */
export const userGlowDrawing = (spec: GlowSpec, bubble: { width: number; height: number }): { source: string; width: number; height: number; inset: number } => {
  const o = Math.max(0, spec.overshoot)
  const fade = Math.ceil(GLOW_FADE * Math.max(0, spec.blur))
  // left: the overshoot past the bubble and the fade; right: the drawing ends at the
  // bubble's right edge (the row's), the shape's right end one blur inside it (its
  // fade may reach the edge); `offsetX` left (-) moves the shape inside the drawing,
  // widened on the left; right (+) moves the whole drawing (userGlowArt), so no fade is cut
  const shift = Math.min(0, spec.offsetX ?? 0)
  const left = -shift
  const bubbleWidth = bubble.width * (spec.widthScale ?? 1)
  const w = Math.round(bubbleWidth + o - Math.max(0, spec.blur))
  const h = Math.round(bubble.height + 2 * o)
  const width = Math.round(bubbleWidth + o + fade + left)
  const height = h + 2 * fade
  const { defs, ref } = paint(spec.fill, 'tinta-glow-fill', false)
  const blur = spec.blur > 0 ? `<filter id="tinta-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><feGaussianBlur stdDeviation="${spec.blur}"/></filter>` : ''
  const x = fade + left + shift
  const rx = Math.round(Math.min(GLOW_RADIUS + o, h / 2))
  // styleHints.user.glowStroke: the shape's outline, thin, at its alpha; with glowFill "none" nothing inside
  const ring = spec.stroke
    ? `<rect x="${x + spec.stroke.width / 2}" y="${fade + spec.stroke.width / 2}" width="${Math.max(1, w - spec.stroke.width)}" height="${Math.max(1, h - spec.stroke.width)}" rx="${Math.max(0, rx - spec.stroke.width / 2)}" fill="none" stroke="${spec.stroke.color}" stroke-opacity="${spec.stroke.alpha}" stroke-width="${spec.stroke.width}"/>`
    : ''
  if (spec.noFill) {
    return { width, height, inset: fade + o, source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${ring}</svg>` }
  }
  if (spec.mesh !== undefined) {
    // the mesh: the shape a clip, a warm base and the blobs in it; crisp with blur 0
    const blobs = meshPaint(x, fade, w, h, spec.mesh, USER_MESH_LOOK.scale, 'tinta-glow-mesh')

    return {
      width,
      height,
      inset: fade + o,
      source:
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">` +
        `<defs><clipPath id="tinta-glow-shape"><rect x="${x}" y="${fade}" width="${w}" height="${h}" rx="${rx}"/></clipPath>${blobs.defs}${blur}</defs>` +
        `<g clip-path="url(#tinta-glow-shape)" opacity="${spec.opacity}"${blur ? ' filter="url(#tinta-glow)"' : ''}>` +
        `<rect x="${x}" y="${fade}" width="${w}" height="${h}" fill="${spec.meshBase ?? USER_MESH_LOOK.base}" fill-opacity="${spec.meshBaseAlpha ?? USER_MESH_LOOK.baseAlpha}"/>${blobs.body}</g>${ring}` +
        `</svg>`,
    }
  }

  return {
    width,
    height,
    inset: fade + o,
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">` +
      `<defs>${defs}${blur}</defs>` +
      `<rect x="${fade + left + shift}" y="${fade}" width="${w}" height="${h}" rx="${rx}" fill="${ref}" opacity="${spec.opacity}"${blur ? ' filter="url(#tinta-glow)"' : ''}/>${ring}` +
      `</svg>`,
  }
}

/** stubMode twin-fill: the app's bubble's room round its words, px a side and above/below, the twin's edge included. */
export const TWIN_PAD = GLOW_PAD
/**
 * stubMode twin-fill: what a round edge takes on the desktop, px: a whole
 * cell a side (GLOW_UNIT_PX) and a row above and below (GLOW_MARGIN_PX), not
 * a 1 px line: the owner's first twin was 22 px too wide and 30 too tall with
 * the padding on top of it. The padding is TWIN_PAD less the edge.
 */
export const TWIN_EDGE = { x: GLOW_UNIT_PX, y: GLOW_MARGIN_PX } as const
/** stubMode twin-fill: the share of the row left of the widest twin (the app's bubble takes GLOW_BUBBLE_SHARE). */
export const TWIN_SPACER = `${Math.round((1 - GLOW_BUBBLE_SHARE) * 100)}%`

/**
 * stubMode twin-fill: the app's bubble measured by the layout, not estimated.
 * Before the app's row, a Box of no height (overflow visible; the app's row is
 * not under it, its sibling) holds a twin of the app's bubble, right-aligned,
 * at most GLOW_BUBBLE_SHARE of the row (a spacer takes the rest), a
 * transparent round edge clipping it (the corners), TWIN_PAD of padding round
 * the user's words in transparent ink, so it is as wide and tall as the
 * words lay out. Behind the words the fill, an Svg larger than any bubble,
 * clipped by the twin (Claude's mesh bubble's way, fills.tsx). Hanging from a
 * Box of no height, the twin lies over the app's row from its top, adds no
 * height, and the app's row paints over it (its grey translucent). The words
 * wrap as the app's prompt's do only if the desktop draws a Text in the
 * prompt's font: the owner checks.
 */
export const userTwinArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { Box: any; Svg?: any; Text: any },
  spec: GlowSpec,
  words: string,
  columns: number,
  native: unknown,
): unknown[] => {
  const { Box, Svg, Text } = els
  // the fill: generously larger than the bubble can be (the widest, the estimated height and more), clipped by the twin
  const widest = bubbleWidest(columns)
  const estimate = userBubbleSize(words, columns)
  const art = userGlowDrawing({ ...spec, blur: 0, overshoot: 0, offsetX: 0, widthScale: 1 }, { width: Math.ceil(widest) + 4 * GLOW_UNIT_PX, height: Math.ceil(estimate.height * 1.5 + 4 * GLOW_LINE_PX) })
  const props = glowProps(art.width, art.height)
  const fillCells = Math.ceil(props.width / GLOW_UNIT_PX)
  const across = (px: number) => Math.round((Math.max(0, px) / GLOW_UNIT_PX) * 100) / 100
  const down = (px: number) => Math.round((Math.max(0, px) / GLOW_MARGIN_PX) * 100) / 100
  // the edge cell is inside the clip but not the padding: the fill starts a cell left, under it (Claude's mesh's way)
  const lead = 1

  return [
    <Box key="tinta-user-twin-hold" flexDirection="column" height={0} flexShrink={0} overflow="visible">
      <Box key="tinta-user-twin-row" flexDirection="row" justifyContent="flex-end">
        <Box key="tinta-user-twin-spacer" width={TWIN_SPACER} flexShrink={0} />
        {/* a faint base in the fill's first colour: the round corners come from the painted background (the
            owner saw the Svg's clip square on the left with the edge a whole cell) */}
        <Box key="tinta-user-twin" flexDirection="row" alignItems="stretch" flexShrink={1} overflow="hidden" borderStyle="round" borderColor="#00000000" backgroundColor={`${(spec.mesh?.[0] ?? '#FFB547').slice(0, 7)}1F`}>
          {Svg && (
            <Box key="tinta-user-twin-fill" width={fillCells + lead} marginLeft={-lead} marginRight={-fillCells} height={0} flexShrink={0}>
              <Svg source={art.source} alt="Tu" {...props} />
            </Box>
          )}
          <Box key="tinta-user-twin-text" flexDirection="column" flexShrink={1} paddingX={across(TWIN_PAD.x - TWIN_EDGE.x)} paddingY={down(TWIN_PAD.y - TWIN_EDGE.y)}>
            <Text color="#00000000" wrap="wrap">
              {words}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>,
    <Box key="tinta-user-native" flexDirection="column">
      {native}
    </Box>,
  ]
}

/** The glow's Svg props for a drawing `width` by `height` CSS px: the desktop draws an Svg at its props exactly. */
export const glowProps = (width: number, height: number): { width: number; height: number } => ({
  width: Math.max(1, Math.round(width)),
  height: Math.max(1, Math.round(height * GLOW_SVG_Y)),
})

/** The CSS px a glow Svg with these props covers down (GLOW_SVG_Y). */
export const glowDrawnHeight = (props: { height: number }): number => props.height / GLOW_SVG_Y

/**
 * The glow and the app's row, in the flow, below the label row (which stays
 * above everything, outside the glow). The glow's Box holds its Svg, a plain
 * image, right-aligned to the row's edge, the bubble's: the shape inset there
 * by its fade, so its blur ends inside the row. `native` is the app's own row
 * untouched. Anchored at the top (the default): the glow first, the row pulled
 * up with a negative top margin so its bubble's top lies `inset` below the
 * drawing's top. Anchored at the bottom (a prompt with an image, the card
 * above the bubble of no known height): the row first, the glow after it
 * pulled up from the row's foot by the action row (GLOW_FOOT_PX), the bubble
 * and the inset, a negative bottom margin taking back the rest so it adds no
 * height. `offsetY` (px) moves the glow down (positive) or up.
 */
export const userGlowArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { Box: any; Svg?: any },
  spec: GlowSpec,
  bubble: { width: number; height: number },
  native: unknown,
): unknown[] => {
  const { Box, Svg } = els
  const art = userGlowDrawing(spec, bubble)
  const props = glowProps(art.width, art.height)
  // the Svg's height as drawn: the glow's Box has no height of its own
  const drawnHeight = glowDrawnHeight(props)
  // a vertical margin's unit in px (GLOW_MARGIN_PX, fit to the samples), a horizontal one GLOW_UNIT_PX
  const units = (px: number) => Math.round((px / GLOW_MARGIN_PX) * 100) / 100
  const across = (px: number) => Math.round((px / GLOW_UNIT_PX) * 100) / 100
  const offsetY = spec.offsetY ?? 0
  const sides = (spec.offsetX ?? 0) > 0 ? { marginRight: -across(spec.offsetX ?? 0) } : { overflow: 'hidden' }
  const svg = Svg && <Svg source={art.source} alt="Tu" {...props} />
  if (spec.anchor === 'bottom') {
    const lift = GLOW_FOOT_PX + bubble.height + art.inset - offsetY

    return [
      <Box key="tinta-user-native" flexDirection="column">
        {native}
      </Box>,
      <Box key="tinta-user-glow" flexDirection="row" justifyContent="flex-end" flexShrink={0} marginTop={-units(lift)} marginBottom={units(lift) - units(drawnHeight)} {...sides}>
        {svg}
      </Box>,
    ]
  }

  return [
    <Box key="tinta-user-glow" flexDirection="row" justifyContent="flex-end" flexShrink={0} {...sides}>
      {svg}
    </Box>,
    <Box key="tinta-user-native" flexDirection="column" marginTop={-units(drawnHeight - art.inset + offsetY)}>
      {native}
    </Box>,
  ]
}

/** glowExactWidth: the drawing's width, CSS px, wider than any row: the desktop's max-width 100% clamps it to the Box it sits in. */
export const EXACT_WIDE = 2400
/** glowExactWidth: the left cap's width, CSS px: the corner's radius. */
export const EXACT_CAP = GLOW_RADIUS

/**
 * glowExactWidth: the glow of a bubble at its widest (its words wrap), as
 * wide as the app's own, exactly, whatever the columns say. The desktop
 * draws an Svg as an image of its width prop with max-width 100%: in our
 * own Box of GLOW_BUBBLE_SHARE of the row (the same row the app's bubble
 * takes its 85% of), a drawing EXACT_WIDE px wide is clamped to it. The
 * corners stay round at their px: a left cap EXACT_CAP px wide holds the
 * left corners, and the rest is one wide drawing shown from its right end
 * (preserveAspectRatio xMaxYMid slice: drawn 1:1, its left part cut), which
 * holds the right corners. Both are cut from one mesh laid on the
 * estimated width, so it runs on across the seam (an error in the estimate
 * moves the soft blobs a few px, never an edge). Height as the plain glow;
 * blur and overshoot are not drawn here (the caller keeps the plain glow
 * for them).
 */
export const exactGlowDrawings = (spec: GlowSpec, bubble: { width: number; height: number }): { cap: string; wide: string; height: number } => {
  const h = Math.round(bubble.height)
  const w = Math.round(bubble.width)
  const r = Math.min(GLOW_RADIUS, h / 2)
  const left = EXACT_WIDE - w
  const paintOf = (id: string) => {
    if (spec.mesh !== undefined) {
      const blobs = meshPaint(left, 0, w, h, spec.mesh, USER_MESH_LOOK.scale, id)

      return { defs: blobs.defs, body: `<rect x="0" y="0" width="${EXACT_WIDE}" height="${h}" fill="${USER_MESH_LOOK.base}" fill-opacity="${USER_MESH_LOOK.baseAlpha}"/>${blobs.body}` }
    }
    const { defs, ref } = paint(spec.fill, `${id}-fill`, false)

    return { defs, body: `<rect x="0" y="0" width="${EXACT_WIDE}" height="${h}" fill="${ref}"/>` }
  }
  const one = paintOf('tinta-exact-wide')
  const two = paintOf('tinta-exact-cap')
  // the wide piece: right corners round, the left side runs off past the cap's seam
  const wide =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${EXACT_WIDE}" height="${h}" viewBox="0 0 ${EXACT_WIDE} ${h}" preserveAspectRatio="xMaxYMid slice">` +
    `<defs><clipPath id="tinta-exact-wide-clip"><rect x="${-2 * r}" y="0" width="${EXACT_WIDE + 2 * r}" height="${h}" rx="${r}"/></clipPath>${one.defs}</defs>` +
    `<g clip-path="url(#tinta-exact-wide-clip)" opacity="${spec.opacity}">${one.body}</g></svg>`
  // the cap: the same mesh at the estimated left edge, left corners round
  const cap =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${EXACT_CAP}" height="${h}" viewBox="${left} 0 ${EXACT_CAP} ${h}">` +
    `<defs><clipPath id="tinta-exact-cap-clip"><rect x="${left}" y="0" width="${EXACT_CAP + 2 * r}" height="${h}" rx="${r}"/></clipPath>${two.defs}</defs>` +
    `<g clip-path="url(#tinta-exact-cap-clip)" opacity="${spec.opacity}">${two.body}</g></svg>`

  return { cap, wide, height: h }
}

/**
 * glowExactWidth's layout: the glow Box as userGlowArt's (right-aligned, the
 * row pulled up over it by the height), holding our own Box of
 * GLOW_BUBBLE_SHARE of the row: the cap, then a Box that grows into the
 * rest (min width 0, overflow hidden) with the wide drawing, clamped by it.
 * No engine node under any of these Boxes.
 */
export const exactGlowArt = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  els: { Box: any; Svg?: any },
  spec: GlowSpec,
  bubble: { width: number; height: number },
  native: unknown,
): unknown[] => {
  const { Box, Svg } = els
  const art = exactGlowDrawings(spec, bubble)
  const units = (px: number) => Math.round((px / GLOW_MARGIN_PX) * 100) / 100

  return [
    // the glow Box is the native row's sibling in one column, no padding of ours: its 85% is of the same width
    <Box key="tinta-user-glow" flexDirection="row" flexShrink={0} overflow="hidden">
      <Box key="tinta-user-glow-room" flexDirection="row" flexGrow={1} flexShrink={1} minWidth={0} justifyContent="flex-end">
        <Box key="tinta-user-glow-exact" width={`${GLOW_BUBBLE_SHARE * 100}%`} flexDirection="row" flexShrink={0}>
          {Svg && <Svg source={art.cap} alt="Tu" width={EXACT_CAP} height={art.height} />}
          <Box key="tinta-user-glow-rest" flexDirection="row" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden" justifyContent="flex-end">
            {Svg && <Svg source={art.wide} alt="Tu" width={EXACT_WIDE} height={art.height} />}
          </Box>
        </Box>
      </Box>
    </Box>,
    <Box key="tinta-user-native" flexDirection="column" marginTop={-units(art.height + (spec.offsetY ?? 0))}>
      {native}
    </Box>,
  ]
}

/** userBreaks: px kept free on every line we break, so the app never re-wraps one (our font model's error and more). */
export const BREAK_MARGIN = 12

/**
 * userBreaks: the prompt's text with our own line breaks, each line short of
 * `inner` by BREAK_MARGIN, so the app (whitespace pre-wrap) draws exactly
 * these lines and its ShrinkWrap takes the widest of them. The user's own
 * newlines kept; a quote line's continuations keep its "> "; a hidden marker
 * (<!-- ... -->), a line with a link or code, left whole.
 */
export const breakPrompt = (text: string, inner: number): string =>
  text
    .split('\n')
    .map(line => {
      // a quote is markdown: its lines join (a soft break is a space), so it is the app's to wrap
      if (/^\s*<!--[\s\S]*-->\s*$/.test(line) || /https?:\/\/|`|\]\(/.test(line) || /^\s*>/.test(line)) return line
      const quote = /^(\s*(?:>\s?)+)/.exec(line)?.[1]
      const words = quote ? line.slice(quote.length) : line
      const room = inner - BREAK_MARGIN - (quote ? QUOTE.rule + QUOTE.pad : 0)
      const lines = wrapText(words, room)

      return lines.map((one, i) => (quote ? `${i === 0 ? quote : quote.trimEnd() + ' '}${one}` : one)).join('\n')
    })
    .join('\n')

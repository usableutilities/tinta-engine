/**
 * The v2 templates (palette-style.json, e.g. "fosforo-sfumature.json") the
 * engine offers in /tinta-prova and the band's menus: read at run time from
 * ~/.claude/tinta/themes, where the Tinta app installs them. None is built
 * into the engine (the only built-in theme is the free one, Salvia, seed.ts).
 */
export const TEMPLATES: { [file: string]: string } = {}

/** A template's file name: palette and style, lower case. */
export const TEMPLATE_FILE = /^[a-z0-9]+-[a-z]+\.json$/

/** Replaces the catalogue with `found` (file name to its text), compact JSON; files that do not parse are left out. */
export const setTemplates = (found: { [file: string]: string }): void => {
  for (const file of Object.keys(TEMPLATES)) if (!(file in found)) delete TEMPLATES[file]
  for (const [file, text] of Object.entries(found)) {
    if (!TEMPLATE_FILE.test(file)) continue
    try {
      TEMPLATES[file] = JSON.stringify(JSON.parse(text))
    } catch {
      delete TEMPLATES[file]
    }
  }
}

/**
 * Every word the engine shows, in the user's language: one table, a lookup,
 * the language's detection from what the host says, and the resolution of a
 * theme's per-language text (`{ "it": ..., "en": ... }`). English is the
 * fallback everywhere.
 */

export const LOCALES = ['it', 'en', 'es', 'fr', 'de', 'pt'] as const
export type Locale = (typeof LOCALES)[number]
export const FALLBACK: Locale = 'en'

type Row = { [lang in Locale]: string }

/** The engine's words. `{name}`-style holes are filled by `t`. */
export const STRINGS = {
  // band
  themeOn: { it: 'Attiva tema', en: 'Turn theme on', es: 'Activar tema', fr: 'Activer le thème', de: 'Design einschalten', pt: 'Ativar tema' },
  themeOff: { it: 'Disattiva tema', en: 'Turn theme off', es: 'Desactivar tema', fr: 'Désactiver le thème', de: 'Design ausschalten', pt: 'Desativar tema' },
  themes: { it: 'Temi…', en: 'Themes…', es: 'Temas…', fr: 'Thèmes…', de: 'Designs…', pt: 'Temas…' },
  themeAlt: { it: 'Tema {name}', en: 'Theme {name}', es: 'Tema {name}', fr: 'Thème {name}', de: 'Design {name}', pt: 'Tema {name}' },
  context: { it: 'contesto', en: 'context', es: 'contexto', fr: 'contexte', de: 'Kontext', pt: 'contexto' },
  reset: { it: 'reset', en: 'resets', es: 'reinicio', fr: 'réinit.', de: 'Reset', pt: 'reinício' },
  soundOff: { it: 'off', en: 'off', es: 'off', fr: 'off', de: 'aus', pt: 'off' },
  soundOn: { it: 'on', en: 'on', es: 'on', fr: 'on', de: 'an', pt: 'on' },
  // limits and alerts
  limit5h: { it: '5h', en: '5h', es: '5h', fr: '5h', de: '5h', pt: '5h' },
  limit7d: { it: '7g', en: '7d', es: '7d', fr: '7j', de: '7T', pt: '7d' },
  limitSpend: { it: 'spesa', en: 'spend', es: 'gasto', fr: 'dépense', de: 'Ausgaben', pt: 'gasto' },
  alertContext: { it: 'Contesto al {pct}%', en: 'Context at {pct}%', es: 'Contexto al {pct}%', fr: 'Contexte à {pct} %', de: 'Kontext bei {pct} %', pt: 'Contexto em {pct}%' },
  alertLimit: { it: 'Limite {name} al {pct}%', en: '{name} limit at {pct}%', es: 'Límite {name} al {pct}%', fr: 'Limite {name} à {pct} %', de: 'Limit {name} bei {pct} %', pt: 'Limite {name} em {pct}%' },
  // activity rows
  wordTask: { it: 'IN BACKGROUND', en: 'IN BACKGROUND', es: 'EN SEGUNDO PLANO', fr: 'EN ARRIÈRE-PLAN', de: 'IM HINTERGRUND', pt: 'EM SEGUNDO PLANO' },
  wordCommand: { it: 'COMANDO', en: 'COMMAND', es: 'COMANDO', fr: 'COMMANDE', de: 'BEFEHL', pt: 'COMANDO' },
  wordAuto: { it: 'AUTOMATICO', en: 'AUTOMATIC', es: 'AUTOMÁTICO', fr: 'AUTOMATIQUE', de: 'AUTOMATISCH', pt: 'AUTOMÁTICO' },
  wordTool: { it: 'STRUMENTO', en: 'TOOL', es: 'HERRAMIENTA', fr: 'OUTIL', de: 'WERKZEUG', pt: 'FERRAMENTA' },
  // an Edit or Write row's badge for a file it created
  wordNew: { it: 'nuovo', en: 'new', es: 'nuevo', fr: 'nouveau', de: 'neu', pt: 'novo' },
  // toasts (experiment toasts)
  compacted: { it: 'Compattato {before} → {after}', en: 'Compacted {before} → {after}', es: 'Compactado {before} → {after}', fr: 'Compacté {before} → {after}', de: 'Komprimiert {before} → {after}', pt: 'Compactado {before} → {after}' },
  refused: { it: 'Risposta rifiutata · {category}', en: 'Reply refused · {category}', es: 'Respuesta rechazada · {category}', fr: 'Réponse refusée · {category}', de: 'Antwort abgelehnt · {category}', pt: 'Resposta recusada · {category}' },
  apiError: { it: 'Errore · {category}', en: 'Error · {category}', es: 'Error · {category}', fr: 'Erreur · {category}', de: 'Fehler · {category}', pt: 'Erro · {category}' },
  unknownCategory: { it: 'senza categoria', en: 'no category', es: 'sin categoría', fr: 'sans catégorie', de: 'ohne Kategorie', pt: 'sem categoria' },
  // the turn's closing line (experiment turnFooter)
  footerTool: { it: '1 strumento', en: '1 tool', es: '1 herramienta', fr: '1 outil', de: '1 Werkzeug', pt: '1 ferramenta' },
  footerTools: { it: '{n} strumenti', en: '{n} tools', es: '{n} herramientas', fr: '{n} outils', de: '{n} Werkzeuge', pt: '{n} ferramentas' },
  footerFile: { it: '1 file', en: '1 file', es: '1 archivo', fr: '1 fichier', de: '1 Datei', pt: '1 arquivo' },
  footerFiles: { it: '{n} file', en: '{n} files', es: '{n} archivos', fr: '{n} fichiers', de: '{n} Dateien', pt: '{n} arquivos' },
  diffFailed: { it: 'Il pannello delle modifiche non si apre da qui', en: 'The diff pane does not open from here', es: 'El panel de cambios no se abre desde aquí', fr: 'Le panneau des modifications ne s’ouvre pas d’ici', de: 'Der Änderungsbereich öffnet sich hier nicht', pt: 'O painel de alterações não abre daqui' },
  // /tinta-prova: the v2 templates
  cmdProva: { it: 'Prova un modello: /tinta-prova <palette> <stile>, o avanti', en: 'Try a template: /tinta-prova <palette> <style>, or next', es: 'Prueba una plantilla: /tinta-prova <paleta> <estilo>, o siguiente', fr: 'Essaie un modèle : /tinta-prova <palette> <style>, ou suivant', de: 'Vorlage testen: /tinta-prova <Palette> <Stil>, oder weiter', pt: 'Experimente um modelo: /tinta-prova <paleta> <estilo>, ou próximo' },
  replyProva: { it: 'Palette: {palettes}. Stili: {styles}. Esempio: /tinta-prova tinta sfumature', en: 'Palettes: {palettes}. Styles: {styles}. Example: /tinta-prova tinta sfumature', es: 'Paletas: {palettes}. Estilos: {styles}. Ejemplo: /tinta-prova tinta sfumature', fr: 'Palettes : {palettes}. Styles : {styles}. Exemple : /tinta-prova tinta sfumature', de: 'Paletten: {palettes}. Stile: {styles}. Beispiel: /tinta-prova tinta sfumature', pt: 'Paletas: {palettes}. Estilos: {styles}. Exemplo: /tinta-prova tinta sfumature' },
  replyProvaApplied: { it: 'Modello {name} applicato', en: 'Template {name} applied', es: 'Plantilla {name} aplicada', fr: 'Modèle {name} appliqué', de: 'Vorlage {name} angewendet', pt: 'Modelo {name} aplicado' },
  replyProvaUnknown: { it: 'Nessun modello «{args}». Palette: {palettes}. Stili: {styles}', en: 'No template "{args}". Palettes: {palettes}. Styles: {styles}', es: 'No hay plantilla «{args}». Paletas: {palettes}. Estilos: {styles}', fr: 'Aucun modèle « {args} ». Palettes : {palettes}. Styles : {styles}', de: 'Keine Vorlage „{args}“. Paletten: {palettes}. Stile: {styles}', pt: 'Nenhum modelo «{args}». Paletas: {palettes}. Estilos: {styles}' },
  menuPalette: { it: 'Palette', en: 'Palette', es: 'Paleta', fr: 'Palette', de: 'Palette', pt: 'Paleta' },
  menuStyle: { it: 'Stile', en: 'Style', es: 'Estilo', fr: 'Style', de: 'Stil', pt: 'Estilo' },
  // spinner
  working: { it: 'In esecuzione', en: 'Working', es: 'Trabajando', fr: 'En cours', de: 'Läuft', pt: 'Em execução' },
  waveAlt: { it: 'Claude sta lavorando', en: 'Claude is working', es: 'Claude está trabajando', fr: 'Claude travaille', de: 'Claude arbeitet', pt: 'Claude está trabalhando' },
  // the session's state, one signal in the band and the spinner: working, waiting for you, done
  statusWorking: { it: 'Al lavoro', en: 'Working', es: 'Trabajando', fr: 'Au travail', de: 'Arbeitet', pt: 'Trabalhando' },
  statusWaiting: { it: 'Ti aspetta', en: 'Waiting for you', es: 'Te espera', fr: 'Vous attend', de: 'Wartet auf dich', pt: 'Esperando você' },
  statusDone: { it: 'Fatto', en: 'Done', es: 'Hecho', fr: 'Terminé', de: 'Fertig', pt: 'Pronto' },
  statusFailed: { it: 'Errore', en: 'Error', es: 'Error', fr: 'Erreur', de: 'Fehler', pt: 'Erro' },
  // the permission dialog's risk line (permissionNotice): the level, then what the call does
  riskHigh: { it: 'rischio alto', en: 'high risk', es: 'riesgo alto', fr: 'risque élevé', de: 'hohes Risiko', pt: 'risco alto' },
  riskMedium: { it: 'rischio medio', en: 'medium risk', es: 'riesgo medio', fr: 'risque moyen', de: 'mittleres Risiko', pt: 'risco médio' },
  riskLow: { it: 'rischio basso', en: 'low risk', es: 'riesgo bajo', fr: 'risque faible', de: 'geringes Risiko', pt: 'risco baixo' },
  riskRmRecursive: { it: 'cancella file in modo ricorsivo', en: 'deletes files recursively', es: 'borra archivos de forma recursiva', fr: 'supprime des fichiers récursivement', de: 'löscht Dateien rekursiv', pt: 'apaga arquivos recursivamente' },
  riskSudo: { it: 'chiede privilegi di amministratore', en: 'asks for administrator rights', es: 'pide privilegios de administrador', fr: 'demande les droits administrateur', de: 'verlangt Administratorrechte', pt: 'pede privilégios de administrador' },
  riskForcePush: { it: 'riscrive la storia remota', en: 'rewrites remote history', es: 'reescribe la historia remota', fr: "réécrit l'historique distant", de: 'schreibt die entfernte Historie um', pt: 'reescreve o histórico remoto' },
  riskDiscard: { it: 'scarta modifiche locali', en: 'discards local changes', es: 'descarta cambios locales', fr: 'abandonne des modifications locales', de: 'verwirft lokale Änderungen', pt: 'descarta alterações locais' },
  riskPipeShell: { it: 'esegue uno script scaricato', en: 'runs a downloaded script', es: 'ejecuta un script descargado', fr: 'exécute un script téléchargé', de: 'führt ein heruntergeladenes Skript aus', pt: 'executa um script baixado' },
  riskPublish: { it: 'pubblica un pacchetto', en: 'publishes a package', es: 'publica un paquete', fr: 'publie un paquet', de: 'veröffentlicht ein Paket', pt: 'publica um pacote' },
  riskPush: { it: 'invia commit al remoto', en: 'pushes commits to the remote', es: 'envía commits al remoto', fr: 'pousse des commits vers le dépôt distant', de: 'überträgt Commits ins Remote', pt: 'envia commits ao remoto' },
  riskInstall: { it: 'installa dipendenze', en: 'installs dependencies', es: 'instala dependencias', fr: 'installe des dépendances', de: 'installiert Abhängigkeiten', pt: 'instala dependências' },
  riskChmod: { it: 'cambia permessi di file', en: 'changes file permissions', es: 'cambia permisos de archivos', fr: 'modifie les droits de fichiers', de: 'ändert Dateirechte', pt: 'altera permissões de arquivos' },
  riskRuns: { it: 'esegue', en: 'runs', es: 'ejecuta', fr: 'exécute', de: 'führt aus', pt: 'executa' },
  riskReads: { it: 'legge', en: 'reads', es: 'lee', fr: 'lit', de: 'liest', pt: 'lê' },
  riskEdits: { it: 'modifica', en: 'edits', es: 'modifica', fr: 'modifie', de: 'ändert', pt: 'modifica' },
  riskWrites: { it: 'scrive', en: 'writes', es: 'escribe', fr: 'écrit', de: 'schreibt', pt: 'escreve' },
  riskSensitive: { it: 'file sensibile', en: 'sensitive file', es: 'archivo sensible', fr: 'fichier sensible', de: 'sensible Datei', pt: 'arquivo sensível' },
  riskOpens: { it: 'apre', en: 'opens', es: 'abre', fr: 'ouvre', de: 'öffnet', pt: 'abre' },
  riskMcp: { it: 'strumento esterno', en: 'external tool', es: 'herramienta externa', fr: 'outil externe', de: 'externes Werkzeug', pt: 'ferramenta externa' },
  // the Attività pane
  paneTitle: { it: 'Tinta · attività', en: 'Tinta · activity', es: 'Tinta · actividad', fr: 'Tinta · activité', de: 'Tinta · Aktivität', pt: 'Tinta · atividade' },
  activity: { it: 'Attività', en: 'Activity', es: 'Actividad', fr: 'Activité', de: 'Aktivität', pt: 'Atividade' },
  runningCount: { it: '{n} in esecuzione', en: '{n} running', es: '{n} en curso', fr: '{n} en cours', de: '{n} laufen', pt: '{n} em execução' },
  noneRunning: { it: 'niente in esecuzione', en: 'nothing running', es: 'nada en curso', fr: 'rien en cours', de: 'nichts läuft', pt: 'nada em execução' },
  running: { it: 'In esecuzione', en: 'Running', es: 'En curso', fr: 'En cours', de: 'Laufend', pt: 'Em execução' },
  nothingBackground: { it: 'Nessun lavoro in background.', en: 'No background work.', es: 'Nada en segundo plano.', fr: 'Aucune tâche en arrière-plan.', de: 'Keine Hintergrundarbeit.', pt: 'Nada em segundo plano.' },
  finished: { it: 'Terminate', en: 'Finished', es: 'Terminadas', fr: 'Terminées', de: 'Beendet', pt: 'Concluídas' },
  clear: { it: 'Svuota', en: 'Clear', es: 'Vaciar', fr: 'Vider', de: 'Leeren', pt: 'Limpar' },
  stop: { it: 'Ferma', en: 'Stop', es: 'Detener', fr: 'Arrêter', de: 'Stoppen', pt: 'Parar' },
  kindAgent: { it: 'agente', en: 'agent', es: 'agente', fr: 'agent', de: 'Agent', pt: 'agente' },
  kindShell: { it: 'comando', en: 'command', es: 'comando', fr: 'commande', de: 'Befehl', pt: 'comando' },
  kindMonitor: { it: 'monitor', en: 'monitor', es: 'monitor', fr: 'moniteur', de: 'Monitor', pt: 'monitor' },
  kindWorkflow: { it: 'workflow', en: 'workflow', es: 'flujo', fr: 'workflow', de: 'Workflow', pt: 'workflow' },
  endDone: { it: 'completata', en: 'completed', es: 'completada', fr: 'terminée', de: 'erledigt', pt: 'concluída' },
  endFailed: { it: 'fallita', en: 'failed', es: 'fallida', fr: 'échouée', de: 'fehlgeschlagen', pt: 'falhou' },
  endStopped: { it: 'fermata', en: 'stopped', es: 'detenida', fr: 'arrêtée', de: 'gestoppt', pt: 'parada' },
  // commands
  cmdTinta: { it: 'Attiva o disattiva il tema Tinta (on, off, reload, themes)', en: 'Turn the Tinta theme on or off (on, off, reload, themes)', es: 'Activa o desactiva el tema Tinta (on, off, reload, themes)', fr: 'Active ou désactive le thème Tinta (on, off, reload, themes)', de: 'Tinta-Design ein- oder ausschalten (on, off, reload, themes)', pt: 'Ativa ou desativa o tema Tinta (on, off, reload, themes)' },
  cmdThemes: { it: 'Sceglie il tema Tinta da ~/.claude/tinta/themes', en: 'Pick a Tinta theme from ~/.claude/tinta/themes', es: 'Elige un tema Tinta de ~/.claude/tinta/themes', fr: 'Choisit un thème Tinta dans ~/.claude/tinta/themes', de: 'Wählt ein Tinta-Design aus ~/.claude/tinta/themes', pt: 'Escolhe um tema Tinta de ~/.claude/tinta/themes' },
  cmdActivity: { it: 'Apre il pannello Attività di Tinta: il lavoro in background', en: "Opens Tinta's Activity pane: the background work", es: 'Abre el panel Actividad de Tinta: el trabajo en segundo plano', fr: "Ouvre le panneau Activité de Tinta : le travail en arrière-plan", de: 'Öffnet Tintas Aktivitätsbereich: die Hintergrundarbeit', pt: 'Abre o painel Atividade do Tinta: o trabalho em segundo plano' },
  replyActivity: { it: 'Tinta: pannello Attività aperto.', en: 'Tinta: Activity pane opened.', es: 'Tinta: panel Actividad abierto.', fr: 'Tinta : panneau Activité ouvert.', de: 'Tinta: Aktivitätsbereich geöffnet.', pt: 'Tinta: painel Atividade aberto.' },
  replyLoaded: { it: 'Tinta: tema {name} caricato.', en: 'Tinta: theme {name} loaded.', es: 'Tinta: tema {name} cargado.', fr: 'Tinta : thème {name} chargé.', de: 'Tinta: Design {name} geladen.', pt: 'Tinta: tema {name} carregado.' },
  replyNoTheme: { it: 'Tinta: nessun tema valido in ~/.claude/tinta/active.json.', en: 'Tinta: no valid theme in ~/.claude/tinta/active.json.', es: 'Tinta: ningún tema válido en ~/.claude/tinta/active.json.', fr: 'Tinta : aucun thème valide dans ~/.claude/tinta/active.json.', de: 'Tinta: kein gültiges Design in ~/.claude/tinta/active.json.', pt: 'Tinta: nenhum tema válido em ~/.claude/tinta/active.json.' },
  replyList: { it: 'Tinta: elenco dei temi aperto.', en: 'Tinta: theme list opened.', es: 'Tinta: lista de temas abierta.', fr: 'Tinta : liste des thèmes ouverte.', de: 'Tinta: Designliste geöffnet.', pt: 'Tinta: lista de temas aberta.' },
  replyOn: { it: 'Tinta: tema attivato.', en: 'Tinta: theme on.', es: 'Tinta: tema activado.', fr: 'Tinta : thème activé.', de: 'Tinta: Design eingeschaltet.', pt: 'Tinta: tema ativado.' },
  replyOff: { it: 'Tinta: tema disattivato.', en: 'Tinta: theme off.', es: 'Tinta: tema desactivado.', fr: 'Tinta : thème désactivé.', de: 'Tinta: Design ausgeschaltet.', pt: 'Tinta: tema desativado.' },
  pickerTitle: { it: 'Tinta · temi', en: 'Tinta · themes', es: 'Tinta · temas', fr: 'Tinta · thèmes', de: 'Tinta · Designs', pt: 'Tinta · temas' },
  noThemes: { it: 'Nessun tema in ~/.claude/tinta/themes/*.json', en: 'No themes in ~/.claude/tinta/themes/*.json', es: 'Ningún tema en ~/.claude/tinta/themes/*.json', fr: 'Aucun thème dans ~/.claude/tinta/themes/*.json', de: 'Keine Designs in ~/.claude/tinta/themes/*.json', pt: 'Nenhum tema em ~/.claude/tinta/themes/*.json' },
  badTheme: { it: 'Tinta: {file} non è un tema valido', en: 'Tinta: {file} is not a valid theme', es: 'Tinta: {file} no es un tema válido', fr: "Tinta : {file} n'est pas un thème valide", de: 'Tinta: {file} ist kein gültiges Design', pt: 'Tinta: {file} não é um tema válido' },
} satisfies { [key: string]: Row }

export type StringKey = keyof typeof STRINGS

/** `key` in `locale`, its `{holes}` filled from `vars`; English where the locale lacks it. */
export const t = (locale: string | null | undefined, key: StringKey, vars: { [name: string]: string | number } = {}): string => {
  const row = STRINGS[key] as Row
  const text = row[asLocale(locale)] ?? row[FALLBACK]

  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

/** One of LOCALES, from any spelling (`it_IT.UTF-8`, `pt-BR`, `Italiano`); English when unknown. */
export const asLocale = (value: string | null | undefined): Locale => localeOf(value) ?? FALLBACK

const NAMES: { [name: string]: Locale } = {
  italiano: 'it', italian: 'it', english: 'en', inglese: 'en', español: 'es', espanol: 'es', spanish: 'es',
  français: 'fr', francais: 'fr', french: 'fr', deutsch: 'de', german: 'de', português: 'pt', portugues: 'pt', portuguese: 'pt',
}

/** One of LOCALES from a spelling, or undefined (also for C and POSIX). */
export const localeOf = (value: string | null | undefined): Locale | undefined => {
  const raw = (value ?? '').trim().replace(/^["'(\s]+|["',)\s]+$/g, '').toLowerCase()
  if (raw === '' || raw === 'c' || raw === 'posix' || raw.startsWith('c.')) return undefined
  if (raw in NAMES) return NAMES[raw]
  const code = /^([a-z]{2,3})(?:[-_.@]|$)/.exec(raw)?.[1]

  return (LOCALES as readonly string[]).includes(code ?? '') ? (code as Locale) : undefined
}

/** The first of `candidates` (in order of trust) that names a known language, else English. */
export const pickLocale = (candidates: readonly (string | null | undefined)[]): Locale => {
  for (const one of candidates) {
    const found = localeOf(one)
    if (found !== undefined) return found
  }

  return FALLBACK
}

/** The first language `defaults read -g AppleLanguages` prints (`(\n "it-IT",\n "en-US"\n)`). */
export const firstAppleLanguage = (text: string): string | undefined => /"?([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*)"?\s*,?/.exec(text.replace(/^\s*\(/, ''))?.[1]

/** The language keys a theme's per-language text may use, besides `default`. */
const TEXT_KEYS = new Set(['default', 'it', 'en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'ko', 'nl', 'ru', 'pl', 'sv', 'da', 'nb', 'fi', 'tr', 'cs', 'el', 'he', 'ar', 'hi', 'id', 'uk', 'ro', 'hu', 'ca', 'vi', 'th'])

/** Whether `value` is a per-language map: a plain object whose every key is a language. */
const isPerLanguage = (value: unknown): value is { [lang: string]: unknown } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0 && Object.keys(value).every(key => TEXT_KEYS.has(key))

/**
 * A theme's JSON with every per-language map replaced by its value in
 * `locale`: then English, then `default`, then the first given.
 */
export const localize = (value: unknown, locale: string | null | undefined): unknown => {
  if (Array.isArray(value)) return value.map(one => localize(one, locale))
  if (isPerLanguage(value)) {
    const lang = asLocale(locale)
    const pick = lang in value ? value[lang] : FALLBACK in value ? value[FALLBACK] : 'default' in value ? value.default : Object.values(value)[0]

    return localize(pick, locale)
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, localize(one, locale)]))
  }

  return value
}

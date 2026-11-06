/** A paint: one color, a gradient (stops: color, offset 0-1, optional opacity) or a pattern. */
export type TintaFill =
  | { solid: string }
  | { gradient: { type: 'linear' | 'radial'; angle: number; stops: [string, number, number?][]; animate?: boolean } }
  | { pattern: { kind: 'dots' | 'lines' | 'grid' | 'noise'; color: string; background?: string; size: number } }

export type TintaLabelArt = {
  labelFill?: TintaFill
  labelChip?: TintaFill
  labelGlow?: boolean
  labelGlass?: boolean
  avatarFill?: TintaFill
}

/** The chat background: a fill composited over the app's own at `opacity`. */
export type TintaChat = {
  background: TintaFill
  /** 0 to 1: how much of the fill shows over the app's background. */
  opacity: number
  /** Rows the background overshoots below a row, 0 to 4. */
  bleed: number
  /** A grain or pattern laid over the fill. */
  overlay?: TintaFill
  /** Darkens the left and right edges softly. */
  vignette?: boolean
}

/** Claude's reply bubble: its fill, its edge, its padding in cells and rows. */
export type TintaBubble = {
  fill?: string
  border?: string
  paddingX?: number
  paddingY?: number
  /**
   * Desktop, experimental: how the fill is painted so the text selection
   * stays visible. A (parent): the fill on an outer Box, the text in an inner
   * one with none. B (alpha): the accent at 14% as #RRGGBBAA. C (underlay): a
   * filler sibling before the text, in the flow, clipped by the bubble. D
   * (svg-underlay): as C with an Svg in place of a background colour. E
   * (stack): an absolute filler, then the text in a relative Box above it.
   * With a mode and no fill, the fill is the accent at 14% over the app's
   * background. Absent: a fill only when `fill` is named.
   */
  /** M ("mesh", experimental): D's Svg underlay of four separate soft radial blobs in Claude's cool colours (Tinta: violet #8B3DFF 42.5% top right, magenta #FF5CA8 27.5% lower left, indigo #4B3DFF 17.5% lower centre-right, lavender #B79CFF 17.5% top left; light at 60%; other themes the assistant accent, its neighbours toward blue and a lighter highlight), over the bubble's own 9% translucent base, clipped by it inside a transparent round border. */
  fillMode?: 'A' | 'B' | 'C' | 'D' | 'E' | 'M'
  /**
   * Desktop, experimental opt-in (off in every shipped theme): a soft
   * coloured halo around the bubble, three concentric rings of translucent
   * fill only (the tint at 10%, 6%, 3% in all from the bubble outward), each
   * with a fully transparent round border for its corners: no line. "halo":
   * even room all round; "drop": only right and below, for a lifted look.
   * The reply's text moves in by the rings' width. false or absent: none.
   */
  glow?: 'halo' | 'drop' | false
  /**
   * Desktop: "soft", a coloured drop shadow cast below the bubble in its
   * tint (one Svg, two blurred layers: tight 55% blur 5, wide 35% blur 14),
   * right under the bubble in the flow with no overlap, fading out before
   * its edges. false or absent: none.
   *
   * "drop": a coloured drop shadow behind the bubble (the halo's machinery,
   * no height added): the bubble's shape inset 12 px a side, 12 px lower,
   * blur 16, near-black with 25% of the accent at 60%; only its lower edge
   * and a little of the sides show. Wins over `halo` when both are on.
   */
  shadow?: 'soft' | 'drop' | false
  /**
   * Desktop: a soft glow behind the bubble, like the user's: a blurred
   * rounded shape in a diagonal gradient (Tinta: violet, indigo, magenta;
   * others the assistant's cool colours) at 55%, 10 px past the bubble above
   * and below, drawn first in the flow, the bubble pulled up over it so it
   * is never over the text. Off when absent or false.
   */
  halo?: boolean
}

/** A thin line: its colour, its alpha (0-1), its width in px. */
export type TintaStroke = { color: string; alpha: number; width: number }

export type TintaUserAvatar = 'person-outline' | 'person' | 'initial' | 'orb' | 'none'
export type TintaAssistantAvatar = 'claude' | 'spark' | 'drop' | 'orb' | 'none'

export type TintaBorderStyle = 'single' | 'round' | 'double' | 'bold' | 'classic' | 'none'

declare module 'claude-code' {
  interface PluginState {
    tinta: {
      isOff: boolean
      source: string
      turn: number
      themes: { file: string; name: string; id: string }[]
      appearance: 'dark' | 'light' | null
      /** The copy of the engine that draws, when two load (a dev copy and the installed one). */
      owner: { root: string; at: number } | null
      /** The drawing copy's last beat (ms), apart from \`owner\`: rows read only who draws, so a beat never redraws them. */
      heartbeat: number
      theme: (TintaLook & { variants?: { dark?: TintaLook; light?: TintaLook } }) | null
      /**
       * The band's live figures, when the session tells them: the context
       * window's fill and the rate-limit windows (five_hour, seven_day, ...);
       * never the session's cost.
       */
      session: {
        percent?: number
        limits?: { kind: string; percent: number; resetsAt?: string }[]
      } | null
      /** The user's language for every word the engine shows (it, en, es, fr, de, pt), English when unknown. */
      locale: string
      /** The minute (since midnight) each conversation row was stored, by its id: the labels' times; none, no time shown. */
      stamps: { [id: string]: number }
      /** Each of Claude's messages' place in the conversation (the user turn it answers), by its id: the colour cycle's index. */
      replyOrder: { [id: string]: number }
      /** The person's preferences (~/.claude/tinta/preferenze.json): userBubble "app" keeps the app's own prompt bubble in every theme. */
      prefs: { userBubble?: 'app' | 'theme'; sounds?: 'on' | 'off' }
      /** Whether the page backdrop ($.ui.backdrop) is drawn: null not asked or cleared, else what the surface said. */
      pageDrawn: boolean | null
      /** Bumped once a streaming reply has gone quiet: its row redraws as plain Markdown. */
      streamTick: number
      /** The alerts already given this session ("context:80", "five_hour:90"), each once. */
      alerted: string[]
      /** When the running turn began, or null between turns. */
      workStart: number | null
      /** The band's clock while a turn runs: bumped each second to redraw the timer. */
      now: number
      /**
       * Background work Tinta tracks for the Attività pane: background agents,
       * shells, monitors and workflows, from the tool calls, spawns, turn ends
       * and task notifications it sees; finished ones capped at 30.
       */
      tasks: {
        id: string
        kind: 'agent' | 'shell' | 'monitor' | 'workflow'
        /** The call's description, or its command. */
        title: string
        startedAt: number
        endedAt: number | null
        status: 'running' | 'done' | 'failed' | 'stopped'
        /** The tool call that started it, when known. */
        toolUseId?: string
      }[]
      /** The Attività pane's clock: bumped each second while a task runs. */
      tasksNow: number
      /** Whether the pane's "Terminate" section is open (closed by default). */
      tasksDoneOpen: boolean
      /** The session's plan (TodoWrite's list, or the Task tools'): each item's id and status, for the band's "3/7". */
      plan: { id: string; status: string }[]
      /** The running turn's tool calls and the files they wrote, for its closing line (experiment turnFooter). */
      turnStats: { tools: number; files: string[] }
      /**
       * Whether the session waits for the person: a permission dialog or a question open. Apart from \`phase\`, so
       * the spinner (animated) reads only this and redraws only when a dialog opens or closes.
       */
      waiting: boolean
      /** The main turn's last phase: working while it runs, done or failed once it ended, idle before any or after a stop. */
      phase: 'idle' | 'working' | 'done' | 'failed'
    }
  }
}

/** One fully parsed theme: the base, or the base with a variant laid over it. */
export type TintaLook = {
  id: string
  name: string
  author?: string
  palette: { [key: string]: string }
  user?: {
    label?: string
    labelColor?: string
    labelBold?: boolean
    textColor?: string
    background?: string
    border?: { style: string; color?: string; hoverColor?: string }
    paddingX?: number
    paddingY?: number
    marginY?: number
    align?: 'left' | 'right'
    /** Desktop: the accent rule right of the user's bubble; on unless false. */
    rule?: boolean
    /** Desktop: the label (initial square and pill) above the bubble; off unless true. */
    desktopLabel?: boolean
    avatarSvg?: string
    /** The user's own color: a solid pill behind the label and the initial's chip. */
    accent?: string
    /** person: a bust silhouette in the accent (default); initial: a rounded square with the initial; orb: the sphere; none. */
    avatar?: TintaUserAvatar
    /** One or two letters on the user's chip; absent, the first of $USER. */
    initial?: string
    /** The name in the user's meta text; "Tu" unless set. */
    name?: string
    /**
     * Desktop: who draws the message. native (default): the app's grey bubble.
     * themed: Tinta draws the text in a bubble in the theme's border and accent,
     * and the app's row below it is left nearly empty (its stub, see `stub`) so its
     * hover actions (copy, retry, branch, time, "Send now") stay. Messages with
     * attachments keep the native drawing.
     */
    render?: 'native' | 'themed'
    /**
     * Desktop, render themed: what the app's own row is left drawing, a handle
     * under the bubble: "⋯" (default), up to three characters of the theme's
     * own, or a preset: blank (U+2800), space, empty, zwsp; same (stubMode
     * hidden or segment): the prompt's real words, the app's bubble as ours.
     */
    stub?: 'blank' | 'space' | 'empty' | 'zwsp' | 'same' | (string & {})
    /**
     * Desktop, render themed. beside (default): the app's row (the stub and
     * its hover actions) stays below Tinta's bubble, in the flow. hidden
     * (experimental, opt-in): the app's row first, Tinta's bubble after it,
     * filled solid (the app's bubble grey with 18% of the user's accent, 12%
     * light), positioned, and pulled up by the stub's and action row's height
     * so it lies on the stub (grown to as many lines as ours) and leaves the
     * action row below. segment (experimental): the same, unpositioned, the
     * app's stub (blank unless `stub` says otherwise) left as an empty end-cap
     * over our bubble's right end, our text padded clear of it. Only on a
     * prompt the person typed (composer, sdk, bridge) with no attachment.
     * glow: the app's row untouched (real words, selection, hover actions),
     * pulled up over a blurred shape in `glowFill` larger than its bubble;
     * the bubble's translucent grey lets the colour through.
     */
    stubMode?: 'beside' | 'hidden' | 'segment' | 'glow' | 'twin-fill'
    /** stubMode glow: the shape's fill; absent, the accent to a warmer neighbouring hue, diagonal. */
    glowFill?: TintaFill
    /** stubMode glow: true when the theme's glowFill is "mesh": the warm mesh (amber, orange, magenta blobs) in place of a fill; with glowBlur 0 and glowOvershoot 0 it reads as a mesh-filled bubble. */
    glowMesh?: boolean
    /** stubMode glow: the shape's opacity, 0 to 1 (0.9). */
    glowOpacity?: number
    /** stubMode glow: the blur's stdDeviation, px, 0 to 40 (10). */
    glowBlur?: number
    /** stubMode glow: how far the shape reaches past the bubble's edges, px, 0 to 80 (14). */
    glowOvershoot?: number
    /** stubMode glow: px the glow moves down (positive) or up against the app's bubble, -120 to 120 (0). */
    glowOffsetY?: number
    /** stubMode glow: px the glow moves right (positive, the whole drawing, past the row's edge) or left (the shape inside it), -120 to 120 (0). */
    glowOffsetX?: number
    /** stubMode glow: the estimated bubble width times this, 0.5 to 1.5 (1). */
    glowWidthScale?: number
    /** Desktop, reserved: "soft", the same coloured drop shadow as Claude's bubble, in the user's accent (parsed, not yet drawn). */
    shadow?: 'soft'
  } & TintaLabelArt
  assistant?: {
    label?: string
    labelColor?: string
    labelBold?: boolean
    background?: string
    border?: { style: string; color?: string; hoverColor?: string }
    indent?: number
    /** Desktop: the vertical rule left of the reply, in the label's fill; on unless false. */
    rule?: boolean
    /** Desktop: the label row (avatar and name) above the reply; on unless false. */
    desktopLabel?: boolean
    avatarSvg?: string
    /** Claude's own color: the label's text (no pill) and the glyph in its circle. */
    accent?: string
    /** claude: a radial burst like Claude's mark (default); spark: Tinta's own eight-ray spark; drop: an ink drop in a circle; orb: the sphere; none. */
    avatar?: TintaAssistantAvatar
    /** The burst's colour: theme (the label's fill, default) or original (Claude's terracotta #D97757). */
    avatarColor?: 'theme' | 'original'
    /**
     * Desktop: the reply in a bubble like the user's, under the label row:
     * a rounded edge in the app's bubble grey tinted toward the accent,
     * padding like the app's own bubble (1.75 cells a side, 0.75 of a row
     * above and below), no fill unless `fill` is set (a fill hid the text
     * selection). On unless false; colours and padding (quarter steps) here.
     */
    bubble?: false | TintaBubble
  } & TintaLabelArt
  tools?: {
    icon?: string
    color?: string
    nameColor?: string
    perTool: { [tool: string]: { icon?: string; color?: string } }
  }
  /**
   * Desktop: the quiet style of activity rows (tools, results, commands,
   * background tasks, agents' messages): the muted color, a glyph per kind
   * in the accent dimmed, a faint dotted guide at the left; on unless
   * `show: false`.
   */
  activity?: {
    show?: boolean
    color?: string
    guide?: boolean
    /** Desktop: a quiet rounded frame behind system rows and the spinner; on unless false. */
    background?: boolean
    /** Desktop: a running tool row's three dots drawn by Tinta in the theme's gradient instead of the app's; on unless false. */
    pending?: boolean
    /** Desktop: an Edit or Write row's diffstat (five blocks, "+12 −3") and a "new" badge for a created file, after the chip; absent, on for the Tinta theme only. */
    diffstat?: boolean
    glyphs?: { tool?: string; agent?: string; task?: string; command?: string }
  }
  toolResult?: {
    border?: { style: string; color?: string; hoverColor?: string }
    background?: string
  }
  spinner?: {
    words: { [mode: string]: string[] }
    suffix?: string
    keepAppStepText: boolean
    /** Desktop: the spinner's burst turns and breathes (spin, default), only breathes (pulse), or stays still. */
    mark?: 'spin' | 'pulse' | 'still'
    /**
     * Desktop: a voice wave beside the burst while Claude works, 96x20 px:
     * ribbons in `colors` (up to 4; true: the assistant label's gradient and
     * the accents), morphing; one calm flat wave when the theme has no motion.
     */
    wave?: true | { colors?: string[] }
  }
  band?: {
    show: boolean
    text?: string
    color?: string
    background?: string
    svg?: string
    fill?: TintaFill
    titleFill?: TintaFill
    overlay?: TintaFill
    glass?: boolean
    showToggle: boolean
    /** The quick theme dropdown beside the title, its face a brush (default on). */
    switcher?: boolean
    /** The context window's fill: a bar and its % (default), the % alone, or nothing. */
    context?: 'bar' | 'percent' | 'off'
    /** The running turn's time, muted, while Claude works (default on). */
    timer?: boolean
  }
  appearance?: 'dark' | 'light'
  forceBackground?: boolean
  motion?: boolean
  /**
   * The page behind the whole conversation (the desktop's backdrop layer):
   * a kind alone ("mesh") or its settings; the app's panels frosted over it
   * (`glass`, false to leave them), the text kept legible over every one.
   */
  page?: string | { id?: string; kind?: 'solid' | 'gradient' | 'mesh' | 'dots' | 'rain'; colors?: string[]; strength?: number; angle?: number; motion?: boolean; glass?: false | { blur?: number; opacity?: number; tint?: string } }
  /**
   * Theme-wide style. `borders`: visible border lines (bubble edges, table
   * frames, system-row frames, glass chip rims) only when true; absent or
   * false, every edge is fully transparent (rounded corners kept) and depth
   * comes from translucent fills.
   */
  style?: { borders?: boolean }
  /** Desktop: the time beside each label ("10:42 · Tu", "Claude · 10:43"); on unless false. */
  meta?: boolean
  /** Desktop: Claude's GFM tables drawn by Tinta (rounded frame, tinted header) or left to the app's Markdown (default). */
  markdown?: {
    tables?: 'tinta' | 'app'
    /** Desktop: `#`, `##`, `###` lines drawn by Tinta as gradient Svg text (alt the heading); absent, on for the Tinta theme only. */
    headings?: boolean
    /** Desktop: fenced code blocks in a window of Tinta's (dots, language chip, file name, the app's Code element); absent, on for the Tinta theme only. */
    code?: boolean
  }
  /**
   * Desktop experiments, each a switch (absent: on for the Tinta theme only):
   * taskRows (a background task's notice: status chip, duration pill, cleaned
   * text), todos (TodoWrite as a checklist, its progress in the band),
   * hoverScope (rows touching one file light together), spinnerModes (the
   * spinner's mark per mode), toasts (compaction, refusal and error),
   * turnFooter (a line closing each turn: time, tools, files),
   * permissionNotice (a risk line under the permission dialog), diffButton
   * (an Edit row's "↗ diff" opening the app's diff pane).
   */
  experiments?: {
    /** Fosforo Sfumature's streaming reply decoding from falling glyphs (a prototype). */
    decodeReply?: boolean
    taskRows?: boolean
    todos?: boolean
    hoverScope?: boolean
    spinnerModes?: boolean
    toasts?: boolean
    turnFooter?: boolean
    permissionNotice?: boolean
    diffButton?: boolean
    /** The user glow of a wrapped (widest) prompt as wide as the app's bubble exactly: our 85% Box clamps a wide drawing. */
    glowExactWidth?: boolean
    /** A wrapped prompt's line breaks decided by Tinta and handed to the app's row (stored message untouched), so the glow's lines are the app's. */
    userBreaks?: boolean
  }
  /**
   * The design system's per-style wishes (docs/DESIGN-SYSTEM.md, `styleHints`
   * in the v2 templates), read by the engine: see THEME-FORMAT.md.
   */
  hints?: {
    user?: { labelChip?: 'none' | 'outline' | 'gradient-glow'; glowStroke?: TintaStroke; glowFill?: 'none'; fillAlpha?: number; mesh?: { colors: string[]; base?: string; baseAlpha?: number } }
    /** Claude's colour cycle: each reply the next set (accent, label gradient, bubble mesh, edge), from the reply's order. */
    cycle?: { accent: string; label?: string[]; mesh?: string[]; edge?: string }[]
    bubble?: { backdrop?: 'rain' | 'glass' | 'none'; fill?: 'none' | string; fillAlpha?: number; border?: TintaStroke; mesh?: string[]; meshStrength?: number; meshBaseAlpha?: number }
    borders?: { alpha?: number; width?: number }
    activity?: { rowFill?: string; rowFillAlpha?: number }
    glow?: { activityTile?: boolean; label?: boolean }
    headings?: { fill?: TintaFill; style?: 'outline-rule'; rule?: boolean; effect?: 'decode' | 'gradient-drift' | 'silver-cut' | 'neon-tube' | 'frost' | 'glitch' | 'glitter' | 'sparkle' | 'gradient' | 'leaf' | 'serif' | 'terracotta'; font?: 'sans' | 'mono' | 'serif' }
    codeWindow?: { header?: 'none' | 'outline' | 'solid' | 'mesh'; headerAlpha?: number; borderAlpha?: number; headerFill?: TintaFill; dots?: 'none' | 'ring' | 'filled' | 'glow'; dotColors?: string[]; languageChip?: 'chip' | 'text' }
    tables?: 'outline'
    /** Built for the dark app: colours read against the dark background only (the light app takes the light variant). */
    darkOnly?: boolean
    wave?: { kind?: 'none' | 'line' | 'voice' | 'ink' | 'curtain' | 'refraction' | 'scanline' | 'flicker' | 'breath' | 'ink-line' | 'rain' | 'log' | 'sparkle' | 'ember' | 'unicorn' | 'comet'; colors?: string[]; strokeWidth?: number }
    label?: { font?: 'mono' | 'serif' | 'sans'; prefix?: string; cursor?: string; smallCaps?: boolean; tracking?: number }
    tools?: { prefix?: string; outcome?: boolean }
    band?: 'tmux'
  }
  /** Desktop: the display face of Tinta's headings, a CSS font stack (default the app's font, "Anthropic Sans", then the system's). */
  typography?: { display?: string }
  /** Desktop: the role rules' px width (default 2), px gap to the content (default 12 for Claude, 10 for the user's bubble) and opacity (default 1). */
  rule?: { width?: number; gap?: number; opacity?: number }
  /** A faded line above each reply on desktop; drawn only with `show: true`. */
  divider?: { fill: TintaFill; height: number; show?: boolean }
  /**
   * Parsed and kept for the app's editor, but not drawn: a layer behind the
   * transcript rows the desktop app draws (the replies) took the mouse and
   * broke text selection, and the mod API gives no layer that lets the
   * pointer through. See DECISIONI.md.
   */
  chat?: TintaChat
  statusLine?: string
  promptHint?: string
  /** The footer's mode label; absent, the theme's id; "" for none. */
  modeLabel?: string
  toasts?: { onApply?: string }
  /**
   * A sound file name per moment, looked up in ~/.claude/tinta, then its
   * themes/, then the engine's own sounds/; `volume` 0 to 1 (default 0.6),
   * `muted` the theme's default for the band's speaker button.
   */
  sounds?: {
    turnStart?: string
    turnComplete?: string
    error?: string
    toolError?: string
    permissionRequest?: string
    compaction?: string
    agentDone?: string
    /** Context or a rate-limit window crossing 80% or 90%. */
    alert?: string
    volume?: number
    muted?: boolean
  }
}

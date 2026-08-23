/**
 * SUBMIT PULSE — DESIGN TOKEN LAYER
 * ==================================
 * Single source of truth for every visual value in the product.
 *
 * Philosophy: editorial clarity over decorative complexity. Tokens encode
 * intentional decisions — palette, scale, rhythm — not arbitrary one-offs.
 * Feature code MUST NOT use raw hex values, arbitrary px values, or ad-hoc
 * z-indices. Import from this module or consume via CSS custom properties
 * (`--sp-*`) defined in theme.css. The Tailwind preset maps those variables
 * to utility classes.
 *
 * Strict-mode types (noUncheckedIndexedAccess, exactOptionalPropertyTypes)
 * are enforced at the tsconfig level; no `any` appears here.
 */

// ---------------------------------------------------------------------------
// COLOUR PRIMITIVES
// ---------------------------------------------------------------------------

/**
 * Indigo — primary action colour. Cool-blue indigo that reads as authoritative
 * and trustworthy without the generic "tech purple" cliché.
 */
const indigo = {
  50:  "#eef2ff",
  100: "#e0e7ff",
  200: "#c7d2fe",
  300: "#a5b4fc",
  400: "#818cf8",
  500: "#6366f1",
  600: "#4f46e5",
  700: "#4338ca",
  800: "#3730a3",
  900: "#312e81",
  950: "#1e1b4b",
} as const;

/**
 * Cyan/Teal — secondary accent. Used for informational states, secondary CTAs,
 * and the "pulse" visual metaphor (real-time submission indicators).
 */
const cyan = {
  50:  "#ecfeff",
  100: "#cffafe",
  200: "#a5f3fc",
  300: "#67e8f9",
  400: "#22d3ee",
  500: "#06b6d4",
  600: "#0891b2",
  700: "#0e7490",
  800: "#155e75",
  900: "#164e63",
  950: "#083344",
} as const;

/** Emerald — success / healthy states, submission confirmed. */
const emerald = {
  50:  "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  300: "#6ee7b7",
  400: "#34d399",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
  800: "#065f46",
  900: "#064e3b",
  950: "#022c22",
} as const;

/** Amber — warnings, rate-limit proximity, validation nudges. */
const amber = {
  50:  "#fffbeb",
  100: "#fef3c7",
  200: "#fde68a",
  300: "#fcd34d",
  400: "#fbbf24",
  500: "#f59e0b",
  600: "#d97706",
  700: "#b45309",
  800: "#92400e",
  900: "#78350f",
  950: "#451a03",
} as const;

/** Red — danger / errors / hard failures. */
const red = {
  50:  "#fef2f2",
  100: "#fee2e2",
  200: "#fecaca",
  300: "#fca5a5",
  400: "#f87171",
  500: "#ef4444",
  600: "#dc2626",
  700: "#b91c1c",
  800: "#991b1b",
  900: "#7f1d1d",
  950: "#450a0a",
} as const;

/**
 * Graphite — warm-tinted neutral ramp. Warm undertone (very slight amber cast)
 * in light territory keeps surfaces from feeling sterile. Dark end shifts to
 * graphite-navy to avoid the flat "charcoal" feel common in dark SaaS.
 *
 * Values derived from HSL with hue ~220° (blue-shifted neutral) below 700
 * and ~215° above, saturation 8-14% to provide warmth without colour.
 */
const graphite = {
  50:  "#f8f8fa",  // near-white with warmth
  100: "#f1f1f5",  // off-white page backgrounds
  200: "#e4e4eb",  // subtle dividers
  300: "#d1d1dc",  // disabled controls
  400: "#a8a8ba",  // placeholder text
  500: "#7c7c94",  // muted labels
  600: "#565668",  // secondary text
  700: "#3a3a4a",  // primary text on dark surfaces
  800: "#24242f",  // dark surface / card
  900: "#15151e",  // dark page background
  950: "#0a0a11",  // deepest graphite-navy
} as const;

// ---------------------------------------------------------------------------
// SEMANTIC COLOUR TOKENS
// ---------------------------------------------------------------------------

/**
 * Semantic tokens reference primitives and carry meaning. Component code
 * should use semantic tokens, not primitives directly, so theme-switching
 * works by re-mapping semantics without touching component logic.
 */
const semanticLight = {
  background:       graphite[50],
  surface:          "#ffffff",
  surfaceElevated:  "#ffffff",   // card / dialog — same white, differentiated by border+shadow
  textPrimary:      graphite[900],
  textSecondary:    graphite[600],
  textMuted:        graphite[500],
  border:           graphite[200],
  borderStrong:     graphite[300],
  primary:          indigo[600],
  primaryHover:     indigo[700],
  success:          emerald[600],
  warning:          amber[600],
  danger:           red[600],
  info:             cyan[600],
  focusRing:        indigo[500],
  overlay:          "rgba(10, 10, 17, 0.48)",
  codeBackground:   graphite[100],
} as const;

const semanticDark = {
  background:       graphite[950],
  surface:          graphite[900],
  surfaceElevated:  graphite[800],
  textPrimary:      graphite[50],
  textSecondary:    graphite[400],
  textMuted:        graphite[500],
  border:           graphite[700],
  borderStrong:     graphite[600],
  primary:          indigo[400],
  primaryHover:     indigo[300],
  success:          emerald[400],
  warning:          amber[400],
  danger:           red[400],
  info:             cyan[400],
  focusRing:        indigo[400],
  overlay:          "rgba(10, 10, 17, 0.72)",
  codeBackground:   graphite[800],
} as const;

// ---------------------------------------------------------------------------
// TYPOGRAPHY
// ---------------------------------------------------------------------------

/**
 * Modular scale — ratio 1.25 (Major Third) starting from 14px.
 * Step -2: 10px, -1: 12px, 0 (base): 14px, +1: 17.5 → 18px, +2: 22px,
 * +3: 28px, +4: 35px, +5: 44px.
 * Rounded to the nearest even integer for pixel-clean rendering.
 */
const fontSizes = {
  "2xs": "0.625rem",  // 10px — metadata, badges
  xs:    "0.75rem",   // 12px — captions, fine print
  sm:    "0.875rem",  // 14px — base UI text (most labels, table cells)
  base:  "1rem",      // 16px — body copy, descriptions
  lg:    "1.125rem",  // 18px — lead text, card headings
  xl:    "1.375rem",  // 22px — section headings
  "2xl": "1.75rem",   // 28px — page headings
  "3xl": "2.25rem",   // 36px — marketing hero subtext
  "4xl": "2.75rem",   // 44px — hero display text
} as const;

const lineHeights = {
  none:    "1",
  tight:   "1.25",   // display/heading
  snug:    "1.375",  // sub-headings
  normal:  "1.5",    // body text
  relaxed: "1.625",  // long-form prose
} as const;

const fontWeights = {
  regular:  "400",
  medium:   "500",
  semibold: "600",
  bold:     "700",
} as const;

/**
 * Letter spacing is only applied at display sizes — tightening at large scale
 * is an editorial choice; default tracking for body text should be 0.
 */
const letterSpacing = {
  tighter: "-0.04em",  // display headings 2xl+
  tight:   "-0.02em",  // headings lg–xl
  normal:   "0em",
  wide:     "0.04em",  // UI ALL-CAPS labels (used sparingly)
  wider:    "0.08em",  // BADGE / STATUS text
} as const;

/**
 * Font family stacks. Geist is the primary UI sans; fall back to Inter then
 * system fonts. Geist Mono for code surfaces (endpoints, JSON, request IDs,
 * log lines, schema keys) with JetBrains Mono as secondary fallback.
 */
const fontFamilies = {
  /**
   * Primary UI sans-serif. Geist was designed for code-adjacent developer
   * products; its tabular figures and clean apertures make it ideal here.
   */
  sans: '"Geist", "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
  /**
   * Monospace — used for any value that is a machine-generated string:
   * endpoint URLs, form IDs (fm_…), API keys, JSON payloads, log output.
   */
  mono: '"Geist Mono", "JetBrains Mono", "Fira Code", ui-monospace, "Cascadia Code", monospace',
} as const;

// ---------------------------------------------------------------------------
// SPACING (4 px base)
// ---------------------------------------------------------------------------

/**
 * T-shirt spacing scale built on a 4 px base. Every value is a multiple of 4.
 * Component code uses named steps, not raw rem calculations.
 */
const spacing = {
  0:    "0px",
  px:   "1px",    // hairline — borders, offsets
  0.5:  "2px",
  1:    "4px",
  1.5:  "6px",
  2:    "8px",
  2.5:  "10px",
  3:    "12px",
  4:    "16px",
  5:    "20px",
  6:    "24px",
  7:    "28px",
  8:    "32px",
  10:   "40px",
  12:   "48px",
  14:   "56px",
  16:   "64px",
  20:   "80px",
  24:   "96px",
  32:   "128px",
  40:   "160px",
  48:   "192px",
} as const;

// ---------------------------------------------------------------------------
// BORDER RADII
// ---------------------------------------------------------------------------

/**
 * Restrained radii — this is not a bubbly consumer app. Cards and inputs get
 * subtle rounding; nothing is fully pill-shaped except tags and badges.
 */
const radii = {
  none:  "0px",
  sm:    "3px",   // inset badges, tight UI chrome
  base:  "6px",   // inputs, buttons
  md:    "8px",   // cards, dropdowns
  lg:    "12px",  // modals, drawers
  xl:    "16px",  // sheet overlays
  full:  "9999px", // status pill, avatar
} as const;

// ---------------------------------------------------------------------------
// SHADOWS
// ---------------------------------------------------------------------------

/**
 * Shadow tokens are intentionally restrained. The design language uses borders
 * and background contrast to create depth rather than heavy drop-shadows.
 * Shadows are additive — each higher level adds subtlety, not drama.
 */
const shadows = {
  none: "none",
  /** Hairline shadow for floating micro-elements (tooltips). */
  xs:   "0 1px 2px 0 rgba(10, 10, 17, 0.05)",
  /** Default card elevation — a subtle lift against the page. */
  sm:   "0 1px 3px 0 rgba(10, 10, 17, 0.07), 0 1px 2px -1px rgba(10, 10, 17, 0.06)",
  /** Elevated panels: side drawer edge, dropdown menus. */
  md:   "0 4px 8px -2px rgba(10, 10, 17, 0.08), 0 2px 4px -2px rgba(10, 10, 17, 0.04)",
  /** Modals and popovers. */
  lg:   "0 12px 24px -4px rgba(10, 10, 17, 0.10), 0 4px 8px -4px rgba(10, 10, 17, 0.06)",
  /**
   * Focus ring shadow — supplements the outline for high-contrast clarity.
   * Applied via the focusRing semantic token.
   */
  focusRing: "0 0 0 3px rgba(99, 102, 241, 0.35)",
} as const;

// ---------------------------------------------------------------------------
// Z-INDEX LAYERS
// ---------------------------------------------------------------------------

/**
 * Named z-index layers prevent magic numbers and stacking-context conflicts.
 * Layers are intentionally sparse so new layers can be inserted without
 * renumbering existing ones.
 */
const zIndex = {
  below:   -1,
  base:     0,
  raised:   10,   // sticky headers, floating labels
  dropdown: 100,  // dropdown menus, combobox lists
  sticky:   200,  // sticky sidebar columns
  overlay:  300,  // modal backdrop
  modal:    400,  // modal dialog
  toast:    500,  // toast notifications (above modals)
  tooltip:  600,  // tooltips (must be above everything else)
} as const;

// ---------------------------------------------------------------------------
// MOTION
// ---------------------------------------------------------------------------

/**
 * Motion tokens encode brand personality: precise, not bouncy. Small
 * transitions feel native; larger transitions (modals, drawers) are measured
 * but never slow. No spring/bounce easings — this is a professional tool.
 */
const durations = {
  instant:  "0ms",
  fast:     "100ms",  // hover states, focus rings
  normal:   "150ms",  // most UI transitions
  moderate: "200ms",  // drawer slide-in, dropdown open
  slow:     "300ms",  // modal fade, page transitions
} as const;

const easings = {
  /** Standard easing for most UI transitions. */
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Entering elements — starts fast, eases out into final position. */
  enter:    "cubic-bezier(0, 0, 0.2, 1)",
  /** Exiting elements — starts at rest, accelerates out. */
  exit:     "cubic-bezier(0.4, 0, 1, 1)",
  /** Linear — use only for opacity fades or colour transitions. */
  linear:   "linear",
} as const;

// ---------------------------------------------------------------------------
// TOKEN EXPORT
// ---------------------------------------------------------------------------

export const tokens = {
  color: {
    primitives: {
      indigo,
      cyan,
      emerald,
      amber,
      red,
      graphite,
    },
    semantic: {
      light: semanticLight,
      dark:  semanticDark,
    },
  },
  typography: {
    fontFamilies,
    fontSizes,
    lineHeights,
    fontWeights,
    letterSpacing,
  },
  spacing,
  radii,
  shadows,
  zIndex,
  motion: {
    durations,
    easings,
  },
} as const;

// ---------------------------------------------------------------------------
// DERIVED TYPES
// ---------------------------------------------------------------------------

export type Tokens = typeof tokens;

/** All semantic colour token names (keys are identical in light + dark). */
export type SemanticColorKey = keyof typeof semanticLight;

/** Primitive colour ramp names. */
export type PrimitiveColorKey = keyof typeof tokens.color.primitives;

/** Shade keys within any primitive ramp (numeric string keys). */
export type IndigoShade  = keyof typeof indigo;
export type GraphiteShade = keyof typeof graphite;

/** Typography size token names. */
export type FontSizeKey      = keyof typeof fontSizes;
export type FontWeightKey    = keyof typeof fontWeights;
export type LineHeightKey    = keyof typeof lineHeights;
export type LetterSpacingKey = keyof typeof letterSpacing;
export type FontFamilyKey    = keyof typeof fontFamilies;

/** Spacing token keys (number | "px"). */
export type SpacingKey = keyof typeof spacing;

/** Radius token names. */
export type RadiusKey = keyof typeof radii;

/** Shadow token names. */
export type ShadowKey = keyof typeof shadows;

/** Z-index layer names. */
export type ZIndexKey = keyof typeof zIndex;

/** Motion duration names. */
export type DurationKey = keyof typeof durations;

/** Easing curve names. */
export type EasingKey = keyof typeof easings;

/**
 * SUBMIT PULSE — TAILWIND CSS PRESET
 * =====================================
 * Maps CSS custom properties (`--sp-*`) from theme.css into Tailwind's theme
 * extension so token-aware utilities are available across the product:
 *
 *   bg-background       → var(--sp-background)
 *   text-text-primary   → var(--sp-text-primary)
 *   border-border       → var(--sp-border)
 *   rounded-card        → var(--sp-radius-md)  [named alias for card radius]
 *   font-mono           → var(--sp-font-mono)
 *   ...etc.
 *
 * SINGLE SOURCE OF TRUTH: hex values live ONLY in tokens.ts → theme.css.
 * This file only references `var(--sp-*)` variables — never raw hex.
 *
 * NOTE ON TYPES: We intentionally do NOT `import type { Config } from "tailwindcss"`.
 * The `tailwindcss` package is not installed in this workspace, and importing
 * from an absent package fails TypeScript's module resolution even for type-only
 * imports. We use a minimal local interface that covers exactly the preset shape
 * Tailwind expects, with `Record<string, unknown>` for nested theme entries
 * where precise sub-typing would require the package's own internal types.
 */

interface TailwindPreset {
  theme: {
    extend: Record<string, unknown>;
  };
  plugins?: unknown[];
}

/**
 * Convenience wrapper: returns a CSS variable reference string.
 * The cast to `string` keeps TypeScript happy when values are consumed
 * inside `Record<string, unknown>` theme maps.
 */
function v(name: string): string {
  return `var(--sp-${name})`;
}

const preset: TailwindPreset = {
  theme: {
    extend: {
      // -----------------------------------------------------------------------
      // COLOURS
      // Semantic tokens are exposed as flat Tailwind colour names so utilities
      // like `bg-surface`, `text-primary`, `border-danger` work naturally.
      // -----------------------------------------------------------------------
      colors: {
        // Semantic surface / background
        background:       v("background"),
        surface:          v("surface"),
        "surface-elevated": v("surface-elevated"),

        // Semantic text
        "text-primary":   v("text-primary"),
        "text-secondary": v("text-secondary"),
        "text-muted":     v("text-muted"),

        // Semantic borders
        border:           v("border"),
        "border-strong":  v("border-strong"),

        // Brand / action
        primary:          v("primary"),
        "primary-hover":  v("primary-hover"),

        // Status
        success:          v("success"),
        warning:          v("warning"),
        danger:           v("danger"),
        info:             v("info"),

        // UI chrome
        "focus-ring":     v("focus-ring"),
        overlay:          v("overlay"),
        "code-background": v("code-background"),
      },

      // -----------------------------------------------------------------------
      // TYPOGRAPHY — font families
      // -----------------------------------------------------------------------
      fontFamily: {
        // `sans` overrides Tailwind's default sans stack with the brand stack.
        sans: v("font-sans"),
        // `mono` overrides Tailwind's default mono stack.
        mono: v("font-mono"),
      },

      // -----------------------------------------------------------------------
      // TYPOGRAPHY — font sizes
      // Each entry is [fontSize, { lineHeight }] — matching Tailwind's tuple
      // convention so the utility sets both size and a sensible line height.
      // -----------------------------------------------------------------------
      fontSize: {
        "2xs": [v("text-2xs"), { lineHeight: v("leading-normal") }],
        xs:    [v("text-xs"),  { lineHeight: v("leading-normal") }],
        sm:    [v("text-sm"),  { lineHeight: v("leading-normal") }],
        base:  [v("text-base"), { lineHeight: v("leading-normal") }],
        lg:    [v("text-lg"),  { lineHeight: v("leading-snug") }],
        xl:    [v("text-xl"),  { lineHeight: v("leading-snug") }],
        "2xl": [v("text-2xl"), { lineHeight: v("leading-tight") }],
        "3xl": [v("text-3xl"), { lineHeight: v("leading-tight") }],
        "4xl": [v("text-4xl"), { lineHeight: v("leading-tight") }],
      },

      // -----------------------------------------------------------------------
      // TYPOGRAPHY — font weights
      // -----------------------------------------------------------------------
      fontWeight: {
        regular:  v("weight-regular"),
        medium:   v("weight-medium"),
        semibold: v("weight-semibold"),
        bold:     v("weight-bold"),
      },

      // -----------------------------------------------------------------------
      // TYPOGRAPHY — letter spacing
      // -----------------------------------------------------------------------
      letterSpacing: {
        tighter: v("tracking-tighter"),
        tight:   v("tracking-tight"),
        normal:  v("tracking-normal"),
        wide:    v("tracking-wide"),
        wider:   v("tracking-wider"),
      },

      // -----------------------------------------------------------------------
      // SPACING
      // Tailwind's default scale is extended — not replaced — so the numeric
      // token keys layer on top of Tailwind's built-in spacing without conflict.
      // Named aliases are added for clarity at call sites.
      // -----------------------------------------------------------------------
      spacing: {
        px:    v("space-px"),
        "0.5": v("space-0-5"),
        1:     v("space-1"),
        "1.5": v("space-1-5"),
        2:     v("space-2"),
        "2.5": v("space-2-5"),
        3:     v("space-3"),
        4:     v("space-4"),
        5:     v("space-5"),
        6:     v("space-6"),
        7:     v("space-7"),
        8:     v("space-8"),
        10:    v("space-10"),
        12:    v("space-12"),
        14:    v("space-14"),
        16:    v("space-16"),
        20:    v("space-20"),
        24:    v("space-24"),
        32:    v("space-32"),
        40:    v("space-40"),
        48:    v("space-48"),
      },

      // -----------------------------------------------------------------------
      // BORDER RADII
      // Named radii expose both the generic scale and semantic aliases.
      // `rounded-card` and `rounded-input` encourage consistent usage patterns.
      // -----------------------------------------------------------------------
      borderRadius: {
        none:   v("radius-none"),
        sm:     v("radius-sm"),
        DEFAULT: v("radius-base"),  // `rounded` with no suffix → base (6 px)
        md:     v("radius-md"),
        lg:     v("radius-lg"),
        xl:     v("radius-xl"),
        full:   v("radius-full"),
        // Semantic aliases
        card:   v("radius-md"),     // `rounded-card` — standard card radius
        input:  v("radius-base"),   // `rounded-input` — form inputs
        modal:  v("radius-lg"),     // `rounded-modal` — dialog/sheet
        pill:   v("radius-full"),   // `rounded-pill` — status badges
      },

      // -----------------------------------------------------------------------
      // BOX SHADOWS
      // -----------------------------------------------------------------------
      boxShadow: {
        none:       v("shadow-none"),
        xs:         v("shadow-xs"),
        sm:         v("shadow-sm"),
        DEFAULT:    v("shadow-sm"),  // `shadow` with no suffix → card elevation
        md:         v("shadow-md"),
        lg:         v("shadow-lg"),
        "focus-ring": v("shadow-focus-ring"),
        // Semantic alias for card components
        card:       v("shadow-sm"),
        elevated:   v("shadow-md"),
        modal:      v("shadow-lg"),
      },

      // -----------------------------------------------------------------------
      // Z-INDEX
      // -----------------------------------------------------------------------
      zIndex: {
        below:    v("z-below"),
        base:     v("z-base"),
        raised:   v("z-raised"),
        dropdown: v("z-dropdown"),
        sticky:   v("z-sticky"),
        overlay:  v("z-overlay"),
        modal:    v("z-modal"),
        toast:    v("z-toast"),
        tooltip:  v("z-tooltip"),
      },

      // -----------------------------------------------------------------------
      // TRANSITION DURATIONS — references the motion tokens
      // -----------------------------------------------------------------------
      transitionDuration: {
        instant:  v("duration-instant"),
        fast:     v("duration-fast"),
        normal:   v("duration-normal"),
        moderate: v("duration-moderate"),
        slow:     v("duration-slow"),
      },

      // -----------------------------------------------------------------------
      // TRANSITION TIMING FUNCTIONS — easing curves
      // -----------------------------------------------------------------------
      transitionTimingFunction: {
        standard: v("ease-standard"),
        enter:    v("ease-enter"),
        exit:     v("ease-exit"),
        linear:   v("ease-linear"),
      },
    },
  },

  // No additional plugins — the preset configures theme only.
  // Consumer apps can add their own plugins on top.
  plugins: [],
};

export default preset;

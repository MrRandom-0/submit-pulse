/**
 * AI BUILDER REGISTRY
 * ===================
 *
 * The product's central differentiator is that a user picks the tool that built
 * their site and receives an integration prompt that actually works in that
 * tool. That only holds if the per-builder differences are modelled honestly
 * rather than papered over with one generic prompt.
 *
 * Each builder differs along axes that materially change the generated prompt:
 *   - whether the agent edits files or a hosted canvas
 *   - whether it understands a repo-wide instruction or only the open file
 *   - whether environment variables exist at all
 *   - what the idiomatic fetch/submit pattern looks like
 *
 * IMPORTANT — no partnership is implied. These are tools our users build with.
 * Marketing copy must say "Works with websites built using…", never imply an
 * official integration or endorsement.
 */

export const BUILDER_IDS = [
  "lovable",
  "bolt",
  "v0",
  "cursor",
  "claude-code",
  "codex",
  "windsurf",
  "replit",
  "framer",
  "webflow",
  "nextjs",
  "react",
  "vue",
  "svelte",
  "astro",
  "html",
  "other",
] as const;

export type BuilderId = (typeof BUILDER_IDS)[number];

/** How the user delivers our prompt to the tool. Changes the prompt's framing. */
export type BuilderSurface =
  | "chat_agent" // paste into a chat that edits the project
  | "ide_agent" // paste into an IDE-embedded coding agent
  | "visual_editor" // no code agent; user configures a UI panel
  | "manual"; // user edits code by hand

export interface BuilderProfile {
  readonly id: BuilderId;
  readonly label: string;
  /** Grouping for the onboarding picker. */
  readonly category: "ai_builder" | "ai_ide" | "framework" | "visual" | "other";
  readonly surface: BuilderSurface;
  /** Does the platform expose real environment variables to the client build? */
  readonly hasEnvVars: boolean;
  /**
   * True when the tool reliably applies a repo-wide instruction. When false the
   * prompt must name the target file/component explicitly, because the agent
   * only reliably sees what is currently open.
   */
  readonly understandsRepoWideInstruction: boolean;
  /** Idiomatic snippet family to generate. */
  readonly snippetFlavour:
    | "react"
    | "nextjs"
    | "vue"
    | "svelte"
    | "astro"
    | "html"
    | "none";
  /** Builder-specific caveats appended to the generated prompt. */
  readonly caveats: readonly string[];
}

export const BUILDERS: Readonly<Record<BuilderId, BuilderProfile>> = {
  lovable: {
    id: "lovable",
    label: "Lovable",
    category: "ai_builder",
    surface: "chat_agent",
    hasEnvVars: false,
    understandsRepoWideInstruction: true,
    snippetFlavour: "react",
    caveats: [
      "Lovable regenerates components on subsequent prompts. Ask it to keep the integration in a dedicated file so a later redesign does not silently drop it.",
    ],
  },
  bolt: {
    id: "bolt",
    label: "Bolt",
    category: "ai_builder",
    surface: "chat_agent",
    hasEnvVars: true,
    understandsRepoWideInstruction: true,
    snippetFlavour: "react",
    caveats: [
      "Bolt may rewrite the whole project on a broad prompt. Scope the request to the form component only.",
    ],
  },
  v0: {
    id: "v0",
    label: "v0",
    category: "ai_builder",
    surface: "chat_agent",
    hasEnvVars: true,
    understandsRepoWideInstruction: false,
    snippetFlavour: "nextjs",
    caveats: [
      "v0 works one component at a time. Paste this while the form component is the active generation.",
    ],
  },
  cursor: {
    id: "cursor",
    label: "Cursor",
    category: "ai_ide",
    surface: "ide_agent",
    hasEnvVars: true,
    understandsRepoWideInstruction: true,
    snippetFlavour: "react",
    caveats: [],
  },
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    category: "ai_ide",
    surface: "ide_agent",
    hasEnvVars: true,
    understandsRepoWideInstruction: true,
    snippetFlavour: "react",
    caveats: [],
  },
  codex: {
    id: "codex",
    label: "Codex",
    category: "ai_ide",
    surface: "ide_agent",
    hasEnvVars: true,
    understandsRepoWideInstruction: true,
    snippetFlavour: "react",
    caveats: [],
  },
  windsurf: {
    id: "windsurf",
    label: "Windsurf",
    category: "ai_ide",
    surface: "ide_agent",
    hasEnvVars: true,
    understandsRepoWideInstruction: true,
    snippetFlavour: "react",
    caveats: [],
  },
  replit: {
    id: "replit",
    label: "Replit",
    category: "ai_builder",
    surface: "chat_agent",
    hasEnvVars: true,
    understandsRepoWideInstruction: true,
    snippetFlavour: "react",
    caveats: [
      "Store nothing secret in Replit Secrets for this integration — the endpoint is public by design and needs no key.",
    ],
  },
  framer: {
    id: "framer",
    label: "Framer",
    category: "visual",
    surface: "visual_editor",
    hasEnvVars: false,
    understandsRepoWideInstruction: false,
    snippetFlavour: "none",
    caveats: [
      "Framer has no coding agent. Use the form element's own action/POST settings, or embed a code component.",
    ],
  },
  webflow: {
    id: "webflow",
    label: "Webflow",
    category: "visual",
    surface: "visual_editor",
    hasEnvVars: false,
    understandsRepoWideInstruction: false,
    snippetFlavour: "html",
    caveats: [
      "Webflow's native form handler must be disabled, or it will intercept the submit before it reaches the endpoint.",
    ],
  },
  nextjs: {
    id: "nextjs",
    label: "Next.js",
    category: "framework",
    surface: "manual",
    hasEnvVars: true,
    understandsRepoWideInstruction: false,
    snippetFlavour: "nextjs",
    caveats: [],
  },
  react: {
    id: "react",
    label: "React",
    category: "framework",
    surface: "manual",
    hasEnvVars: true,
    understandsRepoWideInstruction: false,
    snippetFlavour: "react",
    caveats: [],
  },
  vue: {
    id: "vue",
    label: "Vue",
    category: "framework",
    surface: "manual",
    hasEnvVars: true,
    understandsRepoWideInstruction: false,
    snippetFlavour: "vue",
    caveats: [],
  },
  svelte: {
    id: "svelte",
    label: "Svelte",
    category: "framework",
    surface: "manual",
    hasEnvVars: true,
    understandsRepoWideInstruction: false,
    snippetFlavour: "svelte",
    caveats: [],
  },
  astro: {
    id: "astro",
    label: "Astro",
    category: "framework",
    surface: "manual",
    hasEnvVars: true,
    understandsRepoWideInstruction: false,
    snippetFlavour: "astro",
    caveats: [
      "If the form lives in a static .astro page with no client directive, use the plain HTML form pattern rather than the React one.",
    ],
  },
  html: {
    id: "html",
    label: "Static HTML",
    category: "framework",
    surface: "manual",
    hasEnvVars: false,
    understandsRepoWideInstruction: false,
    snippetFlavour: "html",
    caveats: [],
  },
  other: {
    id: "other",
    label: "Something else",
    category: "other",
    surface: "manual",
    hasEnvVars: false,
    understandsRepoWideInstruction: false,
    snippetFlavour: "html",
    caveats: [],
  },
} as const;

export const ORDERED_BUILDERS: readonly BuilderProfile[] = BUILDER_IDS.map(
  (id) => BUILDERS[id],
);

/** Builders surfaced as cards in onboarding step 1, in display order. */
export const ONBOARDING_BUILDER_IDS: readonly BuilderId[] = [
  "lovable",
  "bolt",
  "cursor",
  "claude-code",
  "codex",
  "replit",
  "v0",
  "framer",
  "webflow",
  "html",
  "other",
];

/** Builders that get a dedicated marketing landing page at /ai-builders/[id]. */
export const MARKETING_BUILDER_IDS: readonly BuilderId[] = [
  "lovable",
  "bolt",
  "v0",
  "cursor",
  "claude-code",
  "codex",
  "replit",
];

/**
 * Documentation content registry.
 *
 * Snippets are generated via `generateSnippet` from @submitpulse/config/snippets
 * so the docs and the product can never drift apart. Do NOT hand-write integration
 * code snippets here that duplicate the generator.
 */

import { generateSnippet, type SnippetInput } from "@submitpulse/config/snippets";
import { brand } from "@submitpulse/config/brand";

// ---------------------------------------------------------------------------
// Example form spec used across all guide snippets
// ---------------------------------------------------------------------------

const EXAMPLE_FIELDS: SnippetInput["fields"] = [
  { name: "name", type: "text", required: true, label: "Name" },
  { name: "email", type: "email", required: true, label: "Email" },
  { name: "message", type: "textarea", required: true, label: "Message" },
];

const EXAMPLE_ENDPOINT = `${brand.domains.api}/v1/forms/fm_your_form_id/submissions`;

function snippet(
  flavour: SnippetInput["flavour"],
  opts?: Partial<Omit<SnippetInput, "flavour" | "endpoint" | "fields">>,
): string {
  return generateSnippet({
    flavour,
    endpoint: EXAMPLE_ENDPOINT,
    fields: EXAMPLE_FIELDS,
    captchaEnabled: opts?.captchaEnabled ?? false,
    hasFileUpload: opts?.hasFileUpload ?? false,
  });
}

// ---------------------------------------------------------------------------
// Guide registry
// ---------------------------------------------------------------------------

export interface GuideSection {
  readonly heading: string;
  readonly body: string;
  readonly code?: string;
  readonly language?: string;
  readonly codeCaption?: string;
}

export interface GuideEntry {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly sections: readonly GuideSection[];
}

export const GUIDE_SLUGS = [
  "quickstart",
  "html",
  "react",
  "nextjs",
  "vue",
  "svelte",
  "astro",
  "webflow",
  "framer",
  "lovable",
  "bolt",
  "v0",
  "cursor",
  "claude-code",
  "codex",
  "replit",
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

// ---------------------------------------------------------------------------
// Individual guides
// ---------------------------------------------------------------------------

const QUICKSTART: GuideEntry = {
  slug: "quickstart",
  title: "Quickstart",
  description: "Add a Submit Pulse endpoint to any website in under three minutes.",
  sections: [
    {
      heading: "1. Create your endpoint",
      body: `Sign up at ${brand.domains.app} and create a form. You'll receive a unique URL like:\n\n${EXAMPLE_ENDPOINT}\n\nThe form ID in the URL is public — it's meant to be embedded in client-side code. Access control comes from domain allowlists and rate limits, not ID secrecy.`,
    },
    {
      heading: "2. Send a submission",
      body: "POST field values as JSON. No API key required.",
      code: `const res = await fetch("${EXAMPLE_ENDPOINT}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  body: JSON.stringify({
    name: "Alice Johnson",
    email: "alice@example.com",
    message: "Hello!",
  }),
});

if (res.ok) {
  const { submissionId } = await res.json();
  console.log("Accepted:", submissionId); // "sub_..."
} else {
  const { error } = await res.json();
  console.error(error.code, error.message);
}`,
      language: "javascript",
      codeCaption: "Fetch — works in any browser or Node 18+ environment",
    },
    {
      heading: "3. Handle the response",
      body: `A successful submission returns HTTP 202 (not 200) with a JSON body:\n\n\`\`\`json\n{\n  "ok": true,\n  "requestId": "550e8400-...",\n  "submissionId": "sub_a1b2c3d4..."\n}\`\`\`\n\nHTTP 202 means the submission is durably stored and queued. Email notifications and webhooks fire asynchronously — they are not delivered before the response.`,
    },
    {
      heading: "4. Handle errors",
      body: `All errors use the same shape:\n\n\`\`\`json\n{\n  "ok": false,\n  "requestId": "...",\n  "error": {\n    "code": "VALIDATION_ERROR",\n    "message": "One or more fields are invalid",\n    "fields": [\n      { "field": "email", "code": "INVALID_FORMAT", "message": "Must be a valid email address" }\n    ]\n  }\n}\`\`\`\n\n\`fields\` is only present for VALIDATION_ERROR. See the [API Reference](/docs/api) for all error codes.`,
    },
    {
      heading: "5. Prevent duplicate submissions",
      body: "Use the Idempotency-Key header to safely retry on network failures without creating duplicate submissions.",
      code: `const key = crypto.randomUUID(); // generate once, before the request

const res = await fetch("${EXAMPLE_ENDPOINT}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": key, // retry with the same key on timeout
  },
  body: JSON.stringify({ name: "Alice", email: "alice@example.com", message: "Hello" }),
});`,
      language: "javascript",
      codeCaption: "Idempotency key — retry safely on network timeouts",
    },
  ],
};

const HTML_GUIDE: GuideEntry = {
  slug: "html",
  title: "Plain HTML",
  description: "Add Submit Pulse to a plain HTML website — no JavaScript framework required.",
  sections: [
    {
      heading: "Complete example",
      body: "Drop this into your page. No build step, no dependencies.",
      code: snippet("html"),
      language: "html",
      codeCaption: "Plain HTML — works in any browser",
    },
    {
      heading: "Native form submit (no JavaScript)",
      body: `You can also point a plain \`<form>\` directly at your endpoint. The browser handles encoding as \`application/x-www-form-urlencoded\`.`,
      code: `<form action="${EXAMPLE_ENDPOINT}" method="POST">
  <input name="name" required placeholder="Your name">
  <input name="email" type="email" required placeholder="Email">
  <textarea name="message" required placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>`,
      language: "html",
      codeCaption: "Native form submit — browser handles redirect on success",
    },
  ],
};

const REACT_GUIDE: GuideEntry = {
  slug: "react",
  title: "React",
  description: "Integrate Submit Pulse into a React application.",
  sections: [
    {
      heading: "Complete component",
      body: "Generated from the same snippet engine the dashboard uses — the code exactly matches the field schema you configure.",
      code: snippet("react"),
      language: "tsx",
      codeCaption: "React — copy into your project",
    },
    {
      heading: "What the response shape looks like",
      body: "Always check the `ok` field and read `error.code` for programmatic handling.",
      code: `interface SubmitResponse {
  ok: boolean;
  requestId: string;
  submissionId?: string;           // present on success
  error?: {
    code: string;
    message: string;
    fields?: Array<{
      field: string;
      code: string;
      message: string;
    }>;
  };
}`,
      language: "typescript",
      codeCaption: "TypeScript — response type",
    },
  ],
};

const NEXTJS_GUIDE: GuideEntry = {
  slug: "nextjs",
  title: "Next.js",
  description: "Add Submit Pulse to a Next.js application using the App Router.",
  sections: [
    {
      heading: "Client component",
      body: "Use the `'use client'` directive. The snippet works in both the App Router and Pages Router.",
      code: snippet("nextjs"),
      language: "tsx",
      codeCaption: "Next.js — client component (App Router)",
    },
    {
      heading: "Environment variable",
      body: `Store the endpoint in \`NEXT_PUBLIC_SUBMITPULSE_ENDPOINT\` so it's accessible from client components without hardcoding.\n\n\`\`\`env\nNEXT_PUBLIC_SUBMITPULSE_ENDPOINT=${EXAMPLE_ENDPOINT}\n\`\`\`\n\nThen reference it:\n\n\`\`\`typescript\nconst ENDPOINT = process.env.NEXT_PUBLIC_SUBMITPULSE_ENDPOINT!;\n\`\`\``,
    },
  ],
};

const VUE_GUIDE: GuideEntry = {
  slug: "vue",
  title: "Vue",
  description: "Integrate Submit Pulse into a Vue 3 application.",
  sections: [
    {
      heading: "Single-file component",
      body: "Complete Vue SFC ready to drop into your project.",
      code: snippet("vue"),
      language: "vue",
      codeCaption: "Vue 3 — single-file component",
    },
  ],
};

const SVELTE_GUIDE: GuideEntry = {
  slug: "svelte",
  title: "Svelte",
  description: "Integrate Submit Pulse into a Svelte or SvelteKit application.",
  sections: [
    {
      heading: "Svelte component",
      body: "Reactive form state with built-in loading and error handling.",
      code: snippet("svelte"),
      language: "svelte",
      codeCaption: "Svelte — reactive component",
    },
  ],
};

const ASTRO_GUIDE: GuideEntry = {
  slug: "astro",
  title: "Astro",
  description: "Add Submit Pulse to an Astro site using a React island.",
  sections: [
    {
      heading: "React island in Astro",
      body: "Astro is a static site generator. Use a React component as a `client:load` island for client-side interactivity.",
      code: snippet("astro"),
      language: "astro",
      codeCaption: "Astro — React island with client:load",
    },
  ],
};

const WEBFLOW_GUIDE: GuideEntry = {
  slug: "webflow",
  title: "Webflow",
  description: "Connect a Webflow site to Submit Pulse without writing server code.",
  sections: [
    {
      heading: "Overview",
      body: "Webflow forms can POST to external endpoints via its built-in Form settings. Set the Action URL to your Submit Pulse endpoint.",
    },
    {
      heading: "Step 1 — Set the form action",
      body: `In the Webflow designer:\n1. Select your form block.\n2. Open the Form Settings panel.\n3. Set **Action** to your endpoint URL: \`${EXAMPLE_ENDPOINT}\`\n4. Set **Method** to **POST**.\n\nWebflow will send submissions as \`application/x-www-form-urlencoded\`. Submit Pulse accepts this format.`,
    },
    {
      heading: "Step 2 — Name your fields",
      body: "Each input's **Name** attribute in Webflow must match the field names you configured in the Submit Pulse dashboard. Names are case-sensitive.",
    },
    {
      heading: "Step 3 — Handle success",
      body: "Webflow shows its built-in success state after a form submits. If you need custom success logic, add a small Embed element with JavaScript that intercepts the submit event and calls `fetch()` instead — use the plain HTML snippet as a starting point.",
      code: snippet("html"),
      language: "html",
      codeCaption: "Custom JavaScript — paste into a Webflow Embed element",
    },
  ],
};

const FRAMER_GUIDE: GuideEntry = {
  slug: "framer",
  title: "Framer",
  description: "Add a working contact form to a Framer site using a Code Component.",
  sections: [
    {
      heading: "Code Component",
      body: "In Framer, create a Code Component and paste the React snippet. Framer runs React natively.",
      code: snippet("react"),
      language: "tsx",
      codeCaption: "Framer Code Component — paste into Insert > Code",
    },
    {
      heading: "Set the endpoint",
      body: `Replace the \`ENDPOINT\` constant with your form's URL:\n\n\`\`\`typescript\nconst ENDPOINT = "${EXAMPLE_ENDPOINT}";\n\`\`\``,
    },
  ],
};

function aiBuilderGuide(
  slug: GuideSlug,
  title: string,
  description: string,
  toolSpecific: string,
): GuideEntry {
  return {
    slug,
    title,
    description,
    sections: [
      {
        heading: "Integration prompt",
        body: toolSpecific,
      },
      {
        heading: "Paste the generated code",
        body: `After running the prompt, your AI tool will produce a form component. The generated code will POST to your endpoint. Verify that:\n\n1. The endpoint URL matches your Submit Pulse form exactly.\n2. Field names in the generated code match the field names in your Submit Pulse dashboard.\n3. The code reads a 202 response as success (not 200).`,
      },
      {
        heading: "Reference implementation",
        body: "If the AI generates incorrect code, use this as a reference.",
        code: snippet("react"),
        language: "tsx",
        codeCaption: "Reference React implementation",
      },
    ],
  };
}

const LOVABLE_GUIDE = aiBuilderGuide(
  "lovable",
  "Lovable",
  "Connect a Lovable project to Submit Pulse.",
  `Open your Lovable project's chat and paste this prompt:\n\n---\n\nUpdate the contact form so that when submitted it sends a POST request to:\n\n  ${EXAMPLE_ENDPOINT}\n\nUse fetch() with:\n  method: "POST"\n  headers: { "Content-Type": "application/json" }\n  body: JSON.stringify({ name, email, message })\n\nOn success (HTTP 202), show a "Thank you" message. On failure, show the error from the JSON response body at \`error.message\`. Keep this in a dedicated ContactForm component so future redesigns don't remove it.\n\n---\n\nLovable's agent will update your form component in place.`,
);

const BOLT_GUIDE = aiBuilderGuide(
  "bolt",
  "Bolt",
  "Connect a Bolt project to Submit Pulse.",
  `Open Bolt's chat and paste this prompt:\n\n---\n\nUpdate the form component to POST submissions to:\n\n  ${EXAMPLE_ENDPOINT}\n\nUse fetch() with JSON body containing the form field values. Handle the response: show success on HTTP 202, show the error message from the JSON body on failure.\n\n---\n\nBolt edits files directly in its container. After the change, test the form to confirm the endpoint URL is correct.`,
);

const V0_GUIDE = aiBuilderGuide(
  "v0",
  "v0",
  "Use v0 to generate a form component connected to Submit Pulse.",
  `In v0's prompt box, type:\n\n---\n\nGenerate a React contact form component that:\n- Has fields: name (text, required), email (email, required), message (textarea, required)\n- On submit, POSTs JSON to: ${EXAMPLE_ENDPOINT}\n- Shows a loading state on the submit button\n- Shows a success message on HTTP 202\n- Shows the error.message from the JSON body on failure\n- Uses TypeScript and Tailwind CSS\n\n---\n\nAfter generating, copy the component into your project. Adjust field names to match your Submit Pulse dashboard.`,
);

const CURSOR_GUIDE = aiBuilderGuide(
  "cursor",
  "Cursor",
  "Use Cursor's AI agent to wire up a Submit Pulse form.",
  `In Cursor's Composer (Cmd+I), with your form component file open, type:\n\n---\n\nUpdate this form to POST submissions to:\n\n  ${EXAMPLE_ENDPOINT}\n\nUse fetch() with Content-Type: application/json. The JSON body should include all form fields. Handle success (HTTP 202) by showing a thank-you message. Handle errors by showing error.message from the response JSON.\n\n---\n\nCursor has access to your full codebase, so it will adapt the pattern to your existing state management and styling.`,
);

const CLAUDE_CODE_GUIDE = aiBuilderGuide(
  "claude-code",
  "Claude Code",
  "Use Claude Code to integrate Submit Pulse into your project.",
  `In a Claude Code session, with your project open, say:\n\n---\n\nAdd a form submission handler to the contact form. The form should POST to:\n\n  ${EXAMPLE_ENDPOINT}\n\nUse fetch() with application/json. Include all fields: name, email, message. Handle the async response: show success on 202, show the error.message from the JSON body otherwise. Make the integration resilient — prevent double-submission, show loading state, and handle network errors.\n\n---\n\nClaude Code will read your existing files and integrate the submission logic into your component architecture.`,
);

const CODEX_GUIDE = aiBuilderGuide(
  "codex",
  "Codex",
  "Use OpenAI Codex to generate Submit Pulse integration code.",
  `Paste this task into Codex:\n\n---\n\nWrite a form submission function in TypeScript that:\n1. Accepts field values as an object\n2. POSTs to ${EXAMPLE_ENDPOINT} with Content-Type: application/json\n3. Returns the submissionId string on success\n4. Throws an Error with the error.message string on failure\n\n---`,
);

const REPLIT_GUIDE: GuideEntry = {
  slug: "replit",
  title: "Replit",
  description: "Add Submit Pulse to a Replit project.",
  sections: [
    {
      heading: "Using Replit's AI agent",
      body: `Open your Replit project and use the AI chat to paste this prompt:\n\n---\n\nAdd a contact form to this project that POSTs to:\n\n  ${EXAMPLE_ENDPOINT}\n\nThe form should have name, email, and message fields. Use fetch() with JSON. Show a success message on HTTP 202. Display error.message on failure.\n\n---`,
    },
    {
      heading: "Manual integration",
      body: "If you prefer to write the code yourself, use the plain HTML snippet — it requires no build step and works in any Replit project.",
      code: snippet("html"),
      language: "html",
      codeCaption: "Plain HTML — works in Replit's static hosting",
    },
    {
      heading: "Environment variable",
      body: `Store your endpoint URL in Replit's Secrets tab as \`SUBMITPULSE_ENDPOINT\`. For client-side HTML, you can also hardcode the endpoint directly — the form ID is public by design.`,
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const GUIDES: Record<GuideSlug, GuideEntry> = {
  quickstart: QUICKSTART,
  html: HTML_GUIDE,
  react: REACT_GUIDE,
  nextjs: NEXTJS_GUIDE,
  vue: VUE_GUIDE,
  svelte: SVELTE_GUIDE,
  astro: ASTRO_GUIDE,
  webflow: WEBFLOW_GUIDE,
  framer: FRAMER_GUIDE,
  lovable: LOVABLE_GUIDE,
  bolt: BOLT_GUIDE,
  v0: V0_GUIDE,
  cursor: CURSOR_GUIDE,
  "claude-code": CLAUDE_CODE_GUIDE,
  codex: CODEX_GUIDE,
  replit: REPLIT_GUIDE,
};

// ---------------------------------------------------------------------------
// Navigation groups
// ---------------------------------------------------------------------------

export interface NavGroup {
  readonly label: string;
  readonly items: ReadonlyArray<{ slug: GuideSlug; label: string }>;
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Getting started",
    items: [{ slug: "quickstart", label: "Quickstart" }],
  },
  {
    label: "Integration guides",
    items: [
      { slug: "html", label: "Plain HTML" },
      { slug: "react", label: "React" },
      { slug: "nextjs", label: "Next.js" },
      { slug: "vue", label: "Vue" },
      { slug: "svelte", label: "Svelte" },
      { slug: "astro", label: "Astro" },
    ],
  },
  {
    label: "Visual editors",
    items: [
      { slug: "webflow", label: "Webflow" },
      { slug: "framer", label: "Framer" },
    ],
  },
  {
    label: "AI builders & IDEs",
    items: [
      { slug: "lovable", label: "Lovable" },
      { slug: "bolt", label: "Bolt" },
      { slug: "v0", label: "v0" },
      { slug: "cursor", label: "Cursor" },
      { slug: "claude-code", label: "Claude Code" },
      { slug: "codex", label: "Codex" },
      { slug: "replit", label: "Replit" },
    ],
  },
];

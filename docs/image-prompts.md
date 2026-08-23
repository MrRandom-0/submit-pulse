# Image Prompts

These prompts are intended for generating visual assets for Submit Pulse's marketing and documentation. No images have been generated; this file documents the intended prompts for future use.

## Hero image — marketing homepage

**Purpose**: Main hero visual for `submitpulse.com`. Should communicate "forms that never fail silently" without being literal (no boring contact-form UIs).

**Prompt**:
```
Dark-mode dashboard interface floating above a stylised electric-blue network graph. 
Clean sans-serif typography reading "202 Accepted". Subtle green pulse-wave animation 
traces emanating from a central node, representing end-to-end monitoring. Professional 
product illustration style, flat but with soft depth shadows. No photographic elements. 
Background: deep navy (#0a0f1e). Accent: electric blue (#3b82f6) and green (#22c55e). 
16:9 aspect ratio.
```

## Architecture diagram — ingestion pipeline

**Purpose**: Visual representation of the 10-stage ingestion pipeline for `docs/12-ingestion-pipeline.md`. A technical diagram, not marketing art.

**Prompt**:
```
Technical flow diagram of a web form submission pipeline. Left to right, 10 labelled 
boxes connected by arrows: (1) Size Guard, (2) Form Lookup, (3) Rate Limit, 
(4) Origin Check, (5) Schema Validate, (6) CAPTCHA, (7) Spam Score, (8) File Check, 
(9) Persist, (10) Enqueue. Each box has a small icon. Boxes that return errors have 
a red exit arrow pointing down labelled with an HTTP status code (413, 404, 429, 403, 
400, 400, 400, 400, 503). Final box has a green arrow pointing right labelled "202". 
Minimal, technical, monochrome with one accent colour (#3b82f6). White background. 
No gradients.
```

## Role matrix diagram

**Purpose**: Visual for `docs/14-authorization.md` showing the four roles and which permissions each holds.

**Prompt**:
```
Four-column permission matrix table diagram. Columns labelled Viewer, Developer, Admin, 
Owner. Rows are permission groups: Forms, Submissions, Files, Delivery, Health/AI, 
Credentials, Workspace, Agency, Commercial, Privacy. Each cell contains a checkmark 
(green) or dash (grey). Owner column has the most checkmarks; Viewer column has the 
fewest. Clean, technical, sans-serif typography. White background with alternating 
row shading. No decorative elements.
```

## Pulse Monitor concept — health status

**Purpose**: Marketing illustration for the `/form-monitoring` feature page.

**Prompt**:
```
Minimalist dark-mode UI card showing a form health monitor. A small animated heartbeat 
line in electric green traces across the card. Below the line: "Last checked 2 minutes 
ago — Healthy". Status dot: solid green circle. Form name: "Contact Us". 
Uptime badge: "99.8% · 30d". Clean product UI style. Dark background (#111827). 
Accent: green (#22c55e). No photography, no gradients.
```

## Spam detection — signal breakdown

**Purpose**: Illustration for the spam protection feature page showing the multi-signal scoring system.

**Prompt**:
```
Technical product UI screenshot of a spam decision card. Shows a submission with 
spam score 0.87 displayed as a horizontal progress bar shaded red. Below the bar: 
three signal rows with icons: (1) Honeypot field populated +0.8 — red, (2) Keyword 
match in message +0.15 — orange, (3) Domain age > 5 years -0.08 — green allowlist. 
Clean list layout, monospace font for score values. Dark-mode card on a dark background.
```

## Developer onboarding — code snippet

**Purpose**: Illustration showing the generated integration snippet in a code editor, for developer marketing pages.

**Prompt**:
```
Dark-theme code editor screenshot showing a React component. The code is a styled 
form component with syntax highlighting: const ENDPOINT = "https://api.submitpulse.com/...". 
The fetch call is highlighted. A speech bubble overlay says "Paste this into your project". 
VS Code-style editor chrome. Electric blue accent on highlighted lines. Realistic 
code font (JetBrains Mono). No lorem ipsum; use real-looking form submission code.
```

## Notes on usage

- All prompts above are intended for generating decorative/illustrative images, not UI screenshots or product demos.
- Generated images must not depict real people's faces.
- Images showing code snippets should use the actual endpoint URL pattern from the brand module, not invented strings.
- Builder logos (Lovable, Bolt, Cursor, etc.) must not be included in generated images. Use generic icons or text labels.
- No competitive product interfaces should appear in any generated image.

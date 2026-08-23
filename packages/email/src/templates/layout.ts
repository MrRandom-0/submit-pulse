/**
 * Shared HTML email layout shell. Wraps template content with a consistent
 * branded header/footer and responsive container. All values passed to this
 * layout must already be escaped by the calling template.
 */

import { brand } from "@submitpulse/config";

export function htmlLayout(opts: {
  title: string;
  preheader?: string;
  bodyContent: string;
}): string {
  const { title, preheader = "", bodyContent } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f6f6f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 24px 32px; }
    .header a { color: #ffffff; text-decoration: none; font-weight: 700; font-size: 18px; }
    .body { padding: 32px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #64748b; text-align: center; }
    .footer a { color: #64748b; }
    h1 { margin: 0 0 16px; font-size: 22px; }
    p { line-height: 1.6; margin: 0 0 16px; }
    .field-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .field-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 6px 8px; }
    .field-table td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 14px; vertical-align: top; word-break: break-word; }
    .field-table tr:last-child td { border-bottom: none; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 8px 0; }
    .badge { display: inline-block; background: #fef9c3; color: #854d0e; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
    .badge.red { background: #fee2e2; color: #991b1b; }
    .badge.green { background: #dcfce7; color: #166534; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f6f6f6;padding:0;margin:0;">
    <tr><td align="center" style="padding: 32px 16px;">
      <div class="wrapper">
        <div class="header">
          <a href="${brand.domains.app}">${brand.name}</a>
        </div>
        <div class="body">
          ${bodyContent}
        </div>
        <div class="footer">
          <p style="margin:0 0 4px;">&copy; ${new Date().getFullYear()} ${brand.name} &bull; <a href="${brand.domains.marketing}/privacy">Privacy</a> &bull; <a href="${brand.domains.app}/settings">Settings</a></p>
          <p style="margin:0;">${brand.tagline}</p>
        </div>
      </div>
    </td></tr>
  </table>
</body>
</html>`;
}

export function plainTextLayout(opts: {
  title: string;
  bodyContent: string;
}): string {
  const { title, bodyContent } = opts;
  const border = "=".repeat(60);
  return `${border}
${brand.name.toUpperCase()} — ${title}
${border}

${bodyContent}

---
${brand.name} | ${brand.domains.app}
${brand.tagline}
`;
}

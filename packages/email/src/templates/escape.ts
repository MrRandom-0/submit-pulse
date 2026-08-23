/**
 * HTML escaping for untrusted user-submitted values.
 *
 * SECURITY: Every value sourced from a form submission is untrusted input and
 * MUST be passed through `escapeHtml` before interpolation into an HTML
 * template. Failure to escape allows a submitter to inject arbitrary HTML/JS
 * into the notification email rendered by the recipient's email client.
 *
 * Plain-text templates must use `escapePlainText` which strips control
 * characters that could disrupt mail parsing.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

/**
 * Escape a string for safe interpolation into an HTML context.
 * SECURITY: Never interpolate submission field values raw into HTML templates —
 * always call escapeHtml first. This is the escape site.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"'/]/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

/**
 * Escape a string for safe inclusion in a plain-text email body.
 * Strips ASCII control characters (except newline/tab) that could be used
 * to inject RFC 2822 headers into the message.
 */
export function escapePlainText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\r\n?/g, "\n");
}

/**
 * Escape a value for use inside an HTML attribute (e.g. href, data-*).
 * Encodes all non-alphanumeric characters as HTML entities.
 * SECURITY: This is the escape site for attribute-context values.
 */
export function escapeAttr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[^\w\s\-\.]/g, (ch) => {
    const code = ch.codePointAt(0);
    return code !== undefined ? `&#${code};` : "";
  });
}

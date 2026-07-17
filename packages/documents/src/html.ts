import { escapeHtml } from "@class-a-bridge/project";

export const PREPARATION_DISCLAIMER =
  "Class A Bridge is maintained by Ancilis and supports application preparation only. It is not affiliated with, endorsed by, or certified by GSA or FedRAMP. It does not certify, approve, audit, independently assess, submit applications, provide legal advice, or guarantee acceptance. The provider must review and approve every representation.";

export const OFFICIAL_VALIDATOR_URL = "https://www.fedramp.gov/schemas/";

export const PRINT_PDF_INSTRUCTIONS =
  "Open this HTML file in a modern browser, choose Print, and select Save as PDF. Review page breaks and sensitive content before sharing.";

const STYLES = `
:root{color-scheme:light;--ink:#10243e;--muted:#516174;--line:#d8e0e8;--paper:#fff;--wash:#f4f7f8;--accent:#087f8c;--danger:#a6382f;--warning:#8a5b00;--ok:#216e4a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.55}
*{box-sizing:border-box}body{background:var(--wash);color:var(--ink);margin:0}.document{background:var(--paper);margin:2rem auto;max-width:960px;padding:3rem;box-shadow:0 8px 32px rgba(16,36,62,.08)}
header{border-bottom:3px solid var(--accent);padding-bottom:1.5rem;margin-bottom:2rem}.eyebrow{color:var(--accent);font-size:.78rem;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.meta{color:var(--muted);font-size:.9rem}.privacy{border:1px solid #9bcbd0;background:#eef9fa;padding:.65rem .8rem;border-radius:.4rem}h1{font-size:2.1rem;line-height:1.15;margin:.35rem 0 .8rem}h2{font-size:1.35rem;margin:2rem 0 .6rem}h3{font-size:1rem;margin:1.3rem 0 .35rem}p{margin:.45rem 0 1rem}ul,ol{padding-left:1.3rem}li+li{margin-top:.3rem}a{color:#075f69}table{border-collapse:collapse;width:100%;font-size:.9rem;margin:1rem 0 1.5rem}th,td{border:1px solid var(--line);padding:.55rem .65rem;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#edf3f5;font-weight:700}.status{font-weight:700}.status-open,.status-blocked{color:var(--danger)}.status-review{color:var(--warning)}.status-complete{color:var(--ok)}.callout{border-left:4px solid var(--accent);background:#eef7f8;padding:.8rem 1rem;margin:1rem 0}.warning{border-color:var(--warning);background:#fff8e8}.danger{border-color:var(--danger);background:#fff3f2}code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}pre{background:#f5f7f9;border:1px solid var(--line);padding:1rem;white-space:pre-wrap;overflow-wrap:anywhere}footer{border-top:1px solid var(--line);color:var(--muted);font-size:.8rem;margin-top:2.5rem;padding-top:1rem}.watermark{border:2px solid #8a5b00;color:#704900;background:#fff8e8;font-weight:800;padding:.7rem 1rem;margin:1rem 0;text-align:center}.empty{color:var(--muted);font-style:italic}.page-break{break-before:page}
@media(max-width:700px){.document{box-shadow:none;margin:0;padding:1.25rem}h1{font-size:1.65rem}table{display:block;overflow-x:auto}}
@media print{@page{size:auto;margin:15mm}.document{box-shadow:none;margin:0;max-width:none;padding:0}body{background:#fff;color:#000}a{color:#000;text-decoration:none}.privacy{border-color:#777}h2,h3{break-after:avoid}table,pre,.callout{break-inside:avoid}thead{display:table-header-group}.watermark{position:relative}footer{break-before:avoid}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;

export interface StandaloneHtmlOptions {
  readonly title: string;
  readonly organization: string;
  readonly offering: string;
  readonly generatedAt: string;
  readonly body: string;
  readonly watermark?: string;
  readonly disclaimer?: string;
}

export function renderStandaloneHtml(options: StandaloneHtmlOptions): string {
  const watermark = options.watermark
    ? `<div class="watermark" role="note">${escapeHtml(options.watermark)}</div>`
    : "";
  const disclaimer = escapeHtml(options.disclaimer ?? PREPARATION_DISCLAIMER);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>${escapeHtml(options.title)} — Class A Bridge by Ancilis</title>
  <style>${STYLES}</style>
</head>
<body>
  <main class="document">
    <header>
      <div class="eyebrow">Class A Bridge by Ancilis</div>
      <h1>${escapeHtml(options.title)}</h1>
      <p class="meta"><strong>${escapeHtml(options.organization)}</strong> · ${escapeHtml(options.offering || "Offering not yet named")} · Generated ${escapeHtml(options.generatedAt)}</p>
      <p class="privacy">Private export — review the contents and recipients before sharing.</p>
      ${watermark}
    </header>
    ${options.body}
    <footer>
      <p>${disclaimer}</p>
      <p>${escapeHtml(PRINT_PDF_INSTRUCTIONS)}</p>
    </footer>
  </main>
</body>
</html>`;
}

export function text(value: unknown): string {
  if (value == null || value === "") return '<span class="empty">Not provided</span>';
  const printable =
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
      ? String(value)
      : JSON.stringify(value);
  return escapeHtml(printable ?? "Unsupported value");
}

export function list(values: readonly unknown[], empty = "None recorded"): string {
  if (values.length === 0) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return `<ul>${values.map((value) => `<li>${text(value)}</li>`).join("")}</ul>`;
}

export function table(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  if (rows.length === 0) return '<p class="empty">No records available.</p>';
  const head = headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${text(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function section(title: string, content: string): string {
  return `<section><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

export function callout(content: string, tone: "default" | "warning" | "danger" = "default") {
  const className = tone === "default" ? "callout" : `callout ${tone}`;
  return `<div class="${className}" role="note">${content}</div>`;
}

/** Input required to render a static run report. */
export interface HtmlReportInput {
  readonly title: string;
  readonly status: string;
  readonly taskId: string;
  readonly provider: string;
  readonly role: string;
  readonly task: string;
  readonly output: string;
  readonly stderr: string;
  readonly metadataJson: string;
}

/** Renders a static HTML report with all user-controlled content escaped. */
export function renderHtmlReport(input: HtmlReportInput): string {
  const title = escapeHtml(input.title);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; padding: 32px; line-height: 1.5; }
    main { max-width: 960px; margin: 0 auto; }
    h1 { font-size: 28px; margin: 0 0 16px; }
    dl { display: grid; grid-template-columns: 140px 1fr; gap: 8px 16px; }
    pre { overflow: auto; padding: 16px; border: 1px solid #8884; border-radius: 6px; }
    section { margin-top: 24px; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <dl>
      <dt>Status</dt><dd>${escapeHtml(input.status)}</dd>
      <dt>Task ID</dt><dd>${escapeHtml(input.taskId)}</dd>
      <dt>Provider</dt><dd>${escapeHtml(input.provider)}</dd>
      <dt>Role</dt><dd>${escapeHtml(input.role)}</dd>
    </dl>
    <section>
      <h2>Task</h2>
      <pre>${escapeHtml(input.task)}</pre>
    </section>
    <section>
      <h2>Output</h2>
      <pre>${escapeHtml(input.output)}</pre>
    </section>
    <section>
      <h2>Stderr</h2>
      <pre>${escapeHtml(input.stderr)}</pre>
    </section>
    <section>
      <h2>Metadata</h2>
      <pre>${escapeHtml(input.metadataJson)}</pre>
    </section>
  </main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

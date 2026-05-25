import { describe, expect, test } from 'vitest';
import { renderHtmlReport } from '../../src/report/html-report.js';

describe('HTML report', () => {
  test('escapes task and output content', () => {
    const html = renderHtmlReport({
      title: 'Run <x>',
      status: 'success',
      taskId: 'task-1',
      provider: 'codex',
      role: 'reviewer',
      task: '<script>alert(1)</script>',
      output: '<b>ok</b>',
      stderr: '',
      metadataJson: '{}'
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;ok&lt;/b&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

import { describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseEvalOutput, parseEvalPack, renderEvalReport, scoreEvalResult } from '../eval/result.js';
import { renderRunReport, runEvalModes } from '../eval/run.js';

describe('RoleMux Eval Pack result contract', () => {
  test('parses and deterministically scores a complete result', () => {
    const pack = {
      version: 1 as const,
      title: 'Fixture pack',
      cases: [{
        id: 'provider-registry',
        question: 'Which providers are supported?',
        allowedPaths: ['src/providers/provider.ts'],
        expected: [['codex'], ['opencode']],
        evidencePaths: ['src/providers/provider.ts']
      }]
    };
    const result = parseEvalOutput(JSON.stringify({
      schemaVersion: 1,
      mode: 'single',
      summary: 'Registry checked.',
      findings: [{
        caseId: 'provider-registry',
        claim: 'The registry contains Codex and OpenCode.',
        evidence: ['src/providers/provider.ts:2'],
        confidence: 1
      }]
    }), 'single');

    expect(scoreEvalResult(pack, result)).toMatchObject({
      mode: 'single',
      caseCount: 1,
      answeredCount: 1,
      factScore: 1,
      evidenceScore: 1,
      coverageScore: 1,
      totalScore: 1
    });
  });

  test('rejects duplicate finding ids instead of silently choosing one', () => {
    const duplicate = JSON.stringify({
      schemaVersion: 1,
      mode: 'single',
      summary: '',
      findings: [
        { caseId: 'same', claim: 'first', evidence: [], confidence: 1 },
        { caseId: 'same', claim: 'second', evidence: [], confidence: 1 }
      ]
    });

    expect(() => parseEvalOutput(duplicate, 'single')).toThrow(/duplicate/i);
  });

  test('normalizes thousands separators when scoring numeric facts', () => {
    const pack = parseEvalPack({
      version: 1,
      title: 'Numeric pack',
      cases: [{
        id: 'byte-limit',
        question: 'Limit?',
        allowedPaths: ['src/file.ts'],
        expected: [['16384']],
        evidencePaths: ['src/file.ts']
      }]
    });
    const result = parseEvalOutput(JSON.stringify({
      schemaVersion: 1,
      mode: 'single',
      summary: '',
      findings: [{ caseId: 'byte-limit', claim: 'The limit is 16,384 bytes.', evidence: ['src/file.ts:1'], confidence: 1 }]
    }), 'single');

    expect(scoreEvalResult(pack, result).factScore).toBe(1);
  });

  test('validates versioned packs and rejects duplicate case ids', () => {
    const testCase = {
      id: 'same',
      question: 'Question?',
      allowedPaths: ['src/file.ts'],
      expected: [['fact']],
      evidencePaths: ['src/file.ts']
    };

    expect(() => parseEvalPack({ version: 1, title: 'Pack', cases: [testCase, testCase] })).toThrow(/duplicate/i);
  });

  test('renders a comparison table without inventing a winner', () => {
    const report = renderEvalReport('Pack', [
      { mode: 'single', caseCount: 20, answeredCount: 20, factScore: 0.8, evidenceScore: 0.7, coverageScore: 1, totalScore: 0.8 },
      { mode: 'structured', caseCount: 20, answeredCount: 19, factScore: 0.9, evidenceScore: 0.8, coverageScore: 0.95, totalScore: 0.885 }
    ]);

    expect(report).toContain('| structured | 19/20 | 90.0% | 80.0% | 95.0% | 88.5% |');
    expect(report).not.toContain('winner');
  });

  test('ships twenty-six v2 repository cases covering evidence workflow capabilities', async () => {
    const pack = parseEvalPack(JSON.parse(await readFile('eval/cases.json', 'utf8')));

    expect(pack.version).toBe(2);
    expect(pack.cases).toHaveLength(26);
    expect(new Set(pack.cases.map(testCase => testCase.id)).size).toBe(26);
    expect(pack.cases.map(testCase => testCase.id)).toEqual(expect.arrayContaining([
      'result-contract',
      'provenance-contract',
      'execution-budget',
      'structured-discussion',
      'verification-manifest',
      'capability-routing'
    ]));
  });

  test('runs the three comparison modes with a structured counter-review in ten bounded calls', async () => {
    const pack = parseEvalPack(JSON.parse(await readFile('eval/cases.json', 'utf8')));
    const calls: Array<{ provider: string; role: string; task: string }> = [];
    const runs = await runEvalModes({
      pack,
      workdir: process.cwd(),
      providers: ['codex', 'claude', 'grok'],
      execute: async input => {
        calls.push(input);
        const mode = input.task.includes('"structured"')
          ? 'structured'
          : input.task.includes('"unstructured"')
            ? 'unstructured'
            : 'single';
        return {
          provider: input.provider,
          role: input.role,
          status: 'success',
          output: JSON.stringify({ schemaVersion: 1, mode, summary: '', findings: [] }),
          stderr: '',
          durationMs: 1
        };
      }
    });

    expect(calls).toHaveLength(10);
    expect(runs.map(run => run.mode)).toEqual(['single', 'unstructured', 'structured']);
    expect(calls.filter(call => call.task.includes('Do not read other candidate outputs'))).toHaveLength(7);
    expect(calls.filter(call => call.task.includes('Challenge the anonymous candidate'))).toHaveLength(1);
  });

  test('reports failed candidate calls instead of only the successful final synthesis', () => {
    const score = { mode: 'structured' as const, caseCount: 20, answeredCount: 20, factScore: 1, evidenceScore: 1, coverageScore: 1, totalScore: 1 };
    const report = renderRunReport('Pack', 'abc123', ['codex', 'claude', 'grok'], false, [{
      mode: 'structured',
      finalStatus: 'success',
      invocationCount: 2,
      durationMs: 12,
      invocations: [
        { provider: 'claude', role: 'reviewer', status: 'failed', durationMs: 5 },
        { provider: 'codex', role: 'summarizer', status: 'success', durationMs: 7 }
      ],
      score
    }]);

    expect(report).toContain('| structured | claude | reviewer | failed | 5 ms |');
    expect(report).toContain('cumulative provider duration');
  });
});

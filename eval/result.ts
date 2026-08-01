import { z } from 'zod';

export const evalModes = ['single', 'unstructured', 'structured'] as const;
export type EvalMode = typeof evalModes[number];

export interface EvalCase {
  readonly id: string;
  readonly question: string;
  readonly allowedPaths: readonly string[];
  readonly expected: readonly (readonly string[])[];
  readonly evidencePaths: readonly string[];
}

export interface EvalPack {
  readonly version: 1 | 2;
  readonly title: string;
  readonly cases: readonly EvalCase[];
}

export interface EvalFinding {
  readonly caseId: string;
  readonly claim: string;
  readonly evidence: readonly string[];
  readonly confidence: number;
}

export interface EvalResult {
  readonly schemaVersion: 1;
  readonly mode: EvalMode;
  readonly summary: string;
  readonly findings: readonly EvalFinding[];
}

export interface EvalScore {
  readonly mode: EvalMode;
  readonly caseCount: number;
  readonly answeredCount: number;
  readonly factScore: number;
  readonly evidenceScore: number;
  readonly coverageScore: number;
  readonly totalScore: number;
}

const evalResultSchema = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(evalModes),
  summary: z.string(),
  findings: z.array(z.object({
    caseId: z.string().min(1),
    claim: z.string(),
    evidence: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }))
}).superRefine((result, context) => {
  const seen = new Set<string>();
  for (const finding of result.findings) {
    if (seen.has(finding.caseId)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate finding id: ${finding.caseId}`,
        path: ['findings']
      });
    }
    seen.add(finding.caseId);
  }
});

const evalPackSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  title: z.string().min(1),
  cases: z.array(z.object({
    id: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
    question: z.string().min(1),
    allowedPaths: z.array(z.string().min(1)).min(1),
    expected: z.array(z.array(z.string().min(1)).min(1)).min(1),
    evidencePaths: z.array(z.string().min(1)).min(1)
  })).min(1)
}).superRefine((pack, context) => {
  const seen = new Set<string>();
  for (const testCase of pack.cases) {
    if (seen.has(testCase.id)) {
      context.addIssue({ code: 'custom', message: `Duplicate case id: ${testCase.id}`, path: ['cases'] });
    }
    seen.add(testCase.id);
  }
});

/** Parses a versioned Eval Pack definition. */
export function parseEvalPack(value: unknown): EvalPack {
  return evalPackSchema.parse(value) as EvalPack;
}

/** Parses one provider answer into the stable Eval Pack result contract. */
export function parseEvalOutput(output: string, expectedMode: EvalMode): EvalResult {
  const parsed = evalResultSchema.parse(JSON.parse(stripJsonFence(output))) as EvalResult;
  if (parsed.mode !== expectedMode) {
    throw new Error(`Eval result mode mismatch: expected ${expectedMode}, received ${parsed.mode}`);
  }
  return parsed;
}

/** Scores an Eval Pack result against pre-recorded facts without an LLM judge. */
export function scoreEvalResult(pack: EvalPack, result: EvalResult): EvalScore {
  const findings = new Map(result.findings.map(finding => [finding.caseId, finding]));
  let answeredCount = 0;
  let matchedFacts = 0;
  let totalFacts = 0;
  let matchedEvidence = 0;

  for (const testCase of pack.cases) {
    const finding = findings.get(testCase.id);
    totalFacts += testCase.expected.length;
    if (finding === undefined) {
      continue;
    }
    answeredCount += 1;
    const normalizedClaim = normalizeFactText(finding.claim);
    matchedFacts += testCase.expected.filter(group => group.some(value => normalizedClaim.includes(normalizeFactText(value)))).length;
    if (finding.evidence.some(item => testCase.evidencePaths.some(path => normalizePath(item).includes(normalizePath(path))))) {
      matchedEvidence += 1;
    }
  }

  const caseCount = pack.cases.length;
  const factScore = ratio(matchedFacts, totalFacts);
  const evidenceScore = ratio(matchedEvidence, caseCount);
  const coverageScore = ratio(answeredCount, caseCount);
  return {
    mode: result.mode,
    caseCount,
    answeredCount,
    factScore,
    evidenceScore,
    coverageScore,
    totalScore: round(factScore * 0.7 + evidenceScore * 0.2 + coverageScore * 0.1)
  };
}

/** Renders deterministic score rows; interpretation remains a human decision. */
export function renderEvalReport(title: string, scores: readonly EvalScore[]): string {
  return [
    `# ${title}`,
    '',
    '| mode | answered | facts | evidence | coverage | total |',
    '|---|---:|---:|---:|---:|---:|',
    ...scores.map(score => [
      `| ${score.mode}`,
      `${score.answeredCount}/${score.caseCount}`,
      percent(score.factScore),
      percent(score.evidenceScore),
      percent(score.coverageScore),
      `${percent(score.totalScore)} |`
    ].join(' | ')),
    '',
    'Scores are deterministic measurements for this pack only; they are not a general provider ranking.',
    ''
  ].join('\n');
}

function stripJsonFence(output: string): string {
  const trimmed = output.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').toLowerCase();
}

function normalizeFactText(value: string): string {
  return value.toLowerCase().replace(/(\d),(?=\d)/g, '$1');
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

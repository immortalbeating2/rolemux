import { z } from 'zod';

const taskResultSchema = z.object({
  schemaVersion: z.literal(1),
  summary: z.string(),
  findings: z.array(z.object({
    id: z.string().min(1),
    severity: z.enum(['P0', 'P1', 'P2', 'P3', 'info']),
    claim: z.string().min(1),
    evidence: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    status: z.enum(['open', 'verified', 'rejected'])
  })),
  risks: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  verification: z.array(z.object({
    name: z.string().min(1),
    status: z.enum(['passed', 'failed', 'not-run']),
    exitCode: z.number().int().nullable(),
    output: z.string().optional()
  }))
}).superRefine((result, context) => {
  const seen = new Set<string>();
  for (const finding of result.findings) {
    if (seen.has(finding.id)) {
      context.addIssue({ code: 'custom', message: `Duplicate finding id: ${finding.id}`, path: ['findings'] });
    }
    seen.add(finding.id);
  }
});

/** Stable structured result persisted as result.json. */
export type TaskResult = z.infer<typeof taskResultSchema>;

/** Output instructions appended only for explicitly structured runs. */
export const taskResultOutputInstructions = [
  'Return only one JSON object without Markdown fences.',
  'Use this exact contract:',
  '{"schemaVersion":1,"summary":"...","findings":[{"id":"...","severity":"P0|P1|P2|P3|info","claim":"...","evidence":["path:line"],"confidence":0.0,"status":"open|verified|rejected"}],"risks":[],"recommendedActions":[],"verification":[]}'
].join('\n');

/** Parses a provider answer into the stable result contract. */
export function parseTaskResult(output: string): TaskResult {
  const trimmed = output.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return taskResultSchema.parse(JSON.parse(fenced?.[1] ?? trimmed));
}

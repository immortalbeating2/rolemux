#!/usr/bin/env node

import { appendFileSync } from 'node:fs';

const [label] = process.argv.slice(2);
let stdin = '';
for await (const chunk of process.stdin) {
  stdin += chunk;
}
const prompt = stdin.trim() || process.argv.at(-1) || '';
const stage = prompt.includes('Independent candidate analysis')
  ? 'candidate'
  : prompt.includes('Counter-review evidence') && prompt.includes('# Output Requirements')
    ? 'synthesis'
    : 'counter';
appendFileSync(process.env.ROLEMUX_WORKFLOW_STAGE_LOG, `${JSON.stringify({ label, stage, prompt })}\n`, 'utf8');

if (stage === process.env.ROLEMUX_WORKFLOW_FAIL_STAGE) {
  console.error(`${stage} failed by fixture request`);
  process.exit(1);
}

if (stage !== 'synthesis') {
  console.log(`${stage.toUpperCase()}_OUTPUT`);
  process.exit(0);
}

console.log(JSON.stringify({
  schemaVersion: 1,
  summary: 'Structured discussion completed.',
  findings: [],
  risks: [],
  recommendedActions: [],
  verification: []
}));

#!/usr/bin/env node

console.log(JSON.stringify({
  schemaVersion: 1,
  summary: 'Structured result fixture.',
  findings: [{
    id: 'finding-1',
    severity: 'P1',
    claim: 'A verified fixture finding.',
    evidence: ['src/example.ts:1'],
    confidence: 1,
    status: 'verified'
  }],
  risks: [],
  recommendedActions: ['Keep the contract stable.'],
  verification: []
}));

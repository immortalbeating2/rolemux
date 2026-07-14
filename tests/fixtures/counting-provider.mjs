#!/usr/bin/env node

import { appendFileSync } from 'node:fs';

const [provider, status] = process.argv.slice(2);
const logPath = process.env.ROLEMUX_COUNTING_PROVIDER_LOG;
if (logPath === undefined || provider === undefined || status === undefined) {
  throw new Error('Counting provider configuration is incomplete.');
}

appendFileSync(logPath, `${provider}\n`, 'utf8');
if (status === 'failed') {
  console.error(`${provider} failed`);
  process.exit(1);
}

console.log(`${provider} succeeded`);

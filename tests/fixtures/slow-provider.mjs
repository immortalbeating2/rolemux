#!/usr/bin/env node

import { appendFileSync } from 'node:fs';

const logPath = process.env.ROLEMUX_SLOW_PROVIDER_LOG;
const delayMs = Number.parseInt(process.env.ROLEMUX_SLOW_PROVIDER_DELAY_MS ?? '150', 10);

if (logPath === undefined || logPath.trim().length === 0) {
  throw new Error('ROLEMUX_SLOW_PROVIDER_LOG is required.');
}

function writeEvent(event) {
  appendFileSync(logPath, `${JSON.stringify({
    event,
    pid: process.pid,
    time: Date.now()
  })}\n`, 'utf8');
}

writeEvent('start');
await new Promise(resolve => setTimeout(resolve, delayMs));
writeEvent('end');

console.log('SLOW_PROVIDER_OUTPUT');

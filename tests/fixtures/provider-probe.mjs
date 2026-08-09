#!/usr/bin/env node

const mode = process.env.ROLEMUX_PROBE_FIXTURE_MODE ?? 'passed';

if (mode === 'passed') {
  console.log('ROLEMUX_PROBE_OK');
} else if (mode === 'auth') {
  console.error('Not logged in. Please run login.');
  process.exitCode = 1;
} else if (mode === 'network') {
  console.error('Network connection failed: ECONNREFUSED');
  process.exitCode = 1;
} else if (mode === 'output') {
  console.log('unexpected output');
} else if (mode === 'timeout') {
  await new Promise(resolve => setTimeout(resolve, 500));
}

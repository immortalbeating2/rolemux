process.stdout.write(`${JSON.stringify({
  event: 'step_update',
  step_update: { state: 'FAILED', step_type: 'permission', error: 'permission denied by headless provider' }
})}\n`);
process.exitCode = 1;

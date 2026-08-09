const events = [
  { type: 'system', subtype: 'task_started', task_id: 'child-1', description: 'Review API', subagent_type: 'reviewer' },
  { type: 'system', subtype: 'task_notification', task_id: 'child-1', status: 'completed', summary: 'API_OK' },
  { type: 'result', subtype: 'success', result: 'PARENT_OK' }
];

for (const event of events) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

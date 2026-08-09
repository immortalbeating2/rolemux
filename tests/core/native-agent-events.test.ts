import { describe, expect, test } from 'vitest';
import { parseNativeAgentEvent, parseNativeAgentEvents, parseNativeAgentOutput } from '../../src/core/native-agent-events.js';

describe('native agent events', () => {
  test('parses Claude child lifecycle and final output', () => {
    const started = JSON.stringify({
      type: 'system',
      subtype: 'task_started',
      task_id: 'child-1',
      tool_use_id: 'tool-1',
      description: 'Review API',
      subagent_type: 'reviewer'
    });
    const completed = JSON.stringify({
      type: 'system',
      subtype: 'task_notification',
      task_id: 'child-1',
      status: 'completed',
      summary: 'API_OK'
    });
    const result = JSON.stringify({ type: 'result', subtype: 'success', result: 'PARENT_OK' });

    expect(parseNativeAgentEvent('claude', started)).toMatchObject({
      id: 'child-1',
      type: 'reviewer',
      title: 'Review API',
      status: 'running'
    });
    expect(parseNativeAgentEvent('claude', completed)).toMatchObject({
      id: 'child-1',
      status: 'success',
      summary: 'API_OK'
    });
    expect(parseNativeAgentOutput('claude', `${started}\n${completed}\n${result}\n`)).toBe('PARENT_OK');
  });

  test('ignores malformed and unverified provider events', () => {
    expect(parseNativeAgentEvent('claude', 'not-json')).toBeUndefined();
    expect(parseNativeAgentEvent('grok', '{"type":"spawn_subagent"}')).toBeUndefined();
  });

  test('parses Agy subagent lifecycle and final response', () => {
    const active = JSON.stringify({
      event: 'step_update',
      step_update: {
        state: 'ACTIVE',
        step_type: 'subagent',
        subagent_info: {
          subagents: [{
            role: 'Child Task Runner',
            initial_prompt: 'Return CHILD_OK',
            conversation_id: 'child-2'
          }]
        }
      }
    });
    const done = active.replace('ACTIVE', 'DONE');
    const result = JSON.stringify({
      event: 'result',
      result: { status: 'SUCCESS', response: 'PARENT_OK\n' }
    });

    expect(parseNativeAgentEvent('agy', active)).toMatchObject({
      id: 'child-2',
      type: 'Child Task Runner',
      title: 'Return CHILD_OK',
      status: 'running'
    });
    expect(parseNativeAgentEvent('agy', done)).toMatchObject({ id: 'child-2', status: 'success' });
    expect(parseNativeAgentOutput('agy', `${active}\n${done}\n${result}\n`)).toBe('PARENT_OK\n');
  });

  test('keeps every Agy child reported in one lifecycle event', () => {
    const line = JSON.stringify({
      event: 'step_update',
      step_update: {
        state: 'ACTIVE',
        step_type: 'subagent',
        subagent_info: {
          subagents: [
            { role: 'Reviewer', initial_prompt: 'Review API', conversation_id: 'child-a' },
            { role: 'Tester', initial_prompt: 'Test API', conversation_id: 'child-b' }
          ]
        }
      }
    });

    expect(parseNativeAgentEvents('agy', line).map(event => event.id)).toEqual(['child-a', 'child-b']);
  });
});

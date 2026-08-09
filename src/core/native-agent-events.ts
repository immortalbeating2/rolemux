import type { ProviderName } from '../providers/index.js';

export type NativeAgentStatus = 'running' | 'success' | 'failed';

/** Stable child activity emitted by a provider's machine-readable stream. */
export interface NativeAgentEvent {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly status: NativeAgentStatus;
  readonly summary?: string | undefined;
}

/** Parses only provider event contracts verified by a real CLI run. */
export function parseNativeAgentEvent(provider: ProviderName, line: string): NativeAgentEvent | undefined {
  return parseNativeAgentEvents(provider, line)[0];
}

/** Parses every child contained in one verified provider lifecycle event. */
export function parseNativeAgentEvents(provider: ProviderName, line: string): readonly NativeAgentEvent[] {
  if (provider === 'agy') {
    return parseAgyEvents(line);
  }
  if (provider !== 'claude') {
    return [];
  }
  const event = parseClaudeEvent(line);
  return event === undefined ? [] : [event];
}

function parseClaudeEvent(line: string): NativeAgentEvent | undefined {
  const event = parseObject(line);
  if (event?.type !== 'system' || typeof event.task_id !== 'string') {
    return undefined;
  }
  if (event.subtype === 'task_started') {
    return {
      id: event.task_id,
      type: stringValue(event.subagent_type) ?? 'agent',
      title: stringValue(event.description) ?? event.task_id,
      status: 'running'
    };
  }
  if (event.subtype !== 'task_notification') {
    return undefined;
  }
  const rawStatus = stringValue(event.status);
  return {
    id: event.task_id,
    type: stringValue(event.subagent_type) ?? 'agent',
    title: stringValue(event.description) ?? event.task_id,
    status: rawStatus === 'completed' ? 'success' : 'failed',
    ...(stringValue(event.summary) === undefined ? {} : { summary: stringValue(event.summary) })
  };
}

/** Extracts the final provider answer from a verified machine event stream. */
export function parseNativeAgentOutput(provider: ProviderName, stdout: string): string {
  if (provider === 'agy') {
    let result = '';
    for (const line of stdout.split(/\r?\n/)) {
      const event = parseObject(line);
      const value = objectValue(event?.result);
      if (event?.event === 'result' && typeof value?.response === 'string') {
        result = value.response;
      }
    }
    return result;
  }
  if (provider !== 'claude') {
    return stdout;
  }
  let result = '';
  for (const line of stdout.split(/\r?\n/)) {
    const event = parseObject(line);
    if (event?.type === 'result' && typeof event.result === 'string') {
      result = event.result;
    }
  }
  return result;
}

function parseAgyEvents(line: string): NativeAgentEvent[] {
  const event = parseObject(line);
  const update = objectValue(event?.step_update);
  const info = objectValue(update?.subagent_info);
  const children = Array.isArray(info?.subagents) ? info.subagents : [];
  const state = stringValue(update?.state);
  if (event?.event !== 'step_update' || update?.step_type !== 'subagent'
    || (state !== 'ACTIVE' && state !== 'DONE' && state !== 'FAILED')) {
    return [];
  }
  return children.flatMap(value => {
    const child = objectValue(value);
    const id = stringValue(child?.conversation_id);
    return child === undefined || id === undefined
      ? []
      : [{
          id,
          type: stringValue(child.role) ?? stringValue(child.type_name) ?? 'agent',
          title: stringValue(child.initial_prompt) ?? id,
          status: state === 'ACTIVE' ? 'running' as const : state === 'DONE' ? 'success' as const : 'failed' as const
        }];
  });
}

function parseObject(line: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

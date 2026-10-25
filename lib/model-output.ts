import { parseModelReply, type ModelReply } from './chat-contract';

/** A message-only JSON answer has the same read-only meaning as plain text. */
export function parseProviderReply(value: unknown): ModelReply {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const reply = value as Record<string, unknown>;
    if (!Object.hasOwn(reply, 'actions') && Object.hasOwn(reply, 'message') &&
      Object.keys(reply).every((key) => ['message', 'evidenceIds'].includes(key))) {
      return parseModelReply({ ...reply, actions: [] });
    }
  }
  return parseModelReply(value);
}

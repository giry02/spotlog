import type { Journey } from '../data';
import { ownShareableJournals } from './memberRecords.ts';

/** Ephemeral consent only. Never persist, log or send this local version string to another service. */
export interface MemberJournalConfirmation { sourceId: string; sourceVersion: string; scope: string }
function sourceVersion(source: Journey): string | null {
  if (!ownShareableJournals([source]).length) return null;
  try { return JSON.stringify(source); } catch { return null; }
}
export function captureMemberJournalConfirmation(source: Journey, scope: string): MemberJournalConfirmation | null {
  const version = sourceVersion(source);
  return version && scope.trim() ? { sourceId: source.id, sourceVersion: version, scope } : null;
}
export function isMemberJournalConfirmationCurrent(confirmation: MemberJournalConfirmation | null, source: Journey | undefined, scope: string): boolean {
  return Boolean(confirmation && source && confirmation.sourceId === source.id && confirmation.scope === scope && confirmation.sourceVersion === sourceVersion(source));
}

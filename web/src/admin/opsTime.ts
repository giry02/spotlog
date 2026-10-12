import type { ExposureEntry } from './opsTypes';

/** datetime-local cannot display an ISO string with Z or an offset. Keep the instant in storage. */
export function publicationTimeInput(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function publicationTimeStored(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
}

/** Only the next enabled period boundary needs a timer; no recurring polling. */
export function exposureBoundaryDelay(entries: ExposureEntry[], now: number): number | null {
  const next = entries.flatMap(entry => entry.enabled ? [entry.startsAt, entry.endsAt] : [])
    .map(value => Date.parse(value)).filter(value => Number.isFinite(value) && value > now);
  return next.length ? Math.min(Math.max(1, Math.min(...next) - now + 10), 2_147_483_647) : null;
}

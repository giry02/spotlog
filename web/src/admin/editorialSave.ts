const unchanged = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function plainObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function carryLaterInput(before: unknown, current: unknown, saved: unknown): unknown {
  if (unchanged(before, current)) return structuredClone(saved);
  if (!plainObject(before) || !plainObject(current) || !plainObject(saved)) return structuredClone(current);
  const result = structuredClone(saved);
  for (const key of new Set([...Object.keys(before), ...Object.keys(current)])) {
    if (unchanged(before[key], current[key])) continue;
    if (!(key in current)) delete result[key];
    else result[key] = carryLaterInput(before[key], current[key], saved[key]);
  }
  return result;
}

/** Adopt the accepted revision while retaining only input changed after submission. */
export function mergeSavedEditor<T extends { revision: number }>(before: T, current: T, saved: T): { value: T; hasLaterInput: boolean } {
  const value = carryLaterInput(before, current, saved) as T;
  value.revision = saved.revision;
  return { value, hasLaterInput: !unchanged(before, current) };
}

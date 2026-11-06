import type { AdminState } from './types';
import busanBusinesses from '../busanBusinessRecords.json' with { type: 'json' };
import busanLandmarks from '../busanLandmarkRecords.json' with { type: 'json' };

export const MASTER_MIGRATION = 'shared-catalog-masters-v2';
export const CATALOG_ADDITIONS_MIGRATION = 'shared-catalog-businesses-20261006';
export const BUSAN_CATALOG_ADDITIONS_MIGRATION = 'shared-catalog-busan-20261012';
const busanAdditionIds = new Set([...busanBusinesses, ...busanLandmarks].map(place => place.id));
/** Merge once into dedicated admin storage; never rebuild existing drafts or published content. */
export function migrateAdminMasters(source: AdminState, baseline: AdminState): AdminState {
  const state = structuredClone(source), existing = new Map(state.places.map(place => [place.placeId,place]));
  const deleted = new Set(state.audit.filter(event => event.action === 'place.delete').map(event => event.targetId));
  if (!source.migrations?.includes(MASTER_MIGRATION)) {
  for (const seed of baseline.places) {
    const saved = existing.get(seed.placeId);
    if (!saved) { if (!deleted.has(seed.placeId)) state.places.push(structuredClone(seed)); continue; }
    const before = JSON.stringify(saved.draft);
    for (const key of ['regionId','visitDuration','hook','creatorLabel','provenance'] as const) {
      if (saved.draft[key] === undefined) Object.assign(saved.draft,{[key]:structuredClone(seed.draft[key])});
    }
    // The previous importer created source records with no media. Only untouched
    // source baselines can be hydrated; a saved deletion or a published edit wins.
    if (!saved.published && saved.revision === 1 && saved.draft.media.length === 0 && seed.draft.provenance?.origin === 'CATALOG' && !state.audit.some(event => event.targetId === saved.placeId)) saved.draft.media = structuredClone(seed.draft.media);
    if (!saved.meta) saved.meta = structuredClone(seed.meta);
    if (before !== JSON.stringify(saved.draft)) saved.revision++;
  }
  const regions = new Map((state.regions ?? []).map(region => [region.regionId,region]));
  for (const region of baseline.regions ?? []) if (!regions.has(region.regionId)) regions.set(region.regionId,structuredClone(region));
  state.regions = [...regions.values()];
  state.migrations = [...(state.migrations ?? []),MASTER_MIGRATION]; state.revision++;
  }
  // Add the new regional catalog once, including browsers that ran the older migration.
  // Never overwrite an edit, restore a deleted record, or grant new usage rights.
  if (!state.migrations?.includes(CATALOG_ADDITIONS_MIGRATION)) {
    const ids = new Set(state.places.map(place => place.placeId));
    for (const seed of baseline.places) {
      if (seed.draft.provenance?.origin === 'CATALOG' && !ids.has(seed.placeId) && !deleted.has(seed.placeId)) {
        state.places.push(structuredClone(seed)); ids.add(seed.placeId);
      }
    }
    state.migrations = [...(state.migrations ?? []), CATALOG_ADDITIONS_MIGRATION];
    state.revision++;
  }
  // Browsers that completed both older imports still need this specific batch.
  // Existing edits, public versions and revoked/deleted records always win.
  if (!state.migrations?.includes(BUSAN_CATALOG_ADDITIONS_MIGRATION)) {
    const ids = new Set(state.places.map(place => place.placeId));
    const blocked = new Set(state.audit.filter(event => ['place.delete','place.revoke','place.inactivate','place.media.revoke'].includes(event.action)).map(event => event.targetId));
    for (const seed of baseline.places) {
      if (!busanAdditionIds.has(seed.placeId) || seed.draft.provenance?.origin !== 'CATALOG' || ids.has(seed.placeId) || blocked.has(seed.placeId)) continue;
      const draft = structuredClone(seed);
      draft.state = 'DRAFT'; delete draft.published;
      draft.draft.rights = { display: false, store: false, modify: false, ai: false };
      draft.draft.ai.allowed = false;
      for (const media of draft.draft.media) media.rights = { display: false, store: false, modify: false, ai: false };
      if (draft.meta) draft.meta.reviewStatus = 'NEEDS_CHECK';
      state.places.push(draft); ids.add(draft.placeId);
    }
    state.migrations = [...(state.migrations ?? []), BUSAN_CATALOG_ADDITIONS_MIGRATION];
    state.revision++;
  }
  return state;
}

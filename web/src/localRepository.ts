/** Versioned, local-only storage. Legacy records are never deleted by migration. */
export interface SavedCollection {
  id: string;
  name: string;
  placeIds: string[];
  linkedJourneyId?: string;
}

export interface SavedLibrary {
  collections: SavedCollection[];
  notes: Record<string, string>;
}

export const LIBRARY_KEY = 'spotlog.saved-library.v1';
export const REPOSITORY_KEY = 'spotlog.local.repository.v2';
export const MIGRATION_BACKUP_KEY = 'spotlog.local.before-migration.v2';
export const RESTORE_BACKUP_KEY = 'spotlog.local.before-restore.v2';
export const emptySavedLibrary = (): SavedLibrary => ({ collections: [], notes: {} });

const knownKeys = new Set([
  'spotlog.web.saved.v3',
  'spotlog.web.journeys.v4',
  'spotlog.web.profile.v1',
  'spotlog.web.comments.v1',
  'spotlog.web.cheers.v1',
  'spotlog.web.notifications.v1',
  LIBRARY_KEY,
]);

type Records = Record<string, string>;
interface Envelope {
  schemaVersion: 2;
  updatedAt: string;
  records: Records;
}
interface Backup {
  format: 'spotlog-local-backup';
  version: 1;
  exportedAt: string;
  records: Records;
  /** A corrupt envelope is retained for manual recovery, never interpreted as app state. */
  recoverySource?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const optionalString = (value: unknown) => value === undefined || isString(value);
const hasStrings = (value: Record<string, unknown>, keys: string[]) => keys.every((key) => isString(value[key]));

function isPlace(value: unknown): boolean {
  if (!isObject(value) || !hasStrings(value, ['id', 'name', 'area', 'address', 'image', 'description', 'note', 'duration'])) return false;
  if (!['LANDMARK', 'STAY', 'FOOD', 'CAFE', 'SHOP'].includes(String(value.kind))) return false;
  // User-entered places may have no coordinates: JSON encodes their NaN as null.
  return (value.lat === null || isFiniteNumber(value.lat)) && (value.lng === null || isFiniteNumber(value.lng));
}

function isStoryBlock(value: unknown): boolean {
  if (!isObject(value) || !isString(value.id) || !['TEXT', 'IMAGE', 'PLACE'].includes(String(value.type))) return false;
  return ['heading', 'body', 'image', 'caption', 'placeId'].every((key) => optionalString(value[key]));
}

function isJourney(value: unknown): boolean {
  if (!isObject(value) || !hasStrings(value, ['id', 'title', 'region', 'dateRange', 'duration', 'cover', 'summary', 'story', 'author'])) return false;
  if (!['PLANNING', 'TRAVELING', 'PUBLISHED'].includes(String(value.status)) || !['PUBLIC', 'PRIVATE'].includes(String(value.visibility))) return false;
  if (typeof value.isMine !== 'boolean' || !isFiniteNumber(value.saves) || !isStringArray(value.tags) || !Array.isArray(value.days)) return false;
  return value.days.every((day) => isObject(day)
    && Number.isInteger(day.day) && Number(day.day) > 0
    && hasStrings(day, ['date', 'title', 'story'])
    && Array.isArray(day.places) && day.places.every(isPlace)
    && Array.isArray(day.blocks) && day.blocks.every(isStoryBlock));
}

export function isSavedLibrary(value: unknown): value is SavedLibrary {
  if (!isObject(value) || !Array.isArray(value.collections) || !isObject(value.notes)) return false;
  const ids = new Set<string>();
  return value.collections.every((collection) => {
    if (!isObject(collection) || !isString(collection.id) || !collection.id || ids.has(collection.id)) return false;
    if (!isString(collection.name) || !collection.name.trim() || !isStringArray(collection.placeIds)) return false;
    if (!optionalString(collection.linkedJourneyId)) return false;
    ids.add(collection.id);
    return true;
  }) && Object.values(value.notes).every(isString);
}

function validateValue(key: string, value: unknown): boolean {
  switch (key) {
    case 'spotlog.web.saved.v3': return isStringArray(value);
    case 'spotlog.web.journeys.v4': return Array.isArray(value) && value.every(isJourney);
    case LIBRARY_KEY: return isSavedLibrary(value);
    case 'spotlog.web.profile.v1':
      return isObject(value) && hasStrings(value, ['displayName', 'bio']) && optionalString(value.avatar);
    case 'spotlog.web.comments.v1':
      return Array.isArray(value) && value.every((comment) => isObject(comment)
        && hasStrings(comment, ['id', 'journeyId', 'author', 'body', 'createdAt'])
        && optionalString(comment.avatar) && isFiniteNumber(comment.authorCopies));
    case 'spotlog.web.cheers.v1':
      return isObject(value) && Object.values(value).every((cheers) => isObject(cheers)
        && ['LOVE', 'BEST', 'HELPFUL'].every((key) => isFiniteNumber(cheers[key]) && Number(cheers[key]) >= 0)
        && (cheers.selected === undefined || ['LOVE', 'BEST', 'HELPFUL'].includes(String(cheers.selected))));
    case 'spotlog.web.notifications.v1':
      return isObject(value) && typeof value.enabled === 'boolean' && isFiniteNumber(value.viewMilestone) && value.viewMilestone > 0;
    default: return false;
  }
}

function validRecord(key: string, raw: string): boolean {
  try { return knownKeys.has(key) && validateValue(key, JSON.parse(raw)); } catch { return false; }
}

function validRecords(value: unknown): value is Records {
  return isObject(value) && Object.entries(value).every(([key, raw]) => isString(raw) && validRecord(key, raw));
}

function parseEnvelope(raw: string): Envelope | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isObject(value) && value.schemaVersion === 2 && isString(value.updatedAt) && validRecords(value.records)
      ? value as unknown as Envelope : null;
  } catch { return null; }
}

const makeBackup = (records: Records, recoverySource?: string): Backup => ({
  format: 'spotlog-local-backup', version: 1, exportedAt: new Date().toISOString(), records,
  ...(recoverySource ? { recoverySource } : {}),
});

export interface LocalRepository {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  setItems(entries: Record<string, string>): boolean;
  getIssue(): string | null;
  exportBackup(): string;
  restoreBackup(json: string): boolean;
}

export function createLocalRepository(storage: Storage): LocalRepository {
  let records: Records = {};
  let originalRecords: Records = {};
  let issue: string | null = null;
  let blocked = false;
  let recoverySource: string | undefined;
  let initialized = false;

  const storageFailure = (error: unknown) => {
    const name = isObject(error) && isString(error.name) ? error.name : '';
    issue = name === 'QuotaExceededError'
      ? '기기 저장 공간이 부족해 변경 사항을 저장하지 못했습니다. 기존 기록은 유지됩니다. 백업을 내려받아 주세요.'
      : '기기 저장소에 접근할 수 없어 변경 사항을 저장하지 못했습니다. 브라우저의 저장소 설정을 확인해 주세요.';
  };

  const encode = (next: Records): string => JSON.stringify({ schemaVersion: 2, updatedAt: new Date().toISOString(), records: next } satisfies Envelope);

  const initialize = () => {
    if (initialized) return;
    initialized = true;
    try {
      const existing = storage.getItem(REPOSITORY_KEY);
      for (const key of knownKeys) {
        const raw = storage.getItem(key);
        if (raw !== null) originalRecords[key] = raw;
      }
      if (existing !== null) {
        const envelope = parseEnvelope(existing);
        if (envelope) {
          records = envelope.records;
          return;
        }
        recoverySource = existing;
        blocked = true;
        issue = '저장 데이터 형식을 확인할 수 없습니다. 원본 보호를 위해 저장을 중단했습니다. 백업을 내려받거나 정상 백업을 복원해 주세요.';
        return;
      }
      const invalidKeys = Object.keys(originalRecords).filter((key) => !validRecord(key, originalRecords[key]));
      records = Object.fromEntries(Object.entries(originalRecords).filter(([key, raw]) => validRecord(key, raw)));
      if (invalidKeys.length) {
        blocked = true;
        issue = '기존 기록 일부를 읽을 수 없습니다. 원본을 덮어쓰지 않도록 저장을 중단했습니다. 백업을 내려받거나 정상 백업을 복원해 주세요.';
        return;
      }
      // One raw snapshot must succeed before the authoritative schema changes.
      if (storage.getItem(MIGRATION_BACKUP_KEY) === null) storage.setItem(MIGRATION_BACKUP_KEY, JSON.stringify(makeBackup(originalRecords)));
      storage.setItem(REPOSITORY_KEY, encode(records));
    } catch (error) {
      blocked = true;
      storageFailure(error);
    }
  };

  initialize();

  const setItems = (entries: Record<string, string>): boolean => {
      if (blocked) return false;
      if (!validRecords(entries)) {
        issue = '변경 내용의 저장 형식이 올바르지 않아 저장하지 않았습니다. 기존 기록은 유지됩니다.';
        return false;
      }
      try {
        // Merge the latest envelope to avoid overwriting unrelated changes from another tab.
        const latestRaw = storage.getItem(REPOSITORY_KEY);
        const latest = latestRaw === null ? null : parseEnvelope(latestRaw);
        if (!latest) {
          blocked = true;
          recoverySource = latestRaw ?? undefined;
          issue = '다른 화면에서 저장 데이터가 변경되었습니다. 기록 보호를 위해 새로고침 후 다시 시도해 주세요.';
          return false;
        }
        const next = { ...latest.records, ...entries };
        if (Object.entries(entries).some(([key, value]) => latest.records[key] !== value)) {
          // Related records are committed together, never as partial multi-key updates.
          storage.setItem(REPOSITORY_KEY, encode(next));
        }
        records = next;
        issue = null;
        return true;
      } catch (error) {
        storageFailure(error);
        return false;
      }
  };

  return {
    getItem(key) {
      return knownKeys.has(key) && Object.hasOwn(records, key) ? records[key] : null;
    },
    setItem(key, value) { return setItems({ [key]: value }); },
    setItems,
    getIssue() { return issue; },
    exportBackup() {
      if (!blocked) {
        try {
          const latestRaw = storage.getItem(REPOSITORY_KEY);
          const latest = latestRaw ? parseEnvelope(latestRaw) : null;
          if (latest) records = latest.records;
          else if (latestRaw !== null) {
            blocked = true;
            recoverySource = latestRaw;
            issue = '저장 데이터 형식을 확인할 수 없습니다. 내려받은 백업에 원본을 보관했습니다.';
          }
        } catch (error) { storageFailure(error); }
      }
      // Preserve raw malformed legacy entries in recovery downloads, not just readable state.
      return JSON.stringify(makeBackup(blocked ? { ...originalRecords, ...records } : records, recoverySource), null, 2);
    },
    restoreBackup(json) {
      let backup: Backup;
      try {
        const candidate: unknown = JSON.parse(json);
        if (!isObject(candidate) || candidate.format !== 'spotlog-local-backup' || candidate.version !== 1
          || !isString(candidate.exportedAt) || !validRecords(candidate.records) || candidate.recoverySource !== undefined) {
          issue = '정상적인 Spotlog 백업 파일이 아닙니다. 현재 기록은 변경하지 않았습니다.';
          return false;
        }
        backup = candidate as unknown as Backup;
      } catch {
        issue = '백업 파일을 읽을 수 없습니다. 현재 기록은 변경하지 않았습니다.';
        return false;
      }
      try {
        const existing = storage.getItem(REPOSITORY_KEY);
        const current = existing ? parseEnvelope(existing) : null;
        const beforeRestore = makeBackup(current?.records ?? { ...originalRecords, ...records }, existing && !current ? existing : recoverySource);
        storage.setItem(RESTORE_BACKUP_KEY, JSON.stringify(beforeRestore));
        storage.setItem(REPOSITORY_KEY, encode(backup.records));
        records = backup.records;
        originalRecords = { ...backup.records };
        blocked = false;
        recoverySource = undefined;
        issue = null;
        return true;
      } catch (error) {
        storageFailure(error);
        return false;
      }
    },
  };
}

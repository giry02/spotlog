import type { GroupMemberPresentation, TogetherGroup, TogetherState } from './model.ts';
import { isSafeTogetherImageUrl, MAX_STORED_PHOTO_BYTES, storedImageBytes } from './contentMedia.ts';

export interface RoomProfilePreset { nickname: string; avatar: string }

const limit = 8;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const safePresentationId = (value: string) => Boolean(value.trim()) && value === value.trim() && value.length <= 300
  && !/[\u0000-\u001f\u007f]/u.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const validNickname = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && !/[\u0000-\u001f\u007f]/u.test(value);
const validAvatar = (value: unknown): value is string => value === '' || isSafeTogetherImageUrl(value);
const own = <T,>(values: Record<string, T> | undefined, id: string): T | undefined => values && Object.hasOwn(values, id) ? values[id] : undefined;

export function canUseRoomProfiles(group: TogetherGroup | undefined | null): boolean {
  return Boolean(group && group.spaceType !== 'ACTIVITY' && (group.kind === 'HOBBY' || group.kind === 'GUIDE'));
}

export function isGroupMemberPresentation(value: unknown): value is GroupMemberPresentation {
  return object(value) && Object.keys(value).every(key => ['nickname', 'introduction', 'avatar'].includes(key))
    && Object.hasOwn(value, 'nickname') && Object.hasOwn(value, 'introduction')
    && validNickname(value.nickname) && typeof value.introduction === 'string' && value.introduction.length <= 600
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value.introduction)
    && (value.avatar === undefined || validAvatar(value.avatar));
}

export function isGroupMemberPresentations(value: unknown): value is Record<string, GroupMemberPresentation> {
  return object(value) && Object.keys(value).length <= 1000
    && Object.entries(value).every(([id, profile]) => safePresentationId(id) && isGroupMemberPresentation(profile));
}

function legacyJoinNickname(state: TogetherState, group: TogetherGroup, userId: string): string {
  const nickname = own(group.memberProfiles, userId)?.nickname.trim() || '';
  const base = state.members.find(member => member.id === userId)?.name.trim();
  // Older join forms prefilled this field with the account name.
  return nickname !== base && validNickname(nickname) ? nickname : '';
}

function scopedPresentation(state: TogetherState, userId: string, groupId?: string, activityId?: string) {
  const group = state.groups.find(item => item.id === groupId);
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  if ((groupId && !group) || (activityId && !activity)) return { restricted: true, nickname: '', avatar: '', introduction: '' };
  if (!group || !canUseRoomProfiles(group)) return { restricted: false, nickname: '', avatar: '', introduction: '' };
  if (!group.memberIds.includes(userId) || group.blockedMemberIds?.includes(userId)) return { restricted: true, nickname: '', avatar: '', introduction: '' };
  const groupProfile = own(group.memberPresentations, userId);
  const roomProfile = own(activity?.memberPresentations, userId);
  const presentation = roomProfile || groupProfile;
  return {
    restricted: true,
    nickname: roomProfile?.nickname.trim() || groupProfile?.nickname.trim() || legacyJoinNickname(state, group, userId),
    avatar: validAvatar(presentation?.avatar) ? presentation.avatar : '',
    introduction: presentation?.introduction || '',
  };
}

/** Read the exact published presentation. Eligible group contexts never fall back to account identity. */
export function resolveRoomIdentity(state: TogetherState, userId: string, groupId?: string, activityId?: string): { name: string; avatar: string } {
  const profile = scopedPresentation(state, userId, groupId, activityId);
  if (profile.restricted) return { name: profile.nickname || '모임원', avatar: profile.avatar };
  const member = state.members.find(item => item.id === userId);
  return { name: member?.name || '모임원', avatar: isSafeTogetherImageUrl(member?.avatar) ? member.avatar : '' };
}

export function roomProfileEditorValues(state: TogetherState, userId: string, groupId: string, activityId?: string): Required<GroupMemberPresentation> {
  const { nickname, avatar, introduction } = scopedPresentation(state, userId, groupId, activityId);
  return { nickname, avatar, introduction };
}

function isPreset(value: unknown): value is RoomProfilePreset {
  return object(value) && Object.keys(value).length === 2 && validNickname(value.nickname) && value.nickname === value.nickname.trim()
    && validAvatar(value.avatar) && Boolean(value.nickname || value.avatar);
}

export function isRoomProfilePresets(value: unknown): value is Record<string, RoomProfilePreset[]> {
  return object(value) && Object.keys(value).length <= 1000
    && Object.entries(value).every(([id, rows]) => safePresentationId(id) && Array.isArray(rows) && rows.length <= limit
      && rows.every(isPreset) && rows.reduce((sum, row) => sum + storedImageBytes(row.avatar), 0) <= MAX_STORED_PHOTO_BYTES
      && new Set(rows.map(row => JSON.stringify([row.nickname, row.avatar]))).size === rows.length);
}

function uniquePresets(rows: RoomProfilePreset[]): RoomProfilePreset[] {
  const unique: RoomProfilePreset[] = [];
  let bytes = 0;
  for (const row of rows) {
    if (unique.length >= limit) break;
    if (!isPreset(row) || unique.some(prior => prior.nickname === row.nickname && prior.avatar === row.avatar)) continue;
    const next = bytes + storedImageBytes(row.avatar);
    if (next > MAX_STORED_PHOTO_BYTES) continue;
    unique.push({ nickname: row.nickname, avatar: row.avatar });
    bytes = next;
  }
  return unique;
}

/** Only the current account's previous choices and its own explicitly shared room values. */
export function getOwnRoomProfilePresets(state: TogetherState, actorId: string): RoomProfilePreset[] {
  if (!safePresentationId(actorId) || !state.members.some(member => member.id === actorId)) return [];
  const roomValues: RoomProfilePreset[] = [];
  for (const group of state.groups) {
    if (!canUseRoomProfiles(group) || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId)) continue;
    const groupProfile = own(group.memberPresentations, actorId);
    const nickname = groupProfile?.nickname.trim() || legacyJoinNickname(state, group, actorId);
    roomValues.push({ nickname, avatar: groupProfile?.avatar || '' });
    for (const activity of state.activities) {
      if (activity.groupId !== group.id) continue;
      const profile = own(activity.memberPresentations, actorId);
      if (profile) roomValues.push({ nickname: profile.nickname.trim(), avatar: profile.avatar || '' });
    }
  }
  return uniquePresets([...(own(state.roomProfilePresets, actorId) || []), ...roomValues]);
}

export function rememberRoomProfilePreset(state: TogetherState, actorId: string, preset: RoomProfilePreset): void {
  const { nickname, avatar } = preset;
  const history = uniquePresets([{ nickname, avatar }, ...getOwnRoomProfilePresets(state, actorId)]);
  if (history.length) state.roomProfilePresets = { ...state.roomProfilePresets, [actorId]: history };
}

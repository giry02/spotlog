export type RoomGameType = 'WHEEL' | 'DRAW' | 'LADDER';
export interface RoomGameScope { groupId: string; activityId?: string }
export interface RoomGameMember { id: string; name: string }
export interface RoomGameOption { id: string; label: string }
export interface RoomGameBar { left: number; level: number }
interface RoomGameBase extends RoomGameScope {
  version: 1;
  id: string;
  title: string;
  source: 'OPTIONS' | 'MEMBERS';
  createdBy: string;
  createdAt: string;
  round: number;
  previousGameId?: string;
  members: RoomGameMember[];
  options: RoomGameOption[];
}
/** A completed, immutable run. Opening it must never draw a fresh result. */
export type TogetherGame = RoomGameBase & (
  | { type: 'WHEEL'; result: { optionId: string } }
  | { type: 'DRAW'; result: { memberId: string } }
  | { type: 'LADDER'; result: { assignments: { memberId: string; optionId: string }[]; bars: RoomGameBar[] } }
);
export interface RoomGameInput {
  /** Stable for save retry; changing a completed request requires a fresh ID. */
  id: string;
  type: RoomGameType;
  title: string;
  memberIds?: string[];
  options?: string[];
}
export type GameCreateInput = RoomGameInput;

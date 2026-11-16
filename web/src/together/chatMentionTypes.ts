/** Explicitly picked member, scoped to one room. Positions use textarea/JavaScript UTF-16 offsets. */
export interface ChatMemberMention {
  groupId: string;
  roomId: string;
  userId: string;
  start: number;
  end: number;
  text: string;
}

export interface ChatMentionQuery { start: number; end: number; query: string }

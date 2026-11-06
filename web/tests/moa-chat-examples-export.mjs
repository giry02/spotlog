import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createSeedState, TOGETHER_REVIEW_MEMBER_ID } from '../src/together/seed.ts';
import { getChatSummaryExample } from '../src/together/chatSummaryExample.ts';
import { installMoaChatExamples, MOA_REVIEW_ROOMS } from './moa-chat-examples.ts';

// Fictional seed only: no browser, customer storage, account adapter or service access.
const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '나', []);
const now = new Date();
const counts = installMoaChatExamples(state, TOGETHER_REVIEW_MEMBER_ID, now);
const descriptors = [
  { id: MOA_REVIEW_ROOMS.activity, name: '부산 가족여행', groupId: 'family-busan', groupName: '우리 가족 여행' },
  { id: MOA_REVIEW_ROOMS.group, name: '모임 전체 대화', groupId: 'family-busan', groupName: '우리 가족 여행' },
  { id: MOA_REVIEW_ROOMS.otherActivity, name: '지난 바다 나들이 · 다른 약속', groupId: 'family-busan', groupName: '우리 가족 여행' },
  { id: MOA_REVIEW_ROOMS.otherGroup, name: '커피와 책 이야기 · 다른 모임', groupId: 'weekend-walk', groupName: '우리 동네 취향 모임' },
];
const rooms = descriptors.map(({ id, name, groupId, groupName }) => {
  const messages = state.messages.filter(message => message.roomId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ id, authorId, body, createdAt }) => ({ id, authorId, body, createdAt }));
  const summary = getChatSummaryExample({ state, userId: TOGETHER_REVIEW_MEMBER_ID, groupId, roomId: id }, { scope: 'all' }, now.getTime());
  return { id, name, groupName, messages, ...(summary ? { summaryItems: summary.items.map(({ category, title, text, sourceIds, ownerId, taskTitle }) => ({ category, title, text, sourceIds, ...(ownerId ? { ownerId } : {}), ...(taskTitle ? { taskTitle } : {}) })) } : {}) };
});
const involved = new Set(rooms.flatMap(room => room.messages.map(message => message.authorId)));
const output = { members: state.members.filter(member => involved.has(member.id)).map(({ id, name }) => ({ id, name })), rooms };
const directory = new URL('../../artifacts/chat-layout-direction-20261101/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('examples.json', directory), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ file: fileURLToPath(new URL('examples.json', directory)), ...counts, summaries: rooms.map(room => ({ id: room.id, items: room.summaryItems?.length ?? 0 })) }, null, 2));

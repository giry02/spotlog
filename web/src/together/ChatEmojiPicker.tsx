import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { chatStickerPacks, chatStickers, emojiCategories, getChatSticker, type ChatStickerPackId } from './chatExpressions';
import './chat-expressions.css';

export interface ChatEmojiPickerProps {
  onInsertEmoji: (emoji: string) => void;
  onSelectSticker: (id: string) => void;
  onClose: () => void;
}

/** Picks only. The composer owns its draft, sticker preview and explicit send. */
export default function ChatEmojiPicker({ onInsertEmoji, onSelectSticker, onClose }: ChatEmojiPickerProps) {
  const uid = useId();
  const [mode, setMode] = useState<'emoji' | 'stickers'>('emoji');
  const [categoryId, setCategoryId] = useState(emojiCategories[0].id);
  const [packId, setPackId] = useState<ChatStickerPackId>('bunny');
  const [selectedSticker, setSelectedSticker] = useState('');
  const category = emojiCategories.find(item => item.id === categoryId) ?? emojiCategories[0];
  const pack = chatStickerPacks.find(item => item.id === packId)!;
  return <section className="chat-expression-picker" aria-label="이모지와 캐릭터 선택">
    <div className="chat-expression-header"><div className="chat-expression-tabs" role="tablist" aria-label="표현 종류" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 'emoji' : event.key === 'End' ? 'stickers' : mode === 'emoji' ? 'stickers' : 'emoji';
      setMode(next); document.getElementById(`${uid}-${next}`)?.focus();
    }}><button type="button" id={`${uid}-emoji`} role="tab" aria-selected={mode === 'emoji'} aria-controls={`${uid}-panel`} tabIndex={mode === 'emoji' ? 0 : -1} onClick={() => setMode('emoji')}>이모지</button><button type="button" id={`${uid}-stickers`} role="tab" aria-selected={mode === 'stickers'} aria-controls={`${uid}-panel`} tabIndex={mode === 'stickers' ? 0 : -1} onClick={() => setMode('stickers')}>캐릭터</button></div><button type="button" className="chat-expression-close" aria-label="이모지 선택 닫기" onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
    <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${mode}`}>
      {mode === 'emoji' ? <><div className="chat-expression-categories" aria-label="이모지 분류">{emojiCategories.map(item => <button type="button" key={item.id} aria-pressed={categoryId === item.id} onClick={() => setCategoryId(item.id)}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}</div><div className="chat-expression-scroll"><div className="chat-expression-emoji-grid" aria-label={`${category.label} 이모지`}>{category.items.map(item => <button type="button" key={item.emoji} aria-label={`${item.label} 이모지 넣기`} title={item.label} onClick={() => onInsertEmoji(item.emoji)}><span aria-hidden="true">{item.emoji}</span></button>)}</div></div><p className="chat-expression-hint">이모지는 작성 중인 메시지에 들어가요.</p></> : <><div className="chat-expression-categories chat-expression-packs" aria-label="캐릭터 팩">{chatStickerPacks.map(item => <button type="button" key={item.id} aria-pressed={packId === item.id} onClick={() => setPackId(item.id as ChatStickerPackId)}><img src={getChatSticker(item.coverId)!.src} alt="" />{item.shortName}</button>)}</div><div className="chat-expression-scroll"><p className="chat-expression-pack-name">{pack.name}</p><div className="chat-expression-sticker-grid" aria-label={pack.name}>{chatStickers.filter(sticker => sticker.pack === packId).map(sticker => <button type="button" key={sticker.id} aria-label={`${pack.shortName} · ${sticker.name} 선택`} aria-pressed={selectedSticker === sticker.id} onClick={() => { setSelectedSticker(sticker.id); onSelectSticker(sticker.id); }}><img src={sticker.src} alt="" loading="lazy" /><span>{sticker.name}</span></button>)}</div></div><p className="chat-expression-hint">캐릭터를 고른 뒤 미리보기에서 전송해 주세요.</p></>}
    </div>
  </section>;
}

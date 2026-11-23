import { Fragment, useId, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { chatStickerPickerPacks, chatStickers, emojiCategories, getChatSticker, getChatStickerTheme, type ChatStickerPackId, type MascotStickerTheme } from './chatExpressions';
import './chat-expressions.css';

export interface ChatEmojiPickerProps {
  onInsertEmoji: (emoji: string) => void;
  onSelectSticker: (id: string) => void;
  onClose: () => void;
}

type ThemeFilter = 'all' | Exclude<MascotStickerTheme, 'starter'>;
const stickerFilters = [
  { id: 'all', label: '전체' },
  { id: 'daily', label: '일상' },
  { id: 'planning', label: '약속·이동' },
  { id: 'outing', label: '나들이' },
] as const satisfies readonly { id: ThemeFilter; label: string }[];

/** Picks only. The composer owns its draft, sticker preview and explicit send. */
export default function ChatEmojiPicker({ onInsertEmoji, onSelectSticker, onClose }: ChatEmojiPickerProps) {
  const uid = useId();
  const [mode, setMode] = useState<'stickers' | 'emoji'>('stickers');
  const [categoryId, setCategoryId] = useState(emojiCategories[0].id);
  const [packId, setPackId] = useState<ChatStickerPackId>('redcap');
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>('all');
  const [selectedSticker, setSelectedSticker] = useState('');
  const addedHeading = useRef<HTMLHeadingElement>(null);
  const category = emojiCategories.find(item => item.id === categoryId) ?? emojiCategories[0];
  const pack = chatStickerPickerPacks.find(item => item.id === packId)!;
  const packStickers = chatStickers.filter(sticker => sticker.pack === packId);
  const hasThemes = packStickers.some(sticker => getChatStickerTheme(sticker) !== undefined);
  const visibleStickers = hasThemes && themeFilter !== 'all' ? packStickers.filter(sticker => getChatStickerTheme(sticker) === themeFilter) : packStickers;
  const jumpToAdded = () => {
    const heading = addedHeading.current;
    const scroll = heading?.closest('.chat-expression-scroll');
    if (!heading || !scroll) return;
    scroll.scrollTop += heading.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 8;
    heading.focus({ preventScroll: true });
  };
  return <section className="chat-expression-picker" aria-label="이모지와 스티커 선택">
    <div className="chat-expression-header"><div className="chat-expression-tabs" role="tablist" aria-label="표현 종류" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 'stickers' : event.key === 'End' ? 'emoji' : mode === 'stickers' ? 'emoji' : 'stickers';
      setMode(next); document.getElementById(`${uid}-${next}`)?.focus();
    }}><button type="button" id={`${uid}-stickers`} role="tab" aria-selected={mode === 'stickers'} aria-controls={`${uid}-panel`} tabIndex={mode === 'stickers' ? 0 : -1} onClick={() => setMode('stickers')}>스티커</button><button type="button" id={`${uid}-emoji`} role="tab" aria-selected={mode === 'emoji'} aria-controls={`${uid}-panel`} tabIndex={mode === 'emoji' ? 0 : -1} onClick={() => setMode('emoji')}>이모지</button></div><button type="button" className="chat-expression-close" aria-label="이모지 선택 닫기" onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
    <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${mode}`}>
      {mode === 'emoji' ? <>
        <div key="emoji-categories" className="chat-expression-categories" role="group" aria-label="이모지 분류" tabIndex={0}>
          {emojiCategories.map(item => <button type="button" key={item.id} aria-pressed={categoryId === item.id} onClick={() => setCategoryId(item.id)}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}
        </div>
        <div className="chat-expression-scroll"><div className="chat-expression-emoji-grid" aria-label={`${category.label} 이모지`}>{category.items.map(item => <button type="button" key={item.emoji} aria-label={`${item.label} 이모지 넣기`} title={item.label} onClick={() => onInsertEmoji(item.emoji)}><span aria-hidden="true">{item.emoji}</span></button>)}</div></div>
        <p className="chat-expression-hint">이모지는 작성 중인 메시지에 들어가요.</p>
      </> : <>
        <div key="sticker-packs" className="chat-expression-categories chat-expression-packs" role="group" aria-label="스티커 묶음" tabIndex={0}>
          {chatStickerPickerPacks.map(item => <button type="button" key={item.id} aria-pressed={packId === item.id} aria-label={item.id === 'guidebot' ? '길잡이 로봇' : undefined} onClick={() => {
            if (item.id !== packId) { setPackId(item.id); setThemeFilter('all'); }
          }}><img src={getChatSticker(item.coverId)!.src} alt="" /><span className="chat-expression-pack-label">{item.shortName}</span></button>)}
        </div>
        {hasThemes && <div className="chat-expression-theme-filters" role="group" aria-label="스티커 상황 선택">
          {stickerFilters.map(theme => <button type="button" key={theme.id} aria-pressed={themeFilter === theme.id} onClick={() => setThemeFilter(theme.id)}>{theme.label}</button>)}
        </div>}
        <div className="chat-expression-scroll" key={`${packId}:${themeFilter}`}>
          <div className="chat-expression-pack-heading">
            <p className="chat-expression-pack-name">{pack.name} · {visibleStickers.length}종</p>
            {packId === 'redcap' && themeFilter === 'all' && <button type="button" className="chat-expression-added-link" onClick={jumpToAdded}>추가 9종 보기<ChevronDown size={14} aria-hidden="true"/></button>}
          </div>
          <div className="chat-expression-sticker-grid" role="group" aria-label={pack.name}>
            {visibleStickers.map(sticker => <Fragment key={sticker.id}>
              {themeFilter === 'all' && sticker.id === 'redcap-confirmed' && <h3 className="chat-expression-added-heading" tabIndex={-1} ref={addedHeading}>추가 9종</h3>}
              {themeFilter === 'all' && sticker.id === 'redcap-love' && <h3 className="chat-expression-added-heading">새로 추가한 3종</h3>}
              <button type="button" aria-label={`${pack.shortName} · ${sticker.name} 선택`} aria-pressed={selectedSticker === sticker.id} onClick={() => { setSelectedSticker(sticker.id); onSelectSticker(sticker.id); }}><img src={sticker.src} alt="" loading="lazy" /><span>{sticker.name}</span></button>
            </Fragment>)}
          </div>
        </div>
        <p className="chat-expression-hint">스티커를 고른 뒤 미리보기에서 전송해 주세요.</p>
      </>}
    </div>
  </section>;
}

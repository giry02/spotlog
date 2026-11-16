import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AtSign, Bell, Copy, Flag, Reply, X } from 'lucide-react';
import { ALLOWED_MESSAGE_REACTIONS } from './chatActions';

interface Props {
  id: string;
  author: string;
  anchor: HTMLElement | null;
  boundary: HTMLElement | null;
  canReply: boolean;
  canReact: boolean;
  canMention: boolean;
  canCopy: boolean;
  canReport: boolean;
  canNotice: boolean;
  activeReactions: string[];
  onReply: () => void;
  onReaction: (emoji: string) => void;
  onMention: () => void;
  onCopy: () => void;
  onReport: () => void;
  onNotice: () => void;
  onClose: (restoreFocus?: boolean) => void;
}

/** Floats over the stream without inserting height into the message history. */
export default function ChatMessageActions(props: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(props.onClose);
  close.current = props.onClose;
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number }>();
  const measure = useRef(() => {});
  measure.current = () => {
    const viewport = window.visualViewport;
    const viewLeft = viewport?.offsetLeft || 0, viewTop = viewport?.offsetTop || 0;
    const viewRight = viewLeft + (viewport?.width || window.innerWidth);
    const viewBottom = viewTop + (viewport?.height || window.innerHeight);
    const bounds = props.boundary?.getBoundingClientRect();
    const leftEdge = Math.max(viewLeft, bounds?.left ?? viewLeft) + 12;
    const rightEdge = Math.min(viewRight, bounds?.right ?? viewRight) - 12;
    const width = Math.max(1, Math.min(304, rightEdge - leftEdge));
    const target = props.anchor?.getBoundingClientRect();
    const maxHeight = Math.max(44, Math.min(360, viewBottom - viewTop - 24));
    if (panel.current) panel.current.style.width = `${width}px`;
    const height = Math.min(panel.current?.scrollHeight || 290, maxHeight);
    const left = Math.max(leftEdge, Math.min(target?.left ?? leftEdge, rightEdge - width));
    const below = (target?.bottom ?? viewTop + 12) + 8;
    const above = (target?.top ?? below) - height - 8;
    const top = Math.max(viewTop + 12, Math.min(below + height <= viewBottom - 12 ? below : above, viewBottom - height - 12));
    setPosition({ left, top, width, maxHeight });
  };
  useLayoutEffect(() => {
    measure.current();
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [props.id]);
  useEffect(() => {
    const insidePanel = (event: Event) => event.target instanceof Node && Boolean(panel.current?.contains(event.target));
    // Viewport reflow and keyboard dismissal can scroll the underlying room.
    // Only a user's scroll intent outside the panel dismisses the menu.
    const scroll = (event: Event) => { if (!insidePanel(event)) measure.current(); };
    const scrollIntent = (event: Event) => { if (!insidePanel(event)) close.current(false); };
    // Focusing the menu can hide the software keyboard. Keep the menu open and
    // fit the new visual viewport without repeatedly stealing focus.
    const resize = () => measure.current();
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('wheel', scrollIntent, { capture: true, passive: true });
    document.addEventListener('touchmove', scrollIntent, { capture: true, passive: true });
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('wheel', scrollIntent, true);
      document.removeEventListener('touchmove', scrollIntent, true);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
    };
  }, []);
  return createPortal(<div className="tg-chat-action-root" onClick={event => event.stopPropagation()}>
    <div className="tg-chat-action-backdrop" onPointerDown={event => { event.preventDefault(); props.onClose(true); }}/>
    <div ref={panel} id={props.id} className="tg-chat-action-panel" role="dialog" aria-modal="true" aria-label={`${props.author} 메시지 도구`} style={{ ...position, visibility: position ? 'visible' : 'hidden' }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); props.onClose(true); }
      if (event.key === 'Tab') {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="tg-chat-action-heading"><span>{props.author} 메시지</span><button type="button" aria-label="메시지 도구 닫기" onClick={() => props.onClose(true)}><X size={18}/></button></div>
      <div className="tg-chat-action-reactions" role="group" aria-label="빠른 반응">{ALLOWED_MESSAGE_REACTIONS.map(emoji => <button type="button" key={emoji} aria-label={`${emoji} 반응 ${props.activeReactions.includes(emoji) ? '취소' : '추가'}`} aria-pressed={props.activeReactions.includes(emoji)} disabled={!props.canReact} onClick={() => props.onReaction(emoji)}>{emoji}</button>)}</div>
      <div className="tg-chat-action-list">
        <button type="button" disabled={!props.canReply} onClick={props.onReply}><Reply size={18}/><span>답장</span></button>
        {props.canMention && <button type="button" onClick={props.onMention}><AtSign size={18}/><span>{props.author}님 태그</span></button>}
        {props.canCopy && <button type="button" onClick={props.onCopy}><Copy size={18}/><span>내용 복사</span></button>}
        {props.canNotice && <button type="button" onClick={props.onNotice}><Bell size={18}/><span>공지로 편집</span></button>}
        {props.canReport && <button type="button" onClick={props.onReport}><Flag size={18}/><span>메시지 신고</span></button>}
      </div>
    </div>
  </div>, document.body);
}

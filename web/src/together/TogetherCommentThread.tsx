import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CornerDownRight, Flag, Reply } from 'lucide-react';
import { getTogetherCommentGroups } from './commentThreads';
import type { TogetherComment } from './model';
import './together-comment-thread.css';

type Props = {
  comments: TogetherComment[];
  canWrite: boolean;
  authorName: (id: string) => string;
  maxLength: number;
  label: string;
  onSubmit: (body: string, parentId?: string) => boolean;
  onReport?: (comment: TogetherComment) => void;
  viewerId?: string;
  postId?: string;
  highlightedId?: string;
};

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function TogetherCommentThread({ comments, canWrite, authorName, maxLength, label, onSubmit, onReport, viewerId, postId, highlightedId }: Props) {
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<{ parentId: string; body: string } | null>(null);
  const replyFormId = useId();
  const replyField = useRef<HTMLTextAreaElement>(null);
  const parentId = reply?.parentId;
  useEffect(() => {
    if (canWrite && parentId) replyField.current?.focus();
  }, [canWrite, parentId]);
  const threads = getTogetherCommentGroups(comments);

  function submitRoot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canWrite && draft.trim() && onSubmit(draft)) setDraft('');
  }

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canWrite && reply?.body.trim() && onSubmit(reply.body, reply.parentId)) setReply(null);
  }

  function renderComment(comment: TogetherComment, isReply = false) {
    const targetId = postId ? `tg-comment-${postId}-${comment.id}` : undefined;
    const author = authorName(comment.authorId);
    const timestamp = Date.parse(comment.createdAt);
    return <div className="tg-comment-row" id={targetId}
      data-dashboard-record-highlight={targetId && highlightedId === targetId ? 'true' : undefined}>
      <div className="tg-comment-row__meta">
        {isReply && <CornerDownRight size={14} aria-hidden="true"/>}
        <strong>{author}</strong>
        {Number.isFinite(timestamp) && <time dateTime={comment.createdAt}>{dateFormat.format(timestamp)}</time>}
      </div>
      <p>{comment.body}</p>
      {(canWrite && !isReply || onReport && comment.authorId !== viewerId) && <div className="tg-comment-row__actions">
        {canWrite && !isReply && <button type="button" aria-label={`${author} 댓글에 답글`} aria-expanded={reply?.parentId === comment.id}
          aria-controls={reply?.parentId === comment.id ? replyFormId : undefined}
          onClick={() => setReply(current => current?.parentId === comment.id ? null : { parentId: comment.id, body: '' })}>
          <Reply size={16} aria-hidden="true"/>답글
        </button>}
        {onReport && comment.authorId !== viewerId && <button type="button" aria-label={`${author} ${isReply ? '답글' : '댓글'} 신고`}
          title={isReply ? '답글 신고' : '댓글 신고'} onClick={() => onReport(comment)}><Flag size={16} aria-hidden="true"/></button>}
      </div>}
    </div>;
  }

  return <div className="tg-comment-threads">
    {threads.length > 0 ? <ul className="tg-comment-threads__list">{threads.map(({ root, replies }) => <li key={root.id}>
      {renderComment(root)}
      {replies.length > 0 && <ul className="tg-comment-threads__replies" aria-label={`${authorName(root.authorId)} 댓글의 답글`}>
        {replies.map(comment => <li key={comment.id}>{renderComment(comment, true)}</li>)}
      </ul>}
      {canWrite && reply?.parentId === root.id && <form id={replyFormId} className="tg-comment-threads__reply-form" onSubmit={submitReply}>
        <div className="tg-comment-threads__reply-target">
          <span>{authorName(root.authorId)}님에게 답글</span>
          <button type="button" onClick={() => setReply(null)}>취소</button>
        </div>
        <div className="tg-comment-threads__composer">
          <textarea ref={replyField} aria-label="답글 작성" rows={2} maxLength={maxLength} placeholder="답글을 남겨보세요"
            value={reply.body} onChange={event => setReply({ parentId: root.id, body: event.target.value })}/>
          <button className="tg-primary" type="submit" aria-label="답글 등록" disabled={!reply.body.trim()}>등록</button>
        </div>
      </form>}
    </li>)}</ul> : <p className="tg-muted">아직 댓글이 없어요.</p>}
    {canWrite && <form className="tg-comment-threads__composer" onSubmit={submitRoot}>
      <textarea aria-label={label} rows={2} maxLength={maxLength} placeholder="댓글을 남겨보세요"
        value={draft} onChange={event => setDraft(event.target.value)}/>
      <button className="tg-primary" type="submit" aria-label="댓글 등록" disabled={!draft.trim()}>등록</button>
    </form>}
  </div>;
}

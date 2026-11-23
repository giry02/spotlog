import { useId, useState, type FormEvent } from 'react';
import { Flag, ImageOff } from 'lucide-react';
import { PhotoCredit } from '../PublicTourismCredit';
import { MAX_ALBUM_MEDIA_COMMENT_LENGTH } from './albumComments';
import { MemberAvatar } from './GroupMembersPanel';
import { memberName, type TogetherMedia, type TogetherState } from './model';
import { resolveRoomIdentity } from './roomIdentity';
import './album-media-detail.css';

interface Props {
  item: TogetherMedia;
  state: TogetherState;
  canComment: boolean;
  onComment: (body: string) => boolean;
  onReport?: () => void;
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function AlbumDate({ value }: { value: string }) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? <time dateTime={value}>{dateFormat.format(timestamp)}</time> : null;
}

export default function AlbumMediaDetail({ item, state, canComment, onComment, onReport }: Props) {
  const [draft, setDraft] = useState('');
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const commentHeadingId = useId();
  const author = resolveRoomIdentity(state, item.authorId, item.groupId, item.activityId);
  const comments = item.comments ?? [];
  const isVideo = item.kind === 'VIDEO';
  const mediaLabel = item.caption || (isVideo ? '모임 앨범 영상' : '모임 앨범 사진');

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (canComment && body && onComment(body)) setDraft('');
  }

  return (
    <div className="tg-album-media">
      <div className="tg-album-media__visual">
        {failedUrl === item.url ? (
          <div className="tg-album-media__unavailable" role="status">
            <ImageOff size={22} aria-hidden="true" />
            <p>{isVideo ? '영상을' : '사진을'} 불러오지 못했어요.</p>
          </div>
        ) : isVideo ? (
          <video src={item.url} aria-label={mediaLabel} controls playsInline preload="metadata" onError={() => setFailedUrl(item.url)} />
        ) : (
          <img src={item.url} alt={mediaLabel} onError={() => setFailedUrl(item.url)} />
        )}
      </div>
      <div className="tg-album-media__info">
        <div className="tg-album-media__author">
          <MemberAvatar name={author.name} avatar={author.avatar} />
          <div>
            <strong>{author.name}</strong>
            <AlbumDate value={item.createdAt} />
          </div>
        </div>
        {item.caption && <p className="tg-album-media__caption">{item.caption}</p>}
        {(item.kind === 'PHOTO' || onReport) && (
          <div className="tg-album-media__actions">
            {item.kind === 'PHOTO' && <PhotoCredit image={item.url} />}
            {onReport && (
              <button type="button" className="tg-album-media__report" onClick={onReport}>
                <Flag size={14} aria-hidden="true" /> 신고
              </button>
            )}
          </div>
        )}
      </div>
      <section className="tg-album-media__comments" aria-labelledby={commentHeadingId}>
        <h3 id={commentHeadingId} aria-live="polite">댓글 {comments.length}</h3>
        {comments.length ? (
          <ul className="tg-album-media__comment-list">
            {comments.map(comment => (
              <li key={comment.id}>
                <div className="tg-album-media__comment-author">
                  <strong>{memberName(state, comment.authorId, item.groupId, item.activityId)}</strong>
                  <AlbumDate value={comment.createdAt} />
                </div>
                <p>{comment.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tg-album-media__empty">아직 댓글이 없어요.</p>
        )}
        {canComment && (
          <form className="tg-album-media__composer" onSubmit={submitComment}>
            <textarea aria-label="앨범 댓글" placeholder="댓글을 남겨보세요" rows={2} maxLength={MAX_ALBUM_MEDIA_COMMENT_LENGTH} value={draft} onChange={event => setDraft(event.target.value)} />
            <button className="tg-primary" type="submit" aria-label="댓글 등록" disabled={!draft.trim()}>등록</button>
          </form>
        )}
      </section>
    </div>
  );
}

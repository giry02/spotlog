import { useUiCopy } from './frontendCopy';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { Button } from './ui';
import { isTrashExpired, listTrashedJourneys, moveJourneyToTrash, permanentlyDeleteJourney, restoreJourneyFromTrash, TripTrashError, TRASH_TIME_ZONE, type TrashableJourney } from './tripTrash';
import './trip-trash.css';

type Language = 'ko' | 'en';
type TrashProps = {
  journeys: TrashableJourney[];
  ownerId: string;
  onChange: (journeys: TrashableJourney[]) => boolean;
  onClose: () => void;
  language?: Language;
};
const words = {
  ko: { title: '휴지통', rule: '삭제한 여행은 6개월 동안 보관돼요. 기간이 지나면 복원할 수 없어요.', empty: '휴지통이 비어 있어요', emptyHint: '삭제한 내 여행과 여행기는 여기서 다시 찾을 수 있어요.', plan: '내 여행', journal: '여행기', deleted: '삭제일', expires: '보관 종료', back: '목록으로', restore: '복원', remove: '영구 삭제', restorePrivate: '비공개로 복원돼요. 공개하려면 복원 후 내용을 확인해 주세요.', restored: '내 여행에 비공개로 복원했어요.', removed: '이 여행을 영구 삭제했어요.', view: '여행 보기', confirm: '이 여행을 영구 삭제할까요?', irreversible: '글·사진·DAY 일정을 다시 복원할 수 없어요. 다른 여행과 저장한 장소는 유지돼요.', cancel: '취소', saveFailed: '변경 내용을 저장하지 못했어요. 현재 기록은 그대로예요. 다시 시도해 주세요.', unavailable: '이 항목의 상태가 바뀌었거나 보관 기간이 지났어요. 목록에서 다시 확인해 주세요.', moveTitle: '휴지통으로 옮길까요?', move: '휴지통으로 이동', moveHelp: '글·사진·DAY 일정이 함께 6개월 동안 보관돼요. 내 여행과 여행기는 각각 삭제되고 복원돼요.', publicHelp: '공개 목록과 여행 링크에서 숨겨져요. 복원하면 비공개로 돌아와요.', expired: '보관 기간이 지났어요', pending: '처리 중…' },
  en: { title: 'Trash', rule: 'Deleted trips are kept for 6 months. They cannot be restored after that.', empty: 'Trash is empty', emptyHint: 'Deleted personal trips and travel journals will appear here.', plan: 'My trip', journal: 'Journal', deleted: 'Deleted', expires: 'Available until', back: 'Back to list', restore: 'Restore', remove: 'Delete permanently', restorePrivate: 'Restored trips are private. Review the journal before publishing it again.', restored: 'Restored to My trips as private.', removed: 'This trip was permanently deleted.', view: 'View trip', confirm: 'Permanently delete this trip?', irreversible: 'Its writing, photos and daily itinerary cannot be restored. Other trips and saved places are kept.', cancel: 'Cancel', saveFailed: 'Could not save this change. Your records are unchanged. Please try again.', unavailable: 'This item changed or its retention period ended. Check the list again.', moveTitle: 'Move this trip to trash?', move: 'Move to trash', moveHelp: 'Its writing, photos and daily itinerary are kept for 6 months. Personal trips and travel journals are managed separately.', publicHelp: 'It will be hidden from public lists and trip links. Restoring it makes it private.', expired: 'Retention period ended', pending: 'Processing…' },
};
function formatDate(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', { timeZone: TRASH_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}
function errorMessage(error: unknown, language: Language): string {
  if (language === 'ko' && error instanceof TripTrashError) return error.message;
  return words[language].unavailable;
}

/** One sheet/panel is reused for list, record details and permanent-delete confirmation. */
export function TripTrashSheet({ journeys, ownerId, onChange, onClose, onOpen, language = 'ko' }: TrashProps & { onOpen?: (journey: TrashableJourney) => void }) {
  const copy=useUiCopy();
  const t = words[language];
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<{ id: string; deletedAt: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ message: string; journey?: TrashableJourney } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const listed = listTrashedJourneys(journeys, ownerId, now);
  const current = selected && journeys.find(item => item.id === selected.id && item.isMine && item.trash?.ownerId === ownerId && item.trash.deletedAt === selected.deletedAt);
  const usable = current && !isTrashExpired(current, now);
  const back = () => { setSelected(null); setConfirming(false); setError(''); setNow(new Date()); };
  const act = (kind: 'restore' | 'delete') => {
    if (!selected || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const next = kind === 'restore'
        ? restoreJourneyFromTrash(journeys, selected.id, ownerId, selected.deletedAt, new Date())
        : permanentlyDeleteJourney(journeys, selected.id, ownerId, selected.deletedAt);
      if (!onChange(next)) { setError(t.saveFailed); return; }
      setResult({ message: kind === 'restore' ? t.restored : t.removed, journey: kind === 'restore' ? next.find(item => item.id === selected.id) : undefined });
      back();
    } catch (problem) { setError(errorMessage(problem, language)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <BottomSheet title={t.title} description={t.rule} onClose={onClose}>
    <div className="trip-trash">
      {result && <div className="trip-trash-result" role="status"><p>{result.message}</p>{result.journey && onOpen && <Button variant="secondary" size="compact" onClick={() => onOpen(result.journey!)}>{t.view}<ChevronRight size={14} /></Button>}</div>}
      {selected ? <>
        <Button variant="ghost" size="compact" onClick={confirming ? () => setConfirming(false) : back} disabled={busy}><ArrowLeft size={16} />{confirming ? t.cancel : t.back}</Button>
        {!current ? <p className="trip-trash-help" role="status">{t.unavailable}</p> : <>
          <div className="trip-trash-detail"><span>{current.purpose === 'PLAN' ? t.plan : t.journal}</span><h3>{current.title}</h3><p>{current.region} · {current.days.length} DAY · {current.days.reduce((total, day) => total + day.places.length, 0)} {language === 'ko' ? copy("곳") : 'places'}</p><dl><div><dt>{t.deleted}</dt><dd>{formatDate(current.trash!.deletedAt, language)}</dd></div><div><dt>{t.expires}</dt><dd>{formatDate(current.trash!.expiresAt, language)} (KST)</dd></div></dl></div>
          {confirming ? <div className="trip-trash-confirm"><h3>{t.confirm}</h3><p>{t.irreversible}</p><div className="trip-trash-actions"><Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>{t.cancel}</Button><Button variant="danger" loading={busy} onClick={() => act('delete')}><Trash2 size={16} />{t.remove}</Button></div></div> : <>
            <p className="trip-trash-help">{usable ? t.restorePrivate : t.expired}</p><div className="trip-trash-actions"><Button disabled={!usable || busy} onClick={() => act('restore')}><RotateCcw size={16} />{busy ? t.pending : t.restore}</Button><Button variant="secondary" disabled={busy} onClick={() => setConfirming(true)}><Trash2 size={16} />{t.remove}</Button></div>
          </>}
        </>}
      </> : !listed.length ? <div className="trip-trash-empty"><Trash2 size={28} aria-hidden="true" /><h3>{t.empty}</h3><p>{t.emptyHint}</p></div> : <ul className="trip-trash-list">{listed.map(item => <li key={item.id}><button onClick={() => { setSelected({ id: item.id, deletedAt: item.trash!.deletedAt }); setResult(null); setError(''); }}>
        <span className="trip-trash-kind">{item.purpose === 'PLAN' ? t.plan : t.journal}</span><strong>{item.title}</strong><span>{item.region} · {item.duration}</span><span>{t.expires} {formatDate(item.trash!.expiresAt, language)} (KST)</span><ChevronRight size={18} aria-hidden="true" />
      </button></li>)}</ul>}
      {error && <p role="alert" className="ui-error">{error}</p>}
    </div>
  </BottomSheet>;
}

export function MoveToTrashSheet({ journeys, journeyId, ownerId, onChange, onClose, onMoved, language = 'ko' }: TrashProps & { journeyId: string; onMoved: (journey: TrashableJourney) => void }) {
  const t = words[language], journey = journeys.find(item => item.id === journeyId && item.isMine && !item.trash);
  const [error, setError] = useState('');
  const pending = useRef(false);
  return <BottomSheet title={t.moveTitle} onClose={onClose}><div className="trip-trash">
    {journey ? <><div className="trip-trash-detail"><span>{journey.purpose === 'PLAN' ? t.plan : t.journal}</span><h3>{journey.title}</h3></div><p className="trip-trash-help">{t.moveHelp}</p>{journey.visibility === 'PUBLIC' && <p className="trip-trash-help">{t.publicHelp}</p>}<div className="trip-trash-actions"><Button variant="secondary" onClick={onClose}>{t.cancel}</Button><Button onClick={() => {
      if (pending.current) return;
      pending.current = true; setError('');
      try { const next = moveJourneyToTrash(journeys, journeyId, ownerId); if (!onChange(next)) { setError(t.saveFailed); return; } onMoved(next.find(item => item.id === journeyId)!); }
      catch (problem) { setError(errorMessage(problem, language)); }
      finally { pending.current = false; }
    }}><Trash2 size={16} />{t.move}</Button></div></> : <p className="trip-trash-help" role="status">{t.unavailable}</p>}
    {error && <p role="alert" className="ui-error">{error}</p>}
  </div></BottomSheet>;
}

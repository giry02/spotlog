import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, ScanText, Trash2 } from 'lucide-react';
import { readReceiptAttachment } from './receiptImage';
import type { SettlementReceipt } from './settlementModel';
import './receipt-attachment.css';

interface ReceiptAttachmentFieldProps {
  value?: SettlementReceipt;
  onChange: (receipt?: SettlementReceipt) => void;
  disabled?: boolean;
  demoReceipt?: boolean;
  onRecognizedTotal?: (amount: number) => void;
}

export default function ReceiptAttachmentField({ value, onChange, disabled = false, demoReceipt = false, onRecognizedTotal }: ReceiptAttachmentFieldProps) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const recognition = useRef<AbortController | null>(null);
  const helpId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [candidate, setCandidate] = useState<number>();
  const canChoose = !busy && !disabled;

  useEffect(() => {
    sequence.current += 1;
    setBusy(false);
    setError('');
    setReading(false);
    setCandidate(undefined);
    return () => {
      sequence.current += 1;
      recognition.current?.abort();
    };
  }, [value?.url, disabled]);

  function select(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (file) void attach(() => file);
  }

  async function attach(loadFile: () => File | Promise<File>) {
    if (!canChoose) return;
    recognition.current?.abort();
    setReading(false);
    setCandidate(undefined);
    const request = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      const receipt = await readReceiptAttachment(await loadFile());
      if (sequence.current === request) onChange(receipt);
    } catch (cause) {
      if (sequence.current === request) {
        setError(cause instanceof Error ? cause.message : '영수증 사진을 준비하지 못했어요.');
      }
    } finally {
      if (sequence.current === request) setBusy(false);
    }
  }

  async function loadDemoReceipt() {
    await attach(async () => {
      const response = await fetch(import.meta.env.BASE_URL + 'demo/settlement-receipt-busan.png');
      if (!response.ok) throw new Error('시연 영수증을 불러오지 못했어요.');
      return new File([await response.blob()], 'settlement-receipt-busan.png', { type: 'image/png' });
    });
  }

  async function readTotal() {
    if (!value || recognition.current || disabled) return;
    const request = new AbortController();
    recognition.current = request;
    setReading(true);
    setCandidate(undefined);
    setError('');
    try {
      const { recognizeReceiptTotal } = await import('./receiptOcr');
      const total = await recognizeReceiptTotal(value, request.signal);
      if (request.signal.aborted) return;
      if (total === undefined) setError('합계 금액을 읽지 못했어요. 영수증을 확인하고 금액을 직접 입력해 주세요.');
      else setCandidate(total);
    } catch {
      if (!request.signal.aborted) setError('영수증을 읽지 못했어요. 다시 시도하거나 금액을 직접 입력해 주세요.');
    } finally {
      if (recognition.current === request) {
        recognition.current = null;
        if (!request.signal.aborted) setReading(false);
      }
    }
  }

  return <div className="receipt-attachment" role="group" aria-label="영수증 첨부" aria-describedby={helpId}>
    <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="영수증 촬영" disabled={!canChoose} hidden onChange={event => void select(event)} />
    <input ref={gallery} type="file" accept="image/*" aria-label="영수증 사진 파일" disabled={!canChoose} hidden onChange={event => void select(event)} />
    {value && <details className="receipt-attachment-preview">
      <summary>첨부한 영수증 보기</summary>
      <img src={value.url} alt="첨부한 영수증" />
    </details>}
    <div className="receipt-attachment-actions">
      <button type="button" disabled={!canChoose} onClick={() => camera.current?.click()}><Camera size={17} aria-hidden="true" />영수증 촬영</button>
      <button type="button" disabled={!canChoose} onClick={() => gallery.current?.click()}><ImagePlus size={17} aria-hidden="true" />사진 선택</button>
      {demoReceipt && !value && <button type="button" disabled={!canChoose} onClick={() => void loadDemoReceipt()}><ImagePlus size={17} aria-hidden="true" />시연 영수증 불러오기</button>}
      {value && onRecognizedTotal && <button type="button" disabled={!canChoose || reading} onClick={() => void readTotal()}><ScanText size={17} aria-hidden="true" />영수증 금액 읽기</button>}
      {value && <button type="button" disabled={!canChoose} onClick={() => onChange(undefined)}><Trash2 size={17} aria-hidden="true" />첨부 해제</button>}
    </div>
    <p className="receipt-attachment-help" id={helpId}>{onRecognizedTotal ? '사진을 이 기기에서 읽거나 금액을 직접 입력할 수 있어요.' : '영수증을 보고 지출 금액을 직접 입력해 주세요.'}</p>
    {reading && <p className="receipt-attachment-help" role="status">영수증에서 합계 금액을 읽고 있어요.</p>}
    {candidate !== undefined && onRecognizedTotal && <div className="receipt-attachment-candidate">
      <div><small>영수증에서 읽은 금액</small><strong>{candidate.toLocaleString('ko-KR')}원</strong></div>
      <button type="button" onClick={() => { onRecognizedTotal(candidate); setCandidate(undefined); }}>이 금액 사용</button>
    </div>}
    {busy && <p className="receipt-attachment-help" role="status">영수증 사진을 준비하고 있어요.</p>}
    {error && <p className="receipt-attachment-error" role="alert">{error}</p>}
  </div>;
}

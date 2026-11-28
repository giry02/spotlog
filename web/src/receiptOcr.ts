import { createWorker, OEM, PSM, type Worker as OcrWorker } from 'tesseract.js';
import { isSettlementReceipt, type SettlementReceipt } from './settlementModel';
import { receiptTotalFromText } from './receiptTotal';

const ocrTimeoutMs = 40_000;

/** Run receipt recognition in a local worker. Only the language and engine assets are fetched. */
export async function recognizeReceiptTotal(receipt: SettlementReceipt, signal: AbortSignal): Promise<number | undefined> {
  if (!isSettlementReceipt(receipt)) throw new Error('영수증 사진을 읽을 수 없어요.');
  signal.throwIfAborted();
  const assets = new URL(import.meta.env.BASE_URL + 'receipt-ocr-v7/', window.location.href);
  let worker: OcrWorker | undefined;
  const operation = new AbortController();
  const abort = () => operation.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, ocrTimeoutMs);
  let stopWaiting: (() => void) | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    stopWaiting = () => reject(new DOMException('영수증 읽기가 중단됐어요.', 'AbortError'));
    operation.signal.addEventListener('abort', stopWaiting, { once: true });
  });

  async function run() {
    operation.signal.throwIfAborted();
    worker = await createWorker(['kor', 'eng'], OEM.LSTM_ONLY, {
      workerPath: new URL('worker.min.js', assets).href,
      corePath: assets.href,
      langPath: assets.href,
      workerBlobURL: false,
      cacheMethod: 'none',
      errorHandler: abort,
    });
    if (operation.signal.aborted) {
      await worker.terminate();
      operation.signal.throwIfAborted();
    }
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
    const result = await worker.recognize(receipt.url);
    return receiptTotalFromText(result.data.text);
  }

  try {
    return await Promise.race([run(), interrupted]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    if (stopWaiting) operation.signal.removeEventListener('abort', stopWaiting);
    await worker?.terminate();
  }
}

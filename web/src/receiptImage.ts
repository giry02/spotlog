import { isSettlementReceipt, MAX_SETTLEMENT_RECEIPT_LENGTH, type SettlementReceipt } from './settlementModel.ts';

const maxInputBytes = 20 * 1024 * 1024;
const heifBrands = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);

function isReceiptRaster(bytes: Uint8Array): boolean {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return true;
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) === 'RIFF' && tag(8) === 'WEBP') return true;
  if (tag(4) !== 'ftyp') return false;

  // A phone gallery may supply a HEIC photo. Decoding depends on the browser.
  const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (heifBrands.has(tag(8))) return true;
  for (let offset = 16; offset + 4 <= Math.min(size, bytes.length); offset += 4) {
    if (heifBrands.has(tag(offset))) return true;
  }
  return false;
}

/** Store a small re-encoded raster and discard the original, including its photo metadata. */
export async function readReceiptAttachment(file: File): Promise<SettlementReceipt> {
  if (!file.size || file.size > maxInputBytes) throw new Error('20MB 이하의 영수증 사진을 선택해 주세요.');
  if (!isReceiptRaster(new Uint8Array(await file.slice(0, 48).arrayBuffer()))) {
    throw new Error('JPG, PNG, WebP 또는 HEIC 영수증 사진을 선택해 주세요.');
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('사진을 읽지 못했어요. JPG나 PNG로 다시 선택해 주세요.'));
      image.src = sourceUrl;
    });
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height || width * height > 80_000_000) {
      throw new Error('사진 크기가 너무 커요. 영수증이 보이도록 잘라서 다시 선택해 주세요.');
    }

    const name = file.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120).trimEnd() || '영수증 사진';
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('이 브라우저에서 사진을 준비하지 못했어요.');
    const format = canvas.toDataURL('image/webp').startsWith('data:image/webp;') ? 'image/webp' : 'image/jpeg';
    for (const bound of [1800, 1400, 1050, 800]) {
      const scale = Math.min(1, bound / Math.max(width, height));
      const nextWidth = Math.max(1, Math.round(width * scale));
      const nextHeight = Math.max(1, Math.round(height * scale));
      if (nextWidth === canvas.width && nextHeight === canvas.height && bound !== 1800) continue;
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, nextWidth, nextHeight);
      context.drawImage(image, 0, 0, nextWidth, nextHeight);

      for (const quality of [0.86, 0.73, 0.6]) {
        const url = canvas.toDataURL(format, quality);
        const attachment = { url, name };
        if (url.length <= MAX_SETTLEMENT_RECEIPT_LENGTH && isSettlementReceipt(attachment)) return attachment;
      }
    }
    throw new Error('영수증 사진을 저장할 크기로 줄이지 못했어요. 다른 사진을 선택해 주세요.');
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

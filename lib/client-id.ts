type ClientCrypto = Partial<Pick<Crypto, 'randomUUID' | 'getRandomValues'>>;

/** UUIDv4 also works on the plain HTTP address used for local Wi-Fi demos. */
export function createClientId(cryptoApi: ClientCrypto | undefined = globalThis.crypto): string {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('이 브라우저에서 안전한 요청 번호를 만들 수 없어요. 최신 브라우저로 다시 열어 주세요.');
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

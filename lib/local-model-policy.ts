import { ChatContractError } from './chat-contract';

/** Cloud aliases can forward a loopback /api/chat request to a paid remote service. */
export function isLocalOllamaModelName(model: string) {
  return model.length <= 160 && /^[A-Za-z0-9][A-Za-z0-9_.-]*(?::[A-Za-z0-9][A-Za-z0-9_.-]*)?$/.test(model) &&
    !/cloud|remote/i.test(model) && !/\.[a-z]{2,}(?=:|$)/i.test(model);
}

export function hasLocalOllamaWeights(value: unknown, minimumBillions = 0): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  const details = body.details;
  if (!details || typeof details !== 'object' || Array.isArray(details)) return false;
  const fields = details as Record<string, unknown>;
  for (const record of [body, fields, body.model_info]) {
    if (record && typeof record === 'object' && ('remote_host' in record || 'remote_model' in record)) return false;
  }
  const parameters = typeof fields.parameter_size === 'string' ? fields.parameter_size.match(/^(\d+(?:\.\d+)?)B$/i) : null;
  return fields.format === 'gguf' && !!parameters && Number(parameters[1]) > minimumBillions &&
    typeof fields.quantization_level === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(fields.quantization_level);
}

/** Inspect installed weights, without pulling or generating, immediately before every request. */
export async function verifyLocalOllamaWeights(
  config: { baseUrl: string; model: string },
  fetcher: typeof fetch,
  signal: AbortSignal,
  minimumBillions = 0,
) {
  const rejected = (): never => { throw new ChatContractError('OLLAMA_LOCAL_MODEL_UNVERIFIED', '설치된 로컬 모델을 확인하지 못해 요청을 중단했어요. 클라우드 모델은 사용하지 않습니다.', 503); };
  if (!isLocalOllamaModelName(config.model)) return rejected();
  try {
    const endpoint = new URL(config.baseUrl);
    if (!['http:', 'https:'].includes(endpoint.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') return rejected();
  } catch { return rejected(); }
  const response = await fetcher(`${config.baseUrl}/api/show`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model }), signal, redirect: 'manual',
  });
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > 262144) return rejected();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 262144) { await reader.cancel(); return rejected(); }
      text += decoder.decode(part.value, { stream: true });
    }
    const metadata = JSON.parse(text + decoder.decode());
    if (!hasLocalOllamaWeights(metadata, minimumBillions) || signal.aborted) return rejected();
  } catch (error) {
    if (error instanceof ChatContractError) throw error;
    return rejected();
  } finally { reader.releaseLock(); }
}

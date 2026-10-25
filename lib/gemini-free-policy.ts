import { ChatContractError } from './chat-contract';

export type GoogleAuthorizedUserCredentials = {
  type: 'authorized_user';
  client_id: string;
  client_secret: string;
  refresh_token: string;
};

export type GeminiFreePolicy = {
  /** OAuth access token with API Keys lookup and Cloud Billing read permissions. Server only. */
  verificationAccessToken?: string;
  /** Extracted authorized_user ADC fields. Never serialized to a chat response. */
  verificationCredentials?: GoogleAuthorizedUserCredentials;
  /** Optional API consumer/quota project. It is never evidence of free eligibility. */
  verificationProject?: string;
  maxRequestsPerMinute: number;
  maxRequestsPerDay: number;
};

const blocked = (code = 'LARGE_MODEL_FREE_TIER_UNVERIFIED'): never => {
  throw new ChatContractError(code, 'Gemini 무료 사용을 확인하지 못해 로컬 모델로 전환합니다.', 503);
};

function authorizedUserCredentials(value: unknown): GoogleAuthorizedUserCredentials | undefined {
  if (value === undefined || value === '') return;
  const invalid = () => blocked('LARGE_MODEL_FREE_POLICY_INVALID');
  if (typeof value !== 'string' || value.length > 8192) return invalid();
  let object: unknown;
  try { object = JSON.parse(value); } catch { return invalid(); }
  if (!object || typeof object !== 'object' || Array.isArray(object)) return invalid();
  const fields = object as Record<string, unknown>;
  if (Object.keys(fields).length !== 4 || Object.keys(fields).some(name => !['type', 'client_id', 'client_secret', 'refresh_token'].includes(name)) || fields.type !== 'authorized_user') return invalid();
  if (typeof fields.client_id !== 'string' || !/^\d{6,30}-[A-Za-z0-9_-]{10,100}\.apps\.googleusercontent\.com$/.test(fields.client_id)) return invalid();
  if (typeof fields.client_secret !== 'string' || !/^[A-Za-z0-9._~-]{16,512}$/.test(fields.client_secret)) return invalid();
  if (typeof fields.refresh_token !== 'string' || !/^[A-Za-z0-9._~+/-]{20,4096}$/.test(fields.refresh_token)) return invalid();
  return { type: 'authorized_user', client_id: fields.client_id, client_secret: fields.client_secret, refresh_token: fields.refresh_token };
}

/** Limits reduce traffic; they never establish that a Google project cannot incur charges. */
export function readGeminiFreePolicy(environment: Record<string, unknown>): GeminiFreePolicy {
  const bounded = (name: string, fallback: number) => {
    const value = environment[name];
    if (value === undefined || value === '') return fallback;
    const number = typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isSafeInteger(number) || number < 1 || number > fallback) return blocked('LARGE_MODEL_FREE_POLICY_INVALID');
    return number;
  };
  const credential = environment.GEMINI_BILLING_VERIFICATION_TOKEN;
  const token = typeof credential === 'string' ? credential.trim() : '';
  if (token && (token.length < 16 || token.length > 4096 || /[\r\n\x00-\x1f\x7f]/.test(token))) return blocked('LARGE_MODEL_FREE_POLICY_INVALID');
  const credentials = authorizedUserCredentials(environment.GEMINI_BILLING_VERIFICATION_CREDENTIALS);
  const project = environment.GEMINI_BILLING_VERIFICATION_PROJECT;
  if (project !== undefined && project !== '' && (typeof project !== 'string' ||
    !/^(?:[a-z][a-z0-9-]{4,28}[a-z0-9]|[1-9]\d{5,29})$/.test(project))) return blocked('LARGE_MODEL_FREE_POLICY_INVALID');
  return {
    ...(token ? { verificationAccessToken: token } : {}),
    ...(credentials ? { verificationCredentials: credentials } : {}),
    ...(project ? { verificationProject: project as string } : {}),
    maxRequestsPerMinute: bounded('GEMINI_FREE_MAX_REQUESTS_PER_MINUTE', 5),
    maxRequestsPerDay: bounded('GEMINI_FREE_MAX_REQUESTS_PER_DAY', 20),
  };
}

type Usage = { minute: number; minuteCount: number; day: number; dayCount: number; inFlight: boolean; blockedUntil: number };
const usageByKey = new Map<string, Usage>();
const freeTextModels = new Set(['gemini-3.6-flash', 'gemini-3.8-flash']);

/** Explicit models whose text generation is listed in Google's free tier. No paid-only Pro models. */
export function isFreeGeminiTextModel(model: string) { return freeTextModels.has(model); }

function usage(apiKey: string, now: number): Usage {
  let value = usageByKey.get(apiKey);
  if (!value) {
    // Fail closed if the bounded process-local table is full. Do not evict active budgets.
    if (usageByKey.size >= 128) return blocked('LARGE_MODEL_FREE_LIMIT_REACHED');
    value = { minute: Math.floor(now / 60000), minuteCount: 0, day: Math.floor(now / 86400000), dayCount: 0, inFlight: false, blockedUntil: 0 };
    usageByKey.set(apiKey, value);
  }
  if (value.minute !== Math.floor(now / 60000)) { value.minute = Math.floor(now / 60000); value.minuteCount = 0; }
  if (value.day !== Math.floor(now / 86400000)) { value.day = Math.floor(now / 86400000); value.dayCount = 0; }
  return value;
}

async function boundedJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > 16384) return blocked();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let raw = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 16384) { await reader.cancel(); return blocked(); }
      raw += decoder.decode(part.value, { stream: true });
    }
    const parsed = JSON.parse(raw + decoder.decode());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return blocked();
    return parsed;
  } catch { return blocked(); }
  finally { reader.releaseLock(); }
}

type CachedAccessToken = { token: string; expiresAt: number };
const accessTokens = new Map<string, CachedAccessToken>();
const credentialsKey = (credentials: GoogleAuthorizedUserCredentials) => JSON.stringify(credentials);

function invalidateAccessToken(credentials?: GoogleAuthorizedUserCredentials) {
  if (credentials) accessTokens.delete(credentialsKey(credentials));
}

async function verificationAccessToken(policy: GeminiFreePolicy, fetcher: typeof fetch, signal: AbortSignal): Promise<string> {
  if (policy.verificationAccessToken) return policy.verificationAccessToken;
  const credentials = policy.verificationCredentials;
  if (!credentials) return blocked();
  const key = credentialsKey(credentials);
  const cached = accessTokens.get(key);
  // Access tokens alone may be reused. Project identity and billing are never cached.
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;
  accessTokens.delete(key);
  if (accessTokens.size >= 64) {
    for (const [entry, token] of accessTokens) if (token.expiresAt <= Date.now() + 60000) accessTokens.delete(entry);
    if (accessTokens.size >= 64) return blocked();
  }
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', redirect: 'manual', signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: credentials.client_id, client_secret: credentials.client_secret, refresh_token: credentials.refresh_token }).toString(),
  });
  const body = await boundedJson(response);
  const token = body.access_token;
  if (body.error !== undefined || typeof token !== 'string' || token.length < 16 || token.length > 4096 || /[\s\x00-\x1f\x7f]/.test(token) ||
    body.token_type !== 'Bearer' || typeof body.expires_in !== 'number' || !Number.isSafeInteger(body.expires_in) || body.expires_in <= 0 || body.expires_in > 3600 || signal.aborted) return blocked();
  const expiresAt = Date.now() + body.expires_in * 1000;
  if (body.expires_in > 60) accessTokens.set(key, { token, expiresAt });
  return token;
}

/**
 * No flag, model name, API-key validity or local counter proves free eligibility.
 * Before every generation, bind the actual key to its project and verify billing
 * is disabled through Google's APIs. Missing/expired OAuth or any ambiguity denies
 * remote generation. Nothing in this module enables billing or upgrades a tier.
 */
export async function reserveGeminiFreeCall(
  apiKey: string,
  model: string,
  policy: GeminiFreePolicy | undefined,
  fetcher: typeof fetch,
  now = Date.now(),
) {
  if (!isFreeGeminiTextModel(model)) return blocked('LARGE_MODEL_FREE_MODEL_UNSUPPORTED');
  if (!policy || (!policy.verificationAccessToken && !policy.verificationCredentials)) return blocked();
  const current = usage(apiKey, now);
  if (current.inFlight || current.blockedUntil > now || current.minuteCount >= policy.maxRequestsPerMinute || current.dayCount >= policy.maxRequestsPerDay) return blocked('LARGE_MODEL_FREE_LIMIT_REACHED');
  current.inFlight = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new ChatContractError('LARGE_MODEL_FREE_TIER_UNVERIFIED', 'Gemini 무료 사용 확인 시간이 초과되어 로컬 모델로 전환합니다.', 503)); }, 5000);
  });
  const verify = async () => {
    const token = await verificationAccessToken(policy, fetcher, controller.signal);
    const init = { headers: { Authorization: `Bearer ${token}`, ...(policy.verificationProject ? { 'x-goog-user-project': policy.verificationProject } : {}) }, redirect: 'manual' as const, signal: controller.signal };
    const keyResponse = await fetcher(`https://apikeys.googleapis.com/v2/keys:lookupKey?keyString=${encodeURIComponent(apiKey)}`, init);
    if ([401, 403].includes(keyResponse.status)) invalidateAccessToken(policy.verificationCredentials);
    const key = await boundedJson(keyResponse);
    const parent = typeof key.parent === 'string' ? key.parent : '';
    const name = typeof key.name === 'string' ? key.name : '';
    const match = parent.match(/^projects\/(\d+)\/locations\/global$/);
    if (!match || !name.startsWith(parent + '/keys/') || !/^[A-Za-z0-9_-]+$/.test(name.slice((parent + '/keys/').length))) return blocked();
    const project = match[1];
    const billingResponse = await fetcher(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`, init);
    if ([401, 403].includes(billingResponse.status)) invalidateAccessToken(policy.verificationCredentials);
    const billing = await boundedJson(billingResponse);
    if (billing.billingEnabled !== false || billing.billingAccountName) return blocked('LARGE_MODEL_BILLING_ENABLED');
    // The fixed request path binds this response to the looked-up project number.
    // Billing returns a canonical project ID, which differs from that number.
    const projectId = typeof billing.projectId === 'string' ? billing.projectId : '';
    if (!/^[a-z][a-z0-9-]{4,62}[a-z0-9]$/.test(projectId) || billing.name !== `projects/${projectId}/billingInfo`) return blocked();
    if (controller.signal.aborted) return blocked();
  };
  try {
    await Promise.race([verify(), deadline]);
    current.minuteCount++;
    current.dayCount++;
    return {
      release() { current.inFlight = false; },
      quotaExceeded(retryAfter: string | null) {
        const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Math.min(Number(retryAfter), 86400) : 3600;
        current.blockedUntil = Date.now() + Math.max(seconds, 60) * 1000;
      },
    };
  } catch (error) {
    current.inFlight = false;
    controller.abort();
    if (error instanceof ChatContractError) throw error;
    return blocked();
  } finally { if (timer) clearTimeout(timer); }
}

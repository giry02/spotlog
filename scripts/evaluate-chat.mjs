import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/lib/') && specifier.startsWith('./'))
      return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
});
const { createTripSession, currentTrip } =
  await import('../lib/trip-engine.ts');
const { parseTripSession } = await import('../lib/chat-contract.ts');

// Authored demo smoke cases, independent of ai-v1's 100 interpretation cases.
export const scenarios = [
  {
    id: 'generate',
    text: '제주 1박 2일, 오전 오후로 장소 넣어줘. 숙소 추천은 빼줘.',
    check: (s) =>
      s.region === '제주' &&
      s.days === 2 &&
      [1, 2].every(
        (day) =>
          s.plan.filter((v) => v.day === day && v.kind === 'place').length >= 2,
      ) &&
      !s.plan.some((v) => v.kind === 'stay'),
  },
  {
    id: 'follow-up',
    text: '여기 근처 카페도 담아줘',
    check: (s, before) =>
      s.region === before.region &&
      s.days === before.days &&
      (s.collectedIds ?? []).length > (before.collectedIds ?? []).length &&
      before.plan.every((v) =>
        s.plan.some((after) => JSON.stringify(after) === JSON.stringify(v)),
      ),
  },
  {
    id: 'booking',
    text: '숙소는 이미 예약했어. 새 숙소 추천은 빼줘.',
    check: (s, before) =>
      s.booked &&
      !s.plan.some((v) => v.kind === 'stay' && !v.locked) &&
      before.plan
        .filter((v) => v.locked)
        .every((v) =>
          s.plan.some((a) => JSON.stringify(a) === JSON.stringify(v)),
        ),
  },
  {
    id: 'partial-edit',
    text: 'DAY 2 오후 장소만 다른 곳으로 바꿔줘. DAY 1과 숙소는 그대로 둬.',
    check: (s, before) => {
      const target = before.plan
        .filter((v) => v.day === 2 && v.kind === 'place')
        .at(-1);
      if (!target) return false;
      const changed = s.plan.find((v) => v.id === target.id);
      return (
        s.booked &&
        s.days === before.days &&
        changed?.day === 2 &&
        changed.entityId !== target.entityId &&
        before.plan
          .filter((v) => v.id !== target.id)
          .every((v) =>
            s.plan.some((a) => JSON.stringify(a) === JSON.stringify(v)),
          )
      );
    },
  },
  {
    id: 'community',
    independent: true,
    text: '다른 사람이 만든 제주 여행 보여줘',
    check: (s, before) =>
      s.stage === 'community' &&
      JSON.stringify(s.plan) === JSON.stringify(before.plan),
  },
  {
    id: 'missing-input',
    fresh: true,
    allowedModes: ['clarify'],
    requireRag: false,
    text: '여행 일정 만들어줘',
    check: (s, _before, turn) =>
      s.region === null &&
      s.plan.length === 0 &&
      turn.source === 'clarify' &&
      !turn.retrieval,
  },
];

export async function evaluateChat({
  endpoint,
  fetcher = fetch,
  cases = scenarios,
  expectedMode,
  requireRag = false,
}) {
  const url = new URL(endpoint);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('LOCAL_ENDPOINT_REQUIRED');
  let session = createTripSession();
  let sessionId = `eval_${crypto.randomUUID()}`;
  const results = [];
  let dependencyFailed = false;
  for (const item of cases) {
    if (dependencyFailed && !item.fresh && !item.independent) {
      results.push({
        id: item.id,
        status: null,
        outcome: 'SKIPPED_DEPENDENCY',
        latencyMs: 0,
      });
      continue;
    }
    if (item.fresh) {
      session = createTripSession();
      sessionId = `eval_${crypto.randomUUID()}`;
    }
    const before = structuredClone(currentTrip(session));
    const input = {
      protocolVersion: 1,
      requestId: `eval_${crypto.randomUUID()}`,
      sessionId,
      baseRevision: session.turns.at(-1).id,
      session,
      action: { type: 'message', text: item.text },
    };
    const started = performance.now();
    let outcome = 'TRANSPORT_FAILURE';
    let status = null;
    let errorCode;
    try {
      const response = await fetcher(url, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(50_000),
      });
      status = response.status;
      // Never print model text, upstream errors, secrets or full session snapshots.
      const body = await response.json();
      if (!response.ok) {
        outcome = `HTTP_${response.status}`;
        if (/^[A-Z_]{1,64}$/.test(body.error?.code ?? ''))
          errorCode = body.error.code;
      } else if (
        !['flowise', 'ollama'].includes(body.mode) &&
        !item.allowedModes?.includes(body.mode)
      )
        outcome = 'REAL_MODEL_NOT_CONNECTED';
      else if (
        expectedMode &&
        body.mode !== expectedMode &&
        !item.allowedModes?.includes(body.mode)
      )
        outcome = 'MODEL_PROVIDER_MISMATCH';
      else if (
        requireRag &&
        item.requireRag !== false &&
        !['authored-demo-data', 'curated-travel-data'].includes(body.session?.turns?.at(-1)?.retrieval?.dataMode)
      )
        outcome = 'RAG_NOT_USED';
      else if (
        body.protocolVersion !== 1 ||
        body.requestId !== input.requestId ||
        body.sessionId !== sessionId ||
        body.baseRevision !== input.baseRevision
      )
        outcome = 'CORRELATION_INVALID';
      else {
        const next = parseTripSession(body.session);
        if (
          body.revision !== next.turns.at(-1).id ||
          body.revision <= input.baseRevision
        )
          outcome = 'REVISION_INVALID';
        else {
          outcome = item.check(currentTrip(next), before, next.turns.at(-1))
            ? 'PASS'
            : 'SEMANTIC_CHECK_FAILED';
          session = next;
        }
      }
    } catch {
      /* Fixed outcome only: error messages may contain credentials. */
    }
    results.push({
      id: item.id,
      status,
      outcome,
      ...(errorCode ? { errorCode } : {}),
      latencyMs: Math.round(performance.now() - started),
    });
    // Dependent cases cannot be meaningfully measured without a valid prior result.
    if (outcome !== 'PASS') dependencyFailed = true;
  }
  return {
    dataMode: 'authored-demo-data',
    modelIdentity: 'not-verified-by-api',
    passed:
      results.length === cases.length &&
      results.every((r) => r.outcome === 'PASS'),
    plannedCases: cases.length,
    results,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const report = await evaluateChat({
      endpoint: process.env.MOA_EVAL_URL ?? 'http://127.0.0.1:3000/api/chat',
    });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.passed ? 0 : 1;
  } catch {
    console.error(
      'Evaluation setup failed. Use a local Moa /api/chat endpoint.',
    );
    process.exitCode = 1;
  }
}

# Local chatbot regression matrix

The evaluator in `scripts/evaluate-chatbot-matrix.mjs` exercises the actual local
`/api/chat` endpoint. It uses authored questions and disposable sessions. It does
not read browser storage, saved user chats or real accommodation bookings.

Run `node scripts/evaluate-chatbot-matrix.mjs --list` to inspect the cases without
making model calls. Run `node scripts/evaluate-chatbot-matrix.mjs` when the local
Flowise, RAG and Ollama services are ready and no other model evaluation is active.
Each run writes a uniquely named `work/handoff/CHATBOT_MATRIX_20261016_*.json`.

| Case | Required behavior |
| --- | --- |
| Greeting | A real model answer; no search or itinerary mutation |
| General knowledge | Explain RAG without requiring a destination search |
| Current Jeju weather | Use the weather tool and include date/source context |
| Weather without location | Ask for the location without inventing a temperature |
| Two new forest destinations | Create exactly the requested one-day cards from current RAG evidence |
| General Jeju three-day trip | Cover all three requested days using current retrieved destinations |
| Existing two-day trip to one day | Rebuild at the requested duration and remove all excluded business slots |
| Show only DAY 1 | Preserve the full duration, other days and the authored locked booking |
| Replace DAY 2 afternoon only | Change exactly one visit, attach current evidence and preserve every other visit and booking |
| No Busan RAG material | Use the actual local 14B model; give general advice without invented RAG citations or cards |
| No Busan RAG material, Gemini profile | Use the configured actual Gemini fallback with the same no-fabrication checks |

The strict existing-DAY display case now runs locally without a model or search
request and reports `mode/source: local-action`. It lists canonical saved visit
names rather than a generated summary. Its result is counted separately from
actual model responses. Other requests continue through the model pipeline.

All successful responses must match the request/session IDs and revisions, pass
the production session parser and preserve previous turns. Every newly generated
place must have evidence from that response's retrieval index. Historical fixture
evidence cannot satisfy this requirement. A selected-place request may not add
unrequested destinations. Every explicitly excluded business category must be
absent, including unresolved placeholder cards.
Any explicit "X nights, Y days" in the generated reply must agree with the actual
itinerary cards. A DAY 1 summary may not claim that a known cafe or accommodation
is planned if it is not present in DAY 1 of the original session.

Use `--case=case-id` (repeatable) for focused runs, `--endpoint=http://localhost:3001/api/chat`
for a different loopback endpoint, and `--report=work/handoff/unique-name.json` for
a chosen report name. Remote endpoints and unknown case IDs are rejected. There
are nine shared cases and one fallback case per provider profile. The current
default is `--profile=gemini`; `--profile=ollama` selects the earlier local-14B
fallback instead. The original local-14B report remains unchanged after switching
the configured runtime to Gemini.
There is no automatic model retry. Reports retain per-case correlation IDs, checks,
retrieved place IDs, evidence IDs, resulting visits, routing, reply text and
latency. Upstream error bodies and exception messages are omitted.

The evaluator's deterministic tests cover invalid correlation/revision,
demo responses, historical turn mutation, stale visit evidence, isolation between
fixtures, transport failure continuation and safe diagnostic recording. They do
not count as actual model calls. The focused contract/resources/grounding/routing
test set also passed 93 tests on 2026-10-16 before the live run. A manual review of
the first live report exposed an additional duration mismatch in the reply text;
the stricter evaluation and its regression test were added afterwards. Actual model-run
outcomes are recorded separately in the generated report and must be checked
before claiming that the live chatbot passed.

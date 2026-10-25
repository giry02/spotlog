# Local Flowise runtime

This is the native Flowise 3.1.4 server, not a prediction-compatible proxy. It is
isolated from the Moa application dependencies and listens on `127.0.0.1:3002`.
The app remains at its existing local origin. No public deployment is changed.

The Node 24 runtime and exact npm dependency lock live under the ignored
`.sites-runtime/ai/` directory. Install uses Flowise 3.1.4, with
`better-sqlite3:13.0.0` for Node 24 native compatibility and
`connect-sqlite3:0.9.16` for Flowise's existing filename-based session-store API.
The latter compatibility problem is explained in the
[upstream issue](https://github.com/FlowiseAI/Flowise/issues/6688).
Neither the Flowise source nor its authentication middleware is patched.

The published npm package still logs optional node-load failures for unused
ReAct agents (`@langchain/core/utils/uuid`) and AWS Bedrock
(`@smithy/eventstream-codec`). The local graph does not use these nodes. Its three
actual node modules are checked independently, followed by an authenticated
end-to-end prediction. A startup banner alone does not establish successful
model execution.

Run from the Moa root with the bundled Node executable (use `/` paths on macOS):

```powershell
& '.\.sites-runtime\ai\node-v24.22.0-win-x64\node.exe' scripts/flowise/check-runtime.mjs
& '.\.sites-runtime\ai\node-v24.22.0-win-x64\node.exe' scripts/flowise/local-runtime.mjs
```

In a second terminal, run the bootstrap after the server is listening:

```powershell
& '.\.sites-runtime\ai\node-v24.22.0-win-x64\node.exe' scripts/flowise/bootstrap.mjs
```

Bootstrap uses the supported registration/login APIs to initialize an owner only
when the instance is new. It creates or updates only the named Moa local flow and
its dedicated API key. Existing unrelated flows and owners are preserved. If an
instance has an owner different from the locally retained bootstrap credentials,
login fails; the script never resets an existing owner.

The native graph is `ChatPromptTemplate + ChatOllama -> LLMChain`. The prompt comes
from `docs/flowise-system-prompt.txt` each time bootstrap runs. It receives the full
Moa JSON question containing bounded history, context, server execution hints,
and the new user message. No Flowise memory node is connected. Model JSON is
validated again by the Moa server before any action is applied. RAG evidence is
server-selected input and does not grant permissions or provide executable code.

Explicit RAG itinerary creation has a separate named flow, `Moa local RAG
itinerary v1`, using `docs/flowise-itinerary-system-prompt.txt` and the same
bounded model, native node settings, and dedicated key. This shorter prompt
restricts planning to its allowed schedule actions; the general conversation
flow retains its existing prompt. Bootstrap writes the optional
`FLOWISE_PLANNER_CHATFLOW_ID` alongside the general flow ID. The Moa adapter
selects it for planning requests. `MOA_FLOWISE_BOOTSTRAP_PLANNER_ONLY=true`
creates or updates this planner while leaving an existing general flow untouched.
Both flows remain private with generic configuration overrides disabled.

The upstream 3.1.4 ChatOllama node has no `numPredict` input. The local bounded
alias `moa-qwen3-8b:20261015` reuses installed `qwen3:8b` weights with Ollama
parameters `num_predict:1200`, `num_ctx:12288`, and `temperature:0`. The retained
`Modelfile` and `prepare-model.mjs` reproduce this through Ollama's supported
create API, without downloading or changing the base model. Run prepare-model
only when that base model is already installed, then bootstrap with
`OLLAMA_MODEL=moa-qwen3-8b:20261015`. Native ChatOllama also sets thinking off,
JSON mode on, `repeatPenalty:1.1`, and `repeatLastN:128`. These supported native
node inputs reduce repetitive generation; they do not change the alias weights,
digest, prompt, or its 1200-token limit. The Moa adapter independently enforces its request timeout and
response-byte bound. The initial native smoke was against `qwen3:8b`; later alias
evaluations must be recorded separately.

Generated files:

- `.sites-runtime/ai/flowise-data/bootstrap-private.json`: generated local owner
  credentials and dedicated flow API key. Do not print, commit, or share it.
- `.sites-runtime/ai/flowise-data/config.json`: `FLOWISE_BASE_URL`,
  `FLOWISE_CHATFLOW_ID`, `FLOWISE_API_KEY`, and timeout for the Moa server.
- `.sites-runtime/ai/flowise-data/runtime-settings.json`: non-secret runtime paths
  and restricted network settings.
- `work/flowise/moa-local-chatflow.json`: importable graph with no owner credential,
  API key/id, user messages, or local database content.
- `work/flowise/moa-local-itinerary-chatflow.json` and
  `scripts/flowise/moa-local-itinerary-chatflow.json`: the separate planner graph,
  with the same secret exclusions.

Owner login and the chatflow's Bearer API key are separate. The Ollama model does
not require an API key in this loopback development setup. The prediction key has
only `chatflows:view`; it cannot update flows, prompt, model URL, or credentials.
The flow has `isPublic:false`, `apikeyid` set, and generic node/variable overrides
disabled. Bootstrap verifies a prediction without the key is denied. Flowise
3.1.4 wraps its internal `Unauthorized` error as HTTP 500 at the predictions
service boundary; bootstrap accepts only that exact denial payload or HTTP
401/403, never an arbitrary upstream failure or model response. This upstream
status-code bug is recorded rather than patched locally.

## Restricted local model access

Flowise 3.1.4's native ChatOllama uses the shared HTTP deny-list checker, whose
defaults block all loopback and private network addresses. There is no per-host
allow list. The launcher uses the documented source-level environment controls
`HTTP_SECURITY_CHECK=false` plus an explicit `HTTP_DENY_LIST`, retaining every
default blocked address/network while splitting `127.0.0.0/8` to permit exactly
`127.0.0.1`. Metadata, other private networks, multicast, IPv6 loopback, and other
127/8 addresses remain blocked. The additional `::` address is also blocked.

This setting is only for this owner-controlled, authenticated, loopback-bound
local instance. `check-runtime.mjs` calls Flowise's actual checker against local,
private, metadata, IPv6, and multicast addresses and instantiates the real prompt
and model/chain modules. It does not replace the upstream checker. See
[Flowise 3.1.4 HTTP controls](https://github.com/FlowiseAI/Flowise/blob/a65f81b/packages/components/src/httpSecurity.ts)
and [native ChatOllama](https://github.com/FlowiseAI/Flowise/blob/a65f81b/packages/components/nodes/chatmodels/ChatOllama/ChatOllama.ts).

Environment-separated settings: `FLOWISE_PORT`, `FLOWISE_BASE_URL`,
`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `MOA_FLOWISE_DATA_DIR`,
`MOA_FLOWISE_RUNTIME_DIR`, `MOA_FLOWISE_NODE`, and `MOA_FLOWISE_EXPORT_PATH`.
Provider URLs must remain HTTP `127.0.0.1` origins in these local scripts. A future
Mac deployment must review its paths/runtime, auth/secrets, DB and RAG files, and
rerun the same checks and actual model evaluations. Copying source alone does not
transfer browser localStorage, owner database, or RAG index.

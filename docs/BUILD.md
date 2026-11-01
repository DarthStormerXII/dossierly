# Dossierly build brief (agent-to-agent, binding)

Dossierly: a personal AI caseworker for life abroad. Each person gets a private agent (NVIDIA NemoClaw / OpenShell sandbox) that remembers their case. Poland is the only supported country at launch. Interpret-only: never legal or medical advice. Hackathon: Nebius × NVIDIA, Personal AI track. Freeze Fri 30 Oct 21:00 MYT.

## Hard rules
- Inference only via Nebius Token Factory (`https://api.tokenfactory.nebius.com/v1/`, OpenAI SDK). Models: `nvidia/Nemotron-3_5-Lightning` (turns, guard, summaries; thinking off), `nvidia/Nemotron-3.5-Super-VL` (agent, vision, watcher, wrap, drafts), `nvidia/Nemotron-3-Ultra-550b-a55b` (whole-case reasoning). Embeddings `Qwen/Qwen3-Embedding-8B`. Never Super-120B or Nano-30B (removed 9 Nov). No closed models in the product.
- Send `store: false` on every Token Factory call. Log every call to the ledger.
- Hosting: Cloudflare Workers Paid only (Workers, Pages, KV, D1, R2, Durable Objects, Workflows, Queues, cron). No Containers. No Worker may call Nebius AI Cloud (`api.nebius.cloud`, `auth.*.nebius.com`): it is unreachable from Cloudflare.
- Secrets only from `~/.claude/vault/inject.sh get NAME --dir <dir>` or `wrangler secret put`. Never print, log or commit a secret. Never run `nebius config list`/`nebius profile get`, never read `~/.nebius/*`.
- Next.js 16 in this repo has breaking changes: read `node_modules/next/dist/docs/` for anything you touch (route handlers, config, caching).
- zod at every API boundary. API errors return `{ error, code? }`. Files under 300 lines. No `console.log` in production code. Realistic data, sample data labelled SAMPLE.
- Commit nothing: the coordinator (Opus) commits by explicit path.
- Tavily: one shared free key (1,000 credits/month across six products). Cache every result in KV keyed by normalised query/URL. Never call on page load. Hard cap 5 live credits/day for Settla; per-session cap 1 live call; tests use recorded fixtures.
- Token Factory budget: ONE hard cap of $0.25 per UTC day (resets 00:00 UTC = 08:00 MYT), global, counted from actual tokens at list prices (`PRICES` in `src/lib/config.ts`). Every path reserves an upper-bound estimate first (`checkAndSpend`), then settles to the response usage (`settleSpend`); a failure with no usage releases the reservation. Over the cap: `ModelError("Daily limit reached. Try again after 08:00 MYT.", "over_budget", 429)`; production never serves a recorded/replay answer (replay is for `APP_ENV=local` with no key and `DEMO_FIXTURES=1` only).
- Paths covered (all in `src/lib/model/meter.ts` and `src/lib/server/tfproxy.ts`): `runModel` and the agent cloud fallback (`meterClient`, per chat call, so the JSON retry and the 404 fallback model are metered and priced by the model that answered), hub embeddings (`meteredEmbed`), and the private-agent sandboxes through the metering proxy `POST /api/tf/<sandbox>/<sig>/v1/chat/completions` (+ `GET .../v1/models`; `sig` = hex HMAC-SHA256(BRIDGE_SECRET, "tf-proxy:<sandbox>")). The bridge points each sandbox's `/sandbox/.deepagents/config.toml` `base_url` at the proxy before every task (`bridge/src/tfproxy.mjs`; `TF_PROXY=0` in `~/.settla/bridge.env` disables it). Proxied calls are recorded as `runs` (feature `agent`, ran_on `sandbox`) and ledger `model` rows (global chain, no user).
- Kill switch: set `MODELS_DISABLED=1` (`npx wrangler secret put MODELS_DISABLED`, enter `1`; `npx wrangler secret delete MODELS_DISABLED` re-enables) and every Token Factory call (runModel, cloud fallback, embeddings, proxy) refuses with `{ "error": "Model calls are switched off", "code": "models_disabled" }` (503; `ModelError` in code). No redeploy needed.

## Architecture
```
Phone (Next.js UI, Opus) ──HTTPS──> Cloudflare Worker "settla-app" (OpenNext) behind Pages "dossierly" (dossierly.pages.dev)
   case store: IndexedDB, encrypted in browser        ├─ D1 (EU jurisdiction) users, tasks, ledger, runs, hub_*, budgets, payments
                                                      ├─ KV  tavily cache, hub cache
                                                      ├─ R2 (EU) encrypted letter blobs (ciphertext only)
                                                      ├─ DO UserDO per user (rate limits, entitlement cache, deadline alarms)
                                                      ├─ Workflows: PrepareFallback, LetterPipeline, NightlyWatch (cron 02:00 UTC)
                                                      └─ /api/bridge/* <── polled outbound by the M2 bridge
M2 Mac (local hardware until first 10–20 users; production = Nebius CPU VM pool eu-north1)
   bridge/ (Node) ──> nemo-deepagents <sandbox> exec -- dcode -n "<prompt>" --json   (one OpenShell sandbox per user)
```
Personal-agent tasks (prepare, file-to-memory, ask-my-agent) go to the user's sandbox via the bridge. If no bridge claims a task within 20 s, the Worker runs the same step in the cloud with Super VL and marks `ranOn: "cloud"`. Live interpreting, letter reading (vision) and Ultra case reasoning run in the Worker directly.

## Case model (client-owned, sent as context per request)
```ts
Case { id, country: "pl", type: "temporary_residence_work", office: string, caseNumber?: string,
  profile: { name: string, language: "en"|"uk"|"hi"|"ta" },
  events: { id, date: "YYYY-MM-DD", kind: "appointment"|"letter"|"wrap"|"note", title, summary, refs?: string[] }[],
  documents: { name, have: boolean }[],
  deadlines: { id, date, what, sourceEventId }[] }
```

## API contract (all JSON; every model-backed response includes `run`)
`run = { model, ms, tokensIn, tokensOut, cachedTokens, costUsd, ranOn: "cloud"|"sandbox"|"replay" }` (array `runs` when several calls).
- Accounts (email-code only, no password): `POST /api/auth/email/request {email}` → `{challengeId,expiresIn:600,resendAfter:60}`; `POST /api/auth/email/verify {challengeId,code}` → the `/api/me` payload plus authenticated cookie. `POST /api/auth/signout` clears the session. Device/passkey routes return 410 `email_signin_required`; their stored account/credential data remains intact.
- `GET /api/me` → `{ accountId, accountKind, activeCase:"own"|"sample", plan:{kind,creditsLeft}, planChosen, lettersUsed, freeLetters:3 }` (401 `no_session` without an account); `POST /api/me/plan {choice:"free"}`; `POST /api/session {sample:boolean}` switches the active case (never creates users) and returns the same payload
- `POST /api/intro {name, language, office}` → `{ local, english, run }`
- `POST /api/interpret {speaker:"user"|"official", text, language, recent[]}` → `{ translation, adviceNotice, masked: number, run }`
- `POST /api/watch {turns[], language}` → `{ issues:[{kind, quote, explanation, clarifyLocal, clarifyUser}], run }`
- `POST /api/wrap {turns[], language, office}` → `{ summary:{headline, agreed[], bring[], nextDates[{date,what}], openQuestions[]}, run }`
- `POST /api/letters/read {pages:[dataUrl], language}` → `{ letter:{readable, title, kind, office, caseNumber, dateOnLetter, asks[], deadlineRule:{days, from:"delivery"|"letter_date"|null, quote}, fields[], lowConfidence[]}, run }`
- `POST /api/letters/link {letter, deliveryDate, case, language}` → `{ link:{relatedEventIds[], explanation, stillOpen[]}, deadline:{date, steps[]}|null, draftLocal, draftUser, runs }` (deadline computed in code, never by a model)
- `POST /api/prepare {appointment:{office, purpose, date}, case, language}` → `{ taskId }`
- `POST /api/agent/ask {question, case, language}` → `{ taskId }`
- `POST /api/agent/file {event, case}` → `{ taskId }` (files a wrap-up/letter into the agent's memory)
- `GET /api/agent/tasks/:id` → `{ status:"queued"|"running"|"done"|"failed", ranOn, sandbox?, trace:[{step, tool?, ms}], result? }`; prepare result `{ checklist:[{item, status:"have"|"missing"|"check", citation:{url,title,quote}}], phrases:[{local, user}], changes:[{title, summary, url, detectedAt}] }`
- `GET /api/ledger` → `{ entries:[{ts, kind:"model"|"egress"|"job", what, region?, action?, bytes?, masked?, hash}], root }`
- `GET /api/hub/changes?country=pl`, `GET /api/hub/country/pl` (coverage: offices, letter types, sources, languages)
- `POST /api/checkout {product:"case_pass"|"family", code?}` (Plus USD 39, Family USD 15; credits no longer sold) → `{ checkoutUrl }`; `POST /api/redeem {code}` → `{ plan }`; `POST /api/webhooks/dodo`
- `GET /api/limits` (eval/audit numbers) · `GET /api/status` → `{ models, bridge:{online, lastSeen, sandboxes}, budgets }`

## Email-code authentication (DOS-003)
- `migrations/0004_email_auth.sql` adds verified identities and short-lived challenges without rebuilding users. The old account-kind constraint remains; a linked verified identity makes `/api/me` report `accountKind: "email"`.
- Six-digit CSPRNG codes expire after 10 minutes, are stored as an HMAC under SESSION_SECRET, allow five guesses and are consumed atomically. An HttpOnly, SameSite=Strict challenge cookie binds verification to the requesting browser. POST routes enforce same-origin requests. No code is returned to the client or logged.
- Request limits: 10/minute/IP and 1/minute plus 5/hour/address. Verify: 30/minute/IP plus five guesses/challenge. Successfully delivered resends invalidate older codes. Provider failure never creates a signed-in account.
- Existing verified emails always resolve to the same account. A signed-in legacy account can attach a new verified email while preserving plan/case records; different accounts are never automatically merged. Signing in does not restore case files absent from this browser.
- The client authenticates before opening IndexedDB; keys/documents are scoped to the account ID. Deletion removes only that account's data, not the whole database or browser storage. Unowned legacy encryption records are preserved separately, never assigned to a newly verified email automatically.
- Delivery uses Resend HTTPS with idempotency keys, a 15-second timeout, and sanitized errors. Requires a working `RESEND_API_KEY` and a bare, verified **Dossierly** sender address in `EMAIL_FROM`, loaded via the vault and set as Worker secrets. Do not reuse another product's sender by default. Missing/rejected configuration gives 503 `email_unavailable`; there is no fake-code fallback.
- Deployment prerequisite: verify the product sender and actual delivery before replacing live sign-in; then apply the additive migration and deploy the custom worker with `wrangler deploy --no-autoconfig --keep-vars` to the already named Dossierly target. Local tests inject a sender and never send real mail.

## Ownership (do not edit outside your lane; ask the coordinator)
- **Opus (coordinator):** `src/app/**` pages and layouts (not `api/`), `src/components/**`, `src/lib/client/**`, `src/lib/vault/**`, `public/**`, styles.
- **A · platform:** `wrangler.jsonc`, `open-next.config.ts`, `worker/**`, `migrations/**`, `src/lib/server/**` (db, session, budgets, ledger hash chain, entitlements, rate limits), `src/lib/payments/**`, `src/app/api/{session,me,checkout,redeem,webhooks,ledger,status}/**`, `package.json` deps.
- **B · agents:** `bridge/**`, `agent/**` (policy YAML, sandbox prompts), `src/lib/agent/**`, `src/app/api/{agent,bridge}/**`, `jobs/**` (Nebius Job: NeMo Guardrails audit, stretch).
- **C · models and hub:** `src/lib/model/**`, `src/lib/features/**`, `src/lib/schemas.ts`, `src/lib/safety.ts`, `src/lib/mask/**`, `src/lib/hub/**`, `hub/**` (Poland content, SKILL.md playbooks, phrase banks), `src/app/api/{intro,interpret,watch,wrap,letters,prepare,hub,limits}/**`, `tests/unit/**` for those.
Remove obsolete scaffold routes in your lane (`check`, `summary`, `document`) when replaced.

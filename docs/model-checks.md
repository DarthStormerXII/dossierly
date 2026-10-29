# Model checks (live, Token Factory, Fri 30 Oct 2026, run from the Mac, cost about 3 cents)

Reproduce: `node --env-file=.env.local --import tsx scripts/smoke.ts probe` (capabilities) and
`... scripts/smoke.ts features [letter.png]` (every feature through the real pipeline).

## What the API accepts

| Check | Lightning | Super VL | Ultra |
|---|---|---|---|
| `store: false` | accepted | accepted | accepted |
| Thinking switch `chat_template_kwargs: {enable_thinking: false}` | works | works | works |
| Thinking switch `reasoning_effort: "none"` | works | works | works |
| `response_format: json_object` (thinking off) | works | works | works |
| `response_format: json_schema` strict (thinking off) | works | works | works |
| `logprobs: true, top_logprobs: 1` | returned | returned | returned |
| `usage.prompt_tokens_details.cached_tokens` | after a hit only (object absent on a miss) | always, 0 on a miss | always, stayed 0 in our test |
| `service_tier: "flex"` | accepted (200) | not tested | not tested |
| Image part (`image_url` data URL) | n/a | works, read a rendered Polish letter | n/a |

Decisions that follow:

- **Thinking is OFF for every call except Ultra's case reasoning.** Lightning thinks by default and writes
  "Here's a thinking process: ..." into `content`; with `max_tokens: 400` it ran out of budget and returned
  nothing usable (400 completion tokens). With the switch off the same translation is 22 tokens and 0.4 s.
  Super VL and Ultra put reasoning in a separate field, but it still burns the token budget (308 and 46 tokens
  vs 23). The layer sends `chat_template_kwargs.enable_thinking=false`; `reasoning_effort:"none"` is equivalent.
- **JSON**: `json_object` is the default `response_format` (zod validates, one corrective retry). A strict
  `json_schema` is also accepted; it is supported by `ChatRequest.json` but not used, because zod defaults and
  nullable fields do not map cleanly onto strict mode.
- **Letter confidence**: Super VL returns logprobs, so `lowConfidence` is computed from digit tokens below
  p=0.85, keyed to the JSON field they sit in. Without logprobs every date-bearing field is marked for confirmation.
- **Caching**: the prefix cache is automatic and block-granular. A 5.6k-token identical prefix, called again 3 s
  later, reported 2,096 cached tokens (Lightning) and 2,176 (Super VL). Prompts under about 2k tokens never hit
  it, which is what our interpreter prompts are (about 400 to 1,100 tokens), so `cachedTokens` is mostly 0 there.
  Prompt order is rules, then case context, then the new input, so the long case-reasoning calls can hit it.
  Ultra reported 0 cached in the same test, so do not promise savings on Ultra.

## Latency (tiny replies, thinking off, one request from Kuala Lumpur)

| Model | typical |
|---|---|
| Lightning | 0.35 to 0.55 s |
| Super VL | 0.6 to 0.8 s |
| Ultra (thinking off) | 0.5 to 0.75 s |
| Ultra (thinking on, whole-case link, 3.2k output tokens) | 8.3 s, $0.0106 |
| Super VL vision, one letter page with transcript | 3.8 to 6.5 s, $0.001 |
| `/api/interpret` end to end (translate + guard) | 1.0 to 2.8 s |

## Translation quality (the finding that changed the routing)

Same three Polish office sentences into Hindi, Tamil and Ukrainian, thinking off, temperature 0.1:

- **Lightning garbles non-English targets.** Hindi: "Proszę o paszport..." came back as "My name is Nemotron, I
  was built by NVIDIA researchers" (an echo of its own identity). Tamil mixed Arabic script and English
  ("kuṟa lacking"). Ukrainian: "decyzja" became "Декрецію", "odciski palców" became "Оскарівці пальців".
- **Super VL was usable in all nine cases** and only 100 to 200 ms slower. Ultra was worse than Super VL
  (invented "the airline price proof" for the fee receipt, "a signature is missing" for a photo).

So `interpret` and its guard run on **Lightning for English** and on **Super VL for uk, hi and ta**
(`MODEL_TABLE.interpret_ml` and `guard_ml` in `src/lib/config.ts`). A stable glossary of recurring office terms is
in the system prompt, and an echoed Polish reply is retried once. English-user and Polish-side turns keep Lightning
as specified. If the coordinator wants Lightning everywhere, change those two table rows and accept the quality drop.

## Embeddings

| Path | Model | Dimensions | Result |
|---|---|---|---|
| Token Factory | `Qwen/Qwen3-Embedding-8B` | 4096 | 200, works (fallback) |
| NVIDIA hosted (public page text only) | `nvidia/nemotron-3.5-embed-1b` (ID verified in `GET /v1/models`; the list also has `nemotron-3.5-embed-8b`, `nemotron-3-embed-1b`) | 2048 | 200, works, `input_type` query/passage honoured |

Ranking order is NVIDIA first, Qwen second, lexical overlap last (`rankPassages` reports which one ran). Set
`HUB_EMBED=qwen` to force Token Factory. Only public hub text and a generic query ever go to NVIDIA.

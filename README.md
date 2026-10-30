# Dossierly

**A personal AI caseworker for life abroad.** Each person gets their own private AI agent that remembers their whole case. It prepares them for official appointments, interprets while they talk to the official, reads the letters that follow and counts the deadlines. Poland is the first supported country.

- Live demo: **https://dossierly.pages.dev** (no login; start with Arjun's sample case, or your own)
- Judges: the code **`DOSSIERLYJUDGES`** unlocks a free Case Pass at checkout (the first letter is free anyway)
- Built for the Nebius × NVIDIA Global AI Hackathon, Personal AI track, during the hackathon period

Dossierly interprets and explains. It never gives legal or medical advice, and says so on screen.

## The problem

A non-EU worker applying for a residence-and-work permit in Poland faces a case that lasts more than a year (the Mazowiecki office averaged 394 days in 2026, per a reply to Sejm interpellation 18089), conversations at the counter in Polish, and letters such as a *wezwanie* that set a 14-day deadline counted from the day of delivery. Miss it and the application is left unexamined. Translation apps work one sentence at a time and forget everything. Agencies remember the case but cost thousands of złoty.

## What it does

| Step | Feature | Models and tools |
|---|---|---|
| Before | **Prepare**: a checklist for the next appointment from today's official pages, every line citing the exact paragraph, ticked against what the case already holds, plus the Polish phrases you will need and what changed since you last prepared | Your private agent (NVIDIA NemoClaw sandbox, LangChain Deep Agents, Nemotron 3.5 Super VL) · Tavily · NVIDIA Nemotron embeddings |
| During | **Meet**: an introduction card, then two-way interpreting in table mode (the phone lies flat, the official's half faces them); a watcher speaks up when a date, amount or document could be misunderstood | Nemotron 3.5 Lightning (English) or Super VL (Ukrainian, Hindi, Tamil) · Super VL watcher |
| After | **Wrap-up**: what was agreed, what to bring, which dates were named; filed into the agent's memory and your calendar | Super VL |
| Letters | **Read, link, reply**: photograph a letter or upload the e-Doręczenia PDF; see the verbatim Polish beside the explanation; Ultra links it to the earlier conversation; the deadline is computed in code with every step shown; a Polish cover letter is drafted | Super VL (vision, token probabilities flag uncertain dates) · Nemotron 3 Ultra |
| Always | **Interpret-only guard** on every turn, **privacy ledger** of every model call and every network call your agent made | Lightning guard · NVIDIA OpenShell audit log |

## NVIDIA and Nebius in the product

**Nemotron on Nebius Token Factory** (`https://api.tokenfactory.nebius.com/v1/`, OpenAI SDK). Each model has the job it fits:

| Model | Job |
|---|---|
| `nvidia/Nemotron-3_5-Lightning` | interpreted turns (English), the interpret-only guard, introduction cards, change summaries |
| `nvidia/Nemotron-3.5-Super-VL` | the agent inside each person's sandbox, letter reading (vision), the misunderstanding watcher, wrap-ups, drafts, turns in Ukrainian, Hindi and Tamil |
| `nvidia/Nemotron-3-Ultra-550b-a55b` | whole-case reasoning: linking a new letter to everything said and received before |

Token Factory features in use: structured JSON output with zod validation and one corrective retry, thinking switched per role (`chat_template_kwargs.enable_thinking`), token `logprobs` for confidence-gated letter fields, prompt-cache-friendly prompt order with cached tokens reported, `store: false` on every call, and the `flex` service tier for background work. `Qwen/Qwen3-Embedding-8B` on Token Factory embeds private case text. Live model checks are in [`docs/model-checks.md`](docs/model-checks.md).

**NVIDIA NemoClaw and OpenShell: one private agent per person.** Every user is assigned their own OpenShell sandbox running LangChain Deep Agents Code on Nemotron 3.5 Super VL. The sandbox keeps a masked memory of that person's case. A restricted network policy ([`agent/policy/dossierly-restricted.yaml`](agent/policy/dossierly-restricted.yaml), sha256 `2f140afa076e2966a39d349afcf28eccca7e76407abc137404f5c02056f6ff70`) allows only the official sites, Tavily and the app; everything else is denied. OpenShell's OCSF audit log of every connection is collected into the user's privacy ledger. A small outbound-only bridge ([`bridge/`](bridge/)) pulls tasks from the app and runs them with `nemo-deepagents <sandbox> exec -- dcode -n … --json`. If no sandbox answers within 20 s, the same step runs in the cloud and the screen says so.

**NVIDIA NeMo Guardrails** audits the interpret-only rule as a **Nebius Serverless Job** ([`jobs/guardrails-audit/`](jobs/guardrails-audit/)): self-check input rail run by Nemotron on Token Factory plus an output regex rail, over a red-team set. Latest run: 93.3% of harmful or advice-seeking prompts blocked, 100% of benign prompts allowed, 23 cases. This is indicative only: the rail was tuned on the same set. The job is **started on demand from the Nebius CLI**, not on a schedule; it posts signed results to the app, which publishes them on `/limits`.

**NVIDIA Nemotron embeddings** (`nvidia/nemotron-3.5-embed-1b`, NVIDIA API catalog) rank passages of **public** official pages for citations. Private case text never goes there.

**Hosting.** Production runs on a Nebius CPU VM pool in eu-north1 (about $104 a month per VM). Before revenue we cannot carry that bill, so the personal agents run on our own local hardware until our first 10–20 users. The web app runs on Cloudflare Workers behind Cloudflare Pages.

## Partners

**Tavily** Search, Extract and Map, restricted to official Polish domains, power Prepare and the official-pages watch. Every result is cached by query or URL, there is a daily credit cap, and nothing calls Tavily on page load. The watch runs as a Cloudflare cron Workflow: Tavily, then a Lightning summary of any change. It found the real 19 Oct 2026 announcement that a certificate now replaces the passport stamp.

**Dodo Payments** is the merchant of record: Case Pass 149 zł once (one residence case, 18 months), credits for one-off letters and appointments, BLIK, Przelewy24 and cards.

## Privacy you can check

- One sandbox per person, a published network policy, and a ledger of every network call the agent made, from OpenShell's own log.
- Personal identifiers (PESEL, passport and case numbers, names, addresses) are masked before any model call and restored in the answer.
- The case lives on the device, encrypted with AES-GCM; with a passkey that supports PRF, the key is derived from the passkey.
- Every model call is listed in the ledger, which is hash-chained.
- Nebius does not train on customer data. Token Factory's Zero Data Retention will be switched on at the production launch; it is off during the hackathon for speed.

## Limitations

- Speech recognition and the Polish voice are the browser's own (Chrome sends speech to Google to transcribe it); Dossierly never receives audio. NVIDIA's speech models need a GPU endpoint or gRPC, which our hosting cannot run yet.
- Lightning is weak in Hindi, Tamil and Ukrainian, so those languages route to Super VL.
- Public Token Factory endpoints have no fixed region; only dedicated endpoints pin the EU.
- The agent sees the masked case as plain text while it works. The ledger is our own record, and OpenShell describes its audit log as best-effort.
- The local agent host holds about 4–6 agents working at once. An agent run in the sandbox takes 30–45 s.
- Interface labels are in English, with Polish for the official's side; content follows the user's language.
- Sample data (Arjun Raman and his case number) is fictional and labelled SAMPLE. The office, the letter type and the deadline rules are real, quoted from their sources in [`hub/poland/coverage.json`](hub/poland/coverage.json).

## Architecture

```
Phone (Next.js) ──HTTPS──> Cloudflare Pages ──> Worker: API routes, D1 (EU), KV, R2 (EU), Durable Objects, Workflows, cron
                                                   │  model calls ──> Nebius Token Factory (Nemotron Lightning, Super VL, Ultra)
                                                   │  public pages ──> Tavily, NVIDIA Nemotron embeddings
                                                   └─ task queue <── bridge (outbound only) ── NemoClaw / OpenShell sandbox per person
Nebius Serverless Job (NeMo Guardrails audit, started from the CLI) ──signed results──> /api/bridge/job-result
```

## Run it

```bash
npm install
cp .env.example .env.local     # NEBIUS_API_KEY, TAVILY_API_KEY, NVIDIA_API_KEY, SESSION_SECRET, BRIDGE_SECRET
npm run dev                    # http://localhost:3000, platform services stubbed locally
npm test                       # unit tests
npm run deploy:cf              # build with OpenNext and deploy the Worker (wrangler.jsonc)
```

The bridge (`bridge/`) runs on a machine with NVIDIA NemoClaw installed; see `bridge/ops/`. The Guardrails audit job is in `jobs/guardrails-audit/` (`launch.sh` starts it with the Nebius CLI).

## Operator and licence

Operated by Gokul Nath (individual), contact darthstormer.ai@gmail.com. MIT licence, see [`LICENSE`](LICENSE).

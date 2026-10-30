# Dossierly

**A personal AI caseworker for life abroad.** Each person gets their own private AI agent that remembers their whole case. It prepares them for official appointments, interprets while they talk to the official, reads the letters that follow and counts the deadlines. Poland is the first supported country.

- Live demo: **https://dossierly.pages.dev** (passkey account, no email or password; start with Arjun's sample case, or your own)
- Judges: sign up (passkey or "this device only"), choose Plus on the plan step and enter **`DOSSIERLYJUDGES`**: checkout total becomes $0. The free tier already covers three letters, preparation and interpreting.
- Built for the Nebius × NVIDIA Global AI Hackathon, Personal AI track, during the hackathon period

Dossierly interprets and explains. It never gives legal or medical advice, and says so on screen.

## The problem

A non-EU worker applying for a residence-and-work permit in Poland faces a case that lasts more than a year (the Mazowiecki office averaged 394 days in 2026, per a reply to Sejm interpellation 18089), conversations at the counter in Polish, and letters such as a *wezwanie* that set a 14-day deadline counted from the day of delivery. Miss it and the application is left unexamined. Translation apps work one sentence at a time and forget everything. Agencies remember the case but cost thousands of złoty.

## What it does

| Step | Feature | Models and tools |
|---|---|---|
| Before | **Prepare**: a checklist for the next appointment from today's official pages, every line citing the exact paragraph, ticked against what the case already holds, plus the Polish phrases you will need and what changed since you last prepared | Your private agent (NVIDIA NemoClaw sandbox, LangChain Deep Agents, Nemotron 3.5 Super VL) · Tavily · NVIDIA Nemotron embeddings |
| During | **Meet**: an introduction card, then two-way interpreting in table mode (the phone lies flat, the official's half faces them); speech is transcribed by NVIDIA Parakeet, and a watcher speaks up when a date, amount or document could be misunderstood | NVIDIA Parakeet TDT 0.6B v3 (speech to text) · Nemotron 3.5 Lightning (English) or Super VL (Ukrainian, Hindi, Tamil) · Super VL watcher |
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

**NVIDIA Parakeet for speech in Meet.** `nvidia/parakeet-tdt-0.6b-v3` (NVIDIA Parakeet TDT 0.6B v3, multilingual, CC-BY-4.0; run with its MLX build) transcribes each spoken turn in Polish, English and Ukrainian. It runs on the private-agent host next to the NemoClaw sandboxes ([`bridge/asr/server.py`](bridge/asr/server.py), listening on localhost only): the browser records the turn, sends it once as a 16 kHz WAV to the app (`POST /api/asr`), the outbound-only bridge claims it, Parakeet transcribes it, and the audio is deleted as soon as the text comes back. No audio is stored. Nemotron then interprets the text as before. Measured on production, 30 Oct: exact transcripts of a Polish and an English test sentence, 0.3 to 0.75 s in the model, about 4 to 6 s end to end.

**NVIDIA NeMo Guardrails** audits the interpret-only rule as a **Nebius Serverless Job** ([`jobs/guardrails-audit/`](jobs/guardrails-audit/)): a self-check input rail run by Nemotron 3.5 Lightning on Token Factory, behind the same normalisation the app applies (invisible and bidi characters stripped, Cyrillic/Greek look-alike letters mapped to Latin, base64 and hex runs decoded and appended, long input screened in overlapping three-line windows). The rail's rule text ([`rule.txt`](jobs/guardrails-audit/rule.txt)) is the same text as `GUARD_RULE` in `src/lib/safety.ts`, which the live guard uses; a unit test fails if the two drift. Latest run (30 Oct 2026, Nebius job `aijob-e04s5dxjdkx1h5ca4t`, about 4 minutes including the install): **171 prompts, 111 of 111 harmful or advice-seeking prompts blocked (100%), 58 of 60 benign prompts allowed (96.7%)**. Split: a held-out set of 44 prompts written after the rail was final (English, Polish, Ukrainian and Hindi; zero-width, homoglyph, base64 and hex variants; harmful lines planted inside long pasted letters; tricky benign prompts that mention appeals, decisions, medicine or deadlines) scored 29 of 29 blocked and 15 of 15 allowed; the 127-prompt tuning set scored 82 of 82 blocked and 43 of 45 allowed. The two benign prompts blocked are both tuning prompts (a hex-looking case reference to read aloud, and a translation of a sentence mentioning a lawyer and an appeal). Caveats: the sets are small and were written by us; two earlier held-out drafts (52 prompts each) exposed misses, so they were folded into the tuning set and the rail was changed before the final held-out set was written; the model is not deterministic even at temperature 0, so the same prompt can flip between runs (in local runs a planted line in a long letter and two short quoted AI-directed lines were each missed some of the time, and two benign sentences were blocked every time), and a re-run can differ by a prompt or two; the audit measures the model rail, not the app's extra regex layer or its post-translation check. The job is **started on demand from the Nebius CLI**, not on a schedule; it posts signed results to the app, which publishes them on `/limits`.

**NVIDIA Nemotron embeddings** (`nvidia/nemotron-3.5-embed-1b`, NVIDIA API catalog) rank passages of **public** official pages for citations. Private case text never goes there.

**Hosting.** Production runs on a Nebius CPU VM pool in eu-north1 (about $104 a month per VM). Before revenue we cannot carry that bill, so the personal agents run on our own local hardware until our first 10–20 users. The web app runs on Cloudflare Workers behind Cloudflare Pages.

## Fine-tuned letter reader (LoRA)

We fine-tuned an NVIDIA open model to read the letters Dossierly's users receive: a Polish administrative letter in, structured JSON out (document type, issuing office, case number, required action in short English, deadline in days, what the days are counted from, and the deadline date for a given delivery date). The deadline date follows Polish civil-procedure counting: the day of the event is not counted, and a last day that falls on a Saturday, a Sunday or a public holiday moves to the next working day. Everything ran as one **Nebius Serverless Job** on a single H100 in eu-north1 ([`jobs/letter-finetune/`](jobs/letter-finetune/), job `aijob-e00wg0es4gvzjh5wnj`, started from the CLI, deleted afterwards).

- **Base model:** `nvidia/Llama-3.1-Nemotron-Nano-4B-v1.1` (4.5B parameters, loads in plain transformers), licensed under the NVIDIA Open Model License (built on Llama 3.1). LoRA with peft: rank 16, alpha 32, all attention and MLP projections, bf16, 2 epochs, 200 steps at batch 8, **189 s of training**; the whole job took about 13 minutes including provisioning, roughly **$0.97 of GPU** at an assumed list price of $4.50 per H100-hour.
- **Data:** 800 training and 200 test letters written by **Nemotron 3.5 Lightning on Token Factory** (thinking off, `store: false`), each from a structured spec sampled in code (offices of the Mazowieckie, Małopolskie and Dolnośląskie foreigners' departments, seven case-number formats, 7, 14 and 30 day deadlines, fictional names, distractor dates in the text). The **labels are the spec**, and the deadline date is computed in code from the Polish holiday calendar, never by a model. The office header, date and case number are inserted by code so labels are verbatim; letters that miss the deadline wording or the action words are dropped (157 of 1,340 calls, 11.7%). Token Factory cost about $0.13 (589k input and 398k output tokens at list price). No Claude-written text, no Tavily results, no personal data.
- **Held-out test:** 200 letters from a disjoint spec pool. 92 use training-style offices and case-number formats; 108 use an office or a case-number format never seen in training. Train against test: 0 exact duplicates, 0 near-duplicates (highest word 4-gram Jaccard 0.149, threshold 0.5), 0 shared case numbers.
- **Evaluation:** the same 200 letters, the same prompt, the same JSON parser and greedy decoding for the base model zero-shot and the tuned model, measured inside the same job.

| Metric on 200 held-out letters | Base, zero-shot | Tuned (LoRA) |
|---|---|---|
| Valid JSON | 99.0% | 100% |
| All seven fields correct | 1.0% | **87.5%** |
| Document type | 85.0% | 100% |
| Issuing office | 50.5% | 91.5% |
| Case number | 98.0% | 99.5% |
| Required action | 14.5% | 99.0% |
| Deadline in days | 84.5% | 100% |
| Counted from | 76.5% | 100% |
| **Deadline date, exact** | 19.5% | **97.5%** |
| Deadline date, when the last day rolled to a working day (108 letters) | 6 of 108 | 106 of 108 |

Honest caveats. The data is synthetic and written by one model, the test set is small (200 letters, so one letter is half a point), and the test letters come from the same generator as the training letters, so the numbers show what the tuning learns on this letter family, not a guarantee on every real letter. All-fields-correct is 94.6% on the training-style test pool and 81.5% on the pool with unseen offices and case-number formats. Both models see the same prompt, which lists the allowed actions and the Polish holidays and asks for three scratch fields (start date, raw last day, weekday) that are not scored; the base model is not prompt-tuned beyond that, and office is compared ignoring case and punctuation. **The live app still reads letters with Nemotron 3.5 Super VL on Token Factory; the adapter is not served live** (it stayed inside the job container: Token Factory does not fine-tune Nemotron and we run no always-on GPU). Raw result: [`jobs/letter-finetune/result.json`](jobs/letter-finetune/result.json).

## Partners

**Tavily** Search, Extract and Map, restricted to official Polish domains, power Prepare and the official-pages watch. Every result is cached by query or URL, there is a daily credit cap, and nothing calls Tavily on page load. The watch runs as a Cloudflare cron Workflow: Tavily, then a Lightning summary of any change. It found the real 19 Oct 2026 announcement that a certificate now replaces the passport stamp.

**Dodo Payments** is the merchant of record. Two tiers, priced in US dollars with local currency and methods (BLIK, Przelewy24, cards) at checkout: Free (three letters, appointment preparation, live interpreting) and Dossierly Plus, $39 once for one residence case over 18 months, with a $15 family add-on. Nothing renews.

## Privacy you can check

- One sandbox per person, a published network policy, and a ledger of every network call the agent made, from OpenShell's own log.
- Personal identifiers (PESEL, passport and case numbers, names, addresses) are masked before any model call and restored in the answer.
- The case lives on the device, encrypted with AES-GCM; with a passkey that supports PRF, the key is derived from the passkey.
- Every model call is listed in the ledger, which is hash-chained.
- Nebius does not train on customer data. Token Factory's Zero Data Retention will be switched on at the production launch; it is off during the hackathon for speed.

## Limitations

- Speech: on our current agent host a spoken turn takes about 4 to 6 s from the end of speech to text on screen (the model itself 0.3 to 0.75 s). Hindi and Tamil still use the browser's recognition, and the spoken Polish voice is the browser's. NVIDIA Canary 1B v2 speech translation also ran on the host (Polish to English and back) but is switched off: the 8 GB host cannot keep both speech models in memory next to the sandboxes, and transcription slowed to 20 to 50 s.
- Lightning is weak in Hindi, Tamil and Ukrainian, so those languages route to Super VL.
- Public Token Factory endpoints have no fixed region; only dedicated endpoints pin the EU.
- The agent sees the masked case as plain text while it works. The ledger is our own record, and OpenShell describes its audit log as best-effort.
- The local agent host holds about 4–6 agents working at once. An agent run in the sandbox takes 30–45 s.
- Interface labels are in English, with Polish for the official's side; content follows the user's language.
- Sample data (Arjun Raman and his case number) is fictional and labelled SAMPLE. The office, the letter type and the deadline rules are real, quoted from their sources in [`hub/poland/coverage.json`](hub/poland/coverage.json).

## Architecture

```
Phone (Next.js) ──HTTPS──> Cloudflare Pages ──> Worker: API routes, D1 (EU), KV, Durable Objects, nightly-watch Workflow, cron
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

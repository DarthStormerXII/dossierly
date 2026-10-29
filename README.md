# Newcomer Companion

A phone companion for foreigners at Polish appointments: the voivodeship office for a residence card,
hospital registration, a bank account. It introduces itself to the official in Polish, interprets in
both directions, explains Polish letters and forms, notices likely misunderstandings and says so, and
ends with a plain summary of what happens next.

It interprets. It never gives medical or legal advice, and it is not emotional support. The app never
records or stores audio.

## What it does

1. **Setup**: your language (English, Hindi, Tamil), your name, the appointment type. Stored in the browser's local storage, nothing server-side.
2. **Introduction card**: large Polish text, also spoken, telling the official an AI interpreter is helping, with a line in English for you.
3. **Live interpreting**: two push-to-talk buttons (you / the official). Each utterance is transcribed, translated, shown large in the listener's language and spoken. Typed input is always available.
4. **Speaks up**: after each official turn a larger model checks for likely misunderstandings (dates, amounts, document names, ambiguous yes/no, unanswered questions) and offers a clarifying question in Polish and your language.
5. **Document reader**: photograph a Polish letter or form; a vision model explains what it is, what it asks, deadlines and which fields to fill.
6. **Wrap-up**: what was agreed, what to bring, next dates; saved to a local history that later visits can draw on.
7. **Safety**: medical or legal questions are interpreted with a visible notice that the app only interprets.

## How NVIDIA Nemotron and Nebius Token Factory are used

All model calls are server routes using the OpenAI SDK pointed at Nebius Token Factory
(`https://api.tokenfactory.nebius.com/v1/`). Keys never reach the browser.

| Job | Model |
|---|---|
| Introduction and each interpreted turn (fast, low latency) | `nvidia/Nemotron-3_5-Lightning` |
| Misunderstanding check and end summary (reasoning; replaces Nemotron 3 Super, retired from Token Factory on 9 Nov 2026) | `nvidia/Nemotron-3.5-Super-VL` |
| Reading photographed documents | `nvidia/Nemotron-3.5-Super-VL` |

The IDs live in one table, `src/lib/config.ts`. Every model output is parsed and validated with zod;
one corrective retry, then a clear error.

Speech is not offered by Token Factory, so recognition and spoken Polish use the browser's Web Speech
API behind a `SpeechProvider` interface (`src/lib/speech/`). A Parakeet or Canary endpoint on Nebius
Serverless can replace it without touching the features.

## Run it

```bash
npm install
cp .env.example .env.local   # set NEBIUS_API_KEY
npm run dev                  # http://localhost:3000
```

No key yet? `DEMO_FIXTURES=1 npm run dev` serves recorded sample answers for one scripted
residence-card appointment. The interface shows a "Fixtures" badge while they are active.

Other commands: `npm test` (unit), `npm run test:e2e` (Playwright, phone width, fixtures),
`npm run lint`, `npm run build`, and `npm run smoke` for a live check of every model against Token Factory.

## Layout

```
src/lib/config.ts        model table, languages, appointment types
src/lib/model/           ChatClient interface: tokenfactory, meta (stub), fixtures; JSON validate + retry
src/lib/features/        prompts and calls: introduce, interpret, check, read document, summarise
src/lib/safety.ts        advice-request guard and notices
src/lib/speech/          SpeechProvider interface and the Web Speech implementation
src/lib/storage.ts       local-only profile, current appointment, history
src/app/api/*            one zod-validated route per feature
```

## Licence

MIT, see `LICENSE`.

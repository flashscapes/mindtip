# MindTip — V1

A memory-driven wellbeing companion. This is the V1 foundation: onboarding,
a home screen, and an AI conversation loop with a mocked provider and a
structured, local memory store — built so each piece can be swapped for a
real backend without rewrites.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL on your phone (same network) or resize your
browser to a mobile width — this is built mobile-first. This runs the app
against `MockAIProvider` — no server, no API key needed.

### Running with real Gemini responses

1. Get a key at https://aistudio.google.com/apikey.
2. Copy `.env.example` to `.env` and fill in `GEMINI_API_KEY`. Set
   `VITE_AI_PROVIDER=gemini` in the same file.
3. `npm run dev:full` — starts the Vite dev server and the Express server
   together (Vite proxies `/api/*` to the server on port 8787).

The two are decoupled on purpose: `npm run dev` alone still works with zero
setup (mock mode); `dev:full` is opt-in once you have a key. Switching back
to mock is just flipping `VITE_AI_PROVIDER` back to `mock` — no code change.

## What's here (V1 scope)

- **Onboarding** (`src/features/onboarding`) — 6 short questions (name, triggers,
  support style, what helps, what doesn't, proactive check-in opt-in), designed
  to take roughly 60-90 seconds. Shown only on first launch: `App.tsx` checks
  the persistent `profile.onboardingCompleted` flag on startup and routes
  straight to Home if it's already `true`. Answers are saved into the same
  `UserProfile` object via `useUserProfile` (`localStorage` for V1).
- **Home** (`src/features/conversation/Home.tsx`) — quick-action chips + free text.
- **Conversation** (`src/features/conversation/Conversation.tsx`) — brief validation → Tip.
- **Memory extraction** (`src/services/memory`, `server/services/memoryExtraction`)
  — replaces the old keyword-matching heuristic. When a conversation ends,
  `Conversation.tsx` sends the full exchange to a `MemoryExtractor`
  (interface, mirroring `AIProvider`), which asks a real model "should
  anything here be remembered?" and gets back structured JSON
  (`{ memories: [{ type, content, confidence }] }`) instead of the app
  guessing from string matches. `MockMemoryExtractor` keeps the old
  heuristic alive, but now honestly scoped to mock mode only.
  Provider-agnostic on both sides: the client's `RemoteMemoryExtractor`
  just calls `/api/extract-memory` and has no idea which model answers it;
  the server picks the concrete model via its own factory
  (`server/services/memoryExtraction/index.ts`, `MEMORY_EXTRACTION_PROVIDER`
  env var, defaults to `gemini`). Adding OpenAI or Claude later means
  writing one new class on the server and adding one line to that factory
  — nothing in `Conversation.tsx` or `MemoryService` changes.
- **AIProvider** (`src/services/ai`) — interface with two implementations:
  `MockAIProvider` (default, no setup) and `GeminiProvider` (calls our own
  server route, never exposes the API key to the browser). Which one is used
  is a single env var (`VITE_AI_PROVIDER`), read by the `createAIProvider()`
  factory — no other code needs to know or care which is active.
- **Server** (`server/`) — a small Express app with one route,
  `POST /api/generate`, that holds `GEMINI_API_KEY` and calls Gemini.
  `server/prompts/system.ts` holds MindTip's personality, kept completely
  separate from `server/prompts/buildContext.ts`, which assembles the
  per-turn structured context (profile, relevant memories, recent
  messages) — the pattern from section 23 of the spec.
- **MemoryService** (`src/services/memory`) — structured, typed memories
  (`Memory`), stored in `localStorage` for now. `getRelevant()` is the seam
  to upgrade to real retrieval later.
- **SafetyService** (`src/services/safety`) — keyword-based crisis check,
  fully decoupled from the conversational personality.

## Deliberately not built yet

A real database (memory and profile are still `localStorage`), proactive
check-ins, the "did that help?" feedback loop, and native packaging via
Capacitor. All of these have a clear seam to land in without touching the
rest of the app.

## Design tokens

- Colors: paper `#F6F5F1`, ink `#1F2421`, moss `#3F6659` (primary), amber
  `#E8A33D` (reserved for Tip callouts only).
- Type: Fraunces (display/greetings/Tip headlines), Inter (everything else).
- Tips render as a left-rule card, deliberately distinct from chat bubbles —
  not another rounded card in a stack of identical cards.

## Next logical step

The "did that help?" feedback loop (section 26) — right now extracted
memories start at a flat confidence score and never adjust. Feeding
👍/👎 on a tip back into a memory's confidence is what lets the app learn
that a stated preference ("I like meditation") isn't the same as an
observed effective strategy (section 27).

<!-- Claude push access verified 2026-09-09T17:09:04Z -->

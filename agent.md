## Project Overview

- **Goal**: deliver a landing page and embedded chat widget that helps purchase initiators map their procurement needs to KTRU codes under 44-FZ and 223-FZ. The bot converses with initiators, triggers the n8n workflow, and returns curated KTRU matches tailored to their requests.
- **Outcome**: initiators receive structured KTRU recommendations, feedback form submissions reach n8n, and the team tracks conversions through chat and event logs.
- **Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, custom API routes, n8n integration, CSV file logging.

## Key Flows

1. **Landing page** (`landing-app/src/app/page.tsx`) explains the value specifically for purchase initiators and drives them into the chat.
2. **Chat widget** (`landing-app/src/components/chat-widget.tsx`) captures initiator requests, shows statuses (latest reply, errors, loading), and posts to `POST /api/chat`.
3. **Message handling**:
   - `POST /api/chat` validates payloads, enforces rate limits, logs inbound/outbound events, and forwards the request to n8n.
   - Two execution modes: direct webhook (`N8N_WEBHOOK_URL`) or polling through the internal queue (`/api/chat/queue`, `/api/chat/result`).
   - Bot replies are persisted via `appendChatLog` into CSV files with latency and status metadata.
4. **Analytics** (`POST /api/analytics`) records UI events such as chat open and message send.
5. **Feedback** (`POST /api/feedback`) routes initiator inquiries to the production n8n webhook.
6. **Log viewer** (`landing-app/src/app/admin/logs/page.tsx`) exposes CSV chat/event logs behind an API key for production support.

## Architecture Highlights

- `src/app` — Next.js routes (pages and API).
- `src/components` — UI elements (chat, header, forms).
- `src/lib` — infrastructure utilities:
  - `log-service.ts` writes CSV logs (chat/events) with graceful error handling.
  - `n8n-client.ts` wraps n8n calls with retry logic, circuit breaker, and payload sanitization.
  - `rate-limit.ts`, `lru-cache.ts` implement in-memory rate limiting.
  - `analytics.ts`, `ab-*` provide analytics and A/B helpers.
- Logs live under `landing-app/logs/YYYY/MM/*.csv`; see `landing-app/README.md` for the structure.

## Environment and Build

- Install dependencies: run `npm install` in `/Users/ivanlusnikov/aibuyereeo/landing-app`.
- Local development: `npm run dev`, served at `http://localhost:3000`.
- Production: `npm run build && npm start`.
- Critical environment variables: `N8N_WEBHOOK_URL`, `N8N_SECRET`, `CHAT_TIMEOUT_MS`, `RATE_LIMIT_*`, `LOGS_ROOT`, `FEEDBACK_WEBHOOK_URL`.
- Deployment target: Render Web Service with a mounted disk at `/data/logs` and a health check on `/api/health`.

## Constraints and Risks (see `FUNCTIONALITY_REVIEW.md`)

- **In-memory queue and rate limiting** — do not persist across restarts and do not scale horizontally; migrate to Redis or a database.
- **Circuit breaker state** — stored in memory; multiple instances can diverge.
- **Queue race condition** — parallel workers can pick the same message without proper locking.
- **Logging growth** — CSV files expand indefinitely; add rotation/compression or adopt managed logging.
- **Testing and monitoring gaps** — no automated coverage or latency/error metrics; invest in unit/E2E tests and observability.
- **Documentation freshness** — keep this `agent.md` and `README.md` synchronized whenever architecture or flows change.

## Working in the Repository (humans)

- **New tasks**: coordinate with product, evaluate API/n8n payload impacts, refresh diagrams and fallback flows.
- **Development**: keep code under `landing-app`, honor TypeScript strictness, sanitize all external inputs.
- **Testing**: manually exercise core chat flows, verify fallback responses, and test n8n workflows in a sandbox.
- **Operations**: monitor CSV logs, health checks, and n8n latency; capture incidents in `logs/YYYY/MM/*` and run RCA.
- **Improvement priorities** (highest first):
  1. Migrate queues, results, and rate limiting to Redis.
  2. Fix queue race conditions and expose operational metrics.
  3. Adopt structured JSON logging with rotation.
  4. Add automated tests for critical modules.
  5. Document n8n response formats and error scenarios.

## Guidance for AI Assistants

- **Always consult this `agent.md` before you touch the repository. Treat it as the authoritative checklist.**
- **Context**: you operate within `/Users/ivanlusnikov/aibuyereeo`. Follow the existing style (TypeScript, ESLint, Tailwind) and keep edits ASCII-only unless the file already uses other characters.
- **Editing rules**:
  - Use Cursor tools (`read_file`, `apply_patch`, etc.) and leave any user in-progress edits untouched.
  - Prefer absolute paths in tool arguments, per repository conventions.
  - Update related docs (`README`, `agent.md`, env samples) alongside code and run lint checks (`npm run lint` or `read_lints`) after substantive edits.
  - Never delete log archives; if you must edit CSVs, create a backup first.
  - Wrap every new n8n integration with robust error handling and documentation.
- **Communication**:
  - Summarize each task concisely with the files you touched.
  - Recommend verification steps when you cannot execute them yourself.
  - Pause and ask the user if you encounter unexpected local diffs.
- **Quality bar**:
  - Respect the constraints noted in the risk section (scalability, circuit breaker, logging).
  - Preserve rate limiting and data safety.
  - Suggest Redis/monitoring/test improvements when relevant.

This document is the entry point for every human collaborator and AI agent. Whenever architecture, user journeys, or operational procedures change, update the **Project Overview**, **Key Flows**, and **Guidance for AI Assistants** sections so anyone working in the repository always relies on an up-to-date `agent.md`. Failing to check this file before contributing is considered a process violation.


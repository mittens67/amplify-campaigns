# Amplify API

Node 24 + Express 5, written in TypeScript and run with `tsx`, so there's no build step. Postgres comes from Supabase in production, or embedded PGlite locally. The deployed instance is at https://amplify-api-4o7s.onrender.com. For the product overview, see the [root README](../../README.md).

## Run

```bash
npm run api                    # from the repo root: watch mode on :4000
npm run seed -w @amplify/api   # re-seed demo data
npm run smoke -w @amplify/api  # 39 end-to-end checks; API_URL=… to target another server
```

Without `DATABASE_URL`, the API uses PGlite, an embedded Postgres, and seeds itself on first boot. Without an AI key, drafting falls back to a template and voice input is turned off.

## Environment

| Variable | Needed | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | Supabase **transaction pooler** URL (port 6543). The client runs with `prepare: false`. |
| `JWT_SECRET` | Production | Signs session tokens. Render generates it. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | For uploads | Storage bucket `SUPABASE_BUCKET` (default `campaign-media`). |
| `GEMINI_API_KEY` | Optional | Voice transcription and drafting. `GEMINI_MODELS` sets the fallback order. |
| `MISTRAL_API_KEY` | Optional | Alternative AI provider (`AI_PROVIDER=mistral`). |
| `PORT` | Optional | Default 4000. |

## Layout

```
src/app.ts         Middleware (helmet, CORS, rate limits), static media, routes, error envelope
src/routes/        auth.ts · campaigns.ts (discovery, drafts, contributions, activity, uploads, AI) · review.ts (reviewer + demo)
src/services/
  transitions.ts   The only place campaign status changes: one transaction → lock, guard, update, audit event, notifications
  contributions.ts Quotes, idempotent charges, settlement, refunds
  payments.ts      PaymentProvider interface + the simulated provider (succeed / decline / verify / cancel)
  engine.ts        Lazy time-based rules: deadlines, funding end, simulated ad days. Runs in the background, throttled to every 15 s
  campaigns.ts     Feed and search, public projection (no private data), drafts with a version check, analytics
  notifications.ts In-app activity, deduplicated per event
  ai.ts            Gemini / Mistral with model fallback and a template fallback
  storage.ts       Upload checks (magic bytes, size) → Supabase Storage
src/lib/           auth (JWT, scrypt, guest ids, roles), clock (demo time offset), errors
src/db/            postgres.js / PGlite client and schema.sql
src/seed/          17 demo campaigns covering every lifecycle state, plus demo users
```

## Endpoints

Every response sends errors as `{ "error": { "code", "message", "fields?" } }`, and every response carries `X-Server-Now`, so the app's countdowns match the demo clock. Requests identify a guest with `X-Guest-Id`, or a user with `Authorization: Bearer <jwt>`.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/demo`, `GET/PATCH /me` |
| Discovery | `GET /campaigns` (q, category, status, sort, cursor), `GET /campaigns/:id` |
| Drafts | `POST /campaigns`, `PUT /campaigns/:id/draft` (version-checked), `POST /campaigns/:id/submit`, `POST /campaigns/:id/cancel`, `DELETE /campaigns/:id` |
| Backing | `POST /contributions` (Idempotency-Key), `GET /contributions/:id` (polled; settles pending), `GET /me/contributions` |
| Engagement | `POST /campaigns/:id/save`, `/follow`, `/feedback`, `/report`, `/updates`; `GET /me/campaigns`, `/me/saved` |
| Analytics | `GET /campaigns/:id/analytics` (creator or reviewer) |
| Activity | `GET /activity`, `POST /activity/read`, `GET/PUT /activity/prefs` |
| Media + AI | `POST /uploads`, `POST /ai/transcribe`, `POST /ai/draft`, `GET /ai/status` |
| Review (reviewer only) | `GET /review/queue`, `GET /review/counts`, `GET /review/campaigns/:id`, `POST /review/campaigns/:id/decision` / `prepare` / `launch` / `finish` / `halt`, `POST /review/reports/:id/resolve` |
| Demo (reviewer only) | `GET /demo/state`, `POST /demo/advance`, `/demo/settle`, `/demo/reset` |
| Ops | `GET /health` (checks the database) |

## Data

Tables (`src/db/schema.sql`):
- `users`
- `campaigns` (draft and published content stored as JSONB)
- `campaign_events` (audit log)
- `reviews`
- `contributions`
- `distribution_metrics`
- `campaign_updates`
- `notifications`, `notification_prefs`
- `follows`, `saves`, `feedback_votes`, `campaign_reports`
- `demo_state`

Row-level security is on with no policies, so Supabase's public APIs can't read anything. Only this server, connecting directly, can.

Money is stored as integer cents. Every JSON parameter is cast `$n::text::jsonb`, because postgres.js would otherwise encode strings twice.

# Amplify: community-funded message amplification

A mobile prototype for the Campaign Amplification hackathon. Creators publish reviewed, sourced campaigns. Backers pool money for the **ads that carry a message beyond the creator's network**, which is not a donation to the cause. Everyone sees what was spent and who was reached.

```
apps/mobile      Expo SDK 58 · React Native · expo-router · TypeScript
apps/api         Node + Express · Postgres (Supabase in prod, embedded PGlite locally)
packages/domain  Shared rules: fees, reach model, lifecycle state machine, validation, copy
```

## Run locally

```bash
npm install
npm test                       # domain unit tests
npm run api                    # API on :4000 (embedded Postgres, seeded automatically)
npm run mobile                 # Expo; open in Expo Go or press w for web
npm run smoke -w @amplify/api  # end-to-end API checks (mutates data; reset afterwards)
```

On a physical phone, the app talks to the API on the same machine that serves the bundle. To use a deployed API instead, set `EXPO_PUBLIC_API_URL`.

**Demo accounts** (one tap on the sign-in screen):

| Account | Role | What they show |
| --- | --- | --- |
| Maya | Creator | A campaign running ads, a draft, and a campaign with changes requested |
| Sam | Backer | Several backed campaigns, a completed report, and a refund |
| Priya | Reviewer | The review console and demo controls (advance the clock, settle payments, reset data) |

## Key product rules (in `packages/domain`)

**Money:** 20% platform fee, 80% ad budget, and 2.9% + 30¢ processing added on top. Amounts are in integer cents, and the parts always sum exactly to the contribution.

**Reach:** an illustrative estimate of ≈27 people per $1 (33.75 per ad dollar). It's always labelled *Est.*, and kept separate from *Measured* delivery.

**Lifecycle:** Draft → Submitted → Changes requested / Approved → Funding → Goal reached / Funding ended → Preparing → Promoting → Completed. The exception states are Rejected, Cancelled, Failed and Refund pending → Refunded.

**Review:** reviewers record Fact-Check, Communication Integrity and Shared Reality, each as pass, concern or fail. No trust score is shown.

**Distribution:** funding never launches ads by itself. Ads launch only after a reviewer confirms the ad setup.

## Backend design notes

**Transactions and row locks.** The API connects to Postgres directly (postgres.js), so every lifecycle change runs in one transaction: row lock, guard, state change, audit event, then notifications.

**Payments.** Behind a `PaymentProvider` interface. The current provider is a simulated checkout that supports succeed, decline, verify/pending and cancel. The API never holds a lock while waiting on the provider. Settlement is idempotent, and the Idempotency-Key header makes retries safe.

**Ad delivery.** Behind a `DistributionProvider` interface. The current one generates daily simulated spend, impressions, reach and clicks, and reports are built from that data.

**Time-based rules.** These are evaluated lazily on read, with no cron job. Demo time can be advanced on purpose.

**Auth and identity.** JWT auth with scrypt password hashes. Guests get a random device id, and anything a guest creates moves to their account when they sign in. Backer names are private by default.

**Uploads and AI.** Uploads are checked server-side by magic bytes and size. AI (Gemini, or Mistral as an alternative) only suggests field values, and falls back to a deterministic template when unavailable. It never sets the funding goal.

## Deploy

1. **Supabase.** Create a project and copy the pooler connection string (transaction mode, port 6543). The schema and seed data are created on first boot.
2. **Render.** Create a Blueprint from `render.yaml`, then set these environment variables:
   - `DATABASE_URL`
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (for uploads)
   - `GEMINI_API_KEY` (optional; or `MISTRAL_API_KEY`)

   Ping `/health` every 10 minutes (for example with cron-job.org) to keep both services awake.
3. **APK.** Set `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json`, then run:
   ```bash
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile preview
   ```

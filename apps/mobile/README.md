# Amplify mobile app

Expo SDK 58, React Native 0.88, TypeScript and expo-router. For the product overview and the design decisions, see the [root README](../../README.md).

## Where the app starts

`package.json` sets `"main": "expo-router/entry"`. expo-router turns every file in `src/app/` into a screen:

| File | What it is |
| --- | --- |
| `src/app/_layout.tsx` | **Root layout.** Loads fonts and persisted state, starts waking the API, and defines the root stack (tabs plus modal screens). It also mounts the toast, glossary and "waking up" overlays. |
| `src/app/(tabs)/_layout.tsx` | The five tabs: Home, Explore, Create, Activity, Profile. |
| `src/app/(tabs)/index.tsx` | Home. The first screen after onboarding. |
| `src/app/onboarding.tsx` | The 3-page intro, shown on first launch. |
| `src/app/campaign/[id]/…` | Campaign detail, updates and final report. |
| `src/app/back/[id].tsx` | Back flow: amount → review → simulated checkout → result. |
| `src/app/create/…` | The create wizard (`[id].tsx`), voice drafting (`voice.tsx`) and the submit confirmation. |
| `src/app/me/…` | Profile pages: your campaigns, backed, saved, payments, receipts, notification settings. |
| `src/app/review/…` | Reviewer console, review inspector and demo controls (reviewer role only). |
| `src/app/info/[page].tsx` | Static pages: how it works, FAQs, terms, privacy… |

## Folders

```
src/app        Routes (above)
src/features   Larger components: CampaignView (shared by detail + wizard preview), create wizard steps,
               AI-draft merge, reach rings, tab tour + checklist
src/ui         Design system: theme tokens, Text, Button, Card, Chip, TextField, sheets, toasts,
               and the signature pieces MoneyFlow, JourneyRail, Estimate / Measured
src/lib        api.ts (fetch client, uploads, server wake-up), queries.ts (React Query hooks + keys),
               session.ts / tour.ts (Zustand stores persisted to AsyncStorage), media.ts, format.ts
```

## State

- **Server data** lives in React Query, with optimistic save and follow. It's invalidated after a contribution succeeds.
- **The session** (token, guest id), **drafts** and **tour progress** live in Zustand stores, persisted with AsyncStorage.
  - Drafts are local-first: they sync to `PUT /campaigns/:id/draft` after 1.2 s, with a version check.
- **Business rules** come from `@amplify/domain`, which the API also uses: quotes, validation and the lifecycle.

## Running it

Expo Go on the Play Store is still on SDK 57, so on a phone use the **development build**:

```bash
npx eas-cli@latest build -p android --profile development   # once; install the APK it gives you
npm run mobile:tunnel                                       # from the repo root
```

Point the app at an API with `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`. The options are listed in `.env.example`:
- same Wi-Fi → your PC's LAN IP on port 4000
- a cloudflared tunnel
- the deployed Render URL

The **web** version (`npm run mobile`, then press `w`) works for most flows. Generating the ad image and recording voice are phone-only.

## Builds (`eas.json`)

| Profile | Output | API |
| --- | --- | --- |
| `development` | Dev-client APK | `.env` |
| `preview` | Installable APK (what's submitted) | Render |
| `production` | Play Store app bundle | Render |

## Checks

```bash
npx tsc --noEmit
```

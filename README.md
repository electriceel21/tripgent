# Tripgent

AI travel concierge: personalized advice (neighborhoods, food, day trips). **Sponsors** fund destination programs; **travelers** use the agent for free and earn **USDC** rewards (Circle Gateway nanopayments / ARC Mini Pay).

## Two product surfaces

| Who | What | Where in repo | Stack |
|-----|------|---------------|--------|
| **Your team (B2B)** | Admin web app | `apps/admin` | Next.js — runs in the **browser** |
| **Travelers (consumers)** | Mobile chatbot agent | `apps/mobile` | Expo + **Dynamic** (auth / embedded wallet) + chat UI calling **`apps/api`** |

Backend for AI and data: **`apps/api`** — **Supabase (Postgres)** for sponsors, locations, reward pools, offers, purchases, and user tiers; **0G** for chat inference; Circle seller hooks to add.

Shared TypeScript types: `packages/shared`.

## Why compute stays on the API

The 0G serving broker uses **ethers v6**. Dynamic’s [React Native SDK](https://www.dynamic.xyz/docs/react-native/reference/introduction) does **not** support Ethers in-app — use **Viem** (already wired via `ViemExtension`) for on-device chain actions, and keep **0G inference + `processResponse`** on `apps/api`.

Reference: [0G Compute Inference](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference).

## Customer app: Dynamic + native build

The Dynamic React Native SDK is **not compatible with Expo Go** (custom native modules). After installing dependencies:

```bash
cd apps/mobile
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

See the [React Native quickstart](https://www.dynamic.xyz/docs/react-native/reference/quickstart): set `EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID`, **`EXPO_PUBLIC_DYNAMIC_APP_ORIGIN`**, allowlist the origin in the Dynamic dashboard, enable EVM + embedded wallets + a sign-in method, and register your app deeplink scheme for social login.

## Prerequisites

- Node.js **≥ 20** (0G docs recommend **≥ 22** for compute tooling)
- `pnpm` 9.x
- 0G-funded server wallet + provider address (`apps/api`)
- Dynamic environment ID + app origin (`apps/mobile`)
- Circle Gateway / nanopayments when you wire rewards ([Nanopayments](https://developers.circle.com/gateway/nanopayments))

## Setup

Use **one** env file at the **repository root**:

```bash
pnpm install
cp .env.example .env
# Edit .env: Supabase, chat keys (0G proxy or OpenAI or broker), EXPO_PUBLIC_* for mobile, etc.
```

- **`apps/api`** loads `../../.env` automatically (`load-root-env`).
- **`apps/admin`** loads the same file from `next.config.ts` (plus optional `apps/admin/.env.local` for overrides).
- **`apps/mobile`** injects `../../.env` via **`dotenv-cli`** on `pnpm start` / `ios` / `android`.

**EAS / store builds** do not read the repo-root `.env`; set **`EXPO_PUBLIC_*`** (and secrets) in [EAS env](https://docs.expo.dev/build-reference/variables/) or your CI.

Run **admin + API together** (recommended — one origin, same as Vercel):

```bash
pnpm dev:admin
# http://127.0.0.1:3000/health , /v1/chat , /v1/admin/* (rewrites to /api/*)
```

Optional **standalone API** on port 8787 (e.g. mobile pointed at LAN IP):

```bash
pnpm dev:api
```

Run **customer mobile chatbot** (dev client after prebuild):

```bash
pnpm dev:mobile
# alias: pnpm dev:customer
```

**Android APK (EAS):** `apps/mobile/eas.json` defines a **`preview`** profile that builds an **APK** for internal install. From `apps/mobile`, run **`eas login`**, then **`pnpm eas:init`** (links the app to your Expo account and writes `expo.extra.eas.projectId` in `app.json`). Configure **`EXPO_PUBLIC_TRIPGENT_API_URL`**, **`EXPO_PUBLIC_DYNAMIC_*`**, etc. as [EAS environment variables](https://docs.expo.dev/build-reference/variables/) for the preview profile, then **`pnpm eas:build:android`**. CI can use **`EXPO_TOKEN`** instead of `eas login`.

## API

- **`/v1/admin/*`** — CRUD for sponsors, locations, reward pools, offers, purchases; dashboard counts. Uses **Supabase** via `SUPABASE_SERVICE_ROLE_KEY`. Set **`ADMIN_API_KEY`** and send `x-admin-key` (or `Authorization: Bearer`) in production.
- **`GET /v1/admin/sponsors/by-slug/:slug/tier-rates`** and **`GET /v1/admin/sponsors/:id/tier-rates`** — per-tier USDC rates (after migration **`002_air_monaco_mock.sql`**).
- **`POST /v1/rewards/accrue`** — apply sponsor tier rate to pool spend (user + sponsor slug). **`GET /v1/rewards/accruals`** — ledger. Requires migration **`003_reward_accrual_usdc.sql`**. Auth: **`ADMIN_API_KEY`** (same as admin) or **`API_AUTH_BEARER`** (same as chat).
- `GET /v1/users/profile?external_id=` — traveler tier, reputation, purchase history.
- `POST /v1/chat` — **0G direct proxy:** set **`ZG_COMPUTE_PROXY_URL`** (e.g. `https://…/v1/proxy`) + **`ZG_COMPUTE_SECRET`** (`app-sk-…` from CLI) + optional **`ZG_COMPUTE_MODEL`** (default `qwen/qwen-2.5-7b-instruct`). Same URL + **`OPENAI_API_KEY`** holding `app-sk-…` also works. Otherwise **OpenAI-compatible** (`OPENAI_*` / `LLM_*`) or **0G broker** (`RPC_URL`, `PRIVATE_KEY`, `PROVIDER_ADDRESS`). Optional JSON: **`destination_slug`: `"monaco"`** (loads Monaco mock context from DB after migration **`004_monaco_destination_mocks.sql`**), **`user_external_id`** + optional **`display_name`** — on success, accrues a micro-reward from the **Air Monaco** pool per completed reply (**reason** `monaco_search`; requires **`003`** + tier rates in **`002`**).
- `GET /v1/payments/status` — Circle nanopayments stub.

**Tests:** `pnpm --filter @tripgent/api test` runs tier math always; full DB flow runs only if Supabase env vars are set.

**Admin dashboard all zeros after SQL?** The API must use **`SUPABASE_SERVICE_ROLE_KEY` = service_role** (Supabase → Project Settings → API), not the **anon** key — with RLS and no policies for `anon`, selects return no rows. Confirm the **Supabase host** on the admin home matches the project where you ran SQL; run `apps/api/supabase/VERIFY_COUNTS.sql` in that project’s SQL editor to compare counts.

**Auth:** If `API_AUTH_BEARER` is **unset**, the API accepts requests without a matching secret (fine for local dev). The mobile app sends **`Authorization: Bearer <Dynamic JWT>`** from `client.auth.token` when the user is signed in. For production, verify that JWT on the server (Dynamic docs) instead of relying on an open API.

## Deploying to Vercel (admin + API in one project)

The Hono app is mounted from **`@tripgent/api`** on **`apps/admin/src/app/api/[[...path]]/route.ts`**. Public URLs stay **`/health`** and **`/v1/*`** via Next **rewrites** to **`/api/*`**.

1. Import the Git repo on [Vercel](https://vercel.com).
2. Set **Root Directory** to **`apps/admin`**.
3. **Environment variables** (Production / Preview): mirror your local **root** **`.env`** (see **`.env.example`** in the repo) — at minimum **`SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`**, plus chat keys (**`ZG_COMPUTE_*`** / **`OPENAI_*`** / **`RPC_URL`**, **`PRIVATE_KEY`**, **`PROVIDER_ADDRESS`**) as you use locally. Add **`ADMIN_API_KEY`**, **`API_AUTH_BEARER`**, **`CORS_ORIGINS`** (comma-separated; include your Expo / web origins when calling from a device) as needed.
4. Vercel uses **`apps/admin/vercel.json`**: install from the monorepo root with pnpm, then builds **`@tripgent/api`** and **`@tripgent/admin`**.
5. **Mobile:** set **`EXPO_PUBLIC_TRIPGENT_API_URL`** to `https://<your-deployment>.vercel.app` (no trailing slash). Paths are still **`/v1/chat`**, etc.
6. **Function duration:** `route.ts` sets **`maxDuration = 300`** (requires Vercel Pro or higher for more than 10s). **Hobby** caps at **10s** — long LLM calls may time out unless you upgrade or use a faster model path.
7. **Deployment Protection:** If **`/health`** or the admin dashboard shows **401** and **HTML** (“Authentication Required”), Vercel is gating the whole deployment — not Tripgent. Either **turn off** protection for Preview/Production (Project → Settings → Deployment Protection), or enable **[Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)** so **`VERCEL_AUTOMATION_BYPASS_SECRET`** is set and server-side checks can reach your API.

## Next steps

1. Verify **Dynamic JWT** on `POST /v1/chat` when you lock down the API.
2. **Circle:** fund a **Developer-Controlled** treasury wallet, deposit into **Gateway** on Arc testnet, then enable env vars so **`reward_wallet_address`** receives mints after accrual ([unified balance EVM](https://developers.circle.com/gateway/quickstarts/unified-balance-evm)); use [nanopayments](https://developers.circle.com/gateway/nanopayments) only if you charge travelers per request (x402).
3. **Admin UI** on Vercel uses the **same origin** by default (no **`NEXT_PUBLIC_TRIPGENT_API_URL`**). For a **separate** API host, set **`NEXT_PUBLIC_TRIPGENT_API_URL`** and server **`TRIPGENT_API_URL`**. Prefer **server-only** **`ADMIN_API_KEY`** (avoid exposing secrets with **`NEXT_PUBLIC_ADMIN_API_KEY`** on public URLs).

0G skills: `.0g-skills/` (see `.cursor/rules/0g-skills-context.mdc`).

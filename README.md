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

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role = server only)
# RPC_URL, PRIVATE_KEY, PROVIDER_ADDRESS (for /v1/chat)

cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_* ; use your LAN IP for EXPO_PUBLIC_TRIPGENT_API_URL on a physical device
```

Run API:

```bash
pnpm dev:api
```

Run **admin web app**:

```bash
pnpm dev:admin
```

Run **customer mobile chatbot** (dev client after prebuild):

```bash
pnpm dev:mobile
# alias: pnpm dev:customer
```

## API

- **`/v1/admin/*`** — CRUD for sponsors, locations, reward pools, offers, purchases; dashboard counts. Uses **Supabase** via `SUPABASE_SERVICE_ROLE_KEY`. Set **`ADMIN_API_KEY`** and send `x-admin-key` (or `Authorization: Bearer`) in production.
- **`GET /v1/admin/sponsors/by-slug/:slug/tier-rates`** and **`GET /v1/admin/sponsors/:id/tier-rates`** — per-tier USDC rates (after migration **`002_air_monaco_mock.sql`**).
- **`POST /v1/rewards/accrue`** — apply sponsor tier rate to pool spend (user + sponsor slug). **`GET /v1/rewards/accruals`** — ledger. Requires migration **`003_reward_accrual_usdc.sql`**. Auth: **`ADMIN_API_KEY`** (same as admin) or **`API_AUTH_BEARER`** (same as chat).
- `GET /v1/users/profile?external_id=` — traveler tier, reputation, purchase history.
- `POST /v1/chat` — **0G direct proxy:** set **`ZG_COMPUTE_PROXY_URL`** (e.g. `https://…/v1/proxy`) + **`ZG_COMPUTE_SECRET`** (`app-sk-…` from CLI) + optional **`ZG_COMPUTE_MODEL`** (default `qwen/qwen-2.5-7b-instruct`). Same URL + **`OPENAI_API_KEY`** holding `app-sk-…` also works. Otherwise **OpenAI-compatible** (`OPENAI_*` / `LLM_*`) or **0G broker** (`RPC_URL`, `PRIVATE_KEY`, `PROVIDER_ADDRESS`).
- `GET /v1/payments/status` — Circle nanopayments stub.

**Tests:** `pnpm --filter @tripgent/api test` runs tier math always; full DB flow runs only if Supabase env vars are set.

**Auth:** If `API_AUTH_BEARER` is **unset**, the API accepts requests without a matching secret (fine for local dev). The mobile app sends **`Authorization: Bearer <Dynamic JWT>`** from `client.auth.token` when the user is signed in. For production, verify that JWT on the server (Dynamic docs) instead of relying on an open API.

## Next steps

1. Verify **Dynamic JWT** on `POST /v1/chat` when you lock down the API.
2. **Circle** buyer + seller flows for rewards ([nanopayments](https://developers.circle.com/gateway/nanopayments)).
3. **Admin** UI: nav + CRUD in `apps/admin` — set **`NEXT_PUBLIC_TRIPGENT_API_URL`** and optional **`NEXT_PUBLIC_ADMIN_API_KEY`** for browser calls; server dashboard uses **`TRIPGENT_API_URL`** + **`ADMIN_API_KEY`**.

0G skills: `.0g-skills/` (see `.cursor/rules/0g-skills-context.mdc`).

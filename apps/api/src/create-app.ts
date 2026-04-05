import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ChatRequest } from "@tripgent/shared";
import { accrueSponsorTierReward } from "./accrue-reward.js";
import {
  gatewayCircleRewardEnvConfigured,
  isValidEvmAddress,
  mintGatewayRewardUsdc,
} from "./gateway-circle-reward.js";
import { createAdminApp, getUserProfileHandler } from "./admin-routes.js";
import {
  buildMonacoSystemAugmentation,
  MONACO_SPONSOR_SLUG,
} from "./monaco-context.js";
import { createRewardsApp } from "./rewards-routes.js";
import { createServiceClient } from "./db.js";
import {
  getOpenAICompatConfigFromEnv,
  runChatCompletion,
  runOpenAICompatibleChat,
} from "./inference.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

/**
 * When Dynamic (or client) omits ids, Monaco accrual uses synthetic `wallet:0x…`.
 * Set `REWARD_FALLBACK_WALLET_ADDRESS` to override; set `REWARD_FALLBACK_DISABLED=1` to turn off.
 * If env is unset, a built-in default wallet is used so anonymous searches still accrue (this repo).
 */
const DEFAULT_ANON_REWARD_WALLET = "0xEB4c34f9170E992cBBffF1902C2b74CBfbD3f652";

function rewardFallbackWalletFromEnv(): string | undefined {
  if (process.env.REWARD_FALLBACK_DISABLED === "1") return undefined;
  const fromEnv = process.env.REWARD_FALLBACK_WALLET_ADDRESS?.trim();
  const candidate = fromEnv || DEFAULT_ANON_REWARD_WALLET;
  if (!candidate) return undefined;
  return isValidEvmAddress(candidate) ? candidate : undefined;
}

function assertInferenceConfig0g() {
  return {
    rpcUrl: requireEnv("RPC_URL"),
    privateKey: requireEnv("PRIVATE_KEY"),
    providerAddress: requireEnv("PROVIDER_ADDRESS"),
  };
}

/** Optional shared secret: mobile sends Authorization: Bearer <token> */
function authOk(c: { req: { header: (n: string) => string | undefined } }): boolean {
  const expected = process.env.API_AUTH_BEARER;
  if (!expected) return true;
  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

const TRAVEL_SYSTEM = `You are Tripgent, a concise AI travel concierge. You give practical, personalized advice on neighborhoods, food, day trips, and local experiences. You are not a booking engine; suggest types of places and what to look for. If the user asks about sponsored destinations, be helpful and natural without sounding like an ad read.`;

/**
 * Shared Hono app for Node (`apps/api` dev server) and Vercel (Next.js route handler).
 */
export function createTripgentApp(): Hono {
  const supabase = createServiceClient();

  const app = new Hono();

  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: corsOrigins.length ? corsOrigins : "*",
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "x-admin-key"],
    })
  );

  app.get("/health", (c) => c.json({ ok: true }));

  app.route("/v1/admin", createAdminApp(supabase));
  app.route("/v1/rewards", createRewardsApp(supabase));
  app.get("/v1/users/profile", getUserProfileHandler(supabase));

  /** Browsers open URLs with GET; chat inference is POST-only. */
  app.get("/v1/chat", (c) =>
    c.json({
      service: "Tripgent /v1/chat",
      note: "This endpoint does not serve a web page. Visiting it in a browser sends GET; inference uses POST only.",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer <optional if API_AUTH_BEARER is set>",
      },
      body: {
        messages: [{ role: "user", content: "Your question" }],
        destination_slug: "monaco",
        user_external_id: "<optional Dynamic user id for pool accrual>",
        reward_wallet_address:
          "<optional 0x… Arc EVM address for Circle Gateway USDC mint when treasury is configured>",
      },
      clients: "Expo app (apps/mobile) or curl / Postman against this same URL.",
    })
  );

  app.post("/v1/chat", async (c) => {
    if (!authOk(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let body: ChatRequest;
    try {
      body = (await c.req.json()) as ChatRequest;
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: "messages[] required" }, 400);
    }

    let systemContent = TRAVEL_SYSTEM;
    const dest = body.destination_slug?.trim().toLowerCase();
    if (dest === "monaco") {
      systemContent += "\n\n" + (await buildMonacoSystemAugmentation(supabase));
    }

    const messages = [
      { role: "system" as const, content: systemContent },
      ...body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const openaiCompat = getOpenAICompatConfigFromEnv();

    try {
      let content: string;
      if (openaiCompat) {
        content = (await runOpenAICompatibleChat(messages, openaiCompat)).content;
      } else {
        let config;
        try {
          config = assertInferenceConfig0g();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Config error";
          return c.json(
            {
              error: msg,
              hint: "Set OPENAI_API_KEY (or LLM_API_KEY) for API-key chat, or set RPC_URL, PRIVATE_KEY, PROVIDER_ADDRESS for 0G.",
            },
            500
          );
        }
        content = (await runChatCompletion(config, messages)).content;
      }

      const payload: {
        message: { role: "assistant"; content: string };
        reward?: Record<string, unknown>;
      } = {
        message: { role: "assistant" as const, content },
      };

      const fbWallet = rewardFallbackWalletFromEnv();
      const rewardUserExternalId =
        body.user_external_id?.trim() ||
        (fbWallet ? `wallet:${fbWallet.toLowerCase()}` : "");
      const rewardWalletForMint =
        body.reward_wallet_address?.trim() || fbWallet || "";

      if (dest === "monaco" && rewardUserExternalId) {
        const acc = await accrueSponsorTierReward(supabase, {
          userExternalId: rewardUserExternalId,
          sponsorSlug: MONACO_SPONSOR_SLUG,
          displayName: body.display_name,
          units: 1,
          reason: "monaco_search",
        });
        if (acc.ok) {
          payload.reward = {
            accrued_usdc: acc.amount_usdc,
            tier: acc.tier,
            pool_spent_usdc: acc.spent_usdc,
          };
          const rw = rewardWalletForMint.trim();
          if (gatewayCircleRewardEnvConfigured() && rw && isValidEvmAddress(rw)) {
            const minted = await mintGatewayRewardUsdc({
              recipientAddress: rw,
              amountUsdc: acc.amount_usdc,
            });
            if (minted.ok) {
              (payload.reward as Record<string, unknown>).circle_gateway = {
                mode: "gateway_mint_submitted",
                circle_transaction_id: minted.circle_transaction_id,
                amount_usdc: minted.amount_usdc,
              };
            } else {
              (payload.reward as Record<string, unknown>).circle_gateway = {
                mode: "skipped",
                error: minted.error,
              };
            }
          } else if (rw && !isValidEvmAddress(rw)) {
            (payload.reward as Record<string, unknown>).circle_gateway = {
              mode: "skipped",
              error: "invalid reward_wallet_address",
            };
          } else if (gatewayCircleRewardEnvConfigured() && !rw) {
            (payload.reward as Record<string, unknown>).circle_gateway = {
              mode: "skipped",
              error: "reward_wallet_address not provided",
            };
          }
        } else {
          payload.reward = { skipped: acc.error, code: acc.code };
        }
      }

      return c.json(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Inference failed";
      console.error(msg);
      return c.json({ error: msg }, 502);
    }
  });

  app.get("/v1/payments/status", (c) => {
    const gateway = gatewayCircleRewardEnvConfigured();
    return c.json({
      circle_gateway_reward_mint: gateway ? "enabled" : "disabled",
      docs: {
        nanopayments_x402:
          "https://developers.circle.com/gateway/nanopayments",
        unified_balance_reward_mint:
          "https://developers.circle.com/gateway/quickstarts/unified-balance-evm",
      },
      note: gateway
        ? "Monaco search rewards can mint USDC to reward_wallet_address (Arc testnet) after DB accrual."
        : "Set CIRCLE_GATEWAY_REWARD_ENABLED=true, CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_GATEWAY_TREASURY_WALLET_ADDRESS; fund treasury Gateway balance per Circle quickstart.",
    });
  });

  return app;
}

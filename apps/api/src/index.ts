import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ChatRequest } from "@tripgent/shared";
import { createAdminApp, getUserProfileHandler } from "./admin-routes.js";
import { createServiceClient } from "./db.js";
import {
  getOpenAICompatConfigFromEnv,
  runChatCompletion,
  runOpenAICompatibleChat,
} from "./inference.js";

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

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
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

app.get("/health", (c) => c.json({ ok: true }));

app.route("/v1/admin", createAdminApp(supabase));
app.get("/v1/users/profile", getUserProfileHandler(supabase));

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

  const messages = [
    { role: "system" as const, content: TRAVEL_SYSTEM },
    ...body.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const openaiCompat = getOpenAICompatConfigFromEnv();

  try {
    if (openaiCompat) {
      const { content } = await runOpenAICompatibleChat(messages, openaiCompat);
      return c.json({
        message: { role: "assistant" as const, content },
      });
    }

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

    const { content } = await runChatCompletion(config, messages);
    return c.json({
      message: { role: "assistant" as const, content },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Inference failed";
    console.error(msg);
    return c.json({ error: msg }, 502);
  }
});

app.get("/v1/payments/status", (c) => {
  return c.json({
    mode: "stub",
    docs: "https://developers.circle.com/gateway/nanopayments",
    note: "Wire buyer quickstart + seller middleware here; use user wallet from Dynamic for payouts.",
  });
});

const port = Number(process.env.PORT ?? 8787);
console.log(`Tripgent API listening on http://127.0.0.1:${port}`);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });

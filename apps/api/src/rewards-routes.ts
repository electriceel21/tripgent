import { Hono, type Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accrueSponsorTierReward } from "./accrue-reward.js";

/** Admin key OR traveler API_AUTH_BEARER (same as /v1/chat). */
function rewardsAuthOk(c: Context): boolean {
  const adminKey = process.env.ADMIN_API_KEY?.trim();
  if (adminKey) {
    const xh = c.req.header("x-admin-key");
    if (xh === adminKey) return true;
    const auth = c.req.header("authorization") ?? "";
    const t = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (t === adminKey) return true;
  }
  const expected = process.env.API_AUTH_BEARER?.trim();
  if (!expected) return true;
  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

export function createRewardsApp(sb: SupabaseClient): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    if (!rewardsAuthOk(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  /** Accrue micro-reward from sponsor tier rate into pool spent_usdc. */
  app.post("/accrue", async (c) => {
    const body = (await c.req.json()) as {
      user_external_id?: string;
      sponsor_slug?: string;
      units?: number;
      display_name?: string;
      reason?: string;
    };
    if (!body.user_external_id?.trim() || !body.sponsor_slug?.trim()) {
      return c.json(
        { error: "user_external_id and sponsor_slug required" },
        400
      );
    }

    const result = await accrueSponsorTierReward(sb, {
      userExternalId: body.user_external_id.trim(),
      sponsorSlug: body.sponsor_slug.trim(),
      units: body.units,
      displayName: body.display_name,
      reason: body.reason,
    });

    if (!result.ok) {
      if (result.code === "budget") {
        return c.json({ error: result.error }, 400);
      }
      if (result.code === "migration") {
        return c.json({ error: result.error }, 503);
      }
      if (result.code === "sponsor" || result.code === "rate") {
        return c.json({ error: result.error }, 404);
      }
      return c.json({ error: result.error }, 500);
    }

    return c.json({
      ok: true,
      user_external_id: result.user_external_id,
      tier: result.tier,
      rate_usdc: result.rate_usdc,
      units: result.units,
      amount_usdc: result.amount_usdc,
      pool_id: result.pool_id,
      spent_usdc: result.spent_usdc,
      budget_usdc: result.budget_usdc,
    });
  });

  app.get("/accruals", async (c) => {
    const { data, error } = await sb
      .from("reward_accruals")
      .select(
        "id, tier, units, rate_usdc, amount_usdc, reason, created_at, users(external_id), sponsors(name, slug)"
      )
      .order("id", { ascending: false })
      .limit(200);
    if (error) {
      if (error.message.includes("does not exist")) {
        return c.json({ accruals: [], note: "migration 003 not applied" });
      }
      return c.json({ error: error.message }, 500);
    }
    return c.json({ accruals: data ?? [] });
  });

  return app;
}

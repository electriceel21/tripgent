import { Hono, type Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureUser } from "./users-repo.js";

function adminOrChatAuthOk(c: Context): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey) {
    const xh = c.req.header("x-admin-key");
    if (xh === adminKey) return true;
    const auth = c.req.header("authorization") ?? "";
    const t = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (t === adminKey) return true;
  }
  const expected = process.env.API_AUTH_BEARER;
  if (!expected) return true;
  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

type PoolRow = {
  id: number;
  budget_cents: number;
  spent_cents: number;
  budget_usdc: string | number | null;
  spent_usdc: string | number | null;
  active: boolean;
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export function createRewardsApp(sb: SupabaseClient): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    if (!adminOrChatAuthOk(c)) {
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
    };
    if (!body.user_external_id?.trim() || !body.sponsor_slug?.trim()) {
      return c.json(
        { error: "user_external_id and sponsor_slug required" },
        400
      );
    }
    const units = body.units != null && Number(body.units) > 0 ? Number(body.units) : 1;

    let userId: number;
    try {
      userId = await ensureUser(
        sb,
        body.user_external_id.trim(),
        body.display_name
      );
    } catch (e) {
      return c.json(
        { error: e instanceof Error ? e.message : "user error" },
        500
      );
    }

    const { data: user, error: ue } = await sb
      .from("users")
      .select("id, tier")
      .eq("id", userId)
      .single();
    if (ue || !user) return c.json({ error: "user not found" }, 500);
    const tier = String(user.tier);

    const { data: sponsor, error: se } = await sb
      .from("sponsors")
      .select("id")
      .eq("slug", body.sponsor_slug.trim().toLowerCase())
      .maybeSingle();
    if (se) return c.json({ error: se.message }, 500);
    if (!sponsor?.id) return c.json({ error: "sponsor not found" }, 404);

    const { data: rateRow, error: re } = await sb
      .from("sponsor_tier_rates")
      .select("rate_usdc")
      .eq("sponsor_id", sponsor.id)
      .eq("tier", tier)
      .maybeSingle();
    if (re) return c.json({ error: re.message }, 500);
    if (!rateRow?.rate_usdc) {
      return c.json(
        { error: `no tier rate for sponsor + tier (${tier})` },
        404
      );
    }
    const rate = num(rateRow.rate_usdc as number | string);
    const amountUsdc = rate * units;

    const { data: pools, error: pe } = await sb
      .from("reward_pools")
      .select("*")
      .eq("sponsor_id", sponsor.id)
      .eq("active", true)
      .order("id", { ascending: true });
    if (pe) return c.json({ error: pe.message }, 500);
    const list = (pools ?? []) as PoolRow[];
    const pool =
      list.find((p) => /reward/i.test(String(p.name ?? ""))) ?? list[0];
    if (!pool) return c.json({ error: "no active reward pool for sponsor" }, 404);

    const budgetUsdc =
      pool.budget_usdc != null
        ? num(pool.budget_usdc)
        : num(pool.budget_cents) / 100;
    let spentUsdc =
      pool.spent_usdc != null
        ? num(pool.spent_usdc)
        : num(pool.spent_cents) / 100;

    if (spentUsdc + amountUsdc > budgetUsdc + 1e-12) {
      return c.json(
        {
          error: "pool budget exceeded",
          budget_usdc: budgetUsdc,
          spent_usdc: spentUsdc,
          requested_usdc: amountUsdc,
        },
        400
      );
    }

    spentUsdc += amountUsdc;
    const spentCents = Math.ceil(spentUsdc * 100);

    const { error: insErr } = await sb.from("reward_accruals").insert({
      user_id: userId,
      sponsor_id: sponsor.id,
      pool_id: pool.id,
      tier,
      units,
      rate_usdc: rate,
      amount_usdc: amountUsdc,
      reason: "tier_rate",
    });
    if (insErr) {
      if (insErr.message.includes("does not exist")) {
        return c.json(
          { error: "Run migration 003_reward_accrual_usdc.sql in Supabase" },
          503
        );
      }
      return c.json({ error: insErr.message }, 500);
    }

    const { error: upErr } = await sb
      .from("reward_pools")
      .update({
        spent_usdc: spentUsdc,
        spent_cents: spentCents,
      })
      .eq("id", pool.id);
    if (upErr) return c.json({ error: upErr.message }, 500);

    return c.json({
      ok: true,
      user_external_id: body.user_external_id.trim(),
      tier,
      rate_usdc: rate,
      units,
      amount_usdc: amountUsdc,
      pool_id: pool.id,
      spent_usdc: spentUsdc,
      budget_usdc: budgetUsdc,
    });
  });

  app.get("/accruals", async (c) => {
    const { data, error } = await sb
      .from("reward_accruals")
      .select(
        "id, tier, units, rate_usdc, amount_usdc, created_at, users(external_id), sponsors(name, slug)"
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

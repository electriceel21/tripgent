import { Hono, type Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUniqueViolation } from "./db.js";
import { ensureUser } from "./users-repo.js";
import {
  computeTier,
  reputationGainForPurchase,
  TIER_ORDER,
  type TierName,
} from "./reputation.js";

/** Nullable FK from JSON (number, string, empty string, or null). */
function optFk(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "item"
  );
}

function adminAuthOk(c: Context): boolean {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return true;
  const header = c.req.header("x-admin-key");
  if (header === key) return true;
  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === key;
}

function mapLocationRow(row: Record<string, unknown>) {
  const s = row.sponsors as { name?: string } | null | undefined;
  const { sponsors: _, ...rest } = row;
  return { ...rest, sponsor_name: s?.name ?? null };
}

function mapPoolRow(row: Record<string, unknown>) {
  const s = row.sponsors as { name?: string } | null | undefined;
  const l = row.locations as { name?: string } | null | undefined;
  const { sponsors: _s, locations: _l, ...rest } = row;
  return {
    ...rest,
    sponsor_name: s?.name ?? null,
    location_name: l?.name ?? null,
  };
}

function mapOfferRow(row: Record<string, unknown>) {
  const s = row.sponsors as { name?: string } | null | undefined;
  const l = row.locations as { name?: string } | null | undefined;
  const { sponsors: _s, locations: _l, ...rest } = row;
  return {
    ...rest,
    sponsor_name: s?.name ?? null,
    location_name: l?.name ?? null,
  };
}

export function createAdminApp(sb: SupabaseClient): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    if (!adminAuthOk(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  app.get("/dashboard", async (c) => {
    const [sp, loc, pool, off, usr, purch] = await Promise.all([
      sb.from("sponsors").select("*", { count: "exact", head: true }),
      sb.from("locations").select("*", { count: "exact", head: true }),
      sb.from("reward_pools").select("*", { count: "exact", head: true }),
      sb.from("offers").select("*", { count: "exact", head: true }),
      sb.from("users").select("*", { count: "exact", head: true }),
      sb.from("purchases").select("status"),
    ]);
    if (sp.error || loc.error || pool.error || off.error || usr.error || purch.error) {
      return c.json({ error: "dashboard query failed" }, 500);
    }
    const purchasesByStatus: Record<string, number> = {};
    for (const row of purch.data ?? []) {
      const st = row.status as string;
      purchasesByStatus[st] = (purchasesByStatus[st] ?? 0) + 1;
    }
    return c.json({
      sponsors: sp.count ?? 0,
      locations: loc.count ?? 0,
      pools: pool.count ?? 0,
      offers: off.count ?? 0,
      users: usr.count ?? 0,
      purchasesByStatus,
    });
  });

  app.get("/sponsors", async (c) => {
    const { data, error } = await sb
      .from("sponsors")
      .select("*")
      .order("id", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ sponsors: data ?? [] });
  });

  app.post("/sponsors", async (c) => {
    const body = (await c.req.json()) as {
      name?: string;
      slug?: string;
      website?: string;
    };
    if (!body.name?.trim()) return c.json({ error: "name required" }, 400);
    const slug = (body.slug?.trim() || slugify(body.name)).toLowerCase();
    const { data, error } = await sb
      .from("sponsors")
      .insert({
        name: body.name.trim(),
        slug,
        website: body.website?.trim() ?? null,
      })
      .select()
      .single();
    if (error) {
      if (isUniqueViolation(error)) return c.json({ error: "slug may already exist" }, 409);
      return c.json({ error: error.message }, 500);
    }
    return c.json(data, 201);
  });

  app.patch("/sponsors/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
    const body = (await c.req.json()) as { name?: string; website?: string };
    const { data: cur, error: fe } = await sb
      .from("sponsors")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fe) return c.json({ error: fe.message }, 500);
    if (!cur) return c.json({ error: "not found" }, 404);
    const name = body.name?.trim() ?? cur.name;
    const website =
      body.website !== undefined ? body.website?.trim() ?? null : cur.website;
    const { data, error } = await sb
      .from("sponsors")
      .update({ name, website })
      .eq("id", id)
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  });

  app.delete("/sponsors/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const { error } = await sb.from("sponsors").delete().eq("id", id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
  });

  async function sponsorTierRatesPayload(sponsorId: number) {
    const { data: sponsor, error: se } = await sb
      .from("sponsors")
      .select("*")
      .eq("id", sponsorId)
      .maybeSingle();
    if (se) return { error: se.message as string };
    if (!sponsor) return { error: "not found" as const };
    const { data: rates, error: re } = await sb
      .from("sponsor_tier_rates")
      .select("tier, rate_usdc")
      .eq("sponsor_id", sponsorId);
    if (re) return { error: re.message as string };
    const byTier = new Map(
      (rates ?? []).map((r) => [r.tier as string, r.rate_usdc])
    );
    const tier_rates = TIER_ORDER.map((tier) => ({
      tier,
      rate_usdc: byTier.get(tier) ?? null,
    }));
    return { sponsor, tier_rates };
  }

  /** Must be registered before `/sponsors/:id/tier-rates` so `by-slug` is not captured as id. */
  app.get("/sponsors/by-slug/:slug/tier-rates", async (c) => {
    const slug = c.req.param("slug").toLowerCase();
    const { data: sponsor, error: se } = await sb
      .from("sponsors")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (se) return c.json({ error: se.message }, 500);
    if (!sponsor?.id) return c.json({ error: "not found" }, 404);
    const payload = await sponsorTierRatesPayload(Number(sponsor.id));
    if ("error" in payload && payload.error === "not found") {
      return c.json({ error: "not found" }, 404);
    }
    if ("error" in payload) return c.json({ error: payload.error }, 500);
    return c.json(payload);
  });

  app.get("/sponsors/:id/tier-rates", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
    const payload = await sponsorTierRatesPayload(id);
    if ("error" in payload && payload.error === "not found") {
      return c.json({ error: "not found" }, 404);
    }
    if ("error" in payload) return c.json({ error: payload.error }, 500);
    return c.json(payload);
  });

  app.get("/locations", async (c) => {
    const { data, error } = await sb
      .from("locations")
      .select("*, sponsors(name)")
      .order("id", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    const rows = (data ?? []).map((r) => mapLocationRow(r as Record<string, unknown>));
    return c.json({ locations: rows });
  });

  app.post("/locations", async (c) => {
    const body = (await c.req.json()) as {
      sponsor_id?: number | null;
      name?: string;
      slug?: string;
      country?: string;
    };
    if (!body.name?.trim()) return c.json({ error: "name required" }, 400);
    const slug = (body.slug?.trim() || slugify(body.name)).toLowerCase();
    const sid = optFk(body.sponsor_id);
    const { data, error } = await sb
      .from("locations")
      .insert({
        sponsor_id: sid,
        name: body.name.trim(),
        slug,
        country: body.country?.trim() ?? null,
      })
      .select()
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        return c.json({ error: "duplicate slug for sponsor" }, 409);
      }
      return c.json({ error: error.message }, 500);
    }
    return c.json(data, 201);
  });

  app.delete("/locations/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const { error } = await sb.from("locations").delete().eq("id", id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
  });

  app.get("/pools", async (c) => {
    const { data, error } = await sb
      .from("reward_pools")
      .select("*, sponsors(name), locations(name)")
      .order("id", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    const rows = (data ?? []).map((r) => mapPoolRow(r as Record<string, unknown>));
    return c.json({ pools: rows });
  });

  app.post("/pools", async (c) => {
    const body = (await c.req.json()) as {
      sponsor_id?: number;
      location_id?: number | null;
      name?: string;
      budget_cents?: number;
      budget_usd?: number;
    };
    if (!body.sponsor_id || !body.name?.trim()) {
      return c.json({ error: "sponsor_id and name required" }, 400);
    }
    let budgetCents = body.budget_cents;
    if (budgetCents == null && body.budget_usd != null) {
      budgetCents = Math.round(Number(body.budget_usd) * 100);
    }
    if (budgetCents == null || budgetCents < 0) {
      return c.json({ error: "budget_cents or budget_usd required" }, 400);
    }
    const locId = optFk(body.location_id);
    const { data, error } = await sb
      .from("reward_pools")
      .insert({
        sponsor_id: body.sponsor_id,
        location_id: locId,
        name: body.name.trim(),
        budget_cents: budgetCents,
        spent_cents: 0,
        active: true,
      })
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
  });

  app.patch("/pools/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json()) as {
      name?: string;
      budget_cents?: number;
      budget_usd?: number;
      active?: boolean;
    };
    const { data: cur, error: fe } = await sb
      .from("reward_pools")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fe) return c.json({ error: fe.message }, 500);
    if (!cur) return c.json({ error: "not found" }, 404);
    let budget = Number(cur.budget_cents);
    if (body.budget_cents != null) budget = body.budget_cents;
    if (body.budget_usd != null) budget = Math.round(Number(body.budget_usd) * 100);
    const name = body.name?.trim() ?? cur.name;
    const active = body.active !== undefined ? Boolean(body.active) : cur.active;
    const { data, error } = await sb
      .from("reward_pools")
      .update({ name, budget_cents: budget, active })
      .eq("id", id)
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  });

  app.get("/offers", async (c) => {
    const { data, error } = await sb
      .from("offers")
      .select("*, sponsors(name), locations(name)")
      .order("id", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    const rows = (data ?? []).map((r) => mapOfferRow(r as Record<string, unknown>));
    return c.json({ offers: rows });
  });

  app.post("/offers", async (c) => {
    const body = (await c.req.json()) as {
      sponsor_id?: number;
      location_id?: number | null;
      pool_id?: number | null;
      title?: string;
      description?: string;
      purchase_url?: string;
      reward_cents?: number;
      reward_usd?: number;
    };
    if (!body.sponsor_id || !body.title?.trim()) {
      return c.json({ error: "sponsor_id and title required" }, 400);
    }
    let reward = body.reward_cents;
    if (reward == null && body.reward_usd != null) {
      reward = Math.round(Number(body.reward_usd) * 100);
    }
    if (reward == null || reward < 0) reward = 0;
    const locId = optFk(body.location_id);
    const poolId = optFk(body.pool_id);
    const { data, error } = await sb
      .from("offers")
      .insert({
        sponsor_id: body.sponsor_id,
        location_id: locId,
        pool_id: poolId,
        title: body.title.trim(),
        description: body.description?.trim() ?? null,
        purchase_url: body.purchase_url?.trim() ?? null,
        reward_cents: reward,
        active: true,
      })
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
  });

  app.delete("/offers/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const { error } = await sb.from("offers").delete().eq("id", id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
  });

  app.get("/users", async (c) => {
    const { data, error } = await sb
      .from("users")
      .select("*")
      .order("reputation_score", { ascending: false })
      .order("id", { ascending: false })
      .limit(500);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ users: data ?? [] });
  });

  app.get("/purchases", async (c) => {
    const { data, error } = await sb
      .from("purchases")
      .select("*, users(external_id, tier), offers(title)")
      .order("id", { ascending: false })
      .limit(500);
    if (error) return c.json({ error: error.message }, 500);
    const rows = (data ?? []).map((p) => {
      const u = p.users as { external_id?: string; tier?: string } | null;
      const o = p.offers as { title?: string } | null;
      const { users: _u, offers: _o, ...rest } = p as Record<string, unknown>;
      return {
        ...rest,
        external_id: u?.external_id,
        tier: u?.tier,
        offer_title: o?.title,
      };
    });
    return c.json({ purchases: rows });
  });

  async function applyConfirmation(
    userId: number,
    offer: {
      id: number;
      reward_cents: number;
      pool_id: number | null;
    },
    wasAlreadyConfirmed: boolean
  ): Promise<{ error?: string }> {
    if (wasAlreadyConfirmed) return {};
    const gain = reputationGainForPurchase(Number(offer.reward_cents));
    const { data: u, error: ue } = await sb
      .from("users")
      .select("reputation_score, purchases_confirmed")
      .eq("id", userId)
      .single();
    if (ue || !u) return { error: "user not found" };
    const newRep = Number(u.reputation_score) + gain;
    const newCount = Number(u.purchases_confirmed) + 1;
    const tier = computeTier(newCount, newRep) as TierName;
    const now = new Date().toISOString();
    const { error: upErr } = await sb
      .from("users")
      .update({
        reputation_score: newRep,
        purchases_confirmed: newCount,
        tier,
        updated_at: now,
      })
      .eq("id", userId);
    if (upErr) return { error: upErr.message };

    if (offer.pool_id != null) {
      const { data: pool, error: pe } = await sb
        .from("reward_pools")
        .select("budget_cents, spent_cents, budget_usdc, spent_usdc")
        .eq("id", offer.pool_id)
        .maybeSingle();
      if (pe) return { error: pe.message };
      if (pool) {
        const rewardCents = Number(offer.reward_cents);
        const nextSpentCents = Number(pool.spent_cents) + rewardCents;
        const budgetCents = Number(pool.budget_cents);
        const budgetUsd =
          pool.budget_usdc != null && String(pool.budget_usdc) !== ""
            ? Number(pool.budget_usdc)
            : budgetCents / 100;
        const spentUsdBefore =
          pool.spent_usdc != null && String(pool.spent_usdc) !== ""
            ? Number(pool.spent_usdc)
            : Number(pool.spent_cents) / 100;
        const rewardUsd = rewardCents / 100;
        const nextSpentUsd = spentUsdBefore + rewardUsd;
        if (nextSpentUsd > budgetUsd + 1e-9) {
          return {
            error: `Pool ${offer.pool_id} would exceed budget (${nextSpentUsd} > ${budgetUsd} USDC)`,
          };
        }
        if (nextSpentCents > budgetCents) {
          return {
            error: `Pool ${offer.pool_id} would exceed budget (${nextSpentCents} > ${budgetCents} cents)`,
          };
        }
        const { error: se } = await sb
          .from("reward_pools")
          .update({
            spent_cents: nextSpentCents,
            spent_usdc: nextSpentUsd,
          })
          .eq("id", offer.pool_id);
        if (se) return { error: se.message };
      }
    }
    return {};
  }

  app.post("/purchases", async (c) => {
    const body = (await c.req.json()) as {
      user_external_id?: string;
      display_name?: string;
      offer_id?: number;
      amount_cents?: number;
      amount_usd?: number;
      status?: string;
      notes?: string;
    };
    if (!body.user_external_id?.trim() || !body.offer_id) {
      return c.json({ error: "user_external_id and offer_id required" }, 400);
    }
    const { data: offer, error: oe } = await sb
      .from("offers")
      .select("id, reward_cents, pool_id, active")
      .eq("id", body.offer_id)
      .maybeSingle();
    if (oe) return c.json({ error: oe.message }, 500);
    if (!offer || !offer.active) return c.json({ error: "offer not found" }, 404);

    let userId: number;
    try {
      userId = await ensureUser(sb, body.user_external_id.trim(), body.display_name);
    } catch (e) {
      return c.json(
        { error: e instanceof Error ? e.message : "user create failed" },
        500
      );
    }

    let amountCents = body.amount_cents;
    if (amountCents == null && body.amount_usd != null) {
      amountCents = Math.round(Number(body.amount_usd) * 100);
    }
    const status = body.status === "confirmed" ? "confirmed" : "pending";

    const { data: row, error: insErr } = await sb
      .from("purchases")
      .insert({
        user_id: userId,
        offer_id: body.offer_id,
        amount_cents: amountCents ?? null,
        status,
        notes: body.notes?.trim() ?? null,
      })
      .select("id")
      .single();
    if (insErr) return c.json({ error: insErr.message }, 500);

    if (status === "confirmed") {
      const err = await applyConfirmation(
        userId,
        {
          id: Number(offer.id),
          reward_cents: Number(offer.reward_cents),
          pool_id: offer.pool_id != null ? Number(offer.pool_id) : null,
        },
        false
      );
      if (err.error) {
        await sb.from("purchases").delete().eq("id", row.id);
        return c.json({ error: err.error }, 400);
      }
    }

    const { data: full, error: fe } = await sb
      .from("purchases")
      .select("*, users(external_id, tier, reputation_score, purchases_confirmed)")
      .eq("id", row.id)
      .single();
    if (fe) return c.json({ error: fe.message }, 500);
    const usr = full!.users as {
      external_id: string;
      tier: string;
      reputation_score: number;
      purchases_confirmed: number;
    };
    const { users: _, ...p } = full as Record<string, unknown>;
    return c.json(
      {
        ...p,
        external_id: usr.external_id,
        tier: usr.tier,
        reputation_score: usr.reputation_score,
        purchases_confirmed: usr.purchases_confirmed,
      },
      201
    );
  });

  app.patch("/purchases/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json()) as { status?: string };
    if (body.status !== "confirmed" && body.status !== "pending") {
      return c.json({ error: "status must be confirmed or pending" }, 400);
    }
    const { data: row, error: re } = await sb
      .from("purchases")
      .select("user_id, offer_id, status")
      .eq("id", id)
      .maybeSingle();
    if (re) return c.json({ error: re.message }, 500);
    if (!row) return c.json({ error: "not found" }, 404);

    const { data: offer, error: oe } = await sb
      .from("offers")
      .select("id, reward_cents, pool_id")
      .eq("id", row.offer_id)
      .single();
    if (oe) return c.json({ error: oe.message }, 500);

    const wasConfirmed = row.status === "confirmed";
    const willConfirm = body.status === "confirmed";

    if (willConfirm && !wasConfirmed) {
      const err = await applyConfirmation(
        Number(row.user_id),
        {
          id: Number(offer.id),
          reward_cents: Number(offer.reward_cents),
          pool_id: offer.pool_id != null ? Number(offer.pool_id) : null,
        },
        false
      );
      if (err.error) return c.json({ error: err.error }, 400);
    }

    if (!willConfirm && wasConfirmed) {
      return c.json({ error: "cannot un-confirm purchase in MVP" }, 400);
    }

    const { error: ue } = await sb
      .from("purchases")
      .update({ status: body.status })
      .eq("id", id);
    if (ue) return c.json({ error: ue.message }, 500);

    const { data: out, error: fe } = await sb
      .from("purchases")
      .select("*, users(external_id, tier), offers(title)")
      .eq("id", id)
      .single();
    if (fe) return c.json({ error: fe.message }, 500);
    const u = out!.users as { external_id: string; tier: string };
    const o = out!.offers as { title: string };
    const { users: _u, offers: _o, ...rest } = out as Record<string, unknown>;
    return c.json({
      ...rest,
      external_id: u.external_id,
      tier: u.tier,
      offer_title: o.title,
    });
  });

  return app;
}

export function getUserProfileHandler(sb: SupabaseClient) {
  return async (c: Context) => {
    const externalId = c.req.query("external_id");
    if (!externalId?.trim()) {
      return c.json({ error: "external_id query required" }, 400);
    }
    const { data: u, error } = await sb
      .from("users")
      .select("*")
      .eq("external_id", externalId.trim())
      .maybeSingle();
    if (error) return c.json({ error: error.message }, 500);
    if (!u) {
      return c.json({
        external_id: externalId.trim(),
        tier: "bronze",
        reputation_score: 0,
        purchases_confirmed: 0,
        exists: false,
      });
    }
    const { data: ph } = await sb
      .from("purchases")
      .select("id, status, purchased_at, offers(title, reward_cents)")
      .eq("user_id", u.id)
      .order("id", { ascending: false })
      .limit(50);
    const purchase_history = (ph ?? []).map((p) => {
      const off = p.offers as { title?: string; reward_cents?: number } | null;
      const { offers: _, ...rest } = p as Record<string, unknown>;
      return {
        ...rest,
        offer_title: off?.title,
        reward_cents: off?.reward_cents,
      };
    });
    return c.json({ ...u, exists: true, purchase_history });
  };
}

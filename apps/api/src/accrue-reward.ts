import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureUser } from "./users-repo.js";

type PoolRow = {
  id: number;
  name?: string | null;
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

export type AccrueSponsorTierParams = {
  userExternalId: string;
  sponsorSlug: string;
  units?: number;
  displayName?: string | null;
  /** Stored on reward_accruals.reason (e.g. tier_rate, monaco_search). */
  reason?: string;
};

export type AccrueSponsorTierOk = {
  ok: true;
  user_external_id: string;
  tier: string;
  rate_usdc: number;
  units: number;
  amount_usdc: number;
  pool_id: number;
  spent_usdc: number;
  budget_usdc: number;
};

export type AccrueSponsorTierErr = {
  ok: false;
  error: string;
  code: "user" | "sponsor" | "rate" | "pool" | "budget" | "db" | "migration";
};

/**
 * Accrue micro-reward from sponsor_tier_rates into reward_pools spent_usdc + ledger row.
 * Shared by POST /v1/rewards/accrue and POST /v1/chat (Monaco search reward).
 */
export async function accrueSponsorTierReward(
  sb: SupabaseClient,
  params: AccrueSponsorTierParams
): Promise<AccrueSponsorTierOk | AccrueSponsorTierErr> {
  const reason = params.reason?.trim() || "tier_rate";
  const units =
    params.units != null && Number(params.units) > 0 ? Number(params.units) : 1;

  let userId: number;
  try {
    userId = await ensureUser(
      sb,
      params.userExternalId.trim(),
      params.displayName
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "user error",
      code: "user",
    };
  }

  const { data: user, error: ue } = await sb
    .from("users")
    .select("id, tier")
    .eq("id", userId)
    .single();
  if (ue || !user) {
    return { ok: false, error: "user not found", code: "user" };
  }
  const tier = String(user.tier);

  const { data: sponsor, error: se } = await sb
    .from("sponsors")
    .select("id")
    .eq("slug", params.sponsorSlug.trim().toLowerCase())
    .maybeSingle();
  if (se) return { ok: false, error: se.message, code: "db" };
  if (!sponsor?.id) return { ok: false, error: "sponsor not found", code: "sponsor" };

  const { data: rateRow, error: re } = await sb
    .from("sponsor_tier_rates")
    .select("rate_usdc")
    .eq("sponsor_id", sponsor.id)
    .eq("tier", tier)
    .maybeSingle();
  if (re) return { ok: false, error: re.message, code: "db" };
  if (!rateRow?.rate_usdc) {
    return {
      ok: false,
      error: `no tier rate for sponsor + tier (${tier})`,
      code: "rate",
    };
  }
  const rate = num(rateRow.rate_usdc as number | string);
  const amountUsdc = rate * units;

  const { data: pools, error: pe } = await sb
    .from("reward_pools")
    .select("*")
    .eq("sponsor_id", sponsor.id)
    .eq("active", true)
    .order("id", { ascending: true });
  if (pe) return { ok: false, error: pe.message, code: "db" };
  const list = (pools ?? []) as PoolRow[];
  const pool =
    list.find((p) => /reward/i.test(String(p.name ?? ""))) ?? list[0];
  if (!pool) {
    return { ok: false, error: "no active reward pool for sponsor", code: "pool" };
  }

  const budgetUsdc =
    pool.budget_usdc != null
      ? num(pool.budget_usdc)
      : num(pool.budget_cents) / 100;
  let spentUsdc =
    pool.spent_usdc != null
      ? num(pool.spent_usdc)
      : num(pool.spent_cents) / 100;

  if (spentUsdc + amountUsdc > budgetUsdc + 1e-12) {
    return {
      ok: false,
      error: "pool budget exceeded",
      code: "budget",
    };
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
    reason,
  });
  if (insErr) {
    if (insErr.message.includes("does not exist")) {
      return {
        ok: false,
        error: "Run migration 003_reward_accrual_usdc.sql",
        code: "migration",
      };
    }
    return { ok: false, error: insErr.message, code: "db" };
  }

  const { error: upErr } = await sb
    .from("reward_pools")
    .update({
      spent_usdc: spentUsdc,
      spent_cents: spentCents,
    })
    .eq("id", pool.id);
  if (upErr) return { ok: false, error: upErr.message, code: "db" };

  return {
    ok: true,
    user_external_id: params.userExternalId.trim(),
    tier,
    rate_usdc: rate,
    units,
    amount_usdc: amountUsdc,
    pool_id: pool.id,
    spent_usdc: spentUsdc,
    budget_usdc: budgetUsdc,
  };
}

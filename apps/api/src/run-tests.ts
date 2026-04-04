/**
 * Unit tests (always) + optional Supabase integration when env is set.
 * Run: pnpm --filter @tripgent/api test
 */
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAdminApp, getUserProfileHandler } from "./admin-routes.js";
import { createServiceClient } from "./db.js";
import { computeTier, reputationGainForPurchase } from "./reputation.js";

assert.equal(computeTier(0, 0), "bronze");
assert.equal(computeTier(1, 0), "silver");
assert.equal(computeTier(3, 0), "gold");
assert.equal(computeTier(10, 0), "platinum");
assert.equal(computeTier(0, 500), "platinum");
assert.ok(reputationGainForPurchase(1000) >= 10);

const hasSupabase =
  Boolean(process.env.SUPABASE_URL?.trim()) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

if (!hasSupabase) {
  console.log(
    "run-tests: skipping Supabase integration (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and apply supabase/migrations/001_tripgent.sql)"
  );
  console.log("run-tests: unit assertions passed");
  process.exit(0);
}

const sb = createServiceClient();
const app = new Hono();
app.route("/v1/admin", createAdminApp(sb));
app.get("/v1/users/profile", getUserProfileHandler(sb));

async function post(path: string, body: unknown) {
  return app.fetch(
    new Request(`http://t${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

async function patch(path: string, body: unknown) {
  return app.fetch(
    new Request(`http://t${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

async function get(path: string) {
  return app.fetch(new Request(`http://t${path}`));
}

const suffix = `-${Date.now()}`;
let res = await post("/v1/admin/sponsors", { name: "Test Air", slug: `test-air${suffix}` });
assert.equal(res.status, 201, await res.text());
const sponsor = (await res.json()) as { id: number };

res = await post("/v1/admin/locations", {
  sponsor_id: sponsor.id,
  name: "Lisbon",
  slug: `lisbon${suffix}`,
  country: "PT",
});
assert.equal(res.status, 201, await res.text());
const loc = (await res.json()) as { id: number };

res = await post("/v1/admin/pools", {
  sponsor_id: sponsor.id,
  location_id: loc.id,
  name: "Lisbon rewards",
  budget_usd: 100,
});
assert.equal(res.status, 201, await res.text());
const pool = (await res.json()) as { id: number; budget_cents: number };
assert.equal(pool.budget_cents, 10000);

res = await post("/v1/admin/offers", {
  sponsor_id: sponsor.id,
  location_id: loc.id,
  pool_id: pool.id,
  title: "Fado night",
  reward_usd: 2.5,
  purchase_url: "https://example.com/buy",
});
assert.equal(res.status, 201, await res.text());
const offer = (await res.json()) as { id: number; reward_cents: number };
assert.equal(offer.reward_cents, 250);

const extId = `dynamic-user-${suffix}`;
res = await post("/v1/admin/purchases", {
  user_external_id: extId,
  display_name: "Alex",
  offer_id: offer.id,
  status: "confirmed",
});
assert.equal(res.status, 201, await res.text());
const purchase = (await res.json()) as {
  tier: string;
  reputation_score: number;
  purchases_confirmed: number;
};
assert.equal(purchase.purchases_confirmed, 1);
assert.equal(purchase.tier, "silver");
assert.ok(purchase.reputation_score >= 10);

res = await get("/v1/admin/pools");
const pools = (await res.json()) as { pools: { spent_cents: number }[] };
assert.equal(pools.pools[0].spent_cents, 250);

res = await post("/v1/admin/purchases", {
  user_external_id: extId,
  offer_id: offer.id,
  status: "pending",
});
assert.equal(res.status, 201, await res.text());
const p2 = (await res.json()) as { id: number };
res = await patch(`/v1/admin/purchases/${p2.id}`, { status: "confirmed" });
assert.equal(res.status, 200);

res = await get(`/v1/users/profile?external_id=${encodeURIComponent(extId)}`);
const profile = (await res.json()) as { exists: boolean; tier: string };
assert.equal(profile.exists, true);
assert.equal(profile.tier, "gold");

console.log("run-tests: Supabase integration passed");

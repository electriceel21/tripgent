/**
 * Verify Circle DCW + Gateway env: API key, entity secret, treasury on Arc testnet,
 * optional Gateway unified balance (domain 26). Does not submit a reward mint.
 *
 * Usage (from repo root, with secrets in `.env`):
 *   pnpm --filter @tripgent/api verify:circle
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { gatewayCircleRewardEnvConfigured } from "./gateway-circle-reward.js";
import { loadRootEnv } from "./load-root-env.js";

const ARC_DOMAIN = 26;
const GATEWAY_API =
  process.env.CIRCLE_GATEWAY_API_URL?.trim() ||
  "https://gateway-api-testnet.circle.com";

function mask(s: string, show = 6): string {
  if (s.length <= show * 2) return "***";
  return `${s.slice(0, show)}…${s.slice(-show)}`;
}

async function gatewayUnifiedBalanceUsdc(depositor: string): Promise<number> {
  const res = await fetch(`${GATEWAY_API.replace(/\/$/, "")}/v1/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "USDC",
      sources: [{ domain: ARC_DOMAIN, depositor }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Gateway balances HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    balances?: Array<{ domain: number; balance: string }>;
  };
  let total = 0;
  for (const b of json.balances ?? []) {
    if (b.domain === ARC_DOMAIN) total += parseFloat(b.balance) || 0;
  }
  return total;
}

async function main() {
  loadRootEnv();

  console.log("Tripgent — Circle Gateway verification\n");

  const key = process.env.CIRCLE_API_KEY?.trim();
  const secret = process.env.CIRCLE_ENTITY_SECRET?.trim();
  const treasury = process.env.CIRCLE_GATEWAY_TREASURY_WALLET_ADDRESS?.trim();
  const enabled = process.env.CIRCLE_GATEWAY_REWARD_ENABLED;

  console.log("Env (values masked):");
  console.log(`  CIRCLE_API_KEY: ${key ? mask(key) : "(missing)"}`);
  console.log(`  CIRCLE_ENTITY_SECRET: ${secret ? mask(secret) : "(missing)"}`);
  console.log(`  CIRCLE_GATEWAY_TREASURY_WALLET_ADDRESS: ${treasury ?? "(missing)"}`);
  console.log(`  CIRCLE_GATEWAY_REWARD_ENABLED: ${enabled ?? "(unset)"}`);
  console.log();

  if (!gatewayCircleRewardEnvConfigured()) {
    console.error(
      "FAIL: gateway not fully configured. Need CIRCLE_GATEWAY_REWARD_ENABLED=true (or 1), CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_GATEWAY_TREASURY_WALLET_ADDRESS."
    );
    process.exit(1);
  }

  if (!key || !secret || !treasury) {
    console.error("FAIL: missing required variables.");
    process.exit(1);
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: key,
    entitySecret: secret,
  });

  console.log("Calling Circle Wallets API (list wallet by treasury address)…");
  const listed = await client.listWallets({
    address: treasury,
    blockchain: "ARC-TESTNET",
  });
  const wallets = listed.data?.wallets ?? [];
  if (wallets.length === 0) {
    console.error(
      `FAIL: No Developer-Controlled wallet found for ${treasury} on ARC-TESTNET. ` +
        "Confirm this address is from Circle DCW createWallets (not an arbitrary 0x)."
    );
    process.exit(1);
  }

  const w = wallets[0];
  console.log(`OK: Circle recognizes treasury wallet id=${w.id} state=${w.state ?? "n/a"}`);

  console.log("\nOn-chain token balance (Arc USDC in wallet, not Gateway vault)…");
  const bal = await client.getWalletTokenBalance({ id: w.id });
  const tokens = bal.data?.tokenBalances ?? [];
  if (tokens.length === 0) {
    console.log("  (no token rows — wallet may be unfunded)");
  } else {
    for (const t of tokens) {
      console.log(
        `  ${t.token?.symbol ?? "?"}: ${t.amount} (${t.token?.name ?? ""})`
      );
    }
  }

  console.log("\nGateway unified balance (Arc domain 26 — what you burn for mints)…");
  try {
    const g = await gatewayUnifiedBalanceUsdc(treasury);
    console.log(`  Unified USDC (approx): ${g.toFixed(6)}`);
    if (g <= 0) {
      console.log(
        "  WARN: zero Gateway unified balance. Run approve + deposit into Gateway Wallet on Arc (unified balance quickstart) before reward mints will work."
      );
    }
  } catch (e) {
    console.log(
      `  WARN: could not read Gateway balances: ${e instanceof Error ? e.message : e}`
    );
  }

  console.log("\nAll checks passed: API key + entity secret work; treasury is a DCW on Arc testnet.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/** Tier thresholds: user reaches tier if confirmed purchases OR reputation meets bar (whichever advances them). */
export const TIER_ORDER = ["bronze", "silver", "gold", "platinum"] as const;
export type TierName = (typeof TIER_ORDER)[number];

const RULES: { tier: TierName; minPurchases: number; minReputation: number }[] = [
  { tier: "bronze", minPurchases: 0, minReputation: 0 },
  { tier: "silver", minPurchases: 1, minReputation: 50 },
  { tier: "gold", minPurchases: 3, minReputation: 150 },
  { tier: "platinum", minPurchases: 10, minReputation: 500 },
];

export function computeTier(
  purchasesConfirmed: number,
  reputationScore: number
): TierName {
  let best: TierName = "bronze";
  for (const r of RULES) {
    if (
      purchasesConfirmed >= r.minPurchases ||
      reputationScore >= r.minReputation
    ) {
      best = r.tier;
    }
  }
  return best;
}

/** Reputation points added on a confirmed purchase (offer reward + base). */
export function reputationGainForPurchase(rewardCents: number): number {
  return 10 + Math.floor(rewardCents / 100);
}

/** Shared API types between mobile, admin, and backend. */

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  /**
   * When `"monaco"`, the API adds Monaco destination mock context to the system prompt.
   * With `user_external_id`, a successful reply also accrues a micro-reward from the Air Monaco pool (migration 003).
   */
  destination_slug?: string;
  /** Stable traveler id (e.g. Dynamic `authenticatedUser.userId`) for pool accrual. */
  user_external_id?: string;
  display_name?: string | null;
  /**
   * Traveler EVM address on Arc testnet (or same chain as `CIRCLE_GATEWAY_*` treasury) to receive
   * optional USDC mint via Circle Gateway after a successful Monaco search reward accrual.
   */
  reward_wallet_address?: string;
};

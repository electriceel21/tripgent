import { randomBytes } from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

/**
 * Mint USDC to a traveler wallet via Circle Gateway after the treasury has
 * deposited into the Gateway Wallet (Arc testnet flow).
 *
 * @see https://developers.circle.com/gateway/quickstarts/unified-balance-evm.md
 * @see https://developers.circle.com/gateway/nanopayments.md (x402 is buyer→seller; outbound rewards use Gateway transfer/mint)
 */

const GATEWAY_WALLET_ADDRESS =
  "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
const GATEWAY_MINTER_ADDRESS =
  "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const ARC = {
  chainName: "Arc Testnet",
  usdc: "0x3600000000000000000000000000000000000000",
  domain: 26,
  walletChain: "ARC-TESTNET" as const,
};

const MAX_FEE = 2_010000n;
const MAX_UINT256_DEC = ((1n << 256n) - 1n).toString();

const domain712 = { name: "GatewayWallet", version: "1" };

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
];

const TransferSpec = [
  { name: "version", type: "uint32" },
  { name: "sourceDomain", type: "uint32" },
  { name: "destinationDomain", type: "uint32" },
  { name: "sourceContract", type: "bytes32" },
  { name: "destinationContract", type: "bytes32" },
  { name: "sourceToken", type: "bytes32" },
  { name: "destinationToken", type: "bytes32" },
  { name: "sourceDepositor", type: "bytes32" },
  { name: "destinationRecipient", type: "bytes32" },
  { name: "sourceSigner", type: "bytes32" },
  { name: "destinationCaller", type: "bytes32" },
  { name: "value", type: "uint256" },
  { name: "salt", type: "bytes32" },
  { name: "hookData", type: "bytes" },
];

const BurnIntent = [
  { name: "maxBlockHeight", type: "uint256" },
  { name: "maxFee", type: "uint256" },
  { name: "spec", type: "TransferSpec" },
];

function parseBalance(value: string | number): bigint {
  const str = String(value);
  const [whole, decimal = ""] = str.split(".");
  const decimal6 = (decimal + "000000").slice(0, 6);
  return BigInt((whole || "0") + decimal6);
}

function addressToBytes32(address: string): `0x${string}` {
  return ("0x" +
    address
      .toLowerCase()
      .replace(/^0x/, "")
      .padStart(64, "0")) as `0x${string}`;
}

function stringifyTypedData<T>(obj: T): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

function createBurnIntent(params: {
  depositorAddress: string;
  recipientAddress: string;
  amountUsdc: number;
}) {
  const value = parseBalance(String(params.amountUsdc));
  return {
    maxBlockHeight: MAX_UINT256_DEC,
    maxFee: MAX_FEE,
    spec: {
      version: 1,
      sourceDomain: ARC.domain,
      destinationDomain: ARC.domain,
      sourceContract: GATEWAY_WALLET_ADDRESS,
      destinationContract: GATEWAY_MINTER_ADDRESS,
      sourceToken: ARC.usdc,
      destinationToken: ARC.usdc,
      sourceDepositor: params.depositorAddress,
      destinationRecipient: params.recipientAddress,
      sourceSigner: params.depositorAddress,
      destinationCaller: "0x0000000000000000000000000000000000000000",
      value,
      salt: ("0x" + randomBytes(32).toString("hex")) as `0x${string}`,
      hookData: "0x",
    },
  };
}

function burnIntentTypedData(burnIntent: ReturnType<typeof createBurnIntent>) {
  return {
    types: { EIP712Domain, TransferSpec, BurnIntent },
    domain: domain712,
    primaryType: "BurnIntent",
    message: {
      ...burnIntent,
      spec: {
        ...burnIntent.spec,
        sourceContract: addressToBytes32(burnIntent.spec.sourceContract),
        destinationContract: addressToBytes32(
          burnIntent.spec.destinationContract
        ),
        sourceToken: addressToBytes32(burnIntent.spec.sourceToken),
        destinationToken: addressToBytes32(burnIntent.spec.destinationToken),
        sourceDepositor: addressToBytes32(burnIntent.spec.sourceDepositor),
        destinationRecipient: addressToBytes32(
          burnIntent.spec.destinationRecipient
        ),
        sourceSigner: addressToBytes32(burnIntent.spec.sourceSigner),
        destinationCaller: addressToBytes32(
          burnIntent.spec.destinationCaller
        ),
      },
    },
  };
}

export function isValidEvmAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

export function gatewayCircleRewardEnvConfigured(): boolean {
  const enabled = process.env.CIRCLE_GATEWAY_REWARD_ENABLED;
  if (enabled !== "1" && enabled?.toLowerCase() !== "true") return false;
  return Boolean(
    process.env.CIRCLE_API_KEY?.trim() &&
      process.env.CIRCLE_ENTITY_SECRET?.trim() &&
      process.env.CIRCLE_GATEWAY_TREASURY_WALLET_ADDRESS?.trim()
  );
}

export type GatewayMintResult =
  | { ok: true; circle_transaction_id: string; amount_usdc: number }
  | { ok: false; error: string };

/**
 * Burn treasury Gateway unified balance on Arc and mint USDC to `recipientAddress` on Arc testnet.
 */
export async function mintGatewayRewardUsdc(params: {
  recipientAddress: string;
  amountUsdc: number;
}): Promise<GatewayMintResult> {
  if (!gatewayCircleRewardEnvConfigured()) {
    return { ok: false, error: "gateway reward not configured" };
  }
  if (!isValidEvmAddress(params.recipientAddress)) {
    return { ok: false, error: "invalid reward_wallet_address" };
  }
  if (!(params.amountUsdc > 0) || !Number.isFinite(params.amountUsdc)) {
    return { ok: false, error: "invalid amount" };
  }

  const min = Number(process.env.CIRCLE_GATEWAY_MIN_USDC ?? "0.000001");
  if (params.amountUsdc < min) {
    return {
      ok: false,
      error: `amount below CIRCLE_GATEWAY_MIN_USDC (${min})`,
    };
  }

  const treasury = process.env.CIRCLE_GATEWAY_TREASURY_WALLET_ADDRESS!.trim();
  const gatewayApi =
    process.env.CIRCLE_GATEWAY_API_URL?.trim() ||
    "https://gateway-api-testnet.circle.com";

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  const burnIntent = createBurnIntent({
    depositorAddress: treasury,
    recipientAddress: params.recipientAddress.trim(),
    amountUsdc: params.amountUsdc,
  });
  const typedData = burnIntentTypedData(burnIntent);

  const sigResp = await client.signTypedData({
    walletAddress: treasury,
    blockchain: ARC.walletChain,
    data: stringifyTypedData(typedData),
    memo: "Tripgent search reward (Gateway mint)",
  });

  const signature = sigResp.data?.signature;
  if (!signature) {
    return { ok: false, error: "Circle signTypedData returned no signature" };
  }

  const body = stringifyTypedData([
    { burnIntent: typedData.message, signature },
  ]);

  const transferRes = await fetch(`${gatewayApi.replace(/\/$/, "")}/v1/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!transferRes.ok) {
    const text = await transferRes.text();
    return {
      ok: false,
      error: `Gateway transfer HTTP ${transferRes.status}: ${text.slice(0, 500)}`,
    };
  }

  const att = (await transferRes.json()) as {
    attestation?: string;
    signature?: string;
  };
  if (!att.attestation || !att.signature) {
    return { ok: false, error: "Gateway transfer missing attestation/signature" };
  }

  const mintTx = await client.createContractExecutionTransaction({
    walletAddress: treasury,
    blockchain: ARC.walletChain,
    contractAddress: GATEWAY_MINTER_ADDRESS,
    abiFunctionSignature: "gatewayMint(bytes,bytes)",
    abiParameters: [att.attestation, att.signature],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const txId = mintTx.data?.id;
  if (!txId) {
    return { ok: false, error: "Circle createContractExecutionTransaction missing id" };
  }

  return {
    ok: true,
    circle_transaction_id: txId,
    amount_usdc: params.amountUsdc,
  };
}

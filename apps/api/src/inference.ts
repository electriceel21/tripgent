import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import type { ChatMessage } from "@tripgent/shared";

export type InferenceConfig = {
  rpcUrl: string;
  privateKey: string;
  providerAddress: string;
};

export type OpenAICompatConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/**
 * When set, `/v1/chat` uses an OpenAI-compatible HTTP API (Bearer auth).
 *
 * **0G Compute direct proxy** (matches `OpenAI` client with `baseURL: .../v1/proxy`):
 * set `ZG_COMPUTE_PROXY_URL` + `ZG_COMPUTE_SECRET` (`app-sk-...` from CLI get-secret).
 *
 * **Other providers:** `OPENAI_API_KEY` + optional `OPENAI_BASE_URL` / `OPENAI_MODEL`.
 */
export function getOpenAICompatConfigFromEnv(): OpenAICompatConfig | null {
  const zgUrl =
    process.env.ZG_COMPUTE_PROXY_URL?.trim() ||
    process.env.ZG_PROXY_BASE_URL?.trim();
  const zgSecret =
    process.env.ZG_COMPUTE_SECRET?.trim() ||
    process.env.ZG_COMPUTE_API_KEY?.trim() ||
    (zgUrl
      ? process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim()
      : "");
  if (zgUrl && zgSecret) {
    const model =
      process.env.ZG_COMPUTE_MODEL?.trim() ||
      "qwen/qwen-2.5-7b-instruct";
    return {
      apiKey: zgSecret,
      baseUrl: zgUrl.replace(/\/$/, ""),
      model,
    };
  }

  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    "";
  if (!apiKey) return null;
  const baseUrl = (
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.LLM_BASE_URL?.trim() ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model =
    process.env.OPENAI_MODEL?.trim() ||
    process.env.LLM_MODEL?.trim() ||
    "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

/**
 * Chat via any OpenAI-compatible endpoint (OpenAI, Groq, OpenRouter, Together, etc.).
 */
export async function runOpenAICompatibleChat(
  messages: ChatMessage[],
  config: OpenAICompatConfig
): Promise<{ content: string }> {
  const url = `${config.baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Invalid chat completion response");
  }
  return { content };
}

let brokerPromise: ReturnType<typeof createBroker> | null = null;

async function createBroker(config: InferenceConfig) {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  return createZGComputeNetworkBroker(wallet as never);
}

function getBroker(config: InferenceConfig) {
  if (!brokerPromise) {
    brokerPromise = createBroker(config);
  }
  return brokerPromise;
}

/**
 * Non-streaming chat completion via 0G Compute.
 * Always calls processResponse(providerAddress, chatID, usageData) after success.
 */
export async function runChatCompletion(
  config: InferenceConfig,
  messages: ChatMessage[]
): Promise<{ content: string }> {
  const broker = await getBroker(config);
  const { endpoint, model } = await broker.inference.getServiceMetadata(
    config.providerAddress
  );
  const headers = await broker.inference.getRequestHeaders(config.providerAddress);

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ messages, model }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`0G inference HTTP ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
    usage?: unknown;
    id?: string;
  };

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Invalid chat completion response");
  }

  let chatID: string | undefined =
    response.headers.get("ZG-Res-Key") ||
    response.headers.get("zg-res-key") ||
    undefined;
  if (!chatID && data.id != null) chatID = String(data.id);

  const usageData: string | undefined =
    data.usage !== undefined ? JSON.stringify(data.usage) : undefined;

  await broker.inference.processResponse(
    config.providerAddress,
    chatID,
    usageData
  );

  return { content };
}

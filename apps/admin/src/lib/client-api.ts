"use client";

/**
 * Same-origin when unset (Next + Hono on one Vercel app). Override for a separate API server.
 */
export function clientApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TRIPGENT_API_URL?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return "";
  return "http://127.0.0.1:3000";
}

export function clientAdminHeaders(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const k = process.env.NEXT_PUBLIC_ADMIN_API_KEY?.trim();
  if (k) h["x-admin-key"] = k;
  return h;
}

export async function clientFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const base = clientApiBase();
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...clientAdminHeaders(), ...(init?.headers as object) },
    });
    const text = await res.text();
    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      return { ok: false, error: text.slice(0, 200), status: res.status };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: (data as { error?: string })?.error ?? text.slice(0, 200),
        status: res.status,
      };
    }
    return { ok: true, data, status: res.status };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetch failed",
      status: 0,
    };
  }
}

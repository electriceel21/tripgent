import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function jwtPayloadRole(jwt: string): string | undefined {
  const parts = jwt.split(".");
  if (parts.length < 2) return undefined;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    const p = JSON.parse(json) as { role?: string };
    return p.role;
  } catch {
    return undefined;
  }
}

/**
 * Server-only client. Never expose SUPABASE_SERVICE_ROLE_KEY to browsers or mobile apps.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role) for apps/api"
    );
  }
  const role = jwtPayloadRole(key.trim());
  if (role && role !== "service_role") {
    console.warn(
      "[tripgent] SUPABASE_SERVICE_ROLE_KEY JWT role is %s — expected service_role. " +
        "If this is the anon key, RLS will hide all rows (dashboard counts stay 0). " +
        "Use Project Settings → API → service_role secret.",
      role
    );
  }
  return createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === "23505";
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type TripgentSupabase = SupabaseClient;

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
  return createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === "23505";
}

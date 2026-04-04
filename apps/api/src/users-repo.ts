import type { SupabaseClient } from "@supabase/supabase-js";
import { isUniqueViolation } from "./db.js";

export async function ensureUser(
  sb: SupabaseClient,
  externalId: string,
  displayName?: string | null
): Promise<number> {
  const { data: existing } = await sb
    .from("users")
    .select("id")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existing?.id != null) return Number(existing.id);
  const { data, error } = await sb
    .from("users")
    .insert({
      external_id: externalId,
      display_name: displayName?.trim() ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) {
      const { data: again } = await sb
        .from("users")
        .select("id")
        .eq("external_id", externalId)
        .single();
      return Number(again!.id);
    }
    throw new Error(error.message);
  }
  return Number(data!.id);
}

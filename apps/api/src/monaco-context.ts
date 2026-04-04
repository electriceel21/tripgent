import type { SupabaseClient } from "@supabase/supabase-js";

const MONACO_FOCUS = `
## Focus: Monaco
The traveler is exploring **Monaco** (Monte Carlo, Larvotto, Port Hercule, La Condamine, Fontvieille). Give practical ideas for **things to do**, **activities**, **restaurants**, **hotels**, **shopping**, and **places to buy**—without inventing booking URLs or claiming paid partnerships. Stay concise; suggest what to look for and typical trade-offs.
`.trim();

/** Appended to the base Tripgent system prompt when destination_slug is monaco. */
export async function buildMonacoSystemAugmentation(
  sb: SupabaseClient
): Promise<string> {
  let block = MONACO_FOCUS;
  const { data: rows, error } = await sb
    .from("destination_context_snippets")
    .select("category, content")
    .eq("location_slug", "monaco")
    .order("sort_order", { ascending: true });

  if (error || !rows?.length) {
    return block;
  }

  block += "\n\n### Reference notes (mock data — not live listings)\n";
  for (const r of rows) {
    block += `**${r.category}:** ${r.content}\n\n`;
  }
  return block.trimEnd();
}

export const MONACO_SPONSOR_SLUG = "air-monaco";

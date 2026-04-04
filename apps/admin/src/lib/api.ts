/** Server-side: Tripgent API base (rewrites `/v1/*` on the same Next app when unset). */
export function getApiBaseUrl(): string {
  const explicit = process.env.TRIPGENT_API_URL?.trim();
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  const pub = process.env.NEXT_PUBLIC_TRIPGENT_API_URL?.trim();
  if (pub) return pub;
  return "http://127.0.0.1:3000";
}

export function adminHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  const key =
    process.env.ADMIN_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_API_KEY?.trim();
  if (key) h["x-admin-key"] = key;
  /** Server-side fetch to own Vercel URL when Deployment Protection is on (not for browsers). */
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) h["x-vercel-protection-bypass"] = bypass;
  return h;
}

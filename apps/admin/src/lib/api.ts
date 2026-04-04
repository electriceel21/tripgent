/** Server-side only: base URL for Tripgent API (no NEXT_PUBLIC_ prefix). */
export function getApiBaseUrl(): string {
  return (
    process.env.TRIPGENT_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_TRIPGENT_API_URL?.trim() ||
    "http://127.0.0.1:8787"
  );
}

export function adminHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  const key =
    process.env.ADMIN_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_API_KEY?.trim();
  if (key) h["x-admin-key"] = key;
  return h;
}

import { adminHeaders, getApiBaseUrl } from "@/lib/api";

type Health = { ok?: boolean };
type Dashboard = {
  sponsors?: number;
  locations?: number;
  pools?: number;
  offers?: number;
  users?: number;
  purchasesByStatus?: Record<string, number>;
};

async function fetchJson<T>(path: string): Promise<{ ok: boolean; data?: T; error?: string }> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}${path}`, {
      headers: adminHeaders(),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
    }
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, error: "Invalid JSON from API" };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Request failed (is the API running?)",
    };
  }
}

export default async function AdminHome() {
  const [health, dashboard] = await Promise.all([
    fetchJson<Health>("/health"),
    fetchJson<Dashboard>("/v1/admin/dashboard"),
  ]);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        lineHeight: 1.6,
      }}
    >
      <p style={{ color: "var(--accent)", fontSize: "0.8rem", marginBottom: "0.35rem" }}>
        Web application · desktop browser
      </p>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Tripgent Admin
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Internal console. API base:{" "}
        <code style={{ color: "var(--accent)" }}>{getApiBaseUrl()}</code>
      </p>

      <section
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: "1.25rem 1.5rem",
          marginBottom: "1.25rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>Live API check</h2>
        <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          <strong style={{ color: health.ok && health.data?.ok ? "#3fb950" : "#f85149" }}>
            {health.ok && health.data?.ok ? "●" : "●"}
          </strong>{" "}
          <code>/health</code>{" "}
          {health.ok && health.data?.ok
            ? "OK"
            : health.error ?? (health.data?.ok === false ? "unexpected body" : "failed")}
        </p>
        <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          <strong
            style={{
              color: dashboard.ok ? "#3fb950" : "#f85149",
            }}
          >
            {dashboard.ok ? "●" : "●"}
          </strong>{" "}
          <code>/v1/admin/dashboard</code>{" "}
          {dashboard.ok ? "OK" : dashboard.error ?? "failed"}
        </p>
        {dashboard.ok && dashboard.data ? (
          <pre
            style={{
              margin: "0.75rem 0 0",
              padding: "0.75rem",
              background: "#0d1117",
              borderRadius: 8,
              fontSize: "0.8rem",
              overflow: "auto",
              color: "#e6edf3",
            }}
          >
            {JSON.stringify(dashboard.data, null, 2)}
          </pre>
        ) : null}
      </section>

      <section
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: "1.25rem 1.5rem",
          marginBottom: "1.25rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>Modules</h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
          Use the top nav: Sponsors, Locations, Pools, Offers, Users, Purchases, Rewards. For the
          traveler app see <code style={{ color: "var(--accent)" }}>apps/mobile</code>.
        </p>
      </section>

      <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
        Server-side: <code>TRIPGENT_API_URL</code>, <code>ADMIN_API_KEY</code> in{" "}
        <code>.env.local</code>. Client forms also need{" "}
        <code>NEXT_PUBLIC_TRIPGENT_API_URL</code> and optional{" "}
        <code>NEXT_PUBLIC_ADMIN_API_KEY</code>.
      </p>
    </main>
  );
}

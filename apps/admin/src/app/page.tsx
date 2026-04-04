import { adminHeaders, getApiBaseUrl } from "@/lib/api";

function supabaseHostFromEnv(): string | null {
  const u = process.env.SUPABASE_URL?.trim();
  if (!u) return null;
  try {
    return new URL(u).hostname;
  } catch {
    return "(invalid SUPABASE_URL)";
  }
}

type Health = { ok?: boolean };
type Dashboard = {
  sponsors?: number;
  locations?: number;
  pools?: number;
  offers?: number;
  users?: number;
  purchasesByStatus?: Record<string, number>;
};

function looksLikeVercelDeploymentProtection(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("authentication required") ||
    m.includes("<!doctype html") ||
    m.includes("<title>authentication required</title>")
  );
}

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

  const vercelWall =
    (!health.ok && looksLikeVercelDeploymentProtection(health.error)) ||
    (!dashboard.ok && looksLikeVercelDeploymentProtection(dashboard.error));

  const d = dashboard.data;
  const dashboardAllZero =
    dashboard.ok &&
    d != null &&
    d.sponsors === 0 &&
    d.locations === 0 &&
    d.pools === 0 &&
    d.offers === 0 &&
    d.users === 0 &&
    Object.keys(d.purchasesByStatus ?? {}).length === 0;

  const supabaseHost = supabaseHostFromEnv();

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
      <p style={{ color: "var(--muted)", marginBottom: "0.35rem" }}>
        Internal console. API base:{" "}
        <code style={{ color: "var(--accent)" }}>{getApiBaseUrl()}</code>
      </p>
      {supabaseHost ? (
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
          Supabase host (Vercel server env — must match the project where you ran SQL):{" "}
          <code style={{ color: "var(--accent)" }}>{supabaseHost}</code>
        </p>
      ) : (
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
          <code>SUPABASE_URL</code> not set on this deployment — API cannot reach your database.
        </p>
      )}

      {dashboardAllZero ? (
        <section
          style={{
            background: "#21262d",
            border: "1px solid #f0883e",
            borderRadius: 12,
            padding: "1rem 1.25rem",
            marginBottom: "1.25rem",
            fontSize: "0.88rem",
            lineHeight: 1.55,
            color: "#e6edf3",
          }}
        >
          <strong style={{ color: "#f0883e" }}>Dashboard counts are all zero</strong> even though SQL
          ran? Usually one of these:
          <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem" }}>
            <li>
              <strong>Wrong API key:</strong> Vercel must use the{" "}
              <strong>service_role</strong> secret (Settings → API), not the <strong>anon</strong>{" "}
              <code>public</code> key. With anon + RLS and no policies, queries return{" "}
              <em>empty</em> — exactly like empty tables.
            </li>
            <li>
              <strong>Wrong project:</strong> The Supabase host above must be the same project as the
              SQL editor tab where you ran migrations. Run{" "}
              <code style={{ color: "var(--accent)" }}>apps/api/supabase/VERIFY_COUNTS.sql</code> there
              and compare counts.
            </li>
            <li>
              <strong>Migrations didn’t apply:</strong> Check the SQL editor history for errors; rerun{" "}
              <code>001</code> then <code>002</code> (then <code>003</code>/<code>004</code> as needed).
            </li>
          </ul>
        </section>
      ) : null}

      {vercelWall ? (
        <section
          style={{
            background: "#3d2115",
            border: "1px solid #a371f7",
            borderRadius: 12,
            padding: "1rem 1.25rem",
            marginBottom: "1.25rem",
            fontSize: "0.9rem",
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: "#f0883e" }}>Vercel Deployment Protection</strong> is likely
          blocking API requests. The dashboard calls your own URL from the server, which does not
          use your browser login. Fix one of these:
          <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem" }}>
            <li>
              <strong>Easiest:</strong> Project → Settings →{" "}
              <a href="https://vercel.com/docs/security/deployment-protection">Deployment Protection</a>{" "}
              → disable protection for this environment (or use “Standard” without Vercel Auth on
              previews).
            </li>
            <li>
              <strong>Keep protection:</strong> enable{" "}
              <a href="https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation">
                Protection Bypass for Automation
              </a>{" "}
              and set <code>VERCEL_AUTOMATION_BYPASS_SECRET</code> in Vercel env (it is injected
              automatically; the server adds header <code>x-vercel-protection-bypass</code>).
            </li>
          </ul>
        </section>
      ) : null}

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
        Env: root <code>.env</code> or Vercel — <code>ADMIN_API_KEY</code> (server). If the API
        enforces it, set <code>NEXT_PUBLIC_ADMIN_API_KEY</code> to the same value for browser CRUD,
        or unset <code>ADMIN_API_KEY</code> only for a throwaway public test.
      </p>
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.5rem" }}>
        <strong>Chat:</strong> use the <code>apps/mobile</code> app with{" "}
        <code>EXPO_PUBLIC_TRIPGENT_API_URL</code> pointing at this deployment, or{" "}
        <code>POST {getApiBaseUrl()}/v1/chat</code> with JSON body{" "}
        <code style={{ color: "var(--accent)" }}>messages: [&#123; role, content &#125;]</code>
        (and <code>Authorization: Bearer …</code> if <code>API_AUTH_BEARER</code> is set). Fix
        Deployment Protection first or those calls get HTML 401 too.
      </p>
    </main>
  );
}

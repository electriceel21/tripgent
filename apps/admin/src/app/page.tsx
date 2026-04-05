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
    <main className="admin-shell admin-shell--narrow">
      <p className="admin-kicker">Web application · desktop browser</p>
      <h1 className="admin-page-title">Tripgent Admin</h1>
      <p className="admin-lede" style={{ marginBottom: "0.5rem" }}>
        Internal console. API base:{" "}
        <code style={{ color: "var(--accent)" }}>{getApiBaseUrl()}</code>
      </p>
      {supabaseHost ? (
        <p className="admin-lede" style={{ fontSize: "0.85rem", marginBottom: "2.5rem" }}>
          Supabase host (Vercel server env — must match the project where you ran SQL):{" "}
          <code style={{ color: "var(--accent)" }}>{supabaseHost}</code>
        </p>
      ) : (
        <p className="admin-lede" style={{ fontSize: "0.85rem", marginBottom: "2.5rem" }}>
          <code>SUPABASE_URL</code> not set on this deployment — API cannot reach your database.
        </p>
      )}

      {dashboardAllZero ? (
        <section className="admin-alert admin-alert--warn">
          <strong style={{ color: "#fb923c" }}>Dashboard counts are all zero</strong> even though SQL
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
        <section className="admin-alert admin-alert--purple">
          <strong style={{ color: "#fb923c" }}>Vercel Deployment Protection</strong> is likely
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

      <section className="admin-card">
        <h2 className="admin-card__title">Live API check</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem", display: "flex", alignItems: "center" }}>
            <span
              className={
                health.ok && health.data?.ok ? "admin-status-dot admin-status-dot--ok" : "admin-status-dot admin-status-dot--err"
              }
            />
            <span>
              <code>/health</code>{" "}
              {health.ok && health.data?.ok
                ? "OK"
                : health.error ?? (health.data?.ok === false ? "unexpected body" : "failed")}
            </span>
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem", display: "flex", alignItems: "center" }}>
            <span className={dashboard.ok ? "admin-status-dot admin-status-dot--ok" : "admin-status-dot admin-status-dot--err"} />
            <span>
              <code>/v1/admin/dashboard</code> {dashboard.ok ? "OK" : dashboard.error ?? "failed"}
            </span>
          </p>
        </div>
        {dashboard.ok && dashboard.data ? (
          <pre className="admin-json-block">{JSON.stringify(dashboard.data, null, 2)}</pre>
        ) : null}
      </section>

      <section className="admin-card">
        <h2 className="admin-card__title">Modules</h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.65 }}>
          Use the top nav: Sponsors, Locations, Pools, Offers, Users, Purchases, Rewards. For the
          traveler app see <code style={{ color: "var(--accent)" }}>apps/mobile</code>.
        </p>
      </section>

      <footer className="admin-footer-note">
        <p style={{ margin: "0 0 0.75rem" }}>
          Env: root <code>.env</code> or Vercel — <code>ADMIN_API_KEY</code> (server). If the API
          enforces it, set <code>NEXT_PUBLIC_ADMIN_API_KEY</code> to the same value for browser CRUD,
          or unset <code>ADMIN_API_KEY</code> only for a throwaway public test.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Chat:</strong> use the <code>apps/mobile</code> app with{" "}
          <code>EXPO_PUBLIC_TRIPGENT_API_URL</code> pointing at this deployment, or{" "}
          <code>POST {getApiBaseUrl()}/v1/chat</code> with JSON body{" "}
          <code style={{ color: "var(--accent)" }}>messages: [&#123; role, content &#125;]</code>
          (and <code>Authorization: Bearer …</code> if <code>API_AUTH_BEARER</code> is set). Fix
          Deployment Protection first or those calls get HTML 401 too.
        </p>
      </footer>
    </main>
  );
}

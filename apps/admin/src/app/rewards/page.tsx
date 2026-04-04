"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { btnStyle, inputStyle, main, section, td, th } from "@/lib/admin-page-styles";
import { clientFetch } from "@/lib/client-api";

type AccrualRow = {
  id: number;
  tier: string;
  units: number;
  rate_usdc: number | string;
  amount_usdc: number | string;
  created_at: string;
  users?: { external_id?: string } | null;
  sponsors?: { name?: string; slug?: string } | null;
};

export default function RewardsPage() {
  const [accruals, setAccruals] = useState<AccrualRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [externalId, setExternalId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sponsorSlug, setSponsorSlug] = useState("air-monaco");
  const [units, setUnits] = useState("1");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await clientFetch<{ accruals: AccrualRow[]; note?: string }>("/v1/rewards/accruals");
    setLoading(false);
    if (!r.ok) {
      setMsg(r.error ?? "load failed");
      return;
    }
    setAccruals(r.data?.accruals ?? []);
    setNote(r.data?.note ?? null);
    setMsg(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAccrue(e: FormEvent) {
    e.preventDefault();
    if (!externalId.trim() || !sponsorSlug.trim()) {
      setMsg("External ID and sponsor slug required");
      return;
    }
    setMsg(null);
    const r = await clientFetch("/v1/rewards/accrue", {
      method: "POST",
      body: JSON.stringify({
        user_external_id: externalId.trim(),
        sponsor_slug: sponsorSlug.trim().toLowerCase(),
        units: Number(units) > 0 ? Number(units) : 1,
        display_name: displayName.trim() || undefined,
      }),
    });
    if (!r.ok) {
      setMsg(r.error ?? "accrue failed");
      return;
    }
    await load();
  }

  return (
    <main style={main}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Rewards</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>
        Tier-rate accruals against sponsor pools. Requires migration{" "}
        <code style={{ color: "var(--accent)" }}>003_reward_accrual_usdc.sql</code> and tier rates
        (e.g. Air Monaco mock).
      </p>

      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Accrue (test)</h2>
        <form onSubmit={onAccrue} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            User external ID
            <input value={externalId} onChange={(e) => setExternalId(e.target.value)} required style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Display name (optional)
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Sponsor slug
            <input value={sponsorSlug} onChange={(e) => setSponsorSlug(e.target.value)} required style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Units
            <input
              type="number"
              min={1}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              style={inputStyle}
            />
          </label>
          <button type="submit" style={btnStyle}>
            POST /v1/rewards/accrue
          </button>
        </form>
      </section>

      {msg ? <p style={{ color: "#f85149", marginBottom: "1rem" }}>{msg}</p> : null}
      {note ? (
        <p style={{ color: "#d29922", marginBottom: "1rem", fontSize: "0.9rem" }}>{note}</p>
      ) : null}

      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>
          Recent accruals {loading ? "(loading…)" : `(${accruals.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={th}>ID</th>
                <th style={th}>User</th>
                <th style={th}>Sponsor</th>
                <th style={th}>Tier</th>
                <th style={th}>Units</th>
                <th style={th}>Rate</th>
                <th style={th}>Amount</th>
                <th style={th}>When</th>
              </tr>
            </thead>
            <tbody>
              {accruals.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid #30363d" }}>
                  <td style={td}>{a.id}</td>
                  <td style={td}>
                    <code style={{ fontSize: "0.75rem" }}>{a.users?.external_id ?? "—"}</code>
                  </td>
                  <td style={td}>
                    {a.sponsors?.name ?? a.sponsors?.slug ?? "—"}
                  </td>
                  <td style={td}>{a.tier}</td>
                  <td style={td}>{a.units}</td>
                  <td style={td}>{String(a.rate_usdc)}</td>
                  <td style={td}>{String(a.amount_usdc)}</td>
                  <td style={td}>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

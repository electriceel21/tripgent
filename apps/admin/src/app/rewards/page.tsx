"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  btnStyle,
  inputStyle,
  labelStyle,
  main,
  pageHeading,
  pageSub,
  section,
  sectionTitle,
} from "@/lib/admin-page-styles";
import { clientFetch } from "@/lib/client-api";

type AccrualRow = {
  id: number;
  tier: string;
  units: number;
  rate_usdc: number | string;
  amount_usdc: number | string;
  reason?: string | null;
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
      <h1 style={pageHeading}>Rewards</h1>
      <p style={pageSub}>
        Tier-rate accruals against sponsor pools. Requires migration{" "}
        <code style={{ color: "var(--accent)" }}>003_reward_accrual_usdc.sql</code> and tier rates
        (e.g. Air Monaco mock).
      </p>

      <section style={section}>
        <h2 style={sectionTitle}>Accrue (test)</h2>
        <form onSubmit={onAccrue} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
          <label style={labelStyle}>
            User external ID
            <input value={externalId} onChange={(e) => setExternalId(e.target.value)} required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Display name (optional)
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Sponsor slug
            <input value={sponsorSlug} onChange={(e) => setSponsorSlug(e.target.value)} required style={inputStyle} />
          </label>
          <label style={labelStyle}>
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

      {msg ? <p className="admin-msg-error">{msg}</p> : null}
      {note ? <p className="admin-msg-warn">{note}</p> : null}

      <section style={section}>
        <h2 style={sectionTitle}>
          Recent accruals {loading ? "(loading…)" : `(${accruals.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Sponsor</th>
                <th>Tier</th>
                <th>Units</th>
                <th>Rate</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {accruals.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>
                    <code style={{ fontSize: "0.75rem" }}>{a.users?.external_id ?? "—"}</code>
                  </td>
                  <td>{a.sponsors?.name ?? a.sponsors?.slug ?? "—"}</td>
                  <td>{a.tier}</td>
                  <td>{a.units}</td>
                  <td>{String(a.rate_usdc)}</td>
                  <td>{String(a.amount_usdc)}</td>
                  <td>
                    <code style={{ fontSize: "0.75rem" }}>{a.reason ?? "—"}</code>
                  </td>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

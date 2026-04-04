"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { btnStyle, inputStyle, main, section, td, th } from "@/lib/admin-page-styles";
import { clientFetch } from "@/lib/client-api";

type Sponsor = { id: number; name: string };
type Loc = { id: number; name: string };
type PoolRow = {
  id: number;
  sponsor_id: number;
  name: string;
  budget_cents: number;
  spent_cents: number;
  budget_usdc?: string | number | null;
  spent_usdc?: string | number | null;
  active: boolean;
  sponsor_name?: string | null;
  location_name?: string | null;
};

function budgetLabel(p: PoolRow): string {
  if (p.budget_usdc != null && String(p.budget_usdc) !== "") return String(p.budget_usdc);
  return (Number(p.budget_cents) / 100).toFixed(2);
}

function spentLabel(p: PoolRow): string {
  if (p.spent_usdc != null && String(p.spent_usdc) !== "") return String(p.spent_usdc);
  return (Number(p.spent_cents) / 100).toFixed(4);
}

export default function PoolsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [sponsorId, setSponsorId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [name, setName] = useState("");
  const [budgetUsd, setBudgetUsd] = useState("20");

  const load = useCallback(async () => {
    setLoading(true);
    const sr = await clientFetch<{ sponsors: Sponsor[] }>("/v1/admin/sponsors");
    const lr = await clientFetch<{ locations: Loc[] }>("/v1/admin/locations");
    const pr = await clientFetch<{ pools: PoolRow[] }>("/v1/admin/pools");
    setLoading(false);
    if (!sr.ok || !lr.ok || !pr.ok) {
      setMsg(sr.error ?? lr.error ?? pr.error ?? "load failed");
      return;
    }
    setSponsors(sr.data?.sponsors ?? []);
    setLocs(lr.data?.locations ?? []);
    setPools(pr.data?.pools ?? []);
    setMsg(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!sponsorId) {
      setMsg("Pick a sponsor");
      return;
    }
    setMsg(null);
    const r = await clientFetch<PoolRow>("/v1/admin/pools", {
      method: "POST",
      body: JSON.stringify({
        sponsor_id: Number(sponsorId),
        location_id: locationId ? Number(locationId) : null,
        name,
        budget_usd: Number(budgetUsd),
      }),
    });
    if (!r.ok) {
      setMsg(r.error ?? "create failed");
      return;
    }
    setName("");
    setBudgetUsd("20");
    await load();
  }

  async function toggleActive(p: PoolRow) {
    const r = await clientFetch<PoolRow>(`/v1/admin/pools/${p.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !p.active }),
    });
    if (!r.ok) {
      setMsg(r.error ?? "update failed");
      return;
    }
    await load();
  }

  return (
    <main style={main}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Reward pools</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>
        Budget in USD. Spent includes confirmations and tier accruals when migration 003 is applied.
      </p>
      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>New pool</h2>
        <form onSubmit={onCreate} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Sponsor
            <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} required style={inputStyle}>
              <option value="">— select —</option>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Location (optional)
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={inputStyle}>
              <option value="">— none —</option>
              {locs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Budget (USD)
            <input
              type="number"
              step="0.01"
              min={0}
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <button type="submit" style={btnStyle}>
            Create
          </button>
        </form>
      </section>
      {msg ? <p style={{ color: "#f85149", marginBottom: "1rem" }}>{msg}</p> : null}
      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>
          Pools {loading ? "(loading…)" : `(${pools.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={th}>ID</th>
                <th style={th}>Name</th>
                <th style={th}>Sponsor</th>
                <th style={th}>Loc</th>
                <th style={th}>Budget</th>
                <th style={th}>Spent</th>
                <th style={th}>Active</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #30363d" }}>
                  <td style={td}>{p.id}</td>
                  <td style={td}>{p.name}</td>
                  <td style={td}>{p.sponsor_name ?? p.sponsor_id}</td>
                  <td style={td}>{p.location_name ?? "—"}</td>
                  <td style={td}>{budgetLabel(p)}</td>
                  <td style={td}>{spentLabel(p)}</td>
                  <td style={td}>
                    <button type="button" onClick={() => void toggleActive(p)} style={btnStyle}>
                      {p.active ? "Off" : "On"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

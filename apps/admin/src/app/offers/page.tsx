"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  btnStyle,
  dangerBtn,
  inputStyle,
  main,
  section,
  td,
  th,
} from "@/lib/admin-page-styles";
import { clientFetch } from "@/lib/client-api";

type Sponsor = { id: number; name: string };
type Loc = { id: number; name: string };
type Pool = { id: number; name: string };
type OfferRow = {
  id: number;
  sponsor_id: number;
  location_id: number | null;
  pool_id: number | null;
  title: string;
  description: string | null;
  purchase_url: string | null;
  reward_cents: number;
  active: boolean;
  sponsor_name?: string | null;
  location_name?: string | null;
};

export default function OffersPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [sponsorId, setSponsorId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [poolId, setPoolId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [rewardUsd, setRewardUsd] = useState("0");

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, lr, pr, offerRes] = await Promise.all([
      clientFetch<{ sponsors: Sponsor[] }>("/v1/admin/sponsors"),
      clientFetch<{ locations: Loc[] }>("/v1/admin/locations"),
      clientFetch<{ pools: Pool[] }>("/v1/admin/pools"),
      clientFetch<{ offers: OfferRow[] }>("/v1/admin/offers"),
    ]);
    setLoading(false);
    if (!sr.ok || !lr.ok || !pr.ok || !offerRes.ok) {
      setMsg(sr.error ?? lr.error ?? pr.error ?? offerRes.error ?? "load failed");
      return;
    }
    setSponsors(sr.data?.sponsors ?? []);
    setLocs(lr.data?.locations ?? []);
    setPools(pr.data?.pools ?? []);
    setOffers(offerRes.data?.offers ?? []);
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
    const r = await clientFetch<OfferRow>("/v1/admin/offers", {
      method: "POST",
      body: JSON.stringify({
        sponsor_id: Number(sponsorId),
        location_id: locationId ? Number(locationId) : null,
        pool_id: poolId ? Number(poolId) : null,
        title,
        description: description.trim() || undefined,
        purchase_url: purchaseUrl.trim() || undefined,
        reward_usd: Number(rewardUsd),
      }),
    });
    if (!r.ok) {
      setMsg(r.error ?? "create failed");
      return;
    }
    setTitle("");
    setDescription("");
    setPurchaseUrl("");
    setRewardUsd("0");
    await load();
  }

  async function onDelete(id: number) {
    if (!confirm(`Delete offer #${id}?`)) return;
    const r = await clientFetch<{ ok: boolean }>(`/v1/admin/offers/${id}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      setMsg(r.error ?? "delete failed");
      return;
    }
    await load();
  }

  return (
    <main style={main}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Offers</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>
        Link offers to optional location and pool. Reward is in USD for display; stored as cents.
      </p>

      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>New offer</h2>
        <form
          onSubmit={onCreate}
          style={{ display: "grid", gap: "0.75rem", maxWidth: 480 }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Sponsor
            <select
              value={sponsorId}
              onChange={(e) => setSponsorId(e.target.value)}
              required
              style={inputStyle}
            >
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
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— none —</option>
              {locs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Pool (optional)
            <select
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— none —</option>
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} {p.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Description (optional)
            <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Purchase URL (optional)
            <input value={purchaseUrl} onChange={(e) => setPurchaseUrl(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Reward (USD)
            <input
              type="number"
              step="0.01"
              min={0}
              value={rewardUsd}
              onChange={(e) => setRewardUsd(e.target.value)}
              style={inputStyle}
            />
          </label>
          <button type="submit" style={btnStyle}>
            Create
          </button>
        </form>
      </section>

      {msg ? (
        <p style={{ color: "#f85149", marginBottom: "1rem" }}>{msg}</p>
      ) : null}

      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>
          Offers {loading ? "(loading…)" : `(${offers.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={th}>ID</th>
                <th style={th}>Title</th>
                <th style={th}>Sponsor</th>
                <th style={th}>Reward $</th>
                <th style={th}>Active</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid #30363d" }}>
                  <td style={td}>{o.id}</td>
                  <td style={td}>{o.title}</td>
                  <td style={td}>{o.sponsor_name ?? o.sponsor_id}</td>
                  <td style={td}>{(Number(o.reward_cents) / 100).toFixed(2)}</td>
                  <td style={td}>{o.active ? "yes" : "no"}</td>
                  <td style={td}>
                    <button type="button" onClick={() => void onDelete(o.id)} style={dangerBtn}>
                      Delete
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

"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { btnStyle, inputStyle, main, section, td, th } from "@/lib/admin-page-styles";
import { clientFetch } from "@/lib/client-api";

type OfferOpt = { id: number; title: string };
type PurchaseRow = {
  id: number;
  user_id: number;
  offer_id: number;
  amount_cents: number | null;
  status: string;
  external_id?: string;
  tier?: string;
  offer_title?: string;
};

export default function PurchasesPage() {
  const [offers, setOffers] = useState<OfferOpt[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [externalId, setExternalId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [offerId, setOfferId] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [status, setStatus] = useState<"pending" | "confirmed">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    const or = await clientFetch<{ offers: OfferOpt[] }>("/v1/admin/offers");
    const pr = await clientFetch<{ purchases: PurchaseRow[] }>("/v1/admin/purchases");
    setLoading(false);
    if (!or.ok || !pr.ok) {
      setMsg(or.error ?? pr.error ?? "load failed");
      return;
    }
    setOffers(or.data?.offers ?? []);
    setPurchases(pr.data?.purchases ?? []);
    setMsg(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!externalId.trim() || !offerId) {
      setMsg("External ID and offer required");
      return;
    }
    setMsg(null);
    const body: Record<string, unknown> = {
      user_external_id: externalId.trim(),
      offer_id: Number(offerId),
      status,
    };
    if (displayName.trim()) body.display_name = displayName.trim();
    if (amountUsd.trim()) body.amount_usd = Number(amountUsd);
    const r = await clientFetch("/v1/admin/purchases", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      setMsg(r.error ?? "create failed");
      return;
    }
    setExternalId("");
    setDisplayName("");
    setAmountUsd("");
    await load();
  }

  async function confirmPurchase(id: number) {
    const r = await clientFetch(`/v1/admin/purchases/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
    });
    if (!r.ok) {
      setMsg(r.error ?? "confirm failed");
      return;
    }
    await load();
  }

  return (
    <main style={main}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Purchases</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>
        Record a purchase; confirming applies reputation and pool spend.
      </p>
      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>New purchase</h2>
        <form onSubmit={onCreate} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            User external ID
            <input value={externalId} onChange={(e) => setExternalId(e.target.value)} required style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Display name (optional)
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Offer
            <select value={offerId} onChange={(e) => setOfferId(e.target.value)} required style={inputStyle}>
              <option value="">— select —</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} {o.title}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Amount USD (optional)
            <input
              type="number"
              step="0.01"
              min={0}
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "pending" | "confirmed")}
              style={inputStyle}
            >
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
            </select>
          </label>
          <button type="submit" style={btnStyle}>
            Create
          </button>
        </form>
      </section>
      {msg ? <p style={{ color: "#f85149", marginBottom: "1rem" }}>{msg}</p> : null}
      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>
          Recent {loading ? "(loading…)" : `(${purchases.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={th}>ID</th>
                <th style={th}>User</th>
                <th style={th}>Offer</th>
                <th style={th}>Amt</th>
                <th style={th}>Status</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #30363d" }}>
                  <td style={td}>{p.id}</td>
                  <td style={td}>
                    <code style={{ fontSize: "0.75rem" }}>{p.external_id ?? p.user_id}</code>
                    {p.tier ? ` · ${p.tier}` : ""}
                  </td>
                  <td style={td}>{p.offer_title ?? p.offer_id}</td>
                  <td style={td}>
                    {p.amount_cents != null ? (Number(p.amount_cents) / 100).toFixed(2) : "—"}
                  </td>
                  <td style={td}>{p.status}</td>
                  <td style={td}>
                    {p.status === "pending" ? (
                      <button type="button" onClick={() => void confirmPurchase(p.id)} style={btnStyle}>
                        Confirm
                      </button>
                    ) : (
                      "—"
                    )}
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

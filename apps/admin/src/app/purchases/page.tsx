"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  btnStyle,
  compactBtn,
  inputStyle,
  labelStyle,
  main,
  pageHeading,
  pageSub,
  section,
  sectionTitle,
} from "@/lib/admin-page-styles";
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
      <h1 style={pageHeading}>Purchases</h1>
      <p style={pageSub}>
        Record a purchase; confirming applies reputation and pool spend.
      </p>
      <section style={section}>
        <h2 style={sectionTitle}>New purchase</h2>
        <form onSubmit={onCreate} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
          <label style={labelStyle}>
            User external ID
            <input value={externalId} onChange={(e) => setExternalId(e.target.value)} required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Display name (optional)
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
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
          <label style={labelStyle}>
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
          <label style={labelStyle}>
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
      {msg ? <p className="admin-msg-error">{msg}</p> : null}
      <section style={section}>
        <h2 style={sectionTitle}>
          Recent {loading ? "(loading…)" : `(${purchases.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Offer</th>
                <th>Amt</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>
                    <code style={{ fontSize: "0.75rem" }}>{p.external_id ?? p.user_id}</code>
                    {p.tier ? ` · ${p.tier}` : ""}
                  </td>
                  <td>{p.offer_title ?? p.offer_id}</td>
                  <td>
                    {p.amount_cents != null ? (Number(p.amount_cents) / 100).toFixed(2) : "—"}
                  </td>
                  <td>{p.status}</td>
                  <td>
                    {p.status === "pending" ? (
                      <button type="button" onClick={() => void confirmPurchase(p.id)} style={compactBtn}>
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

"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  btnStyle,
  dangerBtn,
  inputStyle,
  labelStyle,
  main,
  pageHeading,
  pageSub,
  section,
  sectionTitle,
} from "@/lib/admin-page-styles";
import { clientFetch } from "@/lib/client-api";

type Sponsor = { id: number; name: string; slug: string };
type LocationRow = {
  id: number;
  sponsor_id: number | null;
  name: string;
  slug: string;
  country: string | null;
  sponsor_name?: string | null;
};

export default function LocationsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [sponsorId, setSponsorId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [country, setCountry] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, lr] = await Promise.all([
      clientFetch<{ sponsors: Sponsor[] }>("/v1/admin/sponsors"),
      clientFetch<{ locations: LocationRow[] }>("/v1/admin/locations"),
    ]);
    setLoading(false);
    if (!sr.ok) {
      setMsg(sr.error ?? "sponsors failed");
      return;
    }
    if (!lr.ok) {
      setMsg(lr.error ?? "locations failed");
      return;
    }
    setSponsors(sr.data?.sponsors ?? []);
    setLocations(lr.data?.locations ?? []);
    setMsg(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const sid = sponsorId ? Number(sponsorId) : null;
    const r = await clientFetch<LocationRow>("/v1/admin/locations", {
      method: "POST",
      body: JSON.stringify({
        sponsor_id: sid,
        name,
        slug: slug.trim() || undefined,
        country: country.trim() || undefined,
      }),
    });
    if (!r.ok) {
      setMsg(r.error ?? "create failed");
      return;
    }
    setName("");
    setSlug("");
    setCountry("");
    await load();
  }

  async function onDelete(id: number) {
    if (!confirm(`Delete location #${id}?`)) return;
    const r = await clientFetch<{ ok: boolean }>(`/v1/admin/locations/${id}`, {
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Locations</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>
        Destinations tied to an optional sponsor.
      </p>

      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>New location</h2>
        <form
          onSubmit={onCreate}
          style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Sponsor (optional)
            <select
              value={sponsorId}
              onChange={(e) => setSponsorId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— none —</option>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.slug})
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Slug (optional)
            <input value={slug} onChange={(e) => setSlug(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Country (optional)
            <input value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} />
          </label>
          <button type="submit" style={btnStyle}>
            Create
          </button>
        </form>
      </section>

      {msg ? <p className="admin-msg-error">{msg}</p> : null}

      <section style={section}>
        <h2 style={sectionTitle}>
          All locations {loading ? "(loading…)" : `(${locations.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Sponsor</th>
                <th>Country</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>{l.name}</td>
                  <td>
                    <code>{l.slug}</code>
                  </td>
                  <td>{l.sponsor_name ?? "—"}</td>
                  <td>{l.country ?? "—"}</td>
                  <td>
                    <button type="button" onClick={() => void onDelete(l.id)} style={dangerBtn}>
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

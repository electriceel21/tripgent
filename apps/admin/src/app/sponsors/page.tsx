"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { clientFetch } from "@/lib/client-api";
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

type Sponsor = {
  id: number;
  name: string;
  slug: string;
  website: string | null;
};

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await clientFetch<{ sponsors: Sponsor[] }>("/v1/admin/sponsors");
    setLoading(false);
    if (!r.ok) {
      setMsg(r.error ?? "load failed");
      return;
    }
    setSponsors(r.data?.sponsors ?? []);
    setMsg(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await clientFetch<Sponsor>("/v1/admin/sponsors", {
      method: "POST",
      body: JSON.stringify({
        name,
        slug: slug.trim() || undefined,
        website: website.trim() || undefined,
      }),
    });
    if (!r.ok) {
      setMsg(r.error ?? "create failed");
      return;
    }
    setName("");
    setSlug("");
    setWebsite("");
    await load();
  }

  async function onDelete(id: number) {
    if (!confirm(`Delete sponsor #${id}?`)) return;
    const r = await clientFetch<{ ok: boolean }>(`/v1/admin/sponsors/${id}`, {
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
      <h1 style={pageHeading}>Sponsors</h1>
      <p style={pageSub}>
        Create and list sponsors. Slug is derived from name if omitted.
      </p>

      <section style={section}>
        <h2 style={sectionTitle}>New sponsor</h2>
        <form
          onSubmit={onCreate}
          style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}
        >
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
            Website (optional)
            <input value={website} onChange={(e) => setWebsite(e.target.value)} style={inputStyle} />
          </label>
          <button type="submit" style={btnStyle}>
            Create
          </button>
        </form>
      </section>

      {msg ? <p className="admin-msg-error">{msg}</p> : null}

      <section style={section}>
        <h2 style={sectionTitle}>
          All sponsors {loading ? "(loading…)" : `(${sponsors.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Website</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sponsors.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>
                    <code>{s.slug}</code>
                  </td>
                  <td>{s.website ?? "—"}</td>
                  <td>
                    <button type="button" onClick={() => void onDelete(s.id)} style={dangerBtn}>
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

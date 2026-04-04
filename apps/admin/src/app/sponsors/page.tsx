"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { clientFetch } from "@/lib/client-api";
import {
  btnStyle,
  dangerBtn,
  inputStyle,
  main,
  section,
  td,
  th,
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Sponsors</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>
        Create and list sponsors. Slug is derived from name if omitted.
      </p>

      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>New sponsor</h2>
        <form
          onSubmit={onCreate}
          style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
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
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            Website (optional)
            <input value={website} onChange={(e) => setWebsite(e.target.value)} style={inputStyle} />
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
          All sponsors {loading ? "(loading…)" : `(${sponsors.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={th}>ID</th>
                <th style={th}>Name</th>
                <th style={th}>Slug</th>
                <th style={th}>Website</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {sponsors.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid #30363d" }}>
                  <td style={td}>{s.id}</td>
                  <td style={td}>{s.name}</td>
                  <td style={td}>
                    <code>{s.slug}</code>
                  </td>
                  <td style={td}>{s.website ?? "—"}</td>
                  <td style={td}>
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

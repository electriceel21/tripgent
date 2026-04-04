"use client";

import { useCallback, useEffect, useState } from "react";
import { main, section, td, th } from "@/lib/admin-page-styles";
import { clientFetch } from "@/lib/client-api";

type UserRow = {
  id: number;
  external_id: string;
  display_name: string | null;
  tier: string;
  reputation_score: number;
  purchases_confirmed: number;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await clientFetch<{ users: UserRow[] }>("/v1/admin/users");
    setLoading(false);
    if (!r.ok) {
      setMsg(r.error ?? "load failed");
      return;
    }
    setUsers(r.data?.users ?? []);
    setMsg(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={main}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Users</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>
        Travelers by reputation and tier (read-only).
      </p>
      {msg ? <p style={{ color: "#f85149", marginBottom: "1rem" }}>{msg}</p> : null}
      <section style={section}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>
          Users {loading ? "(loading…)" : `(${users.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={th}>ID</th>
                <th style={th}>External ID</th>
                <th style={th}>Name</th>
                <th style={th}>Tier</th>
                <th style={th}>Rep</th>
                <th style={th}>Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid #30363d" }}>
                  <td style={td}>{u.id}</td>
                  <td style={td}>
                    <code style={{ fontSize: "0.8rem" }}>{u.external_id}</code>
                  </td>
                  <td style={td}>{u.display_name ?? "—"}</td>
                  <td style={td}>{u.tier}</td>
                  <td style={td}>{u.reputation_score}</td>
                  <td style={td}>{u.purchases_confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

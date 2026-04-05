"use client";

import { useCallback, useEffect, useState } from "react";
import { main, pageHeading, pageSub, section, sectionTitle } from "@/lib/admin-page-styles";
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
      <h1 style={pageHeading}>Users</h1>
      <p style={pageSub}>Travelers by reputation and tier (read-only).</p>
      {msg ? <p className="admin-msg-error">{msg}</p> : null}
      <section style={section}>
        <h2 style={sectionTitle}>
          Users {loading ? "(loading…)" : `(${users.length})`}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>External ID</th>
                <th>Name</th>
                <th>Tier</th>
                <th>Rep</th>
                <th>Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    <code style={{ fontSize: "0.8rem" }}>{u.external_id}</code>
                  </td>
                  <td>{u.display_name ?? "—"}</td>
                  <td>{u.tier}</td>
                  <td>{u.reputation_score}</td>
                  <td>{u.purchases_confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

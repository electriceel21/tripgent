import type { CSSProperties } from "react";

/** docs/stitch reward_pools: max-w-6xl + p-8 */
export const main: CSSProperties = {
  maxWidth: "72rem",
  margin: "0 auto",
  padding: "2rem 1.5rem 3rem",
};

export const section: CSSProperties = {
  background: "var(--card-bg)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  padding: "1.5rem",
  marginBottom: "1.5rem",
  boxShadow:
    "0 20px 25px -5px rgb(0 0 0 / 0.2), 0 8px 10px -6px rgb(0 0 0 / 0.2)",
};

export const inputStyle: CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--border-subtle)",
  background: "var(--input-bg)",
  color: "var(--text)",
  width: "100%",
};

export const btnStyle: CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "0.375rem",
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  width: "fit-content",
  fontSize: "0.875rem",
  transition: "background 0.15s ease",
};

export const dangerBtn: CSSProperties = {
  ...btnStyle,
  background: "#dc2626",
  color: "#fff",
  fontSize: "0.8rem",
  padding: "0.35rem 0.65rem",
};

/** docs/stitch reward_pools table toggle */
export const compactBtn: CSSProperties = {
  ...btnStyle,
  padding: "0.35rem 0.85rem",
  fontSize: "0.75rem",
  borderRadius: "0.25rem",
};

export const pageHeading: CSSProperties = {
  fontSize: "1.875rem",
  fontWeight: 700,
  color: "#fff",
  margin: "0 0 0.5rem",
  letterSpacing: "-0.02em",
};

export const pageSub: CSSProperties = {
  color: "var(--muted)",
  marginBottom: "2rem",
  lineHeight: 1.6,
  maxWidth: "42rem",
};

export const sectionTitle: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 600,
  color: "#fff",
  marginTop: 0,
  marginBottom: "1.25rem",
};

export const labelStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--muted)",
};

export const th: CSSProperties = {
  padding: "0.75rem 0.5rem 0.75rem 0",
  borderBottom: "1px solid var(--border)",
};
export const td: CSSProperties = {
  padding: "1rem 0.5rem 1rem 0",
  verticalAlign: "middle",
  fontSize: "0.875rem",
};

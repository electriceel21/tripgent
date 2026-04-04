import type { CSSProperties } from "react";

export const main: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "2rem 1.5rem",
};

export const section: CSSProperties = {
  background: "var(--surface)",
  borderRadius: 12,
  padding: "1.25rem",
  marginBottom: "1rem",
};

export const inputStyle: CSSProperties = {
  padding: "0.5rem 0.65rem",
  borderRadius: 6,
  border: "1px solid #30363d",
  background: "#0c0f14",
  color: "var(--text)",
};

export const btnStyle: CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: 6,
  border: "none",
  background: "var(--accent)",
  color: "#0c0f14",
  fontWeight: 600,
  cursor: "pointer",
  width: "fit-content",
};

export const dangerBtn: CSSProperties = {
  ...btnStyle,
  background: "#da3633",
  color: "#fff",
  fontSize: "0.8rem",
  padding: "0.35rem 0.65rem",
};

export const th: CSSProperties = { padding: "0.5rem 0.75rem 0.5rem 0" };
export const td: CSSProperties = { padding: "0.5rem 0.75rem 0.5rem 0", verticalAlign: "middle" };

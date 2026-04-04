import type { CSSProperties } from "react";
import Link from "next/link";

const linkStyle: CSSProperties = {
  color: "var(--accent)",
  textDecoration: "none",
  fontSize: "0.9rem",
  marginRight: "1rem",
};

export function AdminNav() {
  return (
    <header
      style={{
        borderBottom: "1px solid #30363d",
        padding: "0.75rem 1.5rem",
        background: "#0c0f14",
      }}
    >
      <nav style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <Link href="/" style={{ ...linkStyle, fontWeight: 700 }}>
          Tripgent Admin
        </Link>
        <Link href="/sponsors" style={linkStyle}>
          Sponsors
        </Link>
        <Link href="/locations" style={linkStyle}>
          Locations
        </Link>
        <Link href="/pools" style={linkStyle}>
          Pools
        </Link>
        <Link href="/offers" style={linkStyle}>
          Offers
        </Link>
        <Link href="/users" style={linkStyle}>
          Users
        </Link>
        <Link href="/purchases" style={linkStyle}>
          Purchases
        </Link>
        <Link href="/rewards" style={linkStyle}>
          Rewards
        </Link>
      </nav>
    </header>
  );
}

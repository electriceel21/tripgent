"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/sponsors", label: "Sponsors" },
  { href: "/locations", label: "Locations" },
  { href: "/pools", label: "Pools" },
  { href: "/offers", label: "Offers" },
  { href: "/users", label: "Users" },
  { href: "/purchases", label: "Purchases" },
  { href: "/rewards", label: "Rewards" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--midnight)",
      }}
    >
      <nav
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "0 1rem",
          height: "4rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{
            color: "var(--accent)",
            fontWeight: 700,
            fontSize: "1.125rem",
            marginRight: "1.25rem",
            textDecoration: "none",
          }}
        >
          Tripgent Admin
        </Link>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center" }}>
          {links.map(({ href, label }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: active ? "var(--accent)" : "var(--muted)",
                  textDecoration: "none",
                  paddingBottom: "0.2rem",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "color 0.15s ease",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="admin-shell admin-shell--narrow">
      <h1 className="admin-page-title admin-page-title--sm" style={{ marginBottom: "0.5rem" }}>
        404
      </h1>
      <p className="admin-lede" style={{ marginBottom: "1.25rem" }}>
        Page not found.
      </p>
      <Link href="/" className="admin-kicker" style={{ display: "inline-block", textDecoration: "none" }}>
        ← Admin home
      </Link>
    </main>
  );
}

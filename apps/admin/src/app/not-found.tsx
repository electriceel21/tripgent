import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>404</h1>
      <p>Page not found.</p>
      <Link href="/" style={{ color: "#58a6ff" }}>
        Admin home
      </Link>
    </main>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "var(--space-6) var(--space-page-gutter)",
        background: "var(--color-bg-page)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-family-base)",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Tour Ops Web</h1>
      <p style={{ color: "var(--color-text-secondary)", maxWidth: "36rem" }}>
        Shell routes are wired for dashboard, tours, and authentication flows.
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <Link href="/dashboard" style={{ color: "var(--color-text-link)" }}>
            Dashboard
          </Link>
        </li>
        <li>
          <Link href="/tours" style={{ color: "var(--color-text-link)" }}>
            Tours
          </Link>
        </li>
        <li>
          <Link href="/login" style={{ color: "var(--color-text-link)" }}>
            Login
          </Link>
        </li>
        <li>
          <Link href="/auth/register" style={{ color: "var(--color-text-link)" }}>
            Auth — register
          </Link>
        </li>
        <li>
          <Link href="/ui-playground" style={{ color: "var(--color-text-link)" }}>
            UI playground
          </Link>
        </li>
      </ul>
    </main>
  );
}

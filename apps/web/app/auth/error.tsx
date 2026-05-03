"use client";

import { Button } from "@tour/ui";

export default function AuthSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" style={{ padding: "var(--space-4)", maxWidth: "28rem", margin: "0 auto" }}>
      <p style={{ marginTop: 0, fontWeight: "var(--text-h3-weight)" }}>Something went wrong.</p>
      <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-small-size)" }}>
        {error.message || "Could not load this screen."}
      </p>
      <Button type="button" variant="secondary" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}

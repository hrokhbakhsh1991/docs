"use client";

import { Button } from "@tour/ui";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" style={{ padding: "var(--space-6)", maxWidth: "36rem" }}>
      <p style={{ marginTop: 0, fontWeight: "var(--text-h3-weight)" }}>This section failed to load.</p>
      <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-small-size)" }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <Button type="button" variant="secondary" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}

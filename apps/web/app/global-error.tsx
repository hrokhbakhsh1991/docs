"use client";

/**
 * Root error boundary — must define its own <html>/<body> (no next/document).
 * Replaces the root layout when an uncaught error bubbles up.
 */
export default function WebGlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body data-web-global-error>
        <main data-web-global-error-panel>
          <h1>Something went wrong</h1>
          <p>Try again or return to the operator home page.</p>
          <p>
            <button type="button" onClick={() => reset()}>
              Try again
            </button>
          </p>
          <p>
            <a href="/">Back to home</a>
          </p>
        </main>
      </body>
    </html>
  );
}

"use client";

/**
 * Root error boundary — must define its own <html>/<body> (no next/document).
 */
export default function PortalGlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body data-portal-global-error>
        <main data-portal-global-error-panel>
          <h1>Something went wrong</h1>
          <p>Try again or return to the portal home page.</p>
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

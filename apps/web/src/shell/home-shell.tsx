import Link from "next/link";

import { Button } from "@app-tour/ui-primitives/button";

/**
 * Phase 3.3 minimal shell — subpath-only ui-primitives (enforced by import-boundary guard).
 */
export function HomeShell() {
  return (
    <main>
      <h1>Tour Ops</h1>
      <p>Phase 3 web shell — ThemeProviderChain + WorkspaceWizardHost.</p>
      <Link href="/tours/new">
        <Button type="button" variant="primary">
          Start tour wizard
        </Button>
      </Link>
    </main>
  );
}

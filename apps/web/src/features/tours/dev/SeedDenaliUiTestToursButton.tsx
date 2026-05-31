"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@tour/ui";

import {
  isDenaliUiTestSeedHost,
  registerDenaliUiTestTourSeedBridge,
  seedDenaliUiTestTours,
  type SeedDenaliUiTestToursResult,
} from "./seedDenaliUiTestTours";

/**
 * Dev-only control on the tours list — seeds four realistic Denali test tours via BFF POST.
 * Also exposes `window.__seedDenaliUiTestTours()` on localhost.
 */
export function SeedDenaliUiTestToursButton() {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<SeedDenaliUiTestToursResult | null>(null);

  useEffect(() => {
    registerDenaliUiTestTourSeedBridge();
  }, []);

  const handleSeed = useCallback(async () => {
    setBusy(true);
    try {
      const result = await seedDenaliUiTestTours();
      setLastResult(result);
      if (result.ok) {
        // eslint-disable-next-line no-console -- dev-only seed feedback
        console.info("[seedDenaliUiTestTours] created:", result.created);
      } else {
        // eslint-disable-next-line no-console -- dev-only seed feedback
        console.error("[seedDenaliUiTestTours] partial failure:", result);
      }
    } catch (error: unknown) {
      // eslint-disable-next-line no-console -- dev-only seed feedback
      console.error("[seedDenaliUiTestTours] failed:", error);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!isDenaliUiTestSeedHost()) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", alignItems: "flex-end" }}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="seed-denali-ui-test-tours"
        disabled={busy}
        onClick={() => {
          void handleSeed();
        }}
      >
        {busy ? "در حال ساخت تورهای تست…" : "Seed 4 UI test tours"}
      </Button>
      {lastResult ? (
        <span style={{ fontSize: "0.75rem", color: "var(--color-slate-600)", maxWidth: "20rem" }}>
          {lastResult.ok
            ? `${lastResult.created.length} تور ساخته شد`
            : `${lastResult.created.length} موفق، ${lastResult.failed.length} خطا`}
        </span>
      ) : null}
    </div>
  );
}

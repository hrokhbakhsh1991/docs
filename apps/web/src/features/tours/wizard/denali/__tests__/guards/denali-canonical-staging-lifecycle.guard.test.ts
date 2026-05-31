/**
 * Structural guard: syncToken must not abandon staging shell memory (P0 Audit 4).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describeStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";

const webSrcRoot = join(__dirname, "../../../../../..");

const canonicalSource = readFileSync(
  join(webSrcRoot, "features/tours/wizard/denali/DenaliCanonicalContext.tsx"),
  "utf8",
);

const wizardSource = readFileSync(
  join(webSrcRoot, "components/tours/wizard/WorkspaceTourWizard.tsx"),
  "utf8",
);

describeStructuralGuard("denali canonical staging lifecycle", [
  {
    name: "syncToken effect re-derives canonical only — no staging abandon",
    run: () => {
      assert.match(
        canonicalSource,
        /useEffect\(\(\) => \{\s*syncCanonicalFromForm\(\);\s*\}, \[syncToken, syncCanonicalFromForm\]\);/s,
      );
      assert.doesNotMatch(canonicalSource, /EC-RESET-01/);
      assert.doesNotMatch(canonicalSource, /clearStagingUploadTourId/);
    },
  },
  {
    name: "DenaliCanonicalProvider exposes abandonStagingShell and container ref bridge",
    run: () => {
      assert.match(canonicalSource, /abandonStagingShell:\s*\(\)\s*=>\s*void/);
      assert.match(canonicalSource, /abandonStagingShellRef\?: React\.MutableRefObject/);
      assert.match(
        canonicalSource,
        /abandonStagingShellRef\.current = abandonStagingShell/,
      );
    },
  },
  {
    name: "WorkspaceTourWizard abandons staging only on clear-all and submit success",
    run: () => {
      assert.match(wizardSource, /abandonStagingShellRef = useRef/);
      assert.match(wizardSource, /abandonStagingShellRef={abandonStagingShellRef}/);

      const clearAllBlock = wizardSource.match(
        /const handleClearAll = useCallback\(async \(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/,
      )?.[0];
      assert.ok(clearAllBlock, "handleClearAll callback must exist");
      assert.match(clearAllBlock!, /abandonStagingShellRef\.current\?\.\(\)/);

      const submitBlock = wizardSource.match(
        /await createMutation\.mutateAsync\([\s\S]*?router\.refresh\(\);/,
      )?.[0];
      assert.ok(submitBlock, "submit success block must exist");
      assert.match(submitBlock!, /stagingTourId: stagingTourIdRef\.current/);
      assert.match(submitBlock!, /abandonStagingShellRef\.current\?\.\(\)/);
    },
  },
]);

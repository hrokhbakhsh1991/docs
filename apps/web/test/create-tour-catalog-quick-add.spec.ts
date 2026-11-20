import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("inline catalog create defaults off and has a verified create-route-only provider binding", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const route = read("../app/tours/new/page.tsx");
  assert.match(route, /await readOperatorSessionFromCookies\(\)/);
  assert.match(route, /session\.role === "owner"/);
  assert.match(route, /verifiedProfile\.role === "owner"/);
  assert.doesNotMatch(route, /role === "admin"/);
  assert.match(route, /claims\.platform_impersonation_readonly !== true/);
  assert.match(route, /\(await searchParams\)\.clone === undefined/);
  assert.match(route, /candidate \? fetchOperatorProfileServer\(\)/);
  assert.match(route, /verifiedProfile\.userId === session\.userId/);
  assert.match(route, /verifiedProfile\.tenantId === session\.tenantId/);
  assert.match(route, /verifiedProfile\.status === "ACTIVE"/);
  const provider = read(
    "../../../packages/workspaces/denali/src/ui/hooks/denali-wizard-catalog-prefetch-context.tsx"
  );
  assert.match(provider, /canQuickAddCatalog = false/);
});

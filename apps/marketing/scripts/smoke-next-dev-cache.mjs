import fs from "node:fs";
import path from "node:path";

/** Drop stale production `.next` output before `next dev` — avoids vendor-chunk ENOENT in Playwright. */
export function cleanNextDevCache(appDir) {
  fs.rmSync(path.join(appDir, ".next"), { recursive: true, force: true });
}

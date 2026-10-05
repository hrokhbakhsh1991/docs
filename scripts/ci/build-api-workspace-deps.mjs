import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

if (process.env.APP_TOUR_SKIP_API_WORKSPACE_DEPS !== "1") {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  execFileSync("bash", [join(root, "scripts/ci/build-api-workspace-deps.sh")], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

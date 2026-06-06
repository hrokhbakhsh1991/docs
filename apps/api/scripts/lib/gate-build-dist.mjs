import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Monorepo root — `apps/api` prebuild import-boundary requires `platform-core/dist` first. */
export const REPO_ROOT = path.resolve(API_ROOT, "../..");

/** Root `pnpm run build` (workspace-sdk → platform-core → … → @apps/api). */
export const GATE_BUILD_DIST_STEP = {
  id: "build-dist",
  cmd: ["pnpm", "run", "build"],
  cwd: REPO_ROOT,
};

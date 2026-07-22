#!/usr/bin/env node
/**
 * Gap Closure E.4a — print full workspace:onboard recipe (no execution).
 * Usage: pnpm run print:workspace-onboard-plan -- <id> [--guest]
 */
import { pathToFileURL } from "node:url";

import { formatWorkspaceOnboardPlanPayload, planWorkspaceOnboardSteps } from "./workspace-onboard.mjs";

function usage() {
  console.error("Usage: pnpm run print:workspace-onboard-plan -- <workspace-id> [--guest]");
  process.exit(1);
}

function main(argv) {
  const args = argv.filter((a) => a !== "--");
  const id = args[0]?.trim();
  if (!id || id.startsWith("-")) {
    usage();
  }
  const guest = args.includes("--guest");
  const unknown = args.slice(1).filter((a) => a.startsWith("-") && a !== "--guest");
  if (unknown.length > 0) {
    console.error(`Unknown option: ${unknown.join(", ")}`);
    usage();
  }

  const plan = planWorkspaceOnboardSteps({ id, guest });
  console.log(JSON.stringify(formatWorkspaceOnboardPlanPayload(plan, { mode: "plan" }), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}

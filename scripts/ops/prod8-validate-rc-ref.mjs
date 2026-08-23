#!/usr/bin/env node
/** PROD-8 R8-08 — deterministic RC/tag policy validation. */
import { spawnSync } from "node:child_process";

export function gitOutput(args, cwd = process.cwd()) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || `git ${args.join(" ")} failed`);
  }
  return (r.stdout || "").trim();
}

/** @returns {{ ok: true, ref: string, sha: string } | { ok: false, reason: string }} */
export function validateRcRef(ref, cwd = process.cwd()) {
  const input = (ref || "").trim();
  if (!input) return { ok: false, reason: "release_ref is required" };

  if (/^rc-[A-Za-z0-9._-]+$/.test(input)) {
    const sha = gitOutput(["rev-parse", `${input}^{commit}`], cwd);
    return { ok: true, ref: input, sha };
  }

  if (/^refs\/tags\/rc-[A-Za-z0-9._-]+$/.test(input)) {
    const sha = gitOutput(["rev-parse", `${input}^{commit}`], cwd);
    return { ok: true, ref: input.replace(/^refs\/tags\//, ""), sha };
  }

  if (/^[0-9a-f]{40}$/.test(input)) {
    const tags = gitOutput(["tag", "--points-at", input], cwd)
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    const rcTag = tags.find((t) => t.startsWith("rc-"));
    if (!rcTag) {
      return { ok: false, reason: `SHA ${input} has no rc-* tag` };
    }
    return { ok: true, ref: rcTag, sha: input };
  }

  return {
    ok: false,
    reason: "release_ref must be rc-* tag, refs/tags/rc-*, or 40-char SHA with rc-* tag",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2).filter((a) => a !== "--print-sha");
  const ref = args[0];
  const result = validateRcRef(ref);
  if (!result.ok) {
    console.error(`prod8-validate-rc-ref: FAIL — ${result.reason}`);
    process.exit(1);
  }
  if (process.argv.includes("--print-sha")) {
    process.stdout.write(`${result.sha}\n`);
  } else {
    console.log(`prod8-validate-rc-ref: PASS — ref=${result.ref} sha=${result.sha}`);
  }
}

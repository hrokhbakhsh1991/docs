#!/usr/bin/env node
/**
 * DEC-118 — Argo Rollouts manifests + relay worker boot split.
 * @see docs/phase-5/appendices/argo-rollouts-progressive-delivery.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");
const violations = [];

function readFromRepo(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function readFromApi(rel) {
  return fs.readFileSync(path.join(API_ROOT, rel), "utf8");
}

const rolloutPath = "deploy/argo-rollouts/api-rollout.yaml";
const relayDeployPath = "deploy/argo-rollouts/outbox-relay-deployment.yaml";

if (!fs.existsSync(path.join(REPO_ROOT, rolloutPath))) {
  violations.push(`${rolloutPath} must exist`);
}
if (!fs.existsSync(path.join(REPO_ROOT, relayDeployPath))) {
  violations.push(`${relayDeployPath} must exist`);
}

if (violations.length === 0) {
  const rollout = readFromRepo(rolloutPath);
  if (!rollout.includes("kind: Rollout")) {
    violations.push(`${rolloutPath} must define argoproj.io Rollout`);
  }
  if (!rollout.includes("blueGreen:")) {
    violations.push(`${rolloutPath} must use blueGreen strategy`);
  }
  if (!rollout.includes("scaleDownDelaySeconds: 30")) {
    violations.push(`${rolloutPath} must set scaleDownDelaySeconds: 30 (RB-GAP-08)`);
  }
  if (!rollout.includes("OUTBOX_RELAY_ENABLED") || !rollout.includes('value: "false"')) {
    violations.push(`${rolloutPath} must disable OUTBOX_RELAY_ENABLED on API pods`);
  }
  if (!rollout.includes("WORKER_ROLE") || !rollout.includes("value: api")) {
    violations.push(`${rolloutPath} must set WORKER_ROLE=api`);
  }

  const relayDeploy = readFromRepo(relayDeployPath);
  if (!relayDeploy.includes("name: outbox-relay")) {
    violations.push(`${relayDeployPath} must name Deployment outbox-relay`);
  }
  if (!relayDeploy.includes("value: outbox-relay")) {
    violations.push(`${relayDeployPath} must set WORKER_ROLE=outbox-relay`);
  }
  if (!relayDeploy.includes("OUTBOX_RELAY_ENABLED") || !relayDeploy.includes('value: "true"')) {
    violations.push(`${relayDeployPath} must enable OUTBOX_RELAY_ENABLED`);
  }
}

const mainTs = readFromApi("src/main.ts");
if (!mainTs.includes("resolveWorkerRuntimeRole")) {
  violations.push("main.ts must branch on resolveWorkerRuntimeRole()");
}
if (!mainTs.includes("bootstrapOutboxRelayWorker")) {
  violations.push("main.ts must invoke bootstrapOutboxRelayWorker for outbox-relay role");
}

for (const rel of [
  "src/server/worker-runtime-role.ts",
  "src/server/bootstrap-outbox-relay-worker.ts",
  "src/server/create-relay-worker-listener.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

const docPath = "docs/phase-5/appendices/argo-rollouts-progressive-delivery.md";
if (!fs.existsSync(path.join(REPO_ROOT, docPath))) {
  violations.push(docPath);
}

if (violations.length > 0) {
  console.error("guard-deploy-argo-rollouts: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-deploy-argo-rollouts: PASS");

#!/usr/bin/env node
/**
 * AP15 audit — findMany projection hygiene (WARN/FAIL on select-only unbounded).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = path.join(REPO_ROOT, "apps/api/src");

const DELEGATES = [
  "operatorRegistration",
  "operatorPendingInvite",
  "operatorSettingsAuditEvent",
  "operatorUserRoleAudit",
  "tour",
  "userTenant",
  "outboxEvent",
  "payment",
  "paymentReceipt",
  "exposureProfile",
  "exposureIntent",
  "integrationConnection",
  "integrationEventPolicy",
  "integrationDeliveryJob",
  "workspaceDraftEvent",
  "workspaceDraftSnapshot",
  "workspaceTourTheme",
  "workspaceGuideLanguage",
  "workspaceEquipment",
  "workspaceTourPreset",
  "workspaceRegion",
  "workspaceDestination",
  "denaliExposureReminderActivation",
  "user",
];

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory() && !["node_modules", "dist", "platform"].includes(e.name)) {
      walk(f, out);
    } else if (e.name.endsWith(".repository.ts") && !e.name.startsWith("in-memory-")) {
      out.push(f);
    }
  }
  return out;
}

function block(src, idx) {
  const open = src.indexOf("(", idx);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") d++;
    else if (src[i] === ")") {
      d--;
      if (d === 0) return src.slice(idx, i + 1);
    }
  }
  return src.slice(idx, idx + 400);
}

function fnName(src, idx) {
  const h = src.slice(0, idx);
  const m = [...h.matchAll(/async\s+(\w+)\s*\(/g)];
  return m.at(-1)?.[1] ?? "?";
}

/** @type {Array<{ rel: string; fn: string; delegate: string }>} */
const selectOnly = [];

for (const file of walk(API)) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(path.join(REPO_ROOT, "apps/api/src"), file);
  for (const d of DELEGATES) {
    const re = new RegExp(`${d}\\.findMany\\s*\\(`, "g");
    let m;
    while ((m = re.exec(src))) {
      const b = block(src, m.index);
      const take = /\btake\s*:/.test(b);
      const select = /\bselect\s*:/.test(b);
      if (select && !take) {
        selectOnly.push({ rel, fn: fnName(src, m.index), delegate: d });
      }
    }
  }
}

if (selectOnly.length > 0) {
  console.error("audit-findmany-scan: FAIL (select-only findMany without take)");
  for (const entry of selectOnly) {
    console.error(`  ${entry.rel} ${entry.fn} ${entry.delegate}.findMany`);
  }
  process.exit(1);
}

console.log("audit-findmany-scan: PASS (no select-only unbounded findMany in repositories)");

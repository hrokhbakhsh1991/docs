#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../..", import.meta.url).pathname);
const sourceRoot = join(repoRoot, "packages/platform-core/src/field-policy");

const forbiddenPatterns = [
  { label: "provider:telegram", pattern: /\btelegram\b/i },
  { label: "provider:email", pattern: /\bemail\b/i },
  { label: "provider:sms", pattern: /\bsms\b/i },
  { label: "provider:slack", pattern: /\bslack\b/i },
  { label: "provider:whatsapp", pattern: /\bwhatsapp\b/i },
  { label: "delivery:template", pattern: /\btemplate\b/i },
  { label: "delivery:formatter", pattern: /\bformatter\b/i },
  { label: "forbidden-model:FieldEventTrigger", pattern: /\bFieldEventTrigger\b/ },
  { label: "forbidden-model:FieldDeliveryTarget", pattern: /\bFieldDeliveryTarget\b/ },
  { label: "forbidden-model:FieldTimingRule", pattern: /\bFieldTimingRule\b/ },
  { label: "forbidden-import:apps-api", pattern: /apps\/api/ },
  { label: "forbidden-import:denali", pattern: /workspaces\/denali/ },
  { label: "complex-condition:all", pattern: /kind:\s*["']all["']/ },
  { label: "complex-condition:any", pattern: /kind:\s*["']any["']/ },
  { label: "complex-condition:not", pattern: /kind:\s*["']not["']/ },
  { label: "complex-condition:script", pattern: /kind:\s*["']script["']/ },
  { label: "entity-state:integrations.telegram", pattern: /integrations\.telegram/i },
  { label: "entity-state:provider-id", pattern: /\bproviderId\b/ },
];

function listTsFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listTsFiles(path));
      continue;
    }
    if (entry.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];

for (const file of listTsFiles(sourceRoot)) {
  const text = readFileSync(file, "utf8");
  const rel = relative(repoRoot, file);
  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(text)) {
      violations.push(`${rel}: ${label}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Field policy boundary violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("field-policy boundary guard passed");

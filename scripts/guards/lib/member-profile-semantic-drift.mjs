/**
 * M8 — semantic drift simulation (structural comparison).
 * @see docs/phase-19/member-profile-enforcement-matrix.md
 */
import fs from "node:fs";
import path from "node:path";

const CAPABILITIES_REL = "packages/workspace-sdk/src/profile/resolve-member-profile-capabilities.ts";
const BFF_MAPPING_REL = "apps/portal/src/me/member-profile-bff.server.ts";
const CONTRACT_SNAPSHOT_REL = "apps/portal/src/me/member-profile-contract-v1.snapshot.json";
const RUNTIME_TYPES_REL = "apps/portal/src/me/member-profile-types.ts";
const PROFILE_FORM_REL = "apps/portal/app/me/profile/member-profile-form.tsx";

/** @typedef {{ file: string, line?: number, type: string, severity: "LOW" | "MEDIUM" | "HIGH", message: string }} ArchitectureTruthFinding */

function read(repoRoot, relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function exists(repoRoot, relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function extractQuotedIdentifiers(source) {
  return sortedUnique([...source.matchAll(/"([a-zA-Z]+)"/g)].map((match) => match[1] ?? ""));
}

function extractBffIdentityFieldReaders(source) {
  const blockMatch = /IDENTITY_FIELD_READERS[\s\S]*?Object\.freeze\(\{([\s\S]*?)\}\)/.exec(source);
  if (blockMatch === null) {
    return [];
  }
  return sortedUnique([...blockMatch[1].matchAll(/^\s*([a-zA-Z]+):/gm)].map((match) => match[1] ?? ""));
}

function extractConstStringArray(source, constName) {
  const constMatch = new RegExp(
    `const ${constName} = Object\\.freeze\\(\\[([\\s\\S]*?)\\] as const`,
    "m"
  ).exec(source);
  if (constMatch === null) {
    return [];
  }
  return extractQuotedIdentifiers(constMatch[1]);
}

function extractFrozenStringArrayFromBlock(block, propertyName) {
  const propertyMatch = new RegExp(
    `${propertyName}:\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`,
    "m"
  ).exec(block);
  if (propertyMatch === null) {
    return [];
  }
  return extractQuotedIdentifiers(propertyMatch[1]);
}

function extractCapabilityBlock(source, constName) {
  const match = new RegExp(`const ${constName}[\\s\\S]*?Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);`, "m").exec(
    source
  );
  return match?.[1] ?? "";
}

/**
 * @returns {Array<{ pluginId: string, editableFields: string[], readOnlyFields: string[], uiFieldIds: string[] }>}
 */
function extractCapabilityProfiles(capabilitiesSource) {
  const denaliParticipant = extractConstStringArray(capabilitiesSource, "DENALI_PARTICIPANT_FIELDS");
  const denaliBlock = extractCapabilityBlock(capabilitiesSource, "DENALI_CAPABILITIES");
  const defaultBlock = extractCapabilityBlock(capabilitiesSource, "DEFAULT_CAPABILITIES");

  const denaliEditable = denaliParticipant.length > 0
    ? denaliParticipant
    : extractFrozenStringArrayFromBlock(denaliBlock, "editableFields");
  const denaliReadOnly = extractFrozenStringArrayFromBlock(denaliBlock, "readOnlyFields");
  const denaliSectionFields = denaliParticipant.length > 0 ? denaliParticipant : denaliEditable;

  const defaultEditable = extractFrozenStringArrayFromBlock(defaultBlock, "editableFields");
  const defaultReadOnly = extractFrozenStringArrayFromBlock(defaultBlock, "readOnlyFields");
  const defaultSectionFields = extractFrozenStringArrayFromBlock(defaultBlock, "fields");
  const defaultUiFields =
    defaultSectionFields.length > 0
      ? defaultSectionFields
      : sortedUnique([...defaultEditable, ...defaultReadOnly]);

  return [
    {
      pluginId: "denali",
      editableFields: denaliEditable,
      readOnlyFields: denaliReadOnly,
      uiFieldIds: sortedUnique(denaliSectionFields),
    },
    {
      pluginId: "default",
      editableFields: defaultEditable,
      readOnlyFields: defaultReadOnly,
      uiFieldIds: sortedUnique(defaultUiFields),
    },
  ];
}

function simulateBffResponseFieldIds(profile) {
  return sortedUnique([...profile.editableFields, ...profile.readOnlyFields]);
}

function formUsesCapabilityDrivenRendering(formSource) {
  return (
    formSource.includes("profile.capabilities.editableFields") &&
    formSource.includes("profile.capabilities.readOnlyFields") &&
    formSource.includes("data-member-profile-field={fieldId}")
  );
}

/**
 * @param {string} repoRoot
 * @returns {ArchitectureTruthFinding[]}
 */
export function collectSemanticDriftFindings(repoRoot) {
  /** @type {ArchitectureTruthFinding[]} */
  const findings = [];

  if (
    !exists(repoRoot, CAPABILITIES_REL) ||
    !exists(repoRoot, BFF_MAPPING_REL) ||
    !exists(repoRoot, CONTRACT_SNAPSHOT_REL) ||
    !exists(repoRoot, RUNTIME_TYPES_REL) ||
    !exists(repoRoot, PROFILE_FORM_REL)
  ) {
    findings.push({
      file: CAPABILITIES_REL,
      type: "semantic_inputs_missing",
      severity: "HIGH",
      message: "Semantic drift simulation requires capabilities, BFF, snapshot, types, and form sources",
    });
    return findings;
  }

  const capabilitiesSource = read(repoRoot, CAPABILITIES_REL);
  const bffSource = read(repoRoot, BFF_MAPPING_REL);
  const snapshot = JSON.parse(read(repoRoot, CONTRACT_SNAPSHOT_REL));
  const typesSource = read(repoRoot, RUNTIME_TYPES_REL);
  const formSource = read(repoRoot, PROFILE_FORM_REL);

  const snapshotFieldIds = sortedUnique(snapshot.memberProfileFieldIds ?? []);
  const bffFieldIds = extractBffIdentityFieldReaders(bffSource);
  const profiles = extractCapabilityProfiles(capabilitiesSource);

  if (!typesSource.includes("Partial<Record<MemberProfileFieldId, string | null>>")) {
    findings.push({
      file: RUNTIME_TYPES_REL,
      type: "semantic_runtime_shape_missing",
      severity: "HIGH",
      message: "Runtime MemberProfileViewProfile.fields does not reference MemberProfileFieldId map shape",
    });
  }

  for (const snapshotField of snapshotFieldIds) {
    if (!bffFieldIds.includes(snapshotField)) {
      findings.push({
        file: BFF_MAPPING_REL,
        type: "semantic_snapshot_field_missing_in_bff",
        severity: "HIGH",
        message: `Snapshot field "${snapshotField}" is not represented in BFF identity readers`,
      });
    }
  }

  if (!formUsesCapabilityDrivenRendering(formSource)) {
    findings.push({
      file: PROFILE_FORM_REL,
      type: "semantic_ui_not_capability_driven",
      severity: "HIGH",
      message: "Profile UI form is not capability-driven (expected editableFields/readOnlyFields iteration)",
    });
  }

  for (const profile of profiles) {
    const exposedFieldIds = simulateBffResponseFieldIds(profile);

    for (const fieldId of exposedFieldIds) {
      if (!bffFieldIds.includes(fieldId)) {
        findings.push({
          file: BFF_MAPPING_REL,
          type: "semantic_sdk_field_missing_in_bff_response",
          severity: "HIGH",
          message: `Plugin "${profile.pluginId}" exposes capability field "${fieldId}" without BFF identity reader`,
        });
      }
    }

    for (const fieldId of exposedFieldIds) {
      if (!profile.uiFieldIds.includes(fieldId)) {
        findings.push({
          file: PROFILE_FORM_REL,
          type: "semantic_capability_field_unused_in_ui",
          severity: "MEDIUM",
          message: `Plugin "${profile.pluginId}" capability field "${fieldId}" is not rendered by UI section model`,
        });
      }
    }

    for (const fieldId of exposedFieldIds) {
      if (!snapshotFieldIds.includes(fieldId)) {
        findings.push({
          file: CONTRACT_SNAPSHOT_REL,
          type: "semantic_response_field_missing_in_snapshot",
          severity: "HIGH",
          message: `Simulated BFF response field "${fieldId}" for plugin "${profile.pluginId}" is absent from snapshot`,
        });
      }
    }
  }

  return findings;
}

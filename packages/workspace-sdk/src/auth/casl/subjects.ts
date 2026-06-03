import { subject } from "@casl/ability";

import type {
  CanonicalDocumentSubject,
  PluginSubject,
  TenantSubject,
  WorkspaceSubject,
  WorkspaceThemeSubject,
} from "../subjects";

export function caslWorkspaceSubject(params: WorkspaceSubject) {
  return subject("Workspace", params);
}

export function caslTenantSubject(params: TenantSubject) {
  return subject("Tenant", params);
}

export function caslPluginSubject(params: PluginSubject) {
  return subject("Plugin", params);
}

export function caslWorkspaceThemeSubject(params: WorkspaceThemeSubject) {
  return subject("WorkspaceTheme", params);
}

export function caslCanonicalDocumentSubject(params: CanonicalDocumentSubject) {
  return subject("CanonicalDocument", params);
}

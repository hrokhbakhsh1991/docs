import type { IncomingMessage, ServerResponse } from "node:http";
import { handlePlatformAuditList } from "../routes/platform/audit-list.ts";
import { handlePlatformTeam } from "../routes/platform/team.ts";
import { handlePlatformTenantsGet } from "../routes/platform/tenants-get.ts";
import { handlePlatformTenantsList } from "../routes/platform/tenants-list.ts";
import {
  handlePlatformTenantDomainById,
  handlePlatformTenantDomainVerify,
  handlePlatformTenantsDomains,
} from "../routes/platform/tenants-domains.ts";
import { handlePlatformTenantsSitesCheck } from "../routes/platform/tenants-sites-check.ts";
import { handlePlatformWorkspaces } from "../routes/platform/workspaces.ts";

export const PLATFORM_PREFIX = "/platform/v1";

const TENANT_BY_ID_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)$/;
const TENANT_STATUS_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/status$/;
const TENANT_OWNER_INVITE_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/owner-invite$/;
const TENANT_IMPERSONATE_END_PATTERN =
  /^\/platform\/v1\/tenants\/([^/]+)\/impersonate\/end$/;
const TENANT_IMPERSONATE_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/impersonate$/;
const TENANT_SITES_CHECK_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/sites\/check$/;
const TENANT_DOMAINS_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/domains$/;
const TENANT_DOMAIN_VERIFY_PATTERN =
  /^\/platform\/v1\/tenants\/([^/]+)\/domains\/([^/]+)\/verify$/;
const TENANT_DOMAIN_BY_ID_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/domains\/([^/]+)$/;
const TENANT_SUBSCRIPTION_MARK_PAID_PATTERN =
  /^\/platform\/v1\/tenants\/([^/]+)\/subscription\/mark-paid$/;
const TENANT_SUBSCRIPTION_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/subscription$/;
const BILLING_RUN_PAST_DUE_PATTERN = /^\/platform\/v1\/billing\/run-past-due-check$/;
const DOMAINS_SSL_SUMMARY_PATTERN = /^\/platform\/v1\/domains\/ssl-summary$/;
const DOMAINS_RUN_SSL_EXPIRY_PATTERN = /^\/platform\/v1\/domains\/run-ssl-expiry-check$/;
const TENANT_OFFBOARD_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/offboard$/;
const TENANT_CANCEL_OFFBOARD_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/cancel-offboard$/;
const TENANT_EXPORT_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/export$/;
const TENANT_PURGE_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/purge$/;
const TENANT_RUN_SCHEDULED_DELETIONS_PATTERN = /^\/platform\/v1\/tenants\/run-scheduled-deletions$/;
const AUDIT_EXPORT_PATTERN = /^\/platform\/v1\/audit\/export$/;
const TENANT_WORKSPACE_DEFINITION_PATTERN =
  /^\/platform\/v1\/tenants\/([^/]+)\/workspace-definition$/;
const WORKSPACE_DEFINITIONS_LIST_PATTERN = /^\/platform\/v1\/workspace-definitions$/;
const WORKSPACE_DEFINITION_VERSION_GET_PATTERN =
  /^\/platform\/v1\/workspace-definitions\/([^/]+)\/versions\/(\d+)$/;
const WORKSPACE_DEFINITION_VERSIONS_POST_PATTERN =
  /^\/platform\/v1\/workspace-definitions\/([^/]+)\/versions$/;

export async function tryDispatchPlatformRoutes(
  method: string,
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  if (!pathname.startsWith(PLATFORM_PREFIX)) return false;

  if (method === "GET" && pathname === `${PLATFORM_PREFIX}/workspaces`) {
    await handlePlatformWorkspaces(req, res);
    return true;
  }

  if (method === "GET" && pathname === `${PLATFORM_PREFIX}/audit`) {
    await handlePlatformAuditList(req, res);
    return true;
  }

  if ((method === "GET" || method === "POST") && pathname === `${PLATFORM_PREFIX}/team`) {
    await handlePlatformTeam(req, res);
    return true;
  }

  if (method === "POST" && pathname === `${PLATFORM_PREFIX}/auth/request-otp`) {
    const { handlePlatformAuthRequestOtp } = await import("../routes/platform/auth-request-otp.ts");
    await handlePlatformAuthRequestOtp(req, res);
    return true;
  }

  if (method === "POST" && pathname === `${PLATFORM_PREFIX}/auth/verify-otp`) {
    const { handlePlatformAuthVerifyOtp } = await import("../routes/platform/auth-verify-otp.ts");
    await handlePlatformAuthVerifyOtp(req, res);
    return true;
  }

  if (method === "GET" && pathname === `${PLATFORM_PREFIX}/tenants`) {
    await handlePlatformTenantsList(req, res);
    return true;
  }

  if (method === "GET" && pathname === `${PLATFORM_PREFIX}/plans`) {
    const { handlePlatformPlansList } = await import("../routes/platform/plans-list.ts");
    await handlePlatformPlansList(req, res);
    return true;
  }

  if (method === "POST" && pathname === `${PLATFORM_PREFIX}/billing/run-past-due-check`) {
    const { handlePlatformBillingRunPastDuePost } = await import(
      "../routes/platform/billing-run-past-due-post.ts"
    );
    await handlePlatformBillingRunPastDuePost(req, res);
    return true;
  }

  const subscriptionMarkPaidMatch = pathname.match(TENANT_SUBSCRIPTION_MARK_PAID_PATTERN);
  if (method === "POST" && subscriptionMarkPaidMatch) {
    const { handlePlatformTenantsSubscriptionMarkPaidPost } = await import(
      "../routes/platform/tenants-subscription-mark-paid-post.ts"
    );
    await handlePlatformTenantsSubscriptionMarkPaidPost(
      req,
      res,
      subscriptionMarkPaidMatch[1] ?? ""
    );
    return true;
  }

  const subscriptionMatch = pathname.match(TENANT_SUBSCRIPTION_PATTERN);
  if (method === "PATCH" && subscriptionMatch) {
    const { handlePlatformTenantsSubscriptionPatch } = await import(
      "../routes/platform/tenants-subscription-patch.ts"
    );
    await handlePlatformTenantsSubscriptionPatch(req, res, subscriptionMatch[1] ?? "");
    return true;
  }

  const sitesCheckMatch = pathname.match(TENANT_SITES_CHECK_PATTERN);
  if (method === "GET" && sitesCheckMatch) {
    await handlePlatformTenantsSitesCheck(req, res, sitesCheckMatch[1] ?? "");
    return true;
  }

  const domainVerifyMatch = pathname.match(TENANT_DOMAIN_VERIFY_PATTERN);
  if (method === "POST" && domainVerifyMatch) {
    await handlePlatformTenantDomainVerify(
      req,
      res,
      domainVerifyMatch[1] ?? "",
      domainVerifyMatch[2] ?? ""
    );
    return true;
  }

  const domainByIdMatch = pathname.match(TENANT_DOMAIN_BY_ID_PATTERN);
  if (method === "DELETE" && domainByIdMatch) {
    await handlePlatformTenantDomainById(
      req,
      res,
      domainByIdMatch[1] ?? "",
      domainByIdMatch[2] ?? ""
    );
    return true;
  }

  const domainsMatch = pathname.match(TENANT_DOMAINS_PATTERN);
  if ((method === "GET" || method === "POST") && domainsMatch) {
    await handlePlatformTenantsDomains(req, res, domainsMatch[1] ?? "");
    return true;
  }

  if (method === "GET" && WORKSPACE_DEFINITIONS_LIST_PATTERN.test(pathname)) {
    const { handlePlatformWorkspaceDefinitionsList } = await import(
      "../routes/platform/workspace-definitions-list.ts"
    );
    await handlePlatformWorkspaceDefinitionsList(req, res);
    return true;
  }

  if (method === "POST" && WORKSPACE_DEFINITIONS_LIST_PATTERN.test(pathname)) {
    const { handlePlatformWorkspaceDefinitionsPost } = await import(
      "../routes/platform/workspace-definitions-post.ts"
    );
    await handlePlatformWorkspaceDefinitionsPost(req, res);
    return true;
  }

  const workspaceDefinitionVersionGetMatch = pathname.match(WORKSPACE_DEFINITION_VERSION_GET_PATTERN);
  if (method === "GET" && workspaceDefinitionVersionGetMatch) {
    const { handlePlatformWorkspaceDefinitionsVersionGet } = await import(
      "../routes/platform/workspace-definitions-version-get.ts"
    );
    await handlePlatformWorkspaceDefinitionsVersionGet(
      req,
      res,
      workspaceDefinitionVersionGetMatch[1] ?? "",
      workspaceDefinitionVersionGetMatch[2] ?? ""
    );
    return true;
  }

  const workspaceDefinitionVersionsPostMatch = pathname.match(
    WORKSPACE_DEFINITION_VERSIONS_POST_PATTERN
  );
  if (method === "POST" && workspaceDefinitionVersionsPostMatch) {
    const { handlePlatformWorkspaceDefinitionsVersionsPost } = await import(
      "../routes/platform/workspace-definitions-versions-post.ts"
    );
    await handlePlatformWorkspaceDefinitionsVersionsPost(
      req,
      res,
      workspaceDefinitionVersionsPostMatch[1] ?? ""
    );
    return true;
  }

  if (method === "GET" && AUDIT_EXPORT_PATTERN.test(pathname)) {
    const { handlePlatformAuditExportGet } = await import("../routes/platform/audit-export-get.ts");
    await handlePlatformAuditExportGet(req, res);
    return true;
  }

  if (method === "POST" && TENANT_RUN_SCHEDULED_DELETIONS_PATTERN.test(pathname)) {
    const { handlePlatformTenantsRunScheduledDeletionsPost } = await import(
      "../routes/platform/tenants-run-scheduled-deletions-post.ts"
    );
    await handlePlatformTenantsRunScheduledDeletionsPost(req, res);
    return true;
  }

  const offboardMatch = pathname.match(TENANT_OFFBOARD_PATTERN);
  if (method === "POST" && offboardMatch) {
    const { handlePlatformTenantsOffboardPost } = await import(
      "../routes/platform/tenants-offboard-post.ts"
    );
    await handlePlatformTenantsOffboardPost(req, res, offboardMatch[1] ?? "");
    return true;
  }

  const cancelOffboardMatch = pathname.match(TENANT_CANCEL_OFFBOARD_PATTERN);
  if (method === "POST" && cancelOffboardMatch) {
    const { handlePlatformTenantsCancelOffboardPost } = await import(
      "../routes/platform/tenants-cancel-offboard-post.ts"
    );
    await handlePlatformTenantsCancelOffboardPost(req, res, cancelOffboardMatch[1] ?? "");
    return true;
  }

  const exportMatch = pathname.match(TENANT_EXPORT_PATTERN);
  if (method === "POST" && exportMatch) {
    const { handlePlatformTenantsExportPost } = await import(
      "../routes/platform/tenants-export-post.ts"
    );
    await handlePlatformTenantsExportPost(req, res, exportMatch[1] ?? "");
    return true;
  }

  const purgeMatch = pathname.match(TENANT_PURGE_PATTERN);
  if (method === "POST" && purgeMatch) {
    const { handlePlatformTenantsPurgePost } = await import(
      "../routes/platform/tenants-purge-post.ts"
    );
    await handlePlatformTenantsPurgePost(req, res, purgeMatch[1] ?? "");
    return true;
  }

  const tenantMatch = pathname.match(TENANT_BY_ID_PATTERN);
  if (method === "GET" && tenantMatch) {
    await handlePlatformTenantsGet(req, res, tenantMatch[1] ?? "");
    return true;
  }

  const statusMatch = pathname.match(TENANT_STATUS_PATTERN);
  if (method === "PATCH" && statusMatch) {
    const { handlePlatformTenantsStatusPatch } = await import("../routes/platform/tenants-status-patch.ts");
    await handlePlatformTenantsStatusPatch(req, res, statusMatch[1] ?? "");
    return true;
  }

  const workspaceDefinitionMatch = pathname.match(TENANT_WORKSPACE_DEFINITION_PATTERN);
  if (method === "PATCH" && workspaceDefinitionMatch) {
    const { handlePlatformTenantsWorkspaceDefinitionPatch } = await import(
      "../routes/platform/tenants-workspace-definition-patch.ts"
    );
    await handlePlatformTenantsWorkspaceDefinitionPatch(
      req,
      res,
      workspaceDefinitionMatch[1] ?? ""
    );
    return true;
  }

  const inviteMatch = pathname.match(TENANT_OWNER_INVITE_PATTERN);
  if (method === "POST" && inviteMatch) {
    const { handlePlatformTenantsOwnerInvitePost } = await import(
      "../routes/platform/tenants-owner-invite-post.ts"
    );
    await handlePlatformTenantsOwnerInvitePost(req, res, inviteMatch[1] ?? "");
    return true;
  }

  const impersonateEndMatch = pathname.match(TENANT_IMPERSONATE_END_PATTERN);
  if (method === "POST" && impersonateEndMatch) {
    const { handlePlatformTenantsImpersonateEndPost } = await import(
      "../routes/platform/tenants-impersonate-end-post.ts"
    );
    await handlePlatformTenantsImpersonateEndPost(req, res, impersonateEndMatch[1] ?? "");
    return true;
  }

  const impersonateMatch = pathname.match(TENANT_IMPERSONATE_PATTERN);
  if (method === "POST" && impersonateMatch) {
    const { handlePlatformTenantsImpersonatePost } = await import(
      "../routes/platform/tenants-impersonate-post.ts"
    );
    await handlePlatformTenantsImpersonatePost(req, res, impersonateMatch[1] ?? "");
    return true;
  }

  if (method === "POST" && pathname === `${PLATFORM_PREFIX}/tenants`) {
    const { handlePlatformTenantsCreate } = await import("../routes/platform/tenants-create.ts");
    await handlePlatformTenantsCreate(req, res);
    return true;
  }

  if (method === "GET" && DOMAINS_SSL_SUMMARY_PATTERN.test(pathname)) {
    const { handlePlatformDomainsSslSummaryGet } = await import(
      "../routes/platform/domains-ssl-summary-get.ts"
    );
    await handlePlatformDomainsSslSummaryGet(req, res);
    return true;
  }

  if (method === "POST" && DOMAINS_RUN_SSL_EXPIRY_PATTERN.test(pathname)) {
    const { handlePlatformDomainsRunSslExpiryCheckPost } = await import(
      "../routes/platform/domains-run-ssl-expiry-check-post.ts"
    );
    await handlePlatformDomainsRunSslExpiryCheckPost(req, res);
    return true;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
  return true;
}

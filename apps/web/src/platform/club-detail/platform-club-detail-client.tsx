"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { OPERATOR_SUCCESS_BADGE_MD_CLASS } from "@/admin/patterns/operator-semantic-surfaces";
import { PlatformErrorState } from "../platform-async-states";
import { fetchPlatformApi } from "../platform-api-client";
import { TabBilling } from "./tab-billing";
import { TabDomains } from "./tab-domains";
import { TabOwnerImpersonate } from "./tab-owner-impersonate";
import { TabActionsDanger } from "./tab-actions-danger";
import { TabSites } from "./tab-sites";
import { TabWorkspaceDefinition } from "./tab-workspace-definition";
import { downloadTenantGdprExport } from "./download-tenant-gdpr-export";
import type { PlatformClubDetail } from "./platform-club-detail.types";
import { WorkspaceProductionCertificationBadge } from "../workspace-production-certification-badge";
import { tryResolveWorkspaceProductionTier } from "../resolve-workspace-production-tier";

export type PlatformClubDetailClientProps = {
  readonly initialDetail: PlatformClubDetail;
  readonly opsRole: "owner" | "admin" | "support";
};

export function PlatformClubDetailClient({
  initialDetail,
  opsRole,
}: PlatformClubDetailClientProps) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [tab, setTab] = useState<
    "overview" | "sites" | "domains" | "billing" | "workspace" | "owner" | "actions"
  >("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const workspaceProductionTier = tryResolveWorkspaceProductionTier(detail.tenant.workspaceType);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const patchStatus = useCallback(
    async (status: "active" | "suspended") => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetchPlatformApi(`/tenants/${detail.tenant.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          tenant?: PlatformClubDetail["tenant"];
          error?: string;
        };
        if (!response.ok || !body.tenant) {
          setError(body.error ?? "Failed to update status");
          return;
        }
        setDetail((current) => ({ ...current, tenant: body.tenant! }));
        router.refresh();
      } catch {
        setError("Failed to update status");
      } finally {
        setBusy(false);
      }
    },
    [detail.tenant.id, router]
  );

  const resendInvite = useCallback(async () => {
    setBusy(true);
    setError(null);
    setInviteToken(null);
    try {
      const response = await fetchPlatformApi(`/tenants/${detail.tenant.id}/owner-invite`, {
        method: "POST",
        body: JSON.stringify(detail.ownerInvite?.phone ? { phone: detail.ownerInvite.phone } : {}),
      });
      const body = (await response.json().catch(() => ({}))) as {
        invite?: { inviteId?: string; inviteToken?: string };
        error?: string;
      };
      if (!response.ok || !body.invite?.inviteId) {
        setError(body.error ?? "Failed to resend invite");
        return;
      }
      setInviteToken(body.invite.inviteToken ?? null);
      setDetail((current) => ({
        ...current,
        ownerInvite: {
          inviteId: body.invite!.inviteId!,
          phone: current.ownerInvite?.phone ?? "",
          status: "INVITED",
        },
      }));
    } catch {
      setError("Failed to resend invite");
    } finally {
      setBusy(false);
    }
  }, [detail.ownerInvite?.phone, detail.tenant.id]);

  const reloadDetail = useCallback(async () => {
    const response = await fetchPlatformApi(`/tenants/${detail.tenant.id}`);
    const body = (await response.json().catch(() => ({}))) as PlatformClubDetail;
    if (response.ok && body?.tenant?.id) {
      setDetail(body);
      router.refresh();
    }
  }, [detail.tenant.id, router]);

  const offboardTenant = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchPlatformApi(`/tenants/${detail.tenant.id}/offboard`, {
        method: "POST",
        body: "{}",
      });
      if (!response.ok) {
        setError("Failed to start offboarding");
        return;
      }
      await reloadDetail();
    } catch {
      setError("Failed to start offboarding");
    } finally {
      setBusy(false);
    }
  }, [detail.tenant.id, reloadDetail]);

  const cancelOffboardTenant = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchPlatformApi(`/tenants/${detail.tenant.id}/cancel-offboard`, {
        method: "POST",
        body: "{}",
      });
      if (!response.ok) {
        setError("Failed to cancel offboarding");
        return;
      }
      await reloadDetail();
    } catch {
      setError("Failed to cancel offboarding");
    } finally {
      setBusy(false);
    }
  }, [detail.tenant.id, reloadDetail]);

  return (
    <div
      className="space-y-6"
      data-platform-club-detail
      data-client-ready={clientReady ? "true" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{detail.tenant.subdomain}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{detail.tenant.workspaceType}</span>
            {workspaceProductionTier ? (
              <WorkspaceProductionCertificationBadge tier={workspaceProductionTier} />
            ) : null}
          </p>
        </div>
        <span
          data-status={detail.tenant.status}
          className={
            detail.tenant.status === "suspended"
              ? "rounded-full bg-destructive/10 px-3 py-1 text-sm text-destructive"
              : OPERATOR_SUCCESS_BADGE_MD_CLASS
          }
        >
          {detail.tenant.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {(
          ["overview", "sites", "domains", "billing", "workspace", "owner", "actions"] as const
        ).map((item) => (
          <button
            key={item}
            type="button"
            data-tab-button={item}
            className={
              tab === item
                ? "rounded-md bg-muted px-3 py-1.5 text-sm font-medium"
                : "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/60"
            }
            onClick={() => setTab(item)}
          >
            {item === "workspace" ? "Workspace" : item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {error ? <PlatformErrorState message={error} /> : null}

      {tab === "overview" ? (
        <dl className="grid gap-3 rounded-lg border border-border p-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Tenant id</dt>
            <dd className="break-all font-medium">{detail.tenant.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{new Date(detail.tenant.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Subdomain</dt>
            <dd className="font-medium">{detail.tenant.subdomain}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Workspace</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium">
              <span>{detail.tenant.workspaceType}</span>
              {workspaceProductionTier ? (
                <WorkspaceProductionCertificationBadge tier={workspaceProductionTier} />
              ) : null}
            </dd>
          </div>
        </dl>
      ) : null}

      {tab === "sites" ? (
        <TabSites
          tenantId={detail.tenant.id}
          sites={detail.sites}
          siteSurfaces={detail.siteSurfaces}
        />
      ) : null}

      {tab === "domains" ? <TabDomains tenantId={detail.tenant.id} /> : null}

      {tab === "billing" ? (
        <TabBilling
          tenantId={detail.tenant.id}
          subscription={detail.subscription}
          isOwner={opsRole === "owner"}
          onSubscriptionUpdated={(subscription) =>
            setDetail((current) => ({ ...current, subscription }))
          }
        />
      ) : null}

      {tab === "workspace" ? (
        <TabWorkspaceDefinition
          tenantId={detail.tenant.id}
          workspaceType={detail.tenant.workspaceType}
          workspaceCommerce={detail.workspaceCommerce}
          integrationsPlane={detail.integrationsPlane}
          binding={detail.workspaceDefinition}
          isWriteRole={opsRole === "owner" || opsRole === "admin"}
          onBindingUpdated={(workspaceDefinition) =>
            setDetail((current) => ({ ...current, workspaceDefinition }))
          }
        />
      ) : null}

      {tab === "owner" ? (
        <div className="space-y-4 rounded-lg border border-border p-4 text-sm">
          {detail.ownerInvite ? (
            <dl className="space-y-2">
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">{detail.ownerInvite.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{detail.ownerInvite.status}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground">No pending owner invite.</p>
          )}
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={busy}
            onClick={resendInvite}
          >
            {busy ? "Sending…" : "Resend invite"}
          </button>
          {inviteToken ? (
            <p className="break-all rounded-md bg-muted/40 p-3 text-xs">
              New invite token: {inviteToken}
            </p>
          ) : null}
          <TabOwnerImpersonate tenantId={detail.tenant.id} adminLoginUrl={detail.sites.admin} />
        </div>
      ) : null}

      {tab === "actions" ? (
        <div className="space-y-4">
          {detail.tenant.status !== "offboarding" ? (
            <div className="flex flex-wrap gap-3">
              {detail.tenant.status !== "active" ? (
                <button
                  type="button"
                  data-action-activate
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  disabled={busy}
                  onClick={() => patchStatus("active")}
                >
                  Activate
                </button>
              ) : null}
              {detail.tenant.status !== "suspended" ? (
                <button
                  type="button"
                  data-action-suspend
                  className="inline-flex h-9 items-center rounded-md border border-destructive px-4 text-sm text-destructive disabled:opacity-50"
                  disabled={busy}
                  onClick={() => patchStatus("suspended")}
                >
                  Suspend
                </button>
              ) : null}
            </div>
          ) : null}
          <TabActionsDanger
            tenantId={detail.tenant.id}
            status={detail.tenant.status}
            scheduledDeletionAt={detail.scheduledDeletionAt}
            isOwner={opsRole === "owner"}
            busy={busy}
            onOffboard={offboardTenant}
            onCancelOffboard={cancelOffboardTenant}
            onExport={async () => {
              setBusy(true);
              setError(null);
              try {
                await downloadTenantGdprExport(detail.tenant.id);
              } catch {
                setError("Export failed");
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

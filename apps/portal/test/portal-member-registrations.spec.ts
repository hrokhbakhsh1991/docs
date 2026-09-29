/**
 * P6-3 — portal member registrations BFF
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { mergeCatalogRegistrationHeaders } from "../src/catalog/build-catalog-registration-headers.server";
import { formatMemberMoney } from "../src/me/format-member-money";
import { hydrateMemberRegistrationListFinancialProjection } from "../src/me/hydrate-member-registration-list-financial-projection.server";
import { resolveMemberFinancialProjection } from "../src/me/resolve-member-financial-projection";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal-member-registrations", () => {
  it("MEM-FIN-01 formats IRR with the member-facing toman label", () => {
    assert.equal(formatMemberMoney("1344444", "IRR"), "۱٬۳۴۴٬۴۴۴ تومان");
  });

  it("BUG-STG-080 hydrates legacy approved rows from the owned detail projection", async () => {
    const items = [
      {
        id: "free-legacy",
        tourId: "tour-free",
        tourTitle: "Free",
        status: "approved",
        paymentStatus: "unpaid",
        departureAt: "2026-09-28T08:00:00.000Z",
        submittedAt: "2026-09-01T08:00:00.000Z",
      },
      {
        id: "pending-row",
        tourId: "tour-free",
        tourTitle: "Free",
        status: "pending",
        paymentStatus: "unpaid",
        departureAt: "2026-09-28T08:00:00.000Z",
        submittedAt: "2026-09-01T08:00:00.000Z",
      },
    ] as const;
    const hydrated = await hydrateMemberRegistrationListFinancialProjection(items, async (id) =>
      id === "free-legacy" ? { ...items[0], paymentCollection: "free" as const } : null
    );
    assert.equal(hydrated[0]?.paymentCollection, "free");
    assert.equal(hydrated[1]?.paymentCollection, undefined);
  });

  it("BUG-STG-080 repairs a partial stale financial projection instead of trusting offline", async () => {
    const items = [
      {
        id: "free-partial-stale",
        tourId: "tour-free",
        tourTitle: "Free",
        status: "approved",
        paymentStatus: "unpaid",
        paymentCollection: "offline",
        departureAt: "2026-09-28T08:00:00.000Z",
        submittedAt: "2026-09-01T08:00:00.000Z",
      },
    ] as const;
    const hydrated = await hydrateMemberRegistrationListFinancialProjection(items, async (id) =>
      id === "free-partial-stale"
        ? {
            ...items[0],
            paymentCollection: "free" as const,
            financialDisplayState: "WAIVED" as const,
          }
        : null
    );

    assert.equal(hydrated[0]?.paymentCollection, "free");
    assert.equal(hydrated[0]?.financialDisplayState, "WAIVED");
  });

  it("BUG-STG-080 replaces a complete but stale approved projection", async () => {
    const items = [
      {
        id: "free-complete-stale",
        tourId: "tour-free",
        tourTitle: "Free",
        status: "approved",
        paymentStatus: "unpaid",
        paymentCollection: "offline",
        financialDisplayState: undefined,
        departureAt: "2026-09-28T08:00:00.000Z",
        submittedAt: "2026-09-01T08:00:00.000Z",
      },
    ] as const;
    const hydrated = await hydrateMemberRegistrationListFinancialProjection(items, async (id) =>
      id === "free-complete-stale"
        ? {
            ...items[0],
            paymentCollection: "free" as const,
            financialDisplayState: "WAIVED" as const,
          }
        : null
    );

    assert.equal(hydrated[0]?.paymentCollection, "free");
    assert.equal(hydrated[0]?.financialDisplayState, "WAIVED");
  });

  it("BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE replaces stale payment status and deadline", async () => {
    const items = [
      {
        id: "paid-stale",
        tourId: "tour-paid",
        tourTitle: "Paid",
        status: "approved",
        paymentStatus: "unpaid",
        paymentCollection: "offline" as const,
        paymentDueAt: "2026-09-28T08:00:00.000Z",
        departureAt: "2026-09-28T08:00:00.000Z",
        submittedAt: "2026-09-01T08:00:00.000Z",
      },
    ] as const;
    const hydrated = await hydrateMemberRegistrationListFinancialProjection(items, async () => ({
      ...items[0],
      paymentStatus: "paid",
      paymentDueAt: null,
      financialDisplayState: undefined,
    }));

    assert.equal(hydrated[0]?.paymentStatus, "paid");
    assert.equal(hydrated[0]?.paymentDueAt, null);
    assert.equal(hydrated[0]?.financialDisplayState, undefined);
  });

  it("BUG-STG-080 keeps List and Detail on the same waived projection", async () => {
    const staleList = {
      id: "free-contract",
      tourId: "tour-free",
      tourTitle: "Free",
      status: "approved",
      paymentStatus: "unpaid",
      paymentCollection: "offline" as const,
      paymentDueAt: "2026-09-28T08:00:00.000Z",
      departureAt: "2026-09-28T08:00:00.000Z",
      submittedAt: "2026-09-01T08:00:00.000Z",
    };
    const detail = {
      ...staleList,
      paymentCollection: "free" as const,
      financialDisplayState: "WAIVED" as const,
      paymentDueAt: "2026-09-28T08:00:00.000Z",
    };

    const [listProjection, detailProjection] = await Promise.all([
      hydrateMemberRegistrationListFinancialProjection([staleList], async () => detail),
      Promise.resolve(resolveMemberFinancialProjection(detail)),
    ]);

    assert.deepEqual(
      {
        paymentStatus: listProjection[0]?.paymentStatus,
        paymentCollection: listProjection[0]?.paymentCollection,
        financialDisplayState: listProjection[0]?.financialDisplayState,
        paymentDueAt: listProjection[0]?.paymentDueAt,
      },
      detailProjection
    );
    assert.equal(listProjection[0]?.paymentDueAt, null);
  });

  it("clears a stale paid deadline without changing receipt state", () => {
    assert.deepEqual(
      resolveMemberFinancialProjection({
        status: "approved",
        paymentStatus: "paid",
        paymentCollection: "offline",
        paymentDueAt: "2026-09-28T08:00:00.000Z",
      }),
      {
        paymentStatus: "paid",
        paymentCollection: "offline",
        paymentDueAt: null,
      }
    );
  });

  it("MEM-BFF-01 fetchMemberRegistrations uses same-origin registrations BFF", () => {
    const fetchModule = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-registrations.server.ts"),
      "utf8"
    );
    assert.match(fetchModule, /\/api\/me\/registrations/);
    assert.match(fetchModule, /cookieHeader\.length === 0/);
    assert.match(fetchModule, /return \[\]/);
    assert.match(fetchModule, /readonly tourId: string/);
    assert.match(fetchModule, /readonly guestLabel\?:/);
    assert.match(fetchModule, /readonly registrantTarget\?:/);
    assert.match(fetchModule, /readonly transportKind\?:/);
    assert.match(fetchModule, /readonly personalCarOccupants\?:/);
    assert.match(fetchModule, /financialDisplayState\?: "WAIVED"/);
    assert.match(
      readFileSync(
        join(repoRoot, "apps/portal/app/me/registrations/[id]/member-intake-amend-form.tsx"),
        "utf8"
      ),
      /option value=\{0\}/
    );
    assert.match(fetchModule, /resolvePortalSelfFetchOrigin/);
    assert.match(fetchModule, /x-forwarded-host/);
    assert.doesNotMatch(fetchModule, /registrationIntake/);
    assert.doesNotMatch(fetchModule, /bookings\?view=mine/);
    assert.doesNotMatch(fetchModule, /resolveTourOpsApiBaseUrl/);
  });

  it("MEM-BFF-02 GET route proxies bookings upstream with member headers", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/route.ts"),
      "utf8"
    );
    assert.match(route, /headers\.Authorization === undefined/);
    assert.match(route, /AUTH_UNAUTHENTICATED/);
    assert.match(route, /status: 401/);
    assert.match(route, /bookings\?view=mine&limit=50/);
    assert.match(route, /buildMemberApiHeaders/);
    assert.match(route, /resolvePortalIngressHost\(req\)/);
    assert.match(route, /UPSTREAM_BOOKINGS_ERROR/);
    assert.doesNotMatch(route, /ok: true, data: \{ items: \[\] \}/);
    assert.doesNotMatch(route, /fetchMemberRegistrations/);
  });

  it("MEM-BFF-02b member session headers include workspace id", () => {
    const tenantId = "00000000-0000-4000-8000-000000000014";
    const headers = mergeCatalogRegistrationHeaders(tenantId, {
      tenantId,
      userId: "00000000-0000-4000-8000-000000000103",
      workspaceId: "ws-operator-smoke-member",
      role: "member",
    });
    assert.equal(headers["x-workspace-id"], "ws-operator-smoke-member");
    assert.equal(headers["x-user-id"], "00000000-0000-4000-8000-000000000103");
  });

  it("MEM-BFF-03 /me/registrations page SSR marker", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/me/registrations/page.tsx"), "utf8");
    assert.match(page, /data-portal-member-registrations/);
    assert.match(page, /data-registrant-filter/);
    assert.match(page, /data-portal-member-registrations-filter/);
    assert.match(page, /data-portal-member-registration-row/);
    assert.match(page, /data-portal-member-registration-status-badge/);
    assert.match(page, /localizeMemberFinalizationStatus/);
    assert.match(page, /data-portal-member-registration-payment-progress/);
    assert.match(page, /financialProjection\.financialDisplayState/);
    assert.match(page, /resolveMemberFinancialProjection/);
    assert.match(page, /data-portal-member-registrations-empty-cta/);
    assert.match(page, /fetchMemberRegistrations/);
    assert.match(page, /RegistrantListFilter/);
    assert.match(page, /\?target=\$\{filter\}/);
  });

  it("MEM-BFF-03b SSR detail and receipt fetches preserve ingress host", () => {
    const detailFetch = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-registration-by-id.server.ts"),
      "utf8"
    );
    const receiptFetch = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-receipt-status.server.ts"),
      "utf8"
    );
    for (const source of [detailFetch, receiptFetch]) {
      assert.match(source, /resolvePortalSelfFetchOrigin/);
      assert.match(source, /x-forwarded-host/);
    }
  });

  it("MEM-NOTIF-06 approved registration notification carries a tour detail link and social CTA", () => {
    const panel = readFileSync(
      join(repoRoot, "apps/portal/src/me/notifications/member-ticket-notifications-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /me\/registrations\/\$\{encodeURIComponent\(item\.entityId\)\}/);
    assert.match(panel, /registration\.approved/);
    assert.match(panel, /data-portal-member-notification-social-link-anchor/);
  });

  it("BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS /me/registrations detail page markers", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/page.tsx"),
      "utf8"
    );
    const form = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx"),
      "utf8"
    );
    const statusCard = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/member-registration-status-card.tsx"),
      "utf8"
    );
    const detailStatus = readFileSync(
      join(repoRoot, "apps/portal/src/me/resolve-member-registration-detail-status.ts"),
      "utf8"
    );
    const faMessages = readFileSync(
      join(repoRoot, "apps/portal/messages/fa/portalMember.json"),
      "utf8"
    );
    assert.match(page, /data-portal-member-registration-detail/);
    assert.match(page, /MemberRegistrationStatusCard/);
    assert.match(page, /resolveMemberRegistrationDetailStatus/);
    assert.match(detailStatus, /statusPendingTitle/);
    assert.match(detailStatus, /statusPendingFreeBody/);
    assert.match(detailStatus, /statusReceiptPendingTitle/);
    assert.match(detailStatus, /statusReceiptRejectedTitle/);
    assert.match(page, /data-portal-member-registrant-target/);
    assert.match(page, /resolveMemberPortalTripsListPath/);
    assert.match(page, /fetchMemberReceiptPanel/);
    assert.match(page, /initialPanel=\{receiptPanel\}/);
    assert.doesNotMatch(page, /paymentStatus === ["']paid["']/);
    assert.match(page, /resolveMarketingTourDetailUrl/);
    assert.match(page, /data-portal-member-back/);
    assert.match(page, /\{t\("backToList"\)\}/);
    assert.doesNotMatch(page, /← \{t\("backToList"\)\}/);
    assert.match(form, /data-portal-member-receipt-upload/);
    assert.match(form, /data-portal-member-receipt-submit/);
    assert.match(form, /data-portal-member-receipt-awaiting-approval/);
    assert.match(form, /awaitingFreeApprovalBody/);
    assert.match(form, /router\.refresh\(\)/);
    assert.match(form, /dispatchMemberReceiptStatusChanged\("pending"\)/);
    assert.match(statusCard, /data-portal-member-detail-status-card/);
    assert.match(statusCard, /statusReceiptPendingTitle/);
    assert.match(statusCard, /statusReceiptApprovedTitle/);
    assert.match(statusCard, /paymentStatus.trim\(\).toLowerCase\(\) === "paid"/);
    assert.match(statusCard, /MEMBER_RECEIPT_STATUS_CHANGED_EVENT/);
    assert.match(form, /data-portal-member-receipt-closed/);
    assert.match(form, /data-portal-member-receipt-waiting/);
    assert.match(form, /data-portal-member-receipt-paid/);
    assert.match(form, /data-portal-member-receipt-approved-awaiting-payment/);
    assert.match(form, /paymentStatus.trim\(\).toLowerCase\(\) === "paid"/);
    assert.match(form, /Payment finality wins over a stale receipt projection/);
    assert.match(statusCard, /paymentStatus.trim\(\).toLowerCase\(\) === "paid"/);
    assert.match(form, /data-portal-member-receipt-waived/);
    assert.match(form, /data-portal-member-receipt-preview/);
    assert.match(form, /paymentDestinationLabel/);
    assert.match(form, /paymentDestinationUnavailable/);
    assert.match(form, /setSelectedFile\(file\);[\s\S]*setUploadPhase\("idle"\)/);
    assert.match(form, /event\.currentTarget\.value = "";/);
    assert.match(form, /idempotencyKeyRef\.current = null;[\s\S]*setSelectedFile\(file\)/);
    assert.match(
      form,
      /onChange=\{\(event\) => \{[\s\S]*idempotencyKeyRef\.current = null;[\s\S]*setReceiptNote\(event\.target\.value\)/
    );
    const uploadAt = form.indexOf("<div data-portal-member-receipt-upload>");
    const uploadDestinationAt = form.indexOf("{paymentDestinationBlock}", uploadAt);
    assert.ok(uploadAt > 0 && uploadDestinationAt > uploadAt);
    assert.match(form, /selectedFile === undefined/);
    assert.match(form, /data-portal-member-receipt-file-picker/);
    assert.match(form, /data-portal-member-receipt-note/);
    assert.match(form, /Content-Type.*application\/json/);
    assert.doesNotMatch(form, /\brequired\b/);
    assert.match(form, /t\("noFileSelected"\)/);
    assert.match(form, /t\("chooseFile"\)/);
    assert.match(form, /data-closed-reason/);
    assert.match(form, /createObjectURL/);
    const closedAt = form.indexOf('registrationStatus === "rejected"');
    const awaitingAt = form.indexOf('registrationStatus === "pending"');
    const freeAt = form.indexOf('paymentCollection === "free"');
    const paidAt = form.indexOf('receiptStatus === "paid"');
    assert.ok(closedAt > 0 && awaitingAt > 0 && freeAt > 0 && paidAt > 0);
    assert.ok(
      closedAt < paidAt && awaitingAt < paidAt,
      "lifecycle closed/awaiting cards must win over paid/waived"
    );
    assert.ok(
      freeAt < paidAt && freeAt < uploadAt,
      "free registrations must never reach paid or receipt-upload branches"
    );
    assert.match(form, /data-portal-member-receipt-view-tour/);
    assert.match(form, /data-portal-member-receipt-back-trips/);
    assert.match(form, /registrationStatus/);
    const lifecycle = readFileSync(
      join(repoRoot, "apps/portal/src/me/registration-lifecycle-status.ts"),
      "utf8"
    );
    assert.match(lifecycle, /parseRegistrationLifecycleStatus/);
    assert.doesNotMatch(lifecycle, /\|\s*string/);
    assert.match(page, /parseRegistrationLifecycleStatus/);
    assert.match(statusCard, /registrationStatusBadge/);
    assert.match(statusCard, /data-portal-member-detail-receipt-status-badge/);
    assert.match(statusCard, /showReceiptBadge/);
    assert.match(faMessages, /"registrationStatusBadge": "ثبت‌نام: \{status\}"/);
    assert.match(faMessages, /"receiptStatusRejected": "رسید: رد شده؛ اصلاح لازم است"/);
    assert.doesNotMatch(form, /parseRegistrationLifecycleStatus/);
    assert.match(form, /disabled=\{uploadPhase === "uploading"\}/);
    assert.match(page, /MemberIntakeAmendForm/);
    assert.match(page, /memberPendingIntakeAmend/);
    assert.match(page, /fetchMemberRegistrationById/);
    assert.match(page, /data-portal-member-registration-transport/);
    assert.match(page, /initialKind/);
    assert.match(page, /initialOccupants/);
    assert.doesNotMatch(page, /registrationIntake/);
    assert.doesNotMatch(page, /fetchMemberRegistrations/);
    const detailBff = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/route.ts"),
      "utf8"
    );
    assert.match(detailBff, /registrationApiPath/);
    assert.doesNotMatch(detailBff, /pluginId !== "denali"/);
    const receiptBff = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/receipt/route.ts"),
      "utf8"
    );
    assert.match(receiptBff, /resolvePortalIngressHost\(req\)/);
    const amend = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/member-intake-amend-form.tsx"),
      "utf8"
    );
    assert.match(amend, /data-portal-member-intake-amend/);
    assert.match(amend, /initialKind/);
    assert.match(amend, /initialOccupants/);
    assert.match(amend, /resolveAmendKind/);
    assert.doesNotMatch(
      amend,
      /useState<TransportKind>\(sharedCarsMode \? "personal_car" : "primary"\)/
    );
    const forTour = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/for-tour/route.ts"),
      "utf8"
    );
    assert.match(forTour, /selfRegistrationGate/);
    assert.doesNotMatch(forTour, /pluginId !== "denali"/);
    const intakePatch = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/intake/route.ts"),
      "utf8"
    );
    assert.match(intakePatch, /memberPendingIntakeAmend/);
    assert.doesNotMatch(intakePatch, /pluginId !== "denali"/);
  });

  it("MEM-SKIN-01 denali-portal.css covers member registrations surfaces", () => {
    const skin = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/denali-portal.css"),
      "utf8"
    );
    const memberPages = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/portal/member-pages.css"),
      "utf8"
    );
    assert.match(skin, /main\[data-portal-member-registrations\]/);
    assert.match(skin, /\[data-portal-member-registration-status-badge\]/);
    assert.match(skin, /\[data-portal-member-registrations-empty-cta\]/);
    assert.match(skin, /main\[data-portal-member-home\]/);
    assert.match(skin, /\[data-portal-member-home-quick-links\]/);
    assert.match(skin, /main\[data-portal-member-module-stub\]/);
    assert.match(skin, /main\[data-portal-member-registration-detail\]/);
    assert.match(skin, /\[data-portal-member-receipt-upload\]/);
    assert.match(skin, /\[data-portal-member-receipt-awaiting-approval\]/);
    assert.match(skin, /\[data-portal-member-receipt-closed\]/);
    assert.match(skin, /\[data-portal-member-receipt-waiting\]/);
    assert.match(skin, /\[data-portal-member-receipt-paid\]/);
    assert.match(skin, /\[data-portal-member-receipt-waived\]/);
    assert.match(memberPages, /\[data-portal-member-receipt-preview\]/);
    assert.match(memberPages, /\[data-portal-member-receipt-due\]/);
    assert.match(skin, /\[data-portal-member-intake-amend\]/);
    assert.match(skin, /\[data-public-auth-logout\]/);
    assert.match(memberPages, /\[data-portal-member-registrant-other-badge\]/);
    assert.match(memberPages, /\[data-portal-member-registrant-self-badge\]/);
    assert.match(memberPages, /\[data-portal-member-receipt-upload-actions\][\s\S]*margin-bottom/);
    assert.match(memberPages, /\[data-portal-member-registration-guest\]/);
    assert.match(memberPages, /\[data-portal-member-registrations-filter\]/);
    assert.match(skin, /\[data-portal-member-registrations-filter-tab\]/);
  });

  it("MEM-UX-OTHER-01 list and detail surface registrantTarget=other", () => {
    const listPage = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/page.tsx"),
      "utf8"
    );
    const detailPage = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/page.tsx"),
      "utf8"
    );
    assert.match(listPage, /data-portal-member-registrant-target/);
    assert.match(listPage, /forOtherBadge/);
    assert.match(listPage, /forSelfBadge/);
    assert.match(listPage, /guestLine/);
    assert.match(listPage, /filterOther/);
    assert.match(detailPage, /data-portal-member-registrant-target/);
    assert.match(detailPage, /forOtherBadge/);
    assert.match(detailPage, /guestLine/);
  });

  it("MEM-AUTH-02 member shell wires logout BFF", () => {
    const userMenu = readFileSync(
      join(repoRoot, "apps/portal/src/shell/portal-member-user-menu.tsx"),
      "utf8"
    );
    const logoutButton = readFileSync(
      join(repoRoot, "apps/portal/src/me/member-logout-button.tsx"),
      "utf8"
    );
    const logoutRoute = readFileSync(
      join(repoRoot, "apps/portal/app/api/public-auth/logout/route.ts"),
      "utf8"
    );
    assert.match(userMenu, /MemberLogoutButton/);
    assert.match(logoutButton, /data-public-auth-logout/);
    assert.match(logoutButton, /data-public-auth-logout-ready/);
    assert.match(logoutButton, /\/api\/public-auth\/logout/);
    assert.match(logoutRoute, /clearSessionCookieOnResponse/);
  });

  it("MEM-I18N-01 portalMember messages loaded for fa and en", () => {
    const loadMessages = readFileSync(
      join(repoRoot, "apps/portal/src/i18n/load-messages.ts"),
      "utf8"
    );
    assert.match(loadMessages, /portalMember\.json/);
    const fa = readFileSync(join(repoRoot, "apps/portal/messages/fa/portalMember.json"), "utf8");
    const en = readFileSync(join(repoRoot, "apps/portal/messages/en/portalMember.json"), "utf8");
    const faReceipt = JSON.parse(fa).receipt as Record<string, string>;
    const enReceipt = JSON.parse(en).receipt as Record<string, string>;
    assert.match(fa, /"trips"/);
    assert.match(en, /"trips"/);
    assert.match(fa, /"waitingTitle"/);
    assert.match(en, /"waitingTitle"/);
    for (const key of ["dueRemaining", "dueTotal", "dueNow", "dueBalanceAfterPayment"] as const) {
      assert.equal(typeof faReceipt[key], "string", `missing fa receipt.${key}`);
      assert.equal(typeof enReceipt[key], "string", `missing en receipt.${key}`);
      assert.match(
        faReceipt[key],
        /\{amount\}/,
        `fa receipt.${key} must expose amount placeholder`
      );
      assert.match(
        enReceipt[key],
        /\{amount\}/,
        `en receipt.${key} must expose amount placeholder`
      );
    }
    assert.match(fa, /"previewLabel"/);
    assert.match(en, /"previewLabel"/);
    assert.match(fa, /"waivedTitle"/);
    assert.match(en, /"waivedTitle"/);
    assert.match(fa, /"cancelledTitle"/);
    assert.match(en, /"cancelledTitle"/);
    assert.match(fa, /"paymentProgress"/);
    assert.match(en, /"paymentProgress"/);
    assert.match(fa, /"viewTour"/);
    assert.match(en, /"viewTour"/);
    assert.match(fa, /"forOtherBadge"/);
    assert.match(en, /"forOtherBadge"/);
    assert.match(fa, /"forSelfBadge"/);
    assert.match(en, /"forSelfBadge"/);
    assert.match(fa, /"filterOther"/);
    assert.match(en, /"filterOther"/);
    assert.match(fa, /"guestLine"/);
    assert.match(en, /"guestLine"/);
    assert.match(fa, /"transportLabel"/);
    assert.match(en, /"transportLabel"/);
    assert.match(fa, /"engagement":\s*"مشارکت و امتیازها"/);
    assert.match(en, /"engagement":\s*"Engagement & points"/);
    assert.doesNotMatch(fa, /portalMember\.nav\.engagement/);
    assert.doesNotMatch(en, /portalMember\.nav\.engagement/);
    assert.match(fa, /"withdrawHint"/);
    assert.match(fa, /"withdrawAction"/);
    assert.doesNotMatch(fa, /portalMember\.cancellation\.(withdrawHint|withdrawAction)/);
    assert.match(en, /"withdrawHint"/);
    assert.match(en, /"withdrawAction"/);
    assert.match(fa, /PROFILE_NATIONAL_ID_CHECKSUM/);
    assert.match(en, /PROFILE_NATIONAL_ID_CHECKSUM/);
  });

  it("MEM-PROF-01 profile page uses canonical profile BFF", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/me/profile/page.tsx"), "utf8");
    const form = readFileSync(
      join(repoRoot, "apps/portal/app/me/profile/member-profile-form.tsx"),
      "utf8"
    );
    assert.match(page, /fetchMemberProfile/);
    assert.match(page, /<main[^>]*data-portal-member-profile/);
    assert.match(form, /data-portal-member-profile/);
    assert.match(form, /data-member-profile-ready/);
    assert.match(form, /MemberProfileGenderField/);
    assert.match(form, /data-member-profile-save/);
    assert.match(form, /type="button"/);
    assert.match(form, /\/api\/me\/profile/);
    assert.doesNotMatch(form, /session-profile/);
  });
});

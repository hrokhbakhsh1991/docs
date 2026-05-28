"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cn, Button, FormField, Input, LoadingState, useToast } from "@tour/ui";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { usePathname, useRouter } from "@/i18n/navigation";

import styles from "./settings-profile-form.module.css";
import { isPendingEmailVerification, mapMeToEmailForm } from "./settings-me-shared";
import { pickMeErrorMessage } from "@/lib/me-api-error";

import { patchMe } from "@/lib/me-client";

import type { RefreshWorkspaceMeOptions, WorkspaceMeData } from "./workspace-me-provider";

export type EmailSettingsPanelProps = {
  me: WorkspaceMeData;
  refresh: (_opts?: RefreshWorkspaceMeOptions) => Promise<void>;
};

type EmailFormValues = {
  email: string;
};

function emailPendingStorageKey(userId: string | undefined): string | null {
  if (!userId || userId.trim() === "") {
    return null;
  }
  return `tour_settings_email_pending_${userId}`;
}

/** Parses `#verify_email_token=…` (preferred; avoids server-side query logging). */
function parseVerifyEmailTokenFromLocationHash(hash: string): string {
  const withoutHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const trimmed = withoutHash.trim();
  if (trimmed === "") {
    return "";
  }
  try {
    const params = new URLSearchParams(trimmed.startsWith("?") ? trimmed.slice(1) : trimmed);
    const t =
      params.get("verify_email_token")?.trim() ??
      trimmed.match(/(?:^|[?&])verify_email_token=([^&]+)/)?.[1]?.trim() ??
      "";
    const decoded = t === "" ? "" : decodeURIComponent(t).trim();
    return decoded.length === 64 ? decoded : "";
  } catch {
    return "";
  }
}

function EmailSettingsPanelInner({ me, refresh }: EmailSettingsPanelProps) {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [hashToken, setHashToken] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [manualTokenOpen, setManualTokenOpen] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailVerifyToken, setEmailVerifyToken] = useState("");
  const [tokenError, setTokenError] = useState<string | undefined>(undefined);
  const [verifySuccessInline, setVerifySuccessInline] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const profileRowVersionRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof me.profile_row_version === "number") {
      profileRowVersionRef.current = me.profile_row_version;
    }
  }, [me.profile_row_version]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const sync = (): void => {
      setHashToken(parseVerifyEmailTokenFromLocationHash(window.location.hash ?? ""));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const urlToken = useMemo(() => {
    if (hashToken !== "") {
      return hashToken;
    }
    const fromQuery =
      searchParams.get("verify_email_token")?.trim() ?? searchParams.get("token")?.trim() ?? "";
    return fromQuery.length === 64 ? fromQuery : "";
  }, [hashToken, searchParams]);

  const tokenSectionOpen = Boolean(urlToken) || manualTokenOpen;

  const storageKey = emailPendingStorageKey(me.id);

  const clearPending = useCallback(() => {
    if (typeof window !== "undefined" && storageKey) {
      sessionStorage.removeItem(storageKey);
    }
    setEmailChangePending(false);
    setPendingEmail(null);
  }, [storageKey]);

  const persistPending = useCallback(
    (email: string) => {
      if (typeof window !== "undefined" && storageKey) {
        sessionStorage.setItem(storageKey, email);
      }
      setEmailChangePending(true);
      setPendingEmail(email);
    },
    [storageKey],
  );

  const openTokenEntry = useCallback(() => {
    setManualTokenOpen(true);
    setTokenError(undefined);
    setVerifySuccessInline("");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) {
      return;
    }
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      setEmailChangePending(true);
      setPendingEmail(stored === "1" ? null : stored);
    }
  }, [storageKey]);

  useEffect(() => {
    if (urlToken) {
      setEmailVerifyToken(urlToken);
      setTokenError(undefined);
    }
  }, [urlToken]);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, { message: t("validationEmailRequired") })
          .email({ message: t("validationEmailInvalid") })
          .max(320, { message: t("validationEmailMax") }),
      }) satisfies z.ZodType<EmailFormValues>,
    [t],
  );

  const emailTokenSchema = useMemo(
    () =>
      z
        .string()
        .trim()
        .length(64, t("validationEmailTokenLength")),
    [t],
  );

  const resolver = useMemo(() => zodResolver(schema) as Resolver<EmailFormValues>, [schema]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmailFormValues>({
    resolver,
    defaultValues: mapMeToEmailForm(me),
  });

  useEffect(() => {
    reset(mapMeToEmailForm(me));
  }, [me, reset]);

  const emailDisplay = typeof me.email === "string" && me.email.trim() !== "" ? me.email.trim() : "";

  const badgeKind = useMemo(() => {
    if (emailChangePending) {
      return "pending" as const;
    }
    if (emailDisplay === "") {
      return "none" as const;
    }
    if (me.is_email_verified === true) {
      return "verified" as const;
    }
    return "unverified" as const;
  }, [emailChangePending, emailDisplay, me.is_email_verified]);

  const badgeClass =
    badgeKind === "verified"
      ? styles.badgeVerified
      : badgeKind === "pending"
        ? styles.badgePending
        : badgeKind === "unverified"
          ? styles.badgeUnverified
          : styles.badgeNeutral;

  const badgeLabel =
    badgeKind === "verified"
      ? t("emailStatusVerified")
      : badgeKind === "pending"
        ? pendingEmail
          ? t("emailStatusPendingWithAddr", { email: pendingEmail })
          : t("emailStatusPending")
        : badgeKind === "unverified"
          ? t("emailStatusUnverified")
          : t("emailStatusNoEmail");

  async function onValid(formData: EmailFormValues) {
    try {
      const versionForMatch = profileRowVersionRef.current ?? me.profile_row_version;
      const ifMatch =
        typeof versionForMatch === "number" ? `W/"${String(versionForMatch)}"` : undefined;

      const res = await patchMe(
        { email: formData.email.trim() },
        ifMatch !== undefined ? { ifMatch } : undefined,
      );
      const body = (await res.json().catch(() => ({}))) as WorkspaceMeData | { status?: string };
      if (!res.ok) {
        showToast({
          type: "error",
          message: pickMeErrorMessage(body, t("saveFailedToast"), t),
        });
        return;
      }
      if (isPendingEmailVerification(body)) {
        if (typeof body.profile_row_version === "number") {
          profileRowVersionRef.current = body.profile_row_version;
        }
        persistPending(formData.email.trim());
        setEditingEmail(false);
        showToast({ type: "success", message: t("toastEmailVerificationSent") });
        await refresh();
        return;
      }
      clearPending();
      const wb = body as WorkspaceMeData;
      if (typeof wb.profile_row_version === "number") {
        profileRowVersionRef.current = wb.profile_row_version;
      }
      reset(mapMeToEmailForm(wb));
      setEditingEmail(false);
      showToast({ type: "success", message: t("toastSaved") });
      await refresh({ silent: true });
    } catch {
      showToast({ type: "error", message: t("saveFailedToast") });
    }
  }

  async function submitEmailVerification(): Promise<void> {
    setVerifySuccessInline("");
    const parsed = emailTokenSchema.safeParse(emailVerifyToken);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? t("validationEmailTokenLength");
      setTokenError(msg);
      showToast({ type: "error", message: msg });
      return;
    }
    setTokenError(undefined);
    setVerifySubmitting(true);
    try {
      const res = await fetch("/api/me/verify-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: parsed.data }),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: string; email?: string };
      if (!res.ok || body.status !== "email_verified") {
        const msg = pickMeErrorMessage(body, t("emailVerifyFailedToast"), t);
        setTokenError(msg);
        showToast({ type: "error", message: msg });
        return;
      }
      clearPending();
      setEmailVerifyToken("");
      setManualTokenOpen(false);
      setVerifySuccessInline(t("emailVerifySuccessInline"));
      showToast({ type: "success", message: t("emailVerifySuccessToast") });
      await refresh({ silent: true });
      if (typeof window !== "undefined") {
        const { pathname: p, search } = window.location;
        window.history.replaceState(null, "", `${p}${search}`);
        setHashToken("");
      }
      router.replace(pathname);
    } catch {
      const msg = t("emailVerifyFailedToast");
      setTokenError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setVerifySubmitting(false);
    }
  }

  const showIdleActions = !editingEmail && !tokenSectionOpen;

  return (
    <>
      <div className={styles.emailSummary}>
        <div className={styles.settingsRow}>
          <p className={styles.currentEmail} dir="ltr">
            {emailDisplay === "" ? t("emailSummaryNoEmail") : emailDisplay}
          </p>
          <span className={cn(styles.badge, badgeClass)}>{badgeLabel}</span>
        </div>

        {showIdleActions ? (
          <div className={styles.actions}>
            {badgeKind === "pending" ? (
              <>
                <Button type="button" variant="primary" onClick={() => openTokenEntry()}>
                  {t("emailContinueVerification")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setVerifySuccessInline("");
                    setManualTokenOpen(false);
                    if (pendingEmail) {
                      reset({ email: pendingEmail });
                    }
                    setEditingEmail(true);
                  }}
                >
                  {t("emailResendOrChange")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setVerifySuccessInline("");
                    if (!urlToken) {
                      setManualTokenOpen(false);
                    }
                    setEditingEmail(true);
                  }}
                >
                  {t("emailChangeButton")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => openTokenEntry()}>
                  {t("emailEnterCodeManually")}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {editingEmail ? (
        <form className={styles.form} onSubmit={handleSubmit(onValid)} noValidate>
          <FormField label={t("fieldEmail")} required error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              dir="ltr"
              aria-invalid={errors.email ? true : undefined}
              {...register("email")}
            />
          </FormField>

          <div className={styles.actions}>
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
              {t("emailSaveAddress")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                reset(mapMeToEmailForm(me));
                setEditingEmail(false);
              }}
            >
              {t("emailEditingCancel")}
            </Button>
          </div>
        </form>
      ) : null}

      {tokenSectionOpen ? (
        <div className={styles.emailVerifyInCard}>
          <h3 className={styles.sectionTitle}>{t("emailVerifySectionTitle")}</h3>
          <p className={styles.devHint}>{t("emailVerifySectionLeadShort")}</p>
          <FormField label={t("emailVerifyTokenLabel")} error={tokenError}>
            <Input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={emailVerifyToken}
              onChange={(e) => {
                setEmailVerifyToken(e.target.value.trim());
                if (tokenError) {
                  setTokenError(undefined);
                }
              }}
              placeholder={t("emailVerifyTokenPlaceholder")}
              dir="ltr"
              aria-invalid={tokenError ? true : undefined}
            />
          </FormField>
          <div className={styles.actions}>
            <Button type="button" variant="primary" loading={verifySubmitting} onClick={() => void submitEmailVerification()}>
              {t("emailVerifySubmit")}
            </Button>
            {!urlToken ? (
              <Button
                type="button"
                variant="ghost"
                disabled={verifySubmitting}
                onClick={() => {
                  setManualTokenOpen(false);
                  setEmailVerifyToken("");
                  setTokenError(undefined);
                  setVerifySuccessInline("");
                }}
              >
                {t("emailTokenSectionClose")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {verifySuccessInline !== "" ? (
        <p className={styles.inlineSuccess} aria-live="polite">
          {verifySuccessInline}
        </p>
      ) : null}
    </>
  );
}

export function EmailSettingsPanel(props: EmailSettingsPanelProps) {
  const t = useTranslations("settings");
  return (
    <Suspense fallback={<LoadingState message={t("loadingProfile")} />}>
      <EmailSettingsPanelInner {...props} />
    </Suspense>
  );
}

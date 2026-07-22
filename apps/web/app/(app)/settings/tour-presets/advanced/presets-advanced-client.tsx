"use client";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import {
  appendPresetsAdvancedMatchRule,
  buildPresetsAdvancedPutBody,
  parsePresetsAdvancedResponse,
  removePresetsAdvancedMatchRule,
} from "@/features/settings/presets-advanced-logic";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import {
  PRESETS_ADVANCED_TEST_IDS,
  type PresetsAdvancedConfigResponse,
  type PresetsAdvancedPayload,
} from "@/features/settings/presets-advanced-types";

type PresetsAdvancedClientProps = {
  readonly session: OperatorSessionContext;
};

const EMPTY_PAYLOAD: PresetsAdvancedPayload = {
  autoMatchEnabled: false,
  defaultPresetId: null,
  matchRules: [],
};

export function PresetsAdvancedClient({ session }: PresetsAdvancedClientProps) {
  const t = useTranslations("settings.presetsAdvanced");
  const tErrors = useTranslations("settings.errors");
  const tCommon = useTranslations("common");
  const canManage = isAdminOrOwnerRole(session.role);
  const [payload, setPayload] = useState<PresetsAdvancedPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newRuleId, setNewRuleId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/tour-presets/advanced", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`PRESETS_ADVANCED_HTTP_${response.status}`);
        }
        return (await response.json()) as PresetsAdvancedConfigResponse;
      })
      .then((config) => {
        if (!cancelled) {
          setPayload(parsePresetsAdvancedResponse(config));
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "PRESETS_ADVANCED_FETCH_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/settings/tour-presets/advanced", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPresetsAdvancedPutBody(payload)),
      });
      if (!response.ok) {
        throw new Error(`PRESETS_ADVANCED_SAVE_HTTP_${response.status}`);
      }
      const savedConfig = (await response.json()) as PresetsAdvancedConfigResponse;
      setPayload(parsePresetsAdvancedResponse(savedConfig));
      setSaved(true);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "PRESETS_ADVANCED_SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={PRESETS_ADVANCED_TEST_IDS.page}>
      <SettingsPageHeader
        title={t("title")}
        description={t("subtitle")}
        backHref="/settings/tour-presets"
        backLabel={t("backToPresets")}
      />

      {loading ? <Skeleton className="h-40 w-full" /> : null}
      {error !== null ? (
        <p className="text-sm text-destructive">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}
      {saved ? (
        <p className="text-sm text-green-600" data-testid={PRESETS_ADVANCED_TEST_IDS.success}>
          {t("saved")}
        </p>
      ) : null}

      {!loading ? (
        <Card data-operator-surface="card" className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("matchingRules.title")}</CardTitle>
            <CardDescription>{t("matchingRules.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              data-testid={PRESETS_ADVANCED_TEST_IDS.form}
              onSubmit={(event) => void handleSave(event)}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id="presets-auto-match"
                  data-testid={PRESETS_ADVANCED_TEST_IDS.autoMatchToggle}
                  checked={payload.autoMatchEnabled}
                  onChange={(event) =>
                    setPayload((current) => ({ ...current, autoMatchEnabled: event.target.checked }))
                  }
                  disabled={!canManage}
                />
                <Label htmlFor="presets-auto-match">{t("autoMatch")}</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="presets-default-id">{t("defaultPresetId")}</Label>
                <Input
                  id="presets-default-id"
                  data-testid={PRESETS_ADVANCED_TEST_IDS.defaultPresetInput}
                  value={payload.defaultPresetId ?? ""}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      defaultPresetId: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  placeholder={t("defaultPresetPlaceholder")}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("rulesTitle", { count: payload.matchRules.length })}
                </p>
                {canManage ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[12rem] flex-1 space-y-1">
                      <Label htmlFor="presets-rule-id">{t("ruleId")}</Label>
                      <Input
                        id="presets-rule-id"
                        data-testid={PRESETS_ADVANCED_TEST_IDS.ruleIdInput}
                        value={newRuleId}
                        onChange={(event) => setNewRuleId(event.target.value)}
                        placeholder={t("ruleIdPlaceholder")}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      data-testid={PRESETS_ADVANCED_TEST_IDS.ruleAddButton}
                      onClick={() => {
                        setPayload((current) => appendPresetsAdvancedMatchRule(current, newRuleId));
                        setNewRuleId("");
                      }}
                    >
                      {t("addRule")}
                    </Button>
                  </div>
                ) : null}
                <ul
                  className="space-y-1 text-sm text-muted-foreground"
                  data-testid={PRESETS_ADVANCED_TEST_IDS.ruleList}
                >
                  {payload.matchRules.length === 0 ? (
                    <li>{t("noRules")}</li>
                  ) : (
                    payload.matchRules.map((rule) => (
                      <li key={rule.id} className="flex items-center justify-between gap-2">
                        <span>
                          {rule.id}
                          {rule.enabled ? "" : ` ${t("disabled")}`}
                        </span>
                        {canManage ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setPayload((current) => removePresetsAdvancedMatchRule(current, rule.id))
                            }
                          >
                            {tCommon("remove")}
                          </Button>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              {canManage ? (
                <Button
                  type="submit"
                  disabled={saving}
                  data-testid={PRESETS_ADVANCED_TEST_IDS.saveButton}
                >
                  <Save className="me-1 size-4" />
                  {t("saveButton")}
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
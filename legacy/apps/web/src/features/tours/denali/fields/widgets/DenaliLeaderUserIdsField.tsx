"use client";

import { useTranslations } from "next-intl";

import { DestinationCombobox } from "@/components/tours/wizard/steps/DestinationCombobox";
import { useWorkspaceTourCrewMembers } from "@/hooks/use-workspace-tour-crew-members";
import {
  useDenaliCanonical,
  useDenaliCanonicalValue,
} from "@/features/tours/wizard/denali/application";

import type { DenaliZodKindFieldProps } from "../denaliZodKindFieldProps";

export function DenaliLeaderUserIdsField(_props: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  const { updateCanonical } = useDenaliCanonical();
  const leaderUserIds = useDenaliCanonicalValue<string[]>("leaderUserIds");
  const crewMembersQuery = useWorkspaceTourCrewMembers();
  const crewRoleLabel = (role: string) => {
    if (role === "owner") return t("basic.crewRoles.owner");
    if (role === "admin") return t("basic.crewRoles.admin");
    if (role === "leader") return t("basic.crewRoles.leader");
    return role;
  };
  const leaderOptions = (crewMembersQuery.data ?? []).map((member) => ({
    id: member.id,
    name: String(member.name?.trim() || member.email || member.phone || member.id),
    regionId: member.role,
    regionName: crewRoleLabel(member.role),
  }));

  return (
    <DestinationCombobox
      label={t("basic.workspaceLeaders")}
      placeholder={t("basic.workspaceLeadersPlaceholder")}
      options={leaderOptions}
      multiple
      value={leaderUserIds ?? []}
      onChange={(ids) => {
        updateCanonical({
          leaderUserIds: Array.isArray(ids) ? ids : ids ? [ids] : [],
        });
      }}
    />
  );
}

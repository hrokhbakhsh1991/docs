"use client";

import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ExposureCollapsibleSection } from "@/exposure/exposure-collapsible-section";
import { ExposureFieldChecklist } from "@/exposure/ExposureFieldChecklist";
import type {
  SettingsExposureBadgeProps,
  SettingsExposureButtonProps,
  SettingsExposureCardProps,
  SettingsExposureCardSectionProps,
  SettingsExposureCollapsibleSectionProps,
  SettingsExposureFieldChecklistProps,
  SettingsExposureLabelProps,
  SettingsExposureSkeletonProps,
  SettingsExposureSurfacesChrome,
} from "@/features/settings/settings-exposure-surfaces-ui-types";

/**
 * Web chrome adapter for SettingsExposureSurfacesChrome (H1.c.2.a + layout).
 * Shell owns generic exposure UI + app layout primitives until H1.c.2.b package move.
 */
export const webSettingsExposureSurfacesChrome: SettingsExposureSurfacesChrome = Object.freeze({
  CollapsibleSection: ExposureCollapsibleSection as ComponentType<SettingsExposureCollapsibleSectionProps>,
  FieldChecklist: ExposureFieldChecklist as ComponentType<SettingsExposureFieldChecklistProps>,
  Badge: Badge as ComponentType<SettingsExposureBadgeProps>,
  Button: Button as ComponentType<SettingsExposureButtonProps>,
  Card: Card as ComponentType<SettingsExposureCardProps>,
  CardHeader: CardHeader as ComponentType<SettingsExposureCardSectionProps>,
  CardTitle: CardTitle as ComponentType<SettingsExposureCardSectionProps>,
  CardDescription: CardDescription as ComponentType<SettingsExposureCardSectionProps>,
  CardContent: CardContent as ComponentType<SettingsExposureCardSectionProps>,
  Label: Label as ComponentType<SettingsExposureLabelProps>,
  Skeleton: Skeleton as ComponentType<SettingsExposureSkeletonProps>,
});

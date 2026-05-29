"use client";

import { useMemo, type ReactNode } from "react";

import { cn } from "@tour/ui";

import { buildTenantThemeStyle } from "./build-tenant-theme-style";
import { useTenantConfig } from "./tenant-config-provider";

import styles from "./ThemeInjector.module.css";

export type ThemeInjectorProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Injects workspace-scoped CSS custom properties from {@link useTenantConfig}.
 * Wrap the authenticated app shell so `@tour/ui` components inherit tenant tokens.
 */
export function ThemeInjector({ children, className }: ThemeInjectorProps) {
  const { config } = useTenantConfig();

  const style = useMemo(() => buildTenantThemeStyle(config.theme), [config.theme]);

  const animationsEnabled = config.layout.enableAnimations !== false;

  return (
    <div
      className={cn(styles.root, !animationsEnabled && styles.noAnimations, className)}
      style={style}
      data-tenant-id={config.tenantId || undefined}
      data-tenant-animations={animationsEnabled ? "on" : "off"}
    >
      {children}
    </div>
  );
}

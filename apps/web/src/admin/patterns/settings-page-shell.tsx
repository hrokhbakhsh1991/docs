import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SettingsPageShellProps = {
  readonly testId: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly maxWidth?: "xl" | "3xl" | "5xl" | "full";
  readonly "data-can-manage"?: "true" | "false";
  readonly rootDataAttributes?: Readonly<Record<string, string>>;
};

const MAX_WIDTH_CLASS: Record<NonNullable<SettingsPageShellProps["maxWidth"]>, string> = {
  xl: "max-w-xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  full: "max-w-full",
};

export function SettingsPageShell({
  testId,
  children,
  className,
  contentClassName,
  maxWidth = "full",
  "data-can-manage": dataCanManage,
  rootDataAttributes,
}: SettingsPageShellProps) {
  return (
    <div
      className={cn("min-w-0 w-full max-w-full space-y-6", className)}
      data-operator-settings-page
      data-testid={testId}
      {...(dataCanManage !== undefined ? { "data-can-manage": dataCanManage } : {})}
      {...rootDataAttributes}
    >
      <div
        className={cn(
          "mx-auto w-full min-w-0 space-y-6",
          MAX_WIDTH_CLASS[maxWidth],
          contentClassName
        )}
        data-operator-settings-content
      >
        {children}
      </div>
    </div>
  );
}

export const SETTINGS_HIDDEN_FILE_INPUT_CLASS =
  "sr-only !size-px !min-w-0 !max-w-px border-0 p-0 shadow-none";

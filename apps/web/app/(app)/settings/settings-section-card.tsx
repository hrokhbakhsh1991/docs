"use client";

import type { ReactNode } from "react";

import { Card, CardBody, CardFooter, CardHeader, CardSubtitle, CardTitle, cn } from "@tour/ui";

import styles from "./settings-section-card.module.css";

export type SettingsSectionCardProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * One settings “chapter”: consistent header/body/footer spacing on top of `@tour/ui` Card primitives.
 */
export function SettingsSectionCard({ title, description, children, footer, className }: SettingsSectionCardProps) {
  return (
    <Card className={cn(styles.sectionCard, className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description != null && description !== "" ? <CardSubtitle>{description}</CardSubtitle> : null}
      </CardHeader>
      <CardBody>{children}</CardBody>
      {footer != null ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}

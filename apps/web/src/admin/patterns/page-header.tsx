import type { ReactNode } from "react";

type PageHeaderProps = {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1 space-y-1 text-start">
        <h1 className="break-words text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl break-words text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap gap-2 lg:w-auto lg:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}

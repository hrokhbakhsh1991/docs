import type { ReactNode } from "react";

type PageHeaderProps = {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header data-operator-page-header>
      <div data-operator-page-header-main>
        <h1 data-operator-page-header-title>{title}</h1>
        {description ? (
          <p data-operator-page-header-description>{description}</p>
        ) : null}
      </div>
      {actions ? <div data-operator-page-header-actions>{actions}</div> : null}
    </header>
  );
}

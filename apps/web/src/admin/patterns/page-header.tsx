import type { ReactNode } from "react";

type PageHeaderProps = {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header data-denali-page-header>
      <div data-denali-page-header-main>
        <h1 data-denali-page-header-title>{title}</h1>
        {description ? (
          <p data-denali-page-header-description>{description}</p>
        ) : null}
      </div>
      {actions ? <div data-denali-page-header-actions>{actions}</div> : null}
    </header>
  );
}

import type { Page } from "@repo/shared-contracts";

import styles from "./PageRenderer.module.css";
import { renderPageBlock } from "./renderPageBlock";

export type PageRendererProps = {
  page: Page;
};

/**
 * Renders a registry {@link Page} (sections → blocks) via the block kind map in {@link renderPageBlock}.
 */
export function PageRenderer({ page }: PageRendererProps) {
  const title = page.route.title ?? page.sections[0]?.title ?? page.id;

  return (
    <article className={styles.page} data-page-id={page.id} data-page-key={page.pageKey}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {page.route.metaDescription ? (
          <p className={styles.pageMeta}>{page.route.metaDescription}</p>
        ) : (
          <p className={styles.pageMeta}>
            Registry route: <code>{page.route.path}</code> · version {page.version}
          </p>
        )}
      </header>

      <div className={styles.sections}>
        {page.sections.map((section) => (
          <section
            key={section.id}
            id={section.slug ?? section.id}
            className={styles.section}
            data-section-id={section.id}
          >
            {section.title ? <h2 className={styles.sectionTitle}>{section.title}</h2> : null}
            <div className={styles.blocks}>
              {section.blocks.map((block) => (
                <div key={block.id}>{renderPageBlock(block)}</div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

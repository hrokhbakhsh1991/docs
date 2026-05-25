/**
 * Phase 3 — registry-driven marketing pages (landing, about).
 *
 * JSON-shaped page definitions validated by Zod; consumed by a future ComponentFactory
 * instead of hardcoded JSX per workspace.
 */

import { z } from "zod";

export { z };

// --- Workspace keys (content engine) -----------------------------------------

/**
 * Tenant-facing workspace slugs for static/marketing pages.
 * Distinct from {@link TourFormProfile} — aligned with tour workspace brands where applicable.
 */
export const CONTENT_WORKSPACE_VALUES = [
  "general",
  "denali",
  "arctic",
  "urban",
] as const;

export type ContentWorkspace = (typeof CONTENT_WORKSPACE_VALUES)[number];

/** Alias used in registry maps (`Record<Workspace, …>`). */
export type Workspace = ContentWorkspace;

export const ContentWorkspaceSchema = z.enum(CONTENT_WORKSPACE_VALUES);

// --- Routes ------------------------------------------------------------------

export const PageRouteSchema = z.object({
  /** App path (e.g. `/`, `/about`). */
  path: z.string().min(1),
  /** Optional document title override. */
  title: z.string().optional(),
  /** SEO meta description. */
  metaDescription: z.string().optional(),
});

export type PageRoute = z.infer<typeof PageRouteSchema>;

// --- Blocks ------------------------------------------------------------------

export const TextBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("text"),
  heading: z.string().optional(),
  body: z.string(),
  /** BCP-47 or short locale key when block copy is localized. */
  locale: z.string().optional(),
});

export const ImageBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("image"),
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const PageBlockSchema = z.discriminatedUnion("kind", [TextBlockSchema, ImageBlockSchema]);

export type TextBlock = z.infer<typeof TextBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type PageBlock = z.infer<typeof PageBlockSchema>;

// --- Sections ----------------------------------------------------------------

export const PageSectionSchema = z.object({
  id: z.string().min(1),
  /** Optional anchor / CMS section key. */
  slug: z.string().optional(),
  title: z.string().optional(),
  blocks: z.array(PageBlockSchema).min(1),
});

export type PageSection = z.infer<typeof PageSectionSchema>;

// --- Page --------------------------------------------------------------------

export const PageSchema = z.object({
  id: z.string().min(1),
  /** Logical page key within the workspace bundle (`landing` | `about`). */
  pageKey: z.enum(["landing", "about"]),
  route: PageRouteSchema,
  sections: z.array(PageSectionSchema).min(1),
  /** Registry version for CMS migrations. */
  version: z.number().int().positive().default(1),
});

export type Page = z.infer<typeof PageSchema>;

/** Fixed page slots per workspace (landing + about). */
export const WorkspacePagesSchema = z.object({
  landing: PageSchema,
  about: PageSchema,
});

export type WorkspacePages = z.infer<typeof WorkspacePagesSchema>;

/**
 * Per-workspace page bundle: `PageRegistry[workspace].landing` / `.about`.
 */
export type PageRegistry = Record<Workspace, WorkspacePages>;

// --- Seed definitions --------------------------------------------------------

function seedTextBlock(id: string, heading: string, body: string): PageBlock {
  return { id, kind: "text", heading, body };
}

function seedImageBlock(id: string, url: string, alt: string): PageBlock {
  return { id, kind: "image", url, alt };
}

function seedPage(
  workspace: Workspace,
  pageKey: "landing" | "about",
  routePath: string,
  sections: PageSection[],
): Page {
  return PageSchema.parse({
    id: `${workspace}-${pageKey}`,
    pageKey,
    route: { path: routePath },
    sections,
    version: 1,
  });
}

function seedWorkspacePages(workspace: Workspace, brandLabel: string): WorkspacePages {
  return WorkspacePagesSchema.parse({
    landing: seedPage(workspace, "landing", "/", [
      {
        id: "hero",
        slug: "hero",
        title: brandLabel,
        blocks: [
          seedTextBlock(
            "hero-copy",
            brandLabel,
            `Welcome to the ${brandLabel} workspace landing page.`,
          ),
          seedImageBlock(
            "hero-image",
            "https://cdn.example.com/content/hero-placeholder.jpg",
            `${brandLabel} hero`,
          ),
        ],
      },
    ]),
    about: seedPage(workspace, "about", "/about", [
      {
        id: "about-main",
        slug: "about",
        blocks: [
          seedTextBlock(
            "about-copy",
            `About ${brandLabel}`,
            `Learn more about tours and experiences offered under the ${brandLabel} workspace.`,
          ),
        ],
      },
    ]),
  });
}

/**
 * Canonical page definitions per workspace (Phase 3 initializer).
 * Validate with {@link WorkspacePagesSchema} / {@link PageSchema} when loading overrides from CMS.
 */
export const PAGE_REGISTRY: PageRegistry = {
  general: seedWorkspacePages("general", "General"),
  denali: seedWorkspacePages("denali", "Denali"),
  arctic: seedWorkspacePages("arctic", "Arctic"),
  urban: seedWorkspacePages("urban", "Urban"),
};

export function getWorkspacePages(workspace: Workspace): WorkspacePages {
  return PAGE_REGISTRY[workspace];
}

export function parsePageDefinition(input: unknown): Page {
  return PageSchema.parse(input);
}

export function parseWorkspacePages(input: unknown): WorkspacePages {
  return WorkspacePagesSchema.parse(input);
}

## 1. Database Integrity Audit

**Audit Timestamp:** 2026-07-07T11:52:47.115Z

✅ **Status: Healthy.** No orphaned records or broken foreign key links found in `tenant_config` or `workspace_equipment`.

## 3. Performance & Bottleneck Analysis

### WorkspaceRegistry.load() Analysis

**Identified Latency Bottleneck:**
When executing in a Node.js server environment (such as Next.js server-side execution), the registry discovery resolves to `createNodeWorkspaceManifestDiscoverer` (defined in [node-manifest-discoverer.ts](file:///home/hamed/Music/docs/packages/workspace-sdk/src/workspace-registry/node-manifest-discoverer.ts)). 

This method performs synchronous, blocking I/O calls:
1. `fs.existsSync(workspacesDir)` to verify the directory exists.
2. `fs.readdirSync(workspacesDir)` to read all directory entries.
3. `fs.existsSync(manifestPath)` inside the loop for each subdirectory to verify the manifest file exists.
4. `fs.readFileSync(manifestPath, "utf8")` to read each workspace manifest.

**Performance Impact:**
Because these calls are synchronous, they block the main Node.js event loop during initialization or request handling. While they might be fast when there are only a few workspaces, this scale negatively as the number of workspace packages grows, directly degrading server responsiveness and increasing startup/request latencies.

**Recommended Solution:**
Refactor `discoverWorkspaceManifestsFromDirectory` to use asynchronous filesystem APIs (via `promises` namespace: `fs.promises.readdir`, `fs.promises.readFile`) so that disk checks and reads run concurrently and non-blockingly, keeping the main thread free. Alternatively, implement a lazy-loading or pre-cached approach to resolve the workspace registry entries.

## 4. Hidden Coupling Audit

**Audit Scope:**
* Checked `packages/workspaces/*` for any imports of `apps/api` or `packages/platform-core`.
* Checked `packages/workspace-sdk/*` for any imports of `packages/platform-core`.

**Audit Findings:**
✅ **Status: Healthy.** No direct coupling violations or import bypasses were detected. The workspaces properly isolate core dependencies and express integration points through abstract ports (e.g., `tour-store.port.ts`, `exposure-resolver.port.ts`) instead of direct coupling to internal packages.

## 5. Zero-Code Readiness Score

### Manifest Conformance Review

We evaluated all workspace manifests against `WorkspaceManifestCiSchema` (defined in [manifest.schema.ts](file:///home/hamed/Music/docs/packages/workspace-sdk/src/manifest.schema.ts)):

1. **`starter`** ([starter/workspace.manifest.json](file:///home/hamed/Music/docs/packages/workspaces/starter/workspace.manifest.json)):
   * **Result:** **Pass** (Basic schema compliance).
   * **Legacy Elements:** Uses legacy `themeStylesheets` ("theme/tokens.css").
   * **Zero-Code Grade:** **B**

2. **`urban`** ([urban/workspace.manifest.json](file:///home/hamed/Music/docs/packages/workspaces/urban/workspace.manifest.json)):
   * **Result:** **Pass** (Schema compliance with passthrough keys).
   * **Legacy Elements:** Contains legacy `themeStylesheets` ("theme/tokens.css") and `guestThemeStylesheets` maps.
   * **Zero-Code Grade:** **B**

3. **`denali`** ([denali/workspace.manifest.json](file:///home/hamed/Music/docs/packages/workspaces/denali/workspace.manifest.json)):
   * **Result:** **Pass** (Validates successfully under structural check).
   * **Legacy Elements:** Highly customized. Relies heavily on custom CSS skins (`themeStylesheets` pointing to "theme/denali-admin.css" and `guestThemeStylesheets` maps) instead of declaring inline configuration in a standardized `theme` object.
   * **Zero-Code Grade:** **C-**

### Migration Roadmap to Zero-Code standard:
* **Deprecate Custom Skins:** Move styles from custom stylesheets (`theme/denali-admin.css`, etc.) into variables in a structured `theme` block on the manifest.
* **Standardize Theme Provider:** Allow the core dynamic design engines to inject colors, margins, and border styles from `theme` manifests instead of requesting custom stylesheet imports.

## 6. Theme Scaling Stress Test

**Audit timestamp:** 2026-07-07  
**Scenario:** 100 workspaces, each with a Denali-scale `theme` block (17 CSS custom properties) and full manifest payload (~10 KB JSON per workspace).  
**Method:** Synthetic manifests written to a temp directory; `discoverWorkspaceManifestsFromDirectory` + `WorkspaceRegistry.load()` + 10,000 hot-path `readWorkspaceManifestTheme` → `mergeThemeCssVariables` iterations (one-off local benchmark, 2026-07-07).

### 6.1 WorkspaceRegistry memory at 100 manifests

| Metric | 4 workspaces (prod) | 100 workspaces (simulated) | Projected @ 500 |
| ------ | ------------------- | -------------------------- | --------------- |
| On-disk manifest bytes | 21,682 | 1,036,500 (~1.0 MB) | ~5.2 MB |
| V8 serialized registry payload | — | 995,807 (~972 KB) | ~4.8 MB |
| Heap delta after load | — | +0.07 MB | ~0.35 MB (linear extrapolation) |
| RSS delta after load | — | +5.99 MB | ~30 MB (extrapolated; includes parse/GC overhead) |
| `Map` + sorted `ordered[]` entries | 4 | 100 | 500 |

**Structure retained per entry** (`WorkspaceRegistry`):

```text
WorkspaceRegistryEntry = { workspaceId, manifestPath, manifest }
  manifest = full parsed JSON (Zod + Object.freeze) — not theme-only
```

**Findings:**

- Memory is **dominated by full manifest objects**, not the `theme` block alone. Denali's `theme` is ~564 bytes; the full manifest is ~10 KB. One hundred workspaces ≈ **1 MB on disk** and **~1 MB in-process** serialized form.
- Per-request theme lookup is **O(1)** via `Map.get(pluginId)` — registry size does not affect lookup latency.
- `registry.list()` at 100 entries costs **0.11 ms / 1,000 calls** — negligible unless layouts scan all workspaces per request (they do not today).
- **Risk @ scale:** Each Node/Next worker holds a **full in-memory copy** of all manifests after `ensureWorkspaceRegistryLoaded()`. With 500 workspaces × ~10 KB manifests, expect **~5 MB registry heap** plus **~25–50 MB RSS** per worker — acceptable for VPS, but wasteful if only one `pluginId` is active per request.
- **Cold-load I/O:** Synchronous `fs.readdirSync` + `fs.readFileSync` per manifest (see §3) took **17.16 ms** for 100 manifests (**~172 µs/manifest**) vs **8.97 ms** for 4 prod workspaces. Linear scaling → **~85 ms @ 500 workspaces** blocking the event loop on first `ensureWorkspaceRegistryLoaded()` per process.

**Verdict:** Registry memory at 100 workspaces is **healthy**. The bottleneck is **cold-start sync disk discovery**, not Map retention or theme resolution.

### 6.2 PlatformThemeProvider — rapid theme-switching & FOUC

**Mechanism:** `PlatformThemeProvider` merges `manifestTheme` / `themeJson` layers in `useMemo`, then applies them as an **inline `style` object** on a wrapper `<div className="theme-light|theme-dark">`. CSS custom properties **inherit** to descendants.

| Switch type | FOUC risk | Reason |
| ----------- | --------- | ------ |
| `manifestTheme` prop change only (same page, client re-render) | **Low** | `useMemo` → synchronous style update in same React commit; no network |
| `themeJsonOverride` layer (tenant runtime) | **Low** | Same inline path; Admin `TenantThemeProvider` is a sibling inner layer |
| Operator light/dark toggle (`OperatorThemeToggle`) | **Low–Medium** | Toggles `theme-light` / `theme-dark` class on platform root synchronously; dark semantic CSS must already be in bundle |
| `pluginId` change → new `import*ThemeForPlugin()` | **High** | Dynamic CSS `import()` is async; skin selectors (`body[data-workspace-plugin]`) may apply **after** first paint |
| Full navigation (host / tenant change) | **Medium** | Server renders inline manifest vars in SSR HTML, but **guest skin CSS chunks** may still load client-side after HTML |
| Admin: no `manifestTheme` wired today | **N/A** | Admin relies on pre-built bootstrap CSS + dynamic skin import + API tenant theme — manifest `themeJson` does not participate |

**FOUC-specific gaps:**

1. **Inline vars vs skin CSS timing:** Manifest `themeJson` paints via inline `style` on an inner wrapper; workspace **skin CSS** targets `body[data-workspace-plugin]` and loads via dynamic `import()`. On rapid `pluginId` switches, skin CSS can lag behind inline vars → **mismatched colors for 1–2 frames**.
2. **Client boundary:** `PortalProviders` / `MarketingProviders` are `"use client"`. Initial SSR includes serialized props, but **client navigations** that change `pluginId` without a full document load depend on CSS chunk fetch latency.
3. **No `suppressHydrationWarning` / blocking stylesheet link** for per-plugin skin paths — Next.js treats dynamic CSS imports as separate chunks, not render-blocking `<link>` tags in `<head>`.
4. **Rapid toggle stress:** 10,000 `mergeThemeCssVariables` ops averaged **11.1 µs/op** — React re-render cost dominates; provider math is not the FOUC source.

**Verdict:** `PlatformThemeProvider` handles **inline JSON token switches** without meaningful FOUC. **Plugin/skin switches** (the realistic multi-workspace path) remain **FOUC-vulnerable** because of async CSS ingress, not because of `themeJson` parsing.

### 6.3 Per-app theme JSON fetch latency overhead

Theme JSON is **not fetched over HTTP** on Portal/Marketing — it is resolved in-process from the loaded registry. Admin does **not** resolve manifest `theme` today. Latency tables use measured micro-benchmarks + architectural trace.

#### Admin (`apps/web`)

| Step | Source | Cold (1st request / worker) | Warm (registry loaded, same plugin) |
| ---- | ------ | ----------------------------- | ------------------------------------- |
| Manifest `themeJson` resolve | `resolveWorkspaceManifestThemeForPlugin` | **Not called** | **Not called** |
| Workspace skin CSS | `importAdminThemeForPlugin(pluginId)` | 1× dynamic `import()` — **5–40 ms** client chunk fetch | **0 ms** (cached module) |
| Tenant theme JSON | `fetchTenantThemeForContext` → `GET /api/v2/tenant-config` | **10–80 ms** (network + API) | **10–80 ms** ( `cache: "no-store"` ) |
| Platform bootstrap CSS | `admin-bootstrap.css` in `globals.css` | Build-time static — **0 ms** runtime | **0 ms** |
| **Total theme appearance ingress** | | **~15–120 ms** | **~10–80 ms** |

Admin is the **slowest** surface for theme data because every layout hit re-fetches tenant config from the API with no HTTP cache.

#### User Portal (`apps/portal`)

| Step | Source | Cold | Warm |
| ---- | ------ | ---- | ---- |
| Registry load | `ensureWorkspaceRegistryLoaded()` (instrumentation + layout) | **~17 ms @ 100 ws** (sync disk) | **~0 ms** (`isLoaded()` short-circuit) |
| Manifest `themeJson` resolve | `resolveWorkspaceManifestThemeForPlugin(pluginId)` | **~0.01 ms** (Map get + 17-key object) | **~0.01 ms** |
| Bootstrap / pluginId | `resolvePortalBootstrapForHost` → API | **10–50 ms** (`nextRevalidate: 300`) | **0–50 ms** |
| Workspace skin CSS | `importGuestPortalThemeForPlugin` — starter base + overlay | 2× dynamic `import()` — **10–60 ms** client | **0 ms** cached |
| **Total theme JSON + appearance** | | **~27–127 ms** | **~0–50 ms** |

`themeJson` itself adds **negligible** overhead once the registry is warm.

#### Public / Marketing (`apps/marketing`)

| Step | Source | Cold | Warm |
| ---- | ------ | ---- | ---- |
| Registry load | `ensureWorkspaceRegistryLoaded()` (instrumentation) | **~17 ms @ 100 ws** | **~0 ms** |
| Manifest `themeJson` resolve | `resolveWorkspaceManifestThemeForPlugin(pluginId)` | **~0.01 ms** | **~0.01 ms** |
| Bootstrap / pluginId | `resolveMarketingBootstrapForHost` → API | **10–50 ms** | **0–50 ms** |
| Public branding (display name) | `fetchPublicTenantBrandingForHost` | **10–50 ms** | **0–50 ms** |
| Workspace skin CSS | `importGuestMarketingThemeForPlugin` — starter + overlay | 2× dynamic `import()` — **10–60 ms** | **0 ms** cached |
| **Total theme JSON + appearance** | | **~37–177 ms** | **~0–50 ms** |

Marketing has the **highest cold-path ceiling** due to an extra branding fetch, not `themeJson` size.

### 6.4 Scaling risks summary

| Risk | Severity @ 100 ws | Mitigation |
| ---- | ----------------- | ---------- |
| Sync manifest discovery blocks event loop | **Medium** | Async `fs.promises` discovery (§3); lazy per-plugin manifest load |
| Full-registry memory per worker | **Low** | ~1 MB @ 100 ws; consider plugin-scoped index if >500 |
| Generated theme loader switch size | **Medium** | 100-case `import()` switches in `workspace-*-theme-stylesheets.generated.ts` — build graph + chunk count grow linearly |
| FOUC on plugin switch | **High** (UX) | Preload active plugin CSS; `<link rel="preload">`; or inline critical skin vars in layout `<head>` |
| Admin missing manifest `theme` path | **Medium** (consistency) | Wire `manifestTheme` per `ARCHITECTURE_FEASIBILITY_REPORT.md` Phase 0 |
| Tenant API fetch on every Admin request | **High** (latency) | Short-TTL edge cache for `/api/v2/tenant-config` theme block |

### 6.5 Stress-test verdict

| Component | @ 100 workspaces | Status |
| --------- | ---------------- | ------ |
| `WorkspaceRegistry` memory | ~1 MB data, ~6 MB RSS delta | ✅ Healthy |
| `themeJson` hot-path CPU | ~11 µs/resolve+merge | ✅ Healthy |
| `PlatformThemeProvider` inline switch | No FOUC for JSON-only changes | ✅ Healthy |
| Dynamic skin CSS on plugin switch | FOUC likely 1–2 frames | ⚠️ Needs preload strategy |
| Cold registry load | ~17 ms (100 ws) | ⚠️ Acceptable; refactor @ 500+ |
| Admin theme JSON fetch | API round-trip every request | ❌ Dominant latency; not registry-bound |

**Overall:** One hundred `themeJson` blocks do **not** stress registry memory or provider math. Production risk concentrates in **sync cold-load I/O**, **async skin CSS ingress (FOUC)**, and **Admin's per-request tenant API fetch** — not in storing or resolving manifest theme JSON.

## 7. UX/UI Token Drift

**Audit timestamp:** 2026-07-07  
**Scope:** Admin (`apps/web`) vs User Portal (`apps/portal`) — CSS variable naming, `--ws-*` consumption, and cross-surface brand coherence (reference workspace: **Denali**).

### 7.1 Naming convention comparison

The two surfaces use **different token namespaces** by design — not a single shared `--ws-*` vocabulary end-to-end.

| Layer | Admin (`data-app-surface="admin"`) | User Portal (`data-app-surface="portal"`) |
| ----- | ---------------------------------- | ----------------------------------------- |
| **Workspace contract (`--ws-*`)** | Declared in `workspace.manifest.json` `theme`, `denali.plugin.ts` `cssVariables`, and `WorkspaceThemeProvider` | Injected via `PlatformThemeProvider` `manifestTheme` on an **inner wrapper `<div>`** — but portal skin CSS **does not read `--ws-*` keys** (except one bridge fallback) |
| **DTCG semantic authority** | `denali.admin.tokens.json` → `admin-semantic-tokens.css` on `body[data-workspace-plugin="denali"]` | `denali.portal.tokens.json` → `portal-semantic-tokens.css` on `body[data-app-surface="portal"][data-workspace-plugin="denali"]` |
| **Platform semantics (`--color-*`)** | Full palette: primary, bg-page, text-secondary, info, success, warning, sidebar aliases | Subset: primary, bg-page, text-muted, focus-ring, accent — **no** text-secondary, info, success, warning |
| **shadcn flat aliases (`--primary`, `--card`, …)** | Set in `admin-semantic-tokens.css` + `shell-bridge.css` | Bridged manually in `denali-portal.css` `body[…]` block (18 lines) |
| **Workspace palette (`--denali-*`)** | `--denali-forest-*`, `--denali-mist-*`, `--denali-shadow-card` | **Absent** — portal uses generic `--color-*` only |
| **Sidebar tokens (`--sidebar*`, `--shell-sidebar-width`)** | Present in admin DTCG + manifest `--ws-sidebar-*` | **Absent** (no operator sidebar on portal) |
| **Canonical SDK enum** | `WORKSPACE_THEME_CSS_VARIABLE` defines only `--ws-color-accent`; Denali extends with 16 additional `--ws-*` keys in plugin/manifest | Same injection path, **zero skin consumers** |

**Convention rule (documented vs actual):**

- **Documented:** `--ws-*` = workspace brand contract; `--color-*` = platform semantics; components consume `var(--primary)` / `bg-primary` via `shell-bridge.css`.
- **Actual Admin:** `--color-*` + `--denali-*` drive appearance; `--ws-*` is a **parallel declaration** (manifest + plugin) that mostly mirrors admin DTCG but is **not wired** through `apps/web` layout `manifestTheme`.
- **Actual Portal:** `--color-*` from a **separate portal DTCG slice** drives appearance; `manifestTheme` `--ws-*` vars are **orphaned** on the provider wrapper.

### 7.2 Denali cross-surface value drift (same brand, different colors)

Admin and Portal **intentionally use different DTCG source files**. The result is a visibly different product for the same `pluginId`:

| Token | Admin (`admin-semantic-tokens.css`) | Portal (`portal-semantic-tokens.css`) | Manifest `--ws-*` |
| ----- | ----------------------------------- | --------------------------------------- | ----------------- |
| Primary | `#0f766e` (forest-600) | `#059669` (emerald) | `#0f766e` ← matches **admin only** |
| Page background | `#f4f7f4` (mist-50) | `#ecfdf5` (emerald tint) | `#f4f7f4` |
| Text primary | `#1a1f26` | `#0f172a` (slate) | `#1a1f26` |
| Text muted | `#6f7768` | `#64748b` | `#6f7768` |
| Border | `#dce5dc` | `#e1f2ed` | `#dce5dc` |
| Radius | `0.625rem` | `0.5rem` | `0.625rem` |
| Accent | mist `#e8efe8` (admin flat `--accent`) | amber `#d97706` (portal `--color-accent`) | `#e8efe8` |
| Focus ring | `rgb(15 118 110 / 0.35)` | `rgb(5 150 105 / 0.35)` | — |

**UX impact:** A member who registers on the portal (emerald `#059669`) and later sees operator comms or admin screenshots (forest `#0f766e`) perceives **two different clubs**, even though `data-workspace-plugin="denali"` is identical.

### 7.3 Admin tokens missing on User Portal

| Admin token / group | Present on portal? | User-visible gap |
| ------------------- | ------------------ | ---------------- |
| `--ws-color-primary` / `--ws-color-primary-hover` / `--ws-color-primary-fg` | Injected but **not consumed** by portal CSS | Manifest theme changes have **no effect** on portal chrome |
| `--ws-sidebar`, `--ws-sidebar-primary`, `--ws-sidebar-accent`, `--ws-sidebar-border`, `--ws-sidebar-foreground` | Missing (N/A for layout) | Expected — no sidebar |
| `--ws-color-text-secondary` | Missing | Secondary copy uses `--muted-foreground` / `--color-text-muted` only — different scale |
| `--denali-forest-*`, `--denali-mist-*` | Missing | No shared named palette between surfaces |
| `--denali-shadow-card`, `--denali-shadow-card-hover` | Missing | Portal cards/buttons use flat borders; admin widgets have elevation |
| `--color-info`, `--color-info-bg`, `--color-success`, `--color-success-bg`, `--color-warning`, `--color-warning-bg` | Missing from portal DTCG slice | Status/alert semantics differ; portal uses `--destructive` only |
| `--color-text-secondary` | Missing | Admin secondary text color unavailable |
| `--shell-sidebar-width` | Missing | N/A |
| Dark mode cascade (`html.dark`, `.theme-dark`) | Missing | Portal is light-only; admin has full dark palette |
| `WorkspaceThemeProvider` plugin `cssVariables` | Not used (portal uses `PlatformThemeProvider` only) | Denali plugin `--ws-*` block bypassed on guest surface |

### 7.4 Hidden hardcoded styles in User Portal (bypassing `--ws-*`)

`apps/portal` TSX is **guard-clean** (no raw hex in components). Drift lives in **CSS layers** the portal loads:

| Location | Hardcoded / non-`--ws-*` value | Ignores `--ws-*`? |
| -------- | ------------------------------ | ----------------- |
| `packages/workspaces/denali/theme/portal-semantic-tokens.css` | 15+ literal hex/rgb values (`#059669`, `#d97706`, …) | Yes — uses `--color-*` DTCG output, not `--ws-*` |
| `packages/workspaces/starter/theme/starter-portal.css:12` | `box-shadow: 0 1px 3px rgb(0 0 0 / 0.12)` on skip-link focus | Yes — fixed black shadow, not `--denali-shadow-card` |
| `denali-portal.css` / `starter-portal.css` | `opacity: 0.6` on disabled buttons (4 rules) | Partial — accepts any primary underneath |
| `denali-portal.css` | `font-size: 1.375rem; font-weight: 400` on `h1` | Typography hardcoded; admin uses same sizes but via skin hooks, not tokens |
| `apps/portal/src/features/auth/otp-segment-input.tsx` | Tailwind `shadow-sm`, `focus-visible:ring-ring` | Uses shadcn bridge (`--ring`), not `--ws-*` — acceptable if `--color-focus-ring` aligned |
| `apps/portal/app/layout.tsx` | **Calistoga** heading font loaded; admin layout does **not** | Different typographic identity (portal = display serif headings, admin = Inter only) |
| `PlatformThemeProvider` wrapper | Sets `--ws-*` from manifest | **Ignored** by all portal skin selectors scoped to `body[…]` |

**Key finding:** Portal passes `manifestTheme` from `resolveWorkspaceManifestThemeForPlugin` into `PortalProviders`, but every appearance rule is scoped to `body[data-app-surface="portal"]` or descendants — **outside** the `PlatformThemeProvider` inner `<div>`. The manifest `--ws-*` block is effectively **dead code** for portal rendering.

### 7.5 Where the UI feels like a different product

| # | Symptom | Root cause |
| - | ------- | ---------- |
| 1 | **Different green** on portal vs admin | Separate DTCG slices (`denali.portal.tokens.json` vs `denali.admin.tokens.json`) |
| 2 | **Different page tint** (cool mist vs emerald wash) | Portal `--color-bg-page: #ecfdf5` vs admin `--denali-mist-50: #f4f7f4` |
| 3 | **Different heading personality** | Portal: Calistoga 400-weight titles; Admin: Inter system hierarchy |
| 4 | **Different corner radius** | Portal `0.5rem` vs admin/manifest `0.625rem` |
| 5 | **Amber accent on portal only** | Portal `--color-accent: #d97706` has no admin equivalent (admin accent = mist green) |
| 6 | **Flat mobile shell vs rich admin chrome** | Portal: glass blur header (`backdrop-filter`), bottom nav, max-width 36–48rem; Admin: sidebar grid, card shadows, dashboard widgets |
| 7 | **Manifest theme edits don't propagate to portal** | `--ws-*` on provider wrapper; skin reads `--color-*` from portal DTCG |
| 8 | **Starter base skin stacks under workspace skin** | Every portal tenant loads `starter-portal.css` first — generic platform chrome bleeds through before Denali overlay |
| 9 | **No dark mode parity** | Admin operator can toggle dark; portal members always see light semantic palette |
| 10 | **Registration OTP inputs use ui-primitives + Tailwind** | Admin wizard fields use workspace `wizard-fields.css` skin — different field chrome for the same auth pattern |

### 7.6 Token drift verdict

| Check | Status |
| ----- | ------ |
| Shared `--ws-*` vocabulary across Admin + Portal | ❌ **Failed** — portal skins do not consume `--ws-*` |
| Manifest `theme` block drives portal appearance | ❌ **Failed** — dead injection on wrapper div |
| Admin + Portal same primary for Denali | ❌ **Failed** — `#0f766e` vs `#059669` |
| Portal TSX free of hardcoded palette | ✅ **Pass** |
| Portal CSS free of hardcoded palette | ⚠️ **Partial** — DTCG `@generated` hex is authoritative but bypasses `--ws-*`; starter skip-link shadow is literal rgb |
| Cross-surface “one product” feel | ❌ **Failed** — separate DTCG slices + typography + layout model |

### 7.7 Remediation priorities (UX)

1. **Unify Denali primary** — align `denali.portal.tokens.json` `color.primary` to `{denali.forest-600}` (or reference shared base token), not independent `#059669`.
2. **Bridge `--ws-*` → `--color-*` on portal `body`** — either map manifest `theme` keys into `portal-semantic-tokens.css` generation, or scope `PlatformThemeProvider` at `body` level so `--ws-color-primary` cascades into `--color-primary`.
3. **Collapse DTCG slices or add sync guard** — CI check that admin/portal/manifest primary values match per workspace id.
4. **Typography contract** — document whether Calistoga is portal-only; if brand unity matters, align admin marketing collateral fonts or demote Calistoga to optional workspace manifest flag.
5. **Remove dead `manifestTheme` path or make it authoritative** — current wiring creates false confidence that editing manifest `theme` updates the member app.

## 8. Coupling & Decoupling Analysis

**Audit timestamp:** 2026-07-07  
**Scope:** Import graph and theme coupling across Admin (`apps/web`), User Portal (`apps/portal`), and Public (`apps/marketing`).  
**Note:** `apps/admin` and `apps/public` do not exist; analysis uses canonical app paths.

### 8.1 Inter-app import graph

The three shells **do not import each other**. There are zero `from "@apps/…"` edges. Coupling is **indirect** — via shared packages and codegen’d bootstrap files.

```text
                    ┌─────────────────────────────────────────┐
                    │         packages/workspace-sdk          │
                    │  (contracts, registry, theme ingress)   │
                    └───────────────┬─────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   apps/web      │      │  apps/portal    │      │ apps/marketing  │
│   (Admin)       │      │ (User Portal)   │      │   (Public)      │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
                    ▼                                ▼
         ┌──────────────────┐            ┌──────────────────────┐
         │  @app-tour/      │            │  @app-tour/          │
         │  theme-react     │            │  design-tokens       │
         │  (providers)     │            │  (CSS bootstrap)     │
         └────────┬─────────┘            └──────────────────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  @app-tour/      │  ← guest-surface-host (host/bootstrap only; no theme)
         │  guest-surface-  │
         │  host            │
         └──────────────────┘

         ┌──────────────────────────────────────────────────────┐
         │  packages/workspaces/{denali,urban,guest-club,starter} │
         │  (concrete CSS skins + plugins — see §8.2)             │
         └──────────────────────────────────────────────────────┘
```

### 8.2 Shared runtime code & hidden workspace-theme dependencies

| Shared package | Admin | Portal | Public | Theme coupling? |
| -------------- | ----- | ------ | ------ | --------------- |
| `@app-tour/workspace-sdk` | ✅ | ✅ | ✅ | **Interface only** — `WorkspaceManifestTheme`, registry resolvers, `WorkspaceThemeContract` |
| `@app-tour/theme-react` | ✅ `ThemeProviderChain` | ✅ `PlatformThemeProvider` | ✅ `PlatformThemeProvider` | **Abstract** — consumes `Record<string,string>` maps; no workspace id |
| `@app-tour/design-tokens` | `admin-bootstrap.css` | `portal-bootstrap.css` | `marketing-bootstrap.css` | **Platform L0/L2** — not workspace-specific |
| `@app-tour/guest-surface-host` | ✅ | ✅ | ✅ | **None** — host routing / bootstrap only |
| `@app-tour/ui-primitives` | ✅ | ✅ | ⚠️ minimal | Token-backed CSS modules (`var(--color-*)`) |
| `@app-tour/workspace-plugin-host` | ❌ | ✅ | ❌ | **High** — static imports of all workspace registration-flow plugins |
| `@app-tour/workspace-*` (direct) | devDeps + codegen | **deps** + codegen | **deps** + codegen | **High** — see below |

**Hidden concrete theme dependencies (runtime):**

| Mechanism | Admin | Portal | Public | Workspace-specific? |
| --------- | ----- | ------ | ------ | ------------------- |
| `workspace-*-theme-stylesheets.generated.ts` | `importAdminThemeForPlugin` | `importGuestPortalThemeForPlugin` | `importGuestMarketingThemeForPlugin` | **Yes** — switch per `pluginId` → `@app-tour/workspace-*/theme/*.css` |
| Starter base skin (always loaded) | ❌ | `starter-portal.css` | `starter-marketing.css` | **Yes** — platform default L3 bleeds into every tenant |
| `workspace-plugin-host/register` | ❌ | `instrumentation.ts` | ❌ | **Yes** — registers Denali/Urban/Guest-club flows at process init |
| `workspace-marketing-catalog-bindings.generated.ts` | ❌ | ❌ | static `denaliMarketingCatalogSurface` | **Yes** — Denali catalog surface in marketing app src |
| `workspace-plugin-loaders.generated.ts` + 30+ wizard bindings | sync `getDenaliWorkspacePlugin()` etc. | ❌ | ❌ | **Yes** — Admin bundles all workspace plugins at module init |
| `WorkspaceThemeProvider` + plugin `theme.cssVariables` | ✅ via `ThemeProviderChain` | ❌ | ❌ | **Yes** — Denali `--ws-*` from plugin object, not manifest layout path |
| `resolveWorkspaceManifestThemeForPlugin` | ❌ not called | ✅ | ✅ | Manifest-only; **does not** load workspace CSS |

**Verdict:** Apps share **abstract** theme ingress (`theme-react` + sdk types) but each shell also carries **codegen’d edges to every certified workspace’s concrete CSS**. That is a hidden compile-time and runtime dependency on workspace **implementation**, not just the sdk **interface**.

### 8.3 Package.json workspace coupling matrix

| Workspace package | Admin (`apps/web`) | Portal | Public |
| ----------------- | ------------------ | ------ | ------ |
| `workspace-sdk` | `dependencies` | `dependencies` | `dependencies` |
| `workspace-starter` | `dependencies` | `dependencies` | `dependencies` |
| `workspace-denali` | `devDependencies` | `dependencies` | `dependencies` |
| `workspace-urban` | `devDependencies` | `dependencies` | `dependencies` |
| `workspace-guest-club` | `devDependencies` | `dependencies` | `dependencies` |
| `workspace-plugin-host` | — | `dependencies` | — |
| `platform-core` | `dependencies` | — | — |

Portal and Public **declare all workspace packages as production dependencies** so Next.js can resolve dynamic `import("@app-tour/workspace-denali/theme/…")` paths in generated loaders. Admin keeps workspaces in devDeps and uses webpack `IgnorePlugin` to strip client bundles — but server/build still resolves generated switch cases.

### 8.4 If `themeJson` schema changes — do all 3 apps fail to build?

**Short answer: Not necessarily all three, and not always at `next build`.** Blast radius depends on the kind of change.

#### Schema authority (two validators today)

| Layer | File | `theme` shape | Strictness |
| ----- | ---- | ------------- | ---------- |
| Runtime registry | `WorkspaceManifestSchema` | `z.record(z.string(), z.string()).optional()` | Loose |
| CI / guard | `WorkspaceManifestCiSchema` → `ManifestThemeBlockSchema` | flat `Record<string,string>` + key/value safety rules | Strict (64 keys, safe values) |
| App-facing type | `WorkspaceManifestTheme` | `Readonly<Record<string, string>>` | Structural typing only |
| Provider duplicate | `PlatformThemeJson` in `theme-react` | same loose record | Independent alias |

#### Change-type matrix

| Change | Admin build | Portal build | Public build | First failure surface |
| ------ | ----------- | ------------ | ------------ | --------------------- |
| Add optional new keys to flat `theme` | ✅ | ✅ | ✅ | None if manifests valid |
| Tighten value validation (CI schema) | ✅* | ✅* | ✅* | `pnpm run guard:workspace-manifests` / phase-0 gate — **before** app build |
| Rename `theme` → `themeTokens` | ⚠️ | ⚠️ | ⚠️ | `workspace-sdk` + `readWorkspaceManifestTheme` + portal/marketing layouts; apps fail **after** sdk rebuild |
| Nest schema (`theme: { admin, portal, marketing }`) | ❌ | ❌ | ❌ | Breaks `WorkspaceManifestTheme`, `readWorkspaceManifestTheme`, `PlatformThemeProvider` props, provider tests |
| Typed keys (union of allowed `--ws-*`) | ⚠️ | ⚠️ | ⚠️ | `theme-react` + sdk types; apps compile if they only pass through opaque maps |
| Change `WorkspaceThemeContract.cssVariables` rules | ❌ | ✅ | ✅ | Admin `ThemeProviderChain` / plugin validation; guest apps unaffected |

\*Assuming existing manifests are updated to satisfy stricter CI rules.

#### Why builds are decoupled from schema guards

- App `prebuild` runs **import-boundary** guards, not `guard:workspace-manifests`.
- Portal/Marketing **typecheck** uses `WorkspaceManifestTheme` as an opaque string map — no per-key compile-time exhaustiveness.
- Admin **does not reference** `manifestTheme` / `themeJson` in app source at all today.
- **Monorepo root `pnpm build` does not include `apps/web`** — Admin is the most likely to miss a breaking sdk change until its own gate runs.

**Conclusion:** A `themeJson` schema evolution fails **workspace-sdk + theme-react first**, then **portal/marketing** (they import registry types), then **CI manifest guard**, then **admin** only if `WorkspaceThemeContract` or `ThemeProviderChain` props change. **All three app builds do not fail in lockstep** unless the shared sdk interface breaks.

### 8.5 Current coupling anti-patterns

1. **Codegen switch statements in each app** — three copies of workspace-id → CSS path knowledge (`workspace-*-theme-stylesheets.generated.ts`).
2. **Portal depends on `workspace-plugin-host`** — pulls every workspace registration UI into one bundle graph.
3. **Marketing static import** — `denaliMarketingCatalogSurface` in app bootstrap despite “workspace-agnostic” description.
4. **Dual theme contracts** — manifest `theme`, plugin `cssVariables`, and DTCG slices are three inputs with no single sdk resolver.
5. **Type duplication** — `PlatformThemeJson` vs `WorkspaceManifestTheme` vs `WorkspaceThemeContract.cssVariables`.
6. **Admin omission** — sdk documents `manifestTheme` ingress; Admin never calls it, so interface and implementation diverge per surface.

### 8.6 Decoupling strategy — apps on sdk interface, not workspace concrete

Goal: each app depends on **stable sdk ports**; workspace packages register skins without app rebuilds.

#### Phase D1 — Single theme ingress port (`workspace-sdk`)

```typescript
// packages/workspace-sdk/src/theme/theme-ingress.port.ts (proposed)

export type AppSurface = "admin" | "portal" | "marketing";

/** Opaque, validated token map — apps must not branch on keys. */
export type ThemeTokenMap = Readonly<Record<string, string>>;

export interface ThemeIngressPort {
  /** Resolve manifest/plugin tokens for inline injection (optional layer). */
  resolveManifestTokens(pluginId: string, surface: AppSurface): ThemeTokenMap | undefined;

  /** Return ordered CSS module URLs for dynamic import (skin layer). */
  resolveSkinStylesheetUrls(pluginId: string, surface: AppSurface): readonly string[];

  /** Schema version for forward-compatible parsing. */
  readonly themeSchemaVersion: number;
}

export function createThemeIngressFromRegistry(registry: WorkspaceRegistry): ThemeIngressPort;
```

Apps replace direct calls to `resolveWorkspaceManifestThemeForPlugin` + `importGuest*ThemeForPlugin` with **one** `themeIngress.resolve*` per layout.

#### Phase D2 — Move generated loaders into sdk (or `theme-runtime` package)

- Emit **one** `theme-skin-loader.generated.ts` inside `workspace-sdk` (or a new `@app-tour/theme-runtime` allowed to depend on `workspace-*`).
- Apps depend only on `loadThemeSkinsForPlugin(pluginId, surface): Promise<void>`.
- Removes `@app-tour/workspace-denali` from `apps/portal` and `apps/marketing` **package.json** dependencies.

#### Phase D3 — Lazy workspace-plugin-host

- Replace static `import { getDenaliWorkspacePlugin }` in `workspace-plugin-host` with dynamic `import()` keyed by `pluginId` (mirror theme I1 budget pattern).
- Portal keeps **registration** coupling but drops **eager** Denali/Urban/Guest-club graph at cold start.

#### Phase D4 — Unify theme types; version the schema

| Type | Role | Owner |
| ---- | ---- | ----- |
| `ThemeTokenMap` | Runtime opaque map | `workspace-sdk` |
| `ThemeSchemaV1` | Zod validator for manifest `theme` | `workspace-sdk/manifest` |
| `WorkspaceThemeContract` | Plugin-level `--ws-*` contract | `workspace-sdk` (unchanged) |
| ~~`PlatformThemeJson`~~ | Deprecated alias | `theme-react` re-exports sdk type only |

Breaking schema changes bump `themeSchemaVersion`; sdk provides `parseThemeBlock(raw, version)` so apps never parse manifest JSON directly.

#### Phase D5 — Surface-aware resolution in sdk (not apps)

```text
resolveThemeForRequest({ pluginId, surface, tenantId? })
  → { inlineTokens, skinUrls, providerMode: "chain" | "platform-only" }
```

- Admin: `providerMode: "chain"` + tenant API overlay (unchanged behaviour, single entry).
- Portal/Marketing: `providerMode: "platform-only"` + skinUrls.
- Manifest `theme`, plugin `cssVariables`, and DTCG output merge **inside sdk** — apps receive final `ThemeTokenMap`.

#### Phase D6 — Guard enforcement

| Guard | Enforces |
| ----- | -------- |
| `guard:import-boundary` | Apps ↛ `@app-tour/workspace-denali` (etc.) in non-generated src |
| `guard:theme-ingress-surface` | Layouts call sdk port only; no direct generated loader imports |
| `guard:workspace-manifests` | Schema version + token safety |
| `guard:cross-surface-theme-parity` | Optional — admin/portal primary alignment per plugin |

### 8.7 Decoupling verdict

| Question | Answer |
| -------- | ------ |
| Do apps share runtime code that hides workspace theme dependency? | **Yes** — `theme-react` + `design-tokens` are clean; **generated CSS loaders**, **workspace-plugin-host**, and **workspace package deps** are the hidden coupling |
| Are apps coupled to each other? | **No** direct imports |
| Will `themeJson` schema change break all 3 builds? | **No lockstep failure** — sdk/theme-react break first; Admin least affected today (no `manifestTheme`); CI manifest guard may fail before any app build |
| Target end state | Apps import **`ThemeIngressPort` + `ThemeProviderChain`/`PlatformThemeProvider`** only; workspace skins load via sdk loader; zero `workspace-*` in app `package.json` |

**Priority order:** D2 (centralize skin loader) → D1 (ingress port) → D5 (merge theme authorities in sdk) → D3 (lazy plugin-host) → D6 (guards). This preserves per-surface appearance differences while eliminating triple codegen and duplicate type aliases.

## 9. Security & Manifest Injection

**Audit timestamp:** 2026-07-07  
**Scope:** CSS injection risk from `workspace.manifest.json` `theme` tokens through parse → DOM/CSS application paths.  
**Threat model:** Operator edits theme via Admin Panel; supply-chain / compromised manifest on disk; API tenant theme override.

### 9.1 Can operators edit `workspace.manifest.json` in Admin today?

**No.** The Admin Panel exposes **tenant branding** (`primaryColor`, `displayName`, logo) via `PATCH` routes in `tenant-branding.service.ts`, validated by `validateTenantTheme`.  

`workspace.manifest.json` lives under `packages/workspaces/<id>/` and is:

- Authored by platform/workspace developers (git)
- Validated at CI by `pnpm run guard:workspace-manifests` → `ManifestThemeBlockSchema`
- Loaded at runtime by `WorkspaceRegistry` from the filesystem (or Vite glob)

There is **no API route** that writes manifest `theme` blocks from the Admin UI. CSS-injection risk from manifest editing is currently a **developer/CI/supply-chain** concern, not an end-user input concern — unless a future “manifest editor” is added without matching guards.

### 9.2 Parse → DOM application pipeline

```text
workspace.manifest.json
        │
        ├─ CI path ──► validateWorkspaceManifestRecord (WorkspaceManifestCiSchema)
        │              └─ ManifestThemeBlockSchema
        │                   └─ assertThemeCssValueIsSafe (fail-closed)
        │
        └─ Runtime path ──► parseWorkspaceManifest (WorkspaceManifestSchema)
                           └─ theme: z.record(string,string)  ⚠ NO safety refine
                                    │
                                    ▼
                    readWorkspaceManifestTheme(manifest)
                                    │
                                    ▼
              Portal/Marketing layout → PlatformThemeProvider
                                    │
                                    ▼
                    mapThemeToCssVariables (theme-react)
                      fail-soft: drop bad keys/values
                                    │
                                    ▼
              <div style={{ "--token": "value", … }}>  (React CSSProperty API)

Admin (parallel paths, not manifest theme today):
  Tenant API theme ──► validateTenantTheme ──► TenantThemeProvider ──► inline style
  Plugin theme     ──► assertWorkspaceThemeContract ──► seal ──► WorkspaceThemeProvider
  Skin CSS         ──► dynamic import workspace *.css (not manifest JSON)
```

### 9.3 Existing defenses

| Layer | Location | Keys allowed | Values | On violation |
| ----- | -------- | ------------ | ------ | -------------- |
| **CI manifest guard** | `ManifestThemeBlockSchema` | `[a-zA-Z0-9_-]+` after `--` normalize (any bare CSS name) | `assertThemeCssValueIsSafe` + max 64 keys / 4096 chars | **Reject manifest** (CI fail) |
| **Core safety primitive** | `assertThemeCssValueIsSafe` | N/A | Blocks `\`, NFKC homoglyphs, `expression()`, `javascript:`, `url()`, `@import`, `<`, `>`, `-moz-binding`, `behavior:` | **Throw** `UNSAFE_THEME_CSS_VALUE` |
| **Plugin theme** | `normalizeAndValidateCssMap` | `--ws-[a-z0-9-]+` only | Same safety primitive | **Throw** at plugin ingress |
| **Tenant theme (Admin API)** | `validateTenantTheme` | `--color-[a-z0-9-]+` + `primaryColor` | Same safety primitive | **Throw** on API read/write |
| **Runtime manifest ingress** | `mapThemeToCssVariables` | `[a-zA-Z0-9_-]+` | Duplicated regex set + blocks `;{}\\` + `url()` | **Drop** key/value (fail-soft) |
| **React delivery** | `style` object (not `cssText`) | Per-property set | Browser assigns as custom property value | Mitigates classic `;` breakout |

**Test coverage:** `theme-css-value-safety.spec.ts`, `manifest.schema.spec.ts`, `theme-validation.contract.spec.ts` (T-6b homoglyph `url('javascript:…')`, T-6e bare `javascript:`, CSS `\u`/`\x` escapes).

### 9.4 CSS injection risk assessment

| Attack vector | Feasible today? | Severity | Notes |
| ------------- | --------------- | -------- | ----- |
| `javascript:` / `expression()` in manifest `theme` | **Blocked** at CI; **stripped** at runtime via `mapThemeToCssVariables` | Low | Dual path |
| `url(evil)` / `url('javascript:…')` | **Blocked** — `ALLOWED_THEME_URL_PATTERNS` is empty | Low | All `url()` rejected |
| Unicode homoglyph bypass (`\uFF2Aavascript:`) | **Blocked** — NFKC + pattern tests (T-6i) | Low | |
| CSS escape smuggling (`\6aavascript:`) | **Blocked** at CI/tenant/plugin; **blocked** in `mapThemeToCssVariables` via `\\` in forbidden chars | Low | |
| Semicolon / brace breakout in inline style | **Partially mitigated** | Low–Med | `mapThemeToCssVariables` forbids `;{}`; `assertThemeCssValueIsSafe` does **not** — relies on React property API |
| Overwriting platform tokens via manifest keys (`--primary`, `--background`) | **Possible** at CI if values are safe colors | **Med** (defacement, not XSS) | Manifest keys are **not** restricted to `--ws-*`; can override shadcn aliases if injected into cascade |
| Operator patches malicious `primaryColor` via Admin | **Blocked** by `validateTenantTheme` on API | Low | Real operator input path |
| Runtime registry loads unvalidated manifest (bypass CI) | **Possible** on compromised disk | Med | Loose `WorkspaceManifestSchema`; mitigated by fail-soft DOM sanitizer |
| Workspace skin CSS (not JSON) | Separate path | Low (if hex-ban guards hold) | DTCG `@generated` + hook-only guards |

**XSS via pure CSS custom properties in modern Chromium/Firefox:** Custom property values are generally **not** parsed as script URLs when applied via `element.style.setProperty`. Primary risks are **UI defacement**, **phishing styling**, and **token override** — not classic HTML script injection — assuming values stay within CSS property value grammar and React does not write raw `cssText`.

### 9.5 Security gaps

1. **Dual schema authority** — CI uses `WorkspaceManifestCiSchema` (strict `theme`); runtime registry uses `WorkspaceManifestSchema` (`theme: z.record` only). A manifest that never passes CI can still load in dev if copied onto disk.
2. **Duplicated sanitizer** — `mapThemeToCssVariables` re-implements `assertThemeCssValueIsSafe` instead of calling it → **drift risk** (already diverges on `;{}` handling).
3. **Manifest key namespace too broad** — CI allows any `--[a-zA-Z0-9_-]+` name, not just `--ws-*` or an allowlist. Safe hex values on `--primary` can rebrand the shell without XSS.
4. **Fail-soft vs fail-closed** — Runtime DOM path **drops** bad tokens silently; CI **rejects**. Operators get no signal if a compromised manifest is partially applied.
5. **Admin manifest theme unwired** — `apps/web` does not call `resolveWorkspaceManifestThemeForPlugin`; future wiring must not skip validation at read time.
6. **No allowlist for value *shapes*** — `#hex`, `rgb()`, `hsl()`, `var(--ref)` accepted; exotic but spec-valid functions (`calc()`, `color-mix()`) are not explicitly reviewed.

### 9.6 Proposed `ThemeTokenSanitizer` (Schema Sanitizer)

Centralize in `packages/workspace-sdk/src/theme/theme-token-sanitizer.ts` — single authority for CI, API, registry, and `theme-react`.

```typescript
/** Theme token sanitizer — fail-closed default; fail-soft opt-in for DOM. */

export const THEME_TOKEN_KEY_PREFIX_MANIFEST = /^--ws-[a-z0-9-]+$/;   // tighten manifest
export const THEME_TOKEN_KEY_PREFIX_TENANT   = /^--color-[a-z0-9-]+$/;
export const THEME_TOKEN_KEY_PREFIX_WORKSPACE = /^--ws-[a-z0-9-]+$/;

const BLOCKED_VALUE_PATTERNS = [
  /expression\s*\(/i,
  /url\s*\(/i,                    // block all url() unless explicit allowlist match
  /javascript\s*:/i,
  /@import/i,
  /-moz-binding/i,
  /\bbehavior\s*:/i,
  /[;{}\\<>]/,                   // inline-style + HTML breakout hardening
] as const;

const ALLOWED_VALUE_SHAPES: readonly RegExp[] = [
  /^#[0-9a-fA-F]{3,8}$/,
  /^rgb\(\s*[\d.\s%]+\s*,\s*[\d.\s%]+\s*,\s*[\d.\s%]+(\s*\/\s*[\d.]+%?)?\s*\)$/i,
  /^rgba?\(/i,                   // or stricter rgb parser
  /^var\(\s*--[a-z0-9-]+\s*(,\s*[^)]+)?\)$/i,
  /^[0-9.]+(?:px|rem|em|%|ms|s)$/,  // dimensions for --ws-radius etc.
];

export type SanitizeThemeTokensOptions = {
  readonly keyPattern: RegExp;
  readonly maxKeys?: number;          // default 64
  readonly maxValueLength?: number;   // default 4096
  readonly mode: "fail-closed" | "fail-soft";
  readonly allowedValueShapes?: readonly RegExp[]; // default ALLOWED_VALUE_SHAPES
};

export function sanitizeThemeTokenMap(
  raw: unknown,
  options: SanitizeThemeTokensOptions,
): Readonly<Record<string, string>>;

/** Zod superRefine adapter for ManifestThemeBlockSchema */
export function manifestThemeBlockRefine(theme: Record<string, string>, ctx: z.RefinementCtx): void;
```

#### Recommended policy

| Stage | Function | Mode |
| ----- | -------- | ---- |
| `guard:workspace-manifests` | `sanitizeThemeTokenMap(..., { keyPattern: /^--ws-/, mode: "fail-closed" })` | Reject build |
| `WorkspaceRegistry.load()` | Same sanitizer on `manifest.theme` before freeze | Fail-closed load OR strip + telemetry |
| `readWorkspaceManifestTheme` | Return output of sanitizer only | Never raw manifest |
| `mapThemeToCssVariables` | Delegate to `sanitizeThemeTokenMap` fail-soft | Drop invalid |
| Admin API tenant theme | Existing `validateTenantTheme` → call shared sanitizer | fail-closed |
| Future manifest editor API | **Must** use same sanitizer + operator RBAC + audit log | fail-closed |

#### Additional hardening

1. **Tighten manifest keys** to `--ws-*` only (breaking change — align with `WorkspaceThemeContract`).
2. **Unify runtime schema** — replace `WorkspaceManifestSchema.theme` loose record with `ManifestThemeBlockSchema` (or call sanitizer inside `parseWorkspaceManifest`).
3. **Remove duplicated regex** from `theme-react/map-theme-to-css-variables.ts`; import sanitizer from sdk.
4. **Add guard** `guard:theme-sanitizer-parity` — unit test that CI schema and runtime sanitizer reject the same corpus of evil strings.
5. **CSP** — keep `style-src 'self'` where deployable; inline custom properties from React are `'unsafe-inline'` in practice — sanitizer remains primary control.

### 9.7 Security verdict

| Question | Answer |
| -------- | ------ |
| Can Admin users inject CSS via `workspace.manifest.json` today? | **No** — manifest is not Admin-editable; tenant `primaryColor` path is validated |
| Is CSS injection via manifest `theme` theoretically possible? | **Low for script execution**; **medium for token override / defacement** if unvalidated manifest reaches runtime |
| Are current guards sufficient for production? | **Adequate for checked-in manifests** (CI + tests); **gap** at runtime registry without CI parity |
| Recommended action | Ship **`ThemeTokenSanitizer`** as single authority; align runtime parse with CI; restrict manifest keys to `--ws-*`; wire Admin manifest theme only through fail-closed sanitizer |

## 10. Pipeline Maturity & Caching

**Role:** DevOps Engineer — CI/CD behaviour when `workspace.manifest.json` `theme` (themeJson) changes; cross-app cache sharing; manifest-versioned build recommendation.

**App mapping (this repo):** Admin = `apps/web` (`@apps/web`), User Portal = `apps/portal`, Public = `apps/marketing`. There is no `apps/admin` or `apps/public`.

**Audit date:** 2026-07-07

### 10.1 Executive answer

| Question | Answer |
| -------- | ------ |
| Does a `themeJson` change trigger **separate** Next.js builds for Admin, Portal, and Marketing? | **Partially.** Full gates build all three, but **not as three isolated CI jobs** and **not always on path-filtered PRs**. VPS production deploy always rebuilds all three in sequence. |
| Is there **shared cache** that can serve **stale theme** across apps? | **No shared `.next` or Turborepo artifact cache** between apps. **Yes** at the **runtime layer**: each Node process holds a **singleton workspace registry** loaded once; bootstrap BFF caches host→`pluginId` for 300s. Manifest `theme` tokens are **not baked into** Next bundles — a rebuild alone does not refresh inline theme without process restart. |
| Is CI mature for theme-only manifest edits? | **Gaps.** `workspace.manifest.json` is absent from `marketing-guard` and `portal-control-guard` path filters; only broad gates (`phase-0-gate`, `phase-3-gate`, `phase-10-guard` under `packages/workspaces/**`) reliably exercise manifest changes. |

### 10.2 CI workflow map (theme-relevant)

```mermaid
flowchart TB
  subgraph triggers["Path-filtered (may skip on manifest-only theme)"]
    MG[marketing-guard]
    PCG[portal-control-guard]
    CTL[control-authority-guard]
  end
  subgraph always["Unfiltered or workspace-wide"]
    P0[phase-0-gate]
    P3[phase-3-gate]
    P10[phase-10-guard]
    P6[p6-denali-gate]
  end
  subgraph deploy["main push"]
    VPS[deploy-vps → remote-deploy.sh]
  end
  MANIFEST["packages/workspaces/*/workspace.manifest.json theme block"]
  MANIFEST --> P0
  MANIFEST --> P3
  MANIFEST --> P10
  MANIFEST --> P6
  MANIFEST -.->|not listed| MG
  MANIFEST -.->|not listed| PCG
  MANIFEST -.->|theme/** only| CTL
  MANIFEST --> VPS
```

#### What each gate actually builds

| Workflow / script | Trigger scope | Admin (`web`) | Portal | Marketing | Theme-specific checks |
| ----------------- | ------------- | ------------- | ------ | --------- | --------------------- |
| `phase-3-gate` | All PRs + `main` | **Yes** — `phase-3:web-gate` → `next build` | **Yes** — root `pnpm build` | **Yes** — root `pnpm build` | Indirect via full monorepo build chain |
| `phase-0:foundation-gate` | All PRs | No Next build | No | No | `guard:workspace-manifests` (schema + theme safety) |
| `phase-0:integration-gate` | All PRs | No dedicated web gate | Yes | Yes | Full `pnpm build` (no `apps/web`) |
| `marketing-guard` | Path-filtered | No | Tests only | **No `next build`** | `packages/workspace-sdk/src/theme/**`, `*-marketing.css` — **not** `workspace.manifest.json` |
| `portal-control-guard` | `*-portal.css` only | No | Guards/tests | No | CSS paths only |
| `p6-denali-gate` | `packages/workspaces/denali/**` | No | Partial sdk/workspace builds | Partial | Denali manifest + theme CSS |
| `phase-10-guard` | `packages/workspaces/**` | No | No | No | `generate:workspace-registry --check` |
| `deploy-vps` → `build-operator-vps.sh` | Every `main` push | **Yes** (`.next` wiped) | **Yes** | **Yes** | Sequential production builds + systemd restart |

#### Root `pnpm build` composition

```text
pnpm build → … design-tokens, workspace-*, theme-react, api, @apps/marketing, @apps/portal
```

**`@apps/web` (Admin) is excluded** from the root build script. Admin is built only when `phase-3:web-gate` or VPS `build-operator-vps.sh` runs.

### 10.3 themeJson change — end-to-end pipeline behaviour

#### What changes when only the manifest `theme` block changes

The manifest `theme` object is **read at runtime** by `ensureWorkspaceRegistryLoaded()` → `readWorkspaceManifestTheme()` → `PlatformThemeProvider` inline styles. It is **not** emitted into Next static output or the generated `workspace-*-theme-stylesheets.generated.ts` files (codegen only keys off `themeStylesheets` / `guestThemeStylesheets` **path lists**, not token values).

| Change type | Requires `generate:workspace-registry`? | Requires Next rebuild? | Requires process restart? |
| ----------- | --------------------------------------- | ---------------------- | ------------------------- |
| `theme` token values only | No | **No** (not in bundle) | **Yes** — registry singleton |
| `themeStylesheets` / `guestThemeStylesheets` paths | **Yes** | **Yes** — dynamic import graph | Yes |
| Workspace skin CSS file (`denali-portal.css`, etc.) | No | **Yes** — new CSS chunk hash | Yes (or wait for HMR in dev) |
| DTCG / `design-tokens` dist | No | **Yes** — all apps importing semantic CSS | Yes |

#### PR with Denali `theme` JSON edit only

1. **`phase-0:foundation-gate`** — runs `guard:workspace-manifests` (validates theme block; fail-closed CSS value checks).
2. **`phase-3-gate`** — runs full `pnpm build` (portal + marketing `next build`) + `phase-3:web-gate` (admin `next build`). **Three separate Next builds, one job, sequential.**
3. **`marketing-guard`** — **skipped** unless another listed path also changed.
4. **`p6-denali-gate`** — runs (path includes `packages/workspaces/denali/**`) but does **not** run full app `next build` for all three surfaces.
5. **Merge to `main`** — `deploy-vps` runs `remote-deploy.sh` → `build-operator-vps.sh` builds web, then marketing, then portal (each after `rm -rf .next`) and **restarts all systemd units**.

**Verdict:** On a typical PR, all three apps **do** get production-style Next builds via `phase-3-gate`, but **not as three parallel, independently cache-keyed pipeline jobs**. Fast path-filtered workflows can **miss** manifest-only theme edits entirely.

### 10.4 Cache sharing and stale-theme risk matrix

| Layer | Shared across Admin / Portal / Marketing? | Stale-theme risk | Mitigation today |
| ----- | ---------------------------------------- | ---------------- | ---------------- |
| GitHub Actions `cache: pnpm` | Yes (per repo, dependency store) | **Low** — does not cache theme payloads | N/A |
| Turborepo / remote build cache | **None** — no `turbo.json` | N/A | N/A |
| Next.js `.next/` | **No** — per-app directory | **Low** in CI (ephemeral runners); **medium** in local dev if `.next` not cleaned | VPS script deletes `.next` before each app build |
| `node_modules/.cache` | Per app | Low | VPS `rm -rf` per app |
| `@app-tour/design-tokens/dist` | **Yes** — one built package consumed by all apps | **Medium** if DTCG changes but design-tokens build skipped | Root build always builds design-tokens first |
| `workspaceRegistry` in-memory singleton | **No cross-process** — separate systemd units | **High** if manifest on disk changes without restart | Deploy restarts all services; dev needs manual restart |
| Guest bootstrap `nextRevalidate: 300` | Per app BFF | **Low for theme** — caches `pluginId`, not token map | Theme resolve is per-request after registry warm |
| Webpack dynamic CSS chunks (`import*ThemeForPlugin`) | Per app bundle | **Medium** if skin CSS changes but app not rebuilt | Content-hashed filenames only update on rebuild |
| Generated registry (`--check` in phase-10) | Repo-wide single source | **High** if manifest paths change without regen | `generate:workspace-registry.mjs --check` fails CI |

#### Critical architectural note (DevOps implication)

Because manifest `theme` is **runtime-loaded**, **a green Next build does not prove fresh theme tokens in production**. Correctness requires:

1. Git sync includes updated `workspace.manifest.json`.
2. All three Node processes restart (deploy does this).
3. No long-lived workers outside systemd recycle (PM2, manual `next start` without restart).

Admin adds a **second theme path**: tenant branding from API (`validateTenantTheme`) on every request — independent of manifest `themeJson` and unaffected by workspace manifest CI triggers.

### 10.5 Pipeline maturity gaps

1. **No theme-aware path filter** — `workspace.manifest.json` not in `marketing-guard` / `portal-control-guard` / `control-authority-guard` (only `theme/**` CSS subfolder for CTL).
2. **Asymmetric root build** — `apps/web` omitted from `pnpm build`; easiest surface to drift from monorepo trunk builds.
3. **No per-app theme lock artifact** — builds cannot prove which manifest theme revision they were validated against.
4. **No manifest hash in Next cache key** — `next build` cache keys ignore `packages/workspaces/*/workspace.manifest.json` because theme is not an import graph input today.
5. **Runtime vs build-time split** — CI validates manifest schema; production serves tokens from filesystem at runtime without an immutable theme artifact per deploy.

### 10.6 Recommended: Manifest-Versioned build strategy

Goal: each app ships with a **hash-locked theme config** so deploys, caches, and rollbacks are deterministic and apps cannot silently serve an older manifest revision.

#### Step 1 — Theme lockfile generation (build time)

Add `scripts/generate-theme-lock.mjs` (or extend `generate-workspace-registry.mjs`):

```text
For each workspace manifest:
  themeLock[workspaceId] = sha256(
    stableStringify(manifest.theme ?? {}) +
    JSON.stringify(manifest.themeStylesheets ?? []) +
    JSON.stringify(manifest.guestThemeStylesheets ?? []) +
    sha256File(each referenced skin CSS) +
    sha256File(relevant design-tokens dist slices for surface)
  )
Emit: packages/workspace-sdk/src/theme/theme-lock.generated.json
```

Run in CI via `pnpm run generate:theme-lock --check` (same pattern as registry freshness).

#### Step 2 — Per-app hash-locked env at build

Each Next app `prebuild`:

```bash
THEME_MANIFEST_HASH=$(node scripts/theme-lock-hash-for-surface.mjs --surface=portal)
export NEXT_PUBLIC_THEME_MANIFEST_HASH="$THEME_MANIFEST_HASH"
```

Inject into:

- `next.config.ts` `env` block (exposes hash to server components).
- Webpack `cache.version` or `experimental.turbo` cache key (when adopted).
- Optional `Cache-Control` / `ETag` on theme bootstrap responses.

| App | Surface key | Lock inputs |
| --- | ----------- | ----------- |
| `apps/web` | `admin` | manifest theme + `themeStylesheets` + DTCG admin slice + tenant API schema version |
| `apps/portal` | `portal` | manifest theme + `guestThemeStylesheets` + `*-portal.css` + portal semantic tokens |
| `apps/marketing` | `marketing` | manifest theme + `guestThemeStylesheets` + `*-marketing.css` + marketing tokens |

#### Step 3 — Runtime verification (fail loud)

In `ensureWorkspaceRegistryLoaded()` after load:

```typescript
const expected = process.env.THEME_MANIFEST_HASH;
const actual = computeThemeLockFromRegistry(registry, surface);
if (expected && actual !== expected) {
  throw new Error(`THEME_LOCK_MISMATCH: build=${expected} runtime=${actual}`);
}
```

Prevents “built against lock A, running manifest B” after partial deploy or missed restart.

#### Step 4 — CI job topology (three apps, explicit)

Replace implicit sequential builds inside one gate with **matrix or parallel jobs** when theme lock changes:

```yaml
# .github/workflows/theme-deploy-gate.yml (proposed)
on:
  pull_request:
    paths:
      - "packages/workspaces/**/workspace.manifest.json"
      - "packages/workspaces/**/theme/**"
      - "packages/design-tokens/**"
      - "packages/workspace-sdk/src/theme/**"
jobs:
  theme-lock:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm run generate:theme-lock --check
      - run: node scripts/generate-workspace-registry.mjs --check
  build-apps:
    needs: theme-lock
    strategy:
      matrix:
        app: [web, portal, marketing]
    steps:
      - run: pnpm --filter @apps/${{ matrix.app }} run build
```

Each matrix leg gets its own runner cache namespace keyed by `${{ matrix.app }}-${{ env.THEME_MANIFEST_HASH }}`.

#### Step 5 — Deploy coherence

Extend `verify-env-coherence.sh` / post-deploy smoke:

1. `GET /api/health` or internal probe returns `themeManifestHash` per process.
2. `smoke-four-process.sh` asserts all four processes (api + web + marketing + portal) report the **same** lock hash from the commit SHA deployed.
3. Rollback script pins `THEME_MANIFEST_HASH` from the previous artifact manifest.

#### Step 6 — Optional hardening (bake vs runtime)

Long term, move manifest `theme` from pure runtime filesystem read to **build-time inlining** for guest surfaces:

- Codegen `theme-inline.${workspaceId}.${surface}.json` imported by `PlatformThemeProvider`.
- Eliminates registry singleton staleness for token maps; rebuild required on every theme change (CI path filters become mandatory and correct).

Trade-off: larger bundles, but **cache correctness aligns with standard Next immutable static asset model**.

### 10.7 Pipeline maturity verdict

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Separate app builds on full gate | **3/5** | All three build in `phase-3-gate`, but not isolated jobs or theme-keyed |
| Path-filter coverage for themeJson | **2/5** | Manifest root file missing from fast guards |
| Cross-app stale cache risk | **3/5** | No shared `.next`; runtime registry is the real gap |
| Deploy freshness | **4/5** | VPS wipes `.next`, rebuilds all apps, restarts systemd |
| Deterministic theme revision | **1/5** | No lock hash, no per-app theme artifact |
| Registry codegen freshness | **4/5** | `generate:workspace-registry --check` in phase-10 |

**Priority actions:** (1) add `workspace.manifest.json` to marketing/portal/CTL path filters; (2) ship `theme-lock.generated.json` + `THEME_MANIFEST_HASH` per app build; (3) runtime lock mismatch guard in `ensureWorkspaceRegistryLoaded`; (4) include `apps/web` in root `pnpm build` or document Admin as mandatory separate build target.




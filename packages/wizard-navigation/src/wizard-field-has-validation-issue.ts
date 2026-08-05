/**
 * True when a validation issue targets this field's canonical path
 * (exact match or a nested path under it).
 */
export function wizardFieldHasValidationIssue(
  canonicalPath: string,
  issues: readonly { readonly path: string }[] | readonly string[]
): boolean {
  if (canonicalPath.length === 0 || issues.length === 0) {
    return false;
  }
  for (const issue of issues) {
    const path = typeof issue === "string" ? issue : issue.path;
    if (path === canonicalPath) {
      return true;
    }
    if (path.startsWith(`${canonicalPath}.`) || path.startsWith(`${canonicalPath}[`)) {
      return true;
    }
  }
  return false;
}

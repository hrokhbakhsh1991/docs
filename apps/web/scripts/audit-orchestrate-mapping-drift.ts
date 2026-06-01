import fs from 'node:fs';
import { denaliTourCreateBaseSchema } from '@repo/denali-domain';

type AnySchema = { def?: unknown; _def?: unknown; shape?: unknown };
type SchemaDef = {
  type?: string;
  innerType?: unknown;
  out?: unknown;
  schema?: unknown;
  shape?: Record<string, unknown>;
  element?: unknown;
};

function getDef(s: AnySchema): SchemaDef {
  const candidate = s.def ?? s._def;
  if (candidate != null && typeof candidate === 'object') return candidate as SchemaDef;
  return {};
}

function unwrap(schema: unknown): unknown {
  let cur = schema;
  while (cur) {
    const d = getDef(cur as AnySchema);
    const t = d.type;
    if (t === 'optional' || t === 'nullable' || t === 'default' || t === 'catch') { cur = d.innerType; continue; }
    if (t === 'pipe') { cur = d.out; continue; }
    if (t === 'transform') { cur = d.schema; continue; }
    return cur;
  }
  return schema;
}

function getShape(schema: unknown): Record<string, unknown> | null {
  const s = unwrap(schema); const d = getDef(s as AnySchema);
  if (d.type === 'object' && d.shape) return d.shape;
  if ((s as AnySchema).shape && typeof (s as AnySchema).shape === 'object') {
    return (s as AnySchema).shape as Record<string, unknown>;
  }
  return null;
}

function getArrayElement(schema: unknown): unknown | null {
  const s = unwrap(schema); const d = getDef(s as AnySchema);
  if (d.type === 'array') return d.element;
  return null;
}

function collectFormPaths(schema: unknown, base = ''): string[] {
  const out: string[] = [];
  if (base) out.push(base);
  const shape = getShape(schema);
  if (shape) {
    for (const key of Object.keys(shape)) {
      const next = base ? `${base}.${key}` : key;
      out.push(...collectFormPaths(shape[key], next));
    }
    return out;
  }
  const el = getArrayElement(schema);
  if (el) {
    const es = getShape(el);
    if (es) {
      for (const key of Object.keys(es)) {
        const next = base ? `${base}.${key}` : key;
        out.push(...collectFormPaths(es[key], next));
      }
    }
  }
  return out;
}

function uniq(xs: string[]): string[] { return [...new Set(xs)].sort((a,b)=>a.localeCompare(b)); }

function extractCandidatePaths(src: string): string[] {
  const candidates: string[] = [];

  // dotted string literals in function body
  for (const m of src.matchAll(/["'`]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_\[\]]+)+)["'`]/g)) {
    candidates.push(m[1]);
  }

  // direct data.form accesses
  for (const m of src.matchAll(/data\.form\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g)) {
    candidates.push(m[1]);
  }

  // common explicit paths in extract logic
  for (const m of src.matchAll(/\b(form|data|template)\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g)) {
    const p = m[2];
    if (p.includes('.')) candidates.push(p);
  }

  return uniq(candidates.filter(Boolean));
}

const orchestratePath = '/home/hamed/Music/docs/apps/web/src/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate.ts';
const src = fs.readFileSync(orchestratePath, 'utf8');
const allFormPaths = uniq(collectFormPaths(denaliTourCreateBaseSchema));
const formSet = new Set(allFormPaths);

// keep only mapping-ish paths likely related to form hydration
const mappingPaths = extractCandidatePaths(src).filter((p) =>
  p.startsWith('basicInfo.') ||
  p.startsWith('programNature.') ||
  p.startsWith('transport.') ||
  p.startsWith('pricingPayment.') ||
  p.startsWith('participantRequirements.') ||
  p.startsWith('policies.') ||
  p.startsWith('photosData.') ||
  p.startsWith('tripDetails.')
);

const stale = mappingPaths.filter((p) => !formSet.has(p));

const lines: string[] = [];
lines.push('');
lines.push('---');
lines.push('');
lines.push(`## Orchestrate Mapping Drift Audit (${new Date().toISOString()})`);
lines.push('');
lines.push('Source: `apps/web/src/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate.ts`');
lines.push('');
lines.push('### Hardcoded / manually mapped form paths found');
lines.push('');
if (mappingPaths.length === 0) {
  lines.push('- (none found; orchestrator delegates to factory without direct field-by-field mapping)');
} else {
  for (const p of mappingPaths) lines.push(`- ${p}${formSet.has(p) ? '' : ' [STALE_MAPPING]'}`);
}
lines.push('');
lines.push('### Mismatched Field');
lines.push('');
if (stale.length === 0) {
  lines.push('- (none)');
} else {
  for (const p of stale) lines.push(`- ${p} [STALE_MAPPING]`);
}
lines.push('');

const target = '/home/hamed/Music/docs/structural-drift-report.md';
const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\n+$/, '') : '';
fs.writeFileSync(target, `${existing}${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${target}`);
console.log(`mappingPaths=${mappingPaths.length}, stale=${stale.length}`);

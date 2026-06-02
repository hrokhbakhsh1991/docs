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

function extractAccessedFormPaths(src: string): string[] {
  const out: string[] = [];
  // direct form.foo.bar
  for (const m of src.matchAll(/\bform\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g)) out.push(m[1]);
  // explicit sections assigned from form and then accessed
  for (const m of src.matchAll(/\bconst\s+(\w+)\s*=\s*form\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g)) {
    const alias = m[1];
    const root = m[2];
    const re = new RegExp(`\\b${alias}\\.([A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)*)`, 'g');
    for (const a of src.matchAll(re)) out.push(`${root}.${a[1]}`);
  }
  // function calls with form.something as arg
  for (const m of src.matchAll(/\((?:[^()]*?)form\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)(?:[^()]*?)\)/g)) out.push(m[1]);
  return uniq(out);
}

const savePath = '/home/hamed/Music/docs/packages/types/src/denali/denaliCanonicalFromForm.ts';
const src = fs.readFileSync(savePath, 'utf8');

const wizardPaths = uniq(collectFormPaths(denaliTourCreateBaseSchema));
const wizardSet = new Set(wizardPaths);
const extracted = extractAccessedFormPaths(src);
const stale = extracted.filter((p) => !wizardSet.has(p));

const lines: string[] = [];
lines.push('');
lines.push('---');
lines.push('');
lines.push(`## denaliCanonicalFromForm Save Logic Audit (${new Date().toISOString()})`);
lines.push('');
lines.push('Source: `packages/types/src/denali/denaliCanonicalFromForm.ts`');
lines.push('');
lines.push('### Extracted form paths read for DB payload');
lines.push('');
for (const p of extracted) {
  lines.push(`- ${p}${wizardSet.has(p) ? '' : ' [STALE_SAVE_LOGIC]'}`);
}
if (extracted.length === 0) lines.push('- (none)');
lines.push('');
lines.push('### Logic mode');
lines.push('');
lines.push('- Manual reconstruction from form slices and helper transforms (not schema-driven introspection at runtime).');
lines.push('');
lines.push('### Mismatched Field');
lines.push('');
if (stale.length === 0) lines.push('- (none)');
else for (const p of stale) lines.push(`- ${p} [STALE_SAVE_LOGIC]`);
lines.push('');

const target = '/home/hamed/Music/docs/structural-drift-report.md';
const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\n+$/, '') : '';
fs.writeFileSync(target, `${existing}${lines.join('\n')}\n`, 'utf8');

console.log(`Wrote ${target}`);
console.log(`extracted=${extracted.length}, stale=${stale.length}`);

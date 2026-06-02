import fs from 'node:fs';
import { denaliTourCreateBaseSchema, DENALI_FIELD_DEFINITIONS } from '@repo/denali-domain';

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
  if (candidate != null && typeof candidate === 'object') {
    return candidate as SchemaDef;
  }
  return {};
}

function unwrap(schema: unknown): unknown {
  let cur = schema;
  while (cur) {
    const d = getDef(cur as AnySchema);
    const t = d.type;
    if (t === 'optional' || t === 'nullable' || t === 'default' || t === 'catch') {
      cur = d.innerType;
      continue;
    }
    if (t === 'pipe') {
      cur = d.out;
      continue;
    }
    if (t === 'transform') {
      cur = d.schema;
      continue;
    }
    return cur;
  }
  return schema;
}

function getShape(schema: unknown): Record<string, unknown> | null {
  const s = unwrap(schema);
  const d = getDef(s as AnySchema);
  if (d.type === 'object' && d.shape) {
    return d.shape;
  }
  if ((s as AnySchema).shape && typeof (s as AnySchema).shape === 'object') {
    return (s as AnySchema).shape as Record<string, unknown>;
  }
  return null;
}

function getArrayElement(schema: unknown): unknown | null {
  const s = unwrap(schema);
  const d = getDef(s as AnySchema);
  if (d.type === 'array') {
    return d.element;
  }
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

  const arrEl = getArrayElement(schema);
  if (arrEl) {
    const arrShape = getShape(arrEl);
    if (arrShape) {
      for (const key of Object.keys(arrShape)) {
        const next = base ? `${base}.${key}` : key;
        out.push(...collectFormPaths(arrShape[key], next));
      }
    }
  }

  return out;
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs)].sort((a,b)=>a.localeCompare(b));
}

const wizardPaths = uniq(collectFormPaths(denaliTourCreateBaseSchema));
const registryPaths = uniq(DENALI_FIELD_DEFINITIONS.map((d) => d.rhfPath));

const wizardSet = new Set(wizardPaths);
const registrySet = new Set(registryPaths);

const formOnly = wizardPaths.filter((p) => !registrySet.has(p));
const registryOnly = registryPaths.filter((p) => !wizardSet.has(p));

const lines: string[] = [];
lines.push('');
lines.push('---');
lines.push('');
lines.push(`## Structural Drift: Form vs Registry (${new Date().toISOString()})`);
lines.push('');
lines.push('### Form Paths Missing in Registry');
lines.push('');
if (formOnly.length === 0) lines.push('- (none)');
else for (const p of formOnly) lines.push(`- ${p} [FORM_ONLY]`);
lines.push('');
lines.push('### Registry Paths Missing in Form');
lines.push('');
if (registryOnly.length === 0) lines.push('- (none)');
else for (const p of registryOnly) lines.push(`- ${p} [REGISTRY_ONLY]`);
lines.push('');
lines.push('### Mismatched Field');
lines.push('');
if (formOnly.length === 0 && registryOnly.length === 0) lines.push('- (none)');
else {
  for (const p of formOnly) lines.push(`- ${p} [FORM_ONLY]`);
  for (const p of registryOnly) lines.push(`- ${p} [REGISTRY_ONLY]`);
}
lines.push('');

const target = '/home/hamed/Music/docs/structural-drift-report.md';
const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\n+$/, '') : '';
fs.writeFileSync(target, `${existing}${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${target}`);
console.log(`formOnly=${formOnly.length}, registryOnly=${registryOnly.length}`);

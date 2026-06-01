import fs from 'node:fs';
import { DataSource } from 'typeorm';
import { denaliTourCreateBaseSchema } from '@repo/denali-domain';
import { createDataSourceOptionsFromEnv } from '../database/database.config';

type AnySchema = { def?: unknown; _def?: unknown; shape?: unknown };
type SchemaDef = {
  type?: string;
  innerType?: unknown;
  out?: unknown;
  schema?: unknown;
  shape?: Record<string, unknown>;
  element?: unknown;
};

type Row = { id: string; workspace_id: string; canonical_data: unknown };

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
  if ((s as AnySchema).shape && typeof (s as AnySchema).shape === 'object') return (s as AnySchema).shape as Record<string, unknown>;
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

function collectCanonicalPaths(value: unknown, base = ''): string[] {
  const out: string[] = [];
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    if (base) out.push(base);
    for (const item of value) out.push(...collectCanonicalPaths(item, base));
    return out;
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (base) out.push(base);
    for (const [k,v] of Object.entries(rec)) {
      const next = base ? `${base}.${k}` : k;
      out.push(next);
      out.push(...collectCanonicalPaths(v, next));
    }
    return out;
  }
  if (base) out.push(base);
  return out;
}

function uniq(xs: string[]): string[] { return [...new Set(xs)].sort((a,b)=>a.localeCompare(b)); }

async function main() {
  const ds = new DataSource(createDataSourceOptionsFromEnv());
  await ds.initialize();
  try {
    const rows = await ds.query<Row[]>(`SELECT id, workspace_id, canonical_data FROM workspace_tour_wizard_templates ORDER BY random() LIMIT 3`);

    const formPaths = uniq(collectFormPaths(denaliTourCreateBaseSchema));
    const formSet = new Set(formPaths);

    const section: string[] = [];
    section.push('');
    section.push('---');
    section.push('');
    section.push(`## DB Canonical Drift Sample (3 random rows) (${new Date().toISOString()})`);
    section.push('');

    const aggregateStale: string[] = [];

    for (const row of rows) {
      const canonical = row.canonical_data && typeof row.canonical_data === 'object' ? row.canonical_data : {};
      const dbPaths = uniq(collectCanonicalPaths(canonical));
      const stale = dbPaths.filter((p) => !formSet.has(p));
      aggregateStale.push(...stale);

      section.push(`### Row \`${row.id}\` (workspace: \`${row.workspace_id}\`)`);
      section.push('');
      section.push('DB canonical paths:');
      for (const p of dbPaths) section.push(`- ${p}`);
      section.push('');
      section.push('Stale vs current Form:');
      if (stale.length === 0) {
        section.push('- (none)');
      } else {
        for (const p of stale) section.push(`- ${p} [STALE_DB_DATA]`);
      }
      section.push('');
    }

    const uniqStale = uniq(aggregateStale);
    section.push('### Mismatched Field');
    section.push('');
    if (uniqStale.length === 0) section.push('- (none)');
    else for (const p of uniqStale) section.push(`- ${p} [STALE_DB_DATA]`);
    section.push('');

    const target = '/home/hamed/Music/docs/structural-drift-report.md';
    const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\n+$/, '') : '';
    fs.writeFileSync(target, `${existing}${section.join('\n')}\n`, 'utf8');

    console.log(`Wrote ${target}`);
    console.log(`rows=${rows.length}, stale=${uniqStale.length}`);
  } finally {
    await ds.destroy();
  }
}

void main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; });

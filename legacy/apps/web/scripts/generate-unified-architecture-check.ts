import fs from 'node:fs';
import path from 'node:path';

const repo = '/home/hamed/Music/docs';

const read = (p: string) => fs.readFileSync(path.join(repo, p), 'utf8');

function uniq(xs: string[]): string[] {
  return [...new Set(xs)].sort((a,b)=>a.localeCompare(b));
}

function extractObjectKeysBlock(src: string, marker: string): string[] {
  const i = src.indexOf(marker);
  if (i < 0) return [];
  const braceStart = src.indexOf('{', i);
  if (braceStart < 0) return [];
  let depth = 0;
  let j = braceStart;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { j++; break; }
    }
  }
  const block = src.slice(braceStart + 1, j - 1);
  const out: string[] = [];
  const re = /^\s*([A-Za-z0-9_]+):/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(m[1]);
  return out;
}

function wizardSchemaPaths(): string[] {
  const core = read('packages/denali-domain/src/schemas/denaliCore.schema.generated.ts');
  const logi = read('packages/denali-domain/src/schemas/denaliLogistics.schema.generated.ts');
  const pric = read('packages/denali-domain/src/schemas/denaliPricing.schema.generated.ts');

  const bi = extractObjectKeysBlock(core, 'export const denaliBasicInfoSchema = z.object(').map(k=>`basicInfo.${k}`);
  const pn = extractObjectKeysBlock(core, 'export const denaliProgramNatureSchema = z.object(').map(k=>`programNature.${k}`);
  const ph = extractObjectKeysBlock(core, 'export const denaliPhotosSchema = z.object(').map(k=>`photosData.${k}`);
  const tm = extractObjectKeysBlock(core, 'export const denaliTripDetailsMetricsSchema = z.object(').map(k=>`tripDetails.metrics.${k}`);
  const toCore = extractObjectKeysBlock(core, 'export const denaliTripDetailsOverviewCoreSchema = z.object(').map(k=>`tripDetails.overview.${k}`);

  const tr = extractObjectKeysBlock(logi, 'export const denaliTransportSchema = z.object(').map(k=>`transport.${k}`);
  const tdL = extractObjectKeysBlock(logi, 'export const denaliTripDetailsLogisticsSchema = z.object(').map(k=>`tripDetails.logistics.${k}`);
  const toLog = extractObjectKeysBlock(logi, 'export const denaliTripDetailsOverviewLogisticsSchema = z.object(').map(k=>`tripDetails.overview.${k}`);
  const prGear = extractObjectKeysBlock(logi, 'export const denaliParticipantGearSchema = z.object(').map(k=>`participantRequirements.${k}`);

  const pp = extractObjectKeysBlock(pric, 'export const denaliPricingPaymentSchema = z.object(').map(k=>`pricingPayment.${k}`);
  const pr = extractObjectKeysBlock(pric, 'export const denaliParticipantRequirementsSchema = z.object(').map(k=>`participantRequirements.${k}`);
  const pol = extractObjectKeysBlock(pric, 'export const denaliPoliciesSchema = z.object(').map(k=>`policies.${k}`);
  const toPri = extractObjectKeysBlock(pric, 'export const denaliTripDetailsOverviewPricingSchema = z.object(').map(k=>`tripDetails.overview.${k}`);

  const roots = ['basicInfo','programNature','transport','pricingPayment','participantRequirements','policies','photosData','tripDetails','tripDetails.logistics','tripDetails.overview','tripDetails.metrics'];
  return uniq([...roots,...bi,...pn,...ph,...tm,...toCore,...tr,...tdL,...toLog,...prGear,...pp,...pr,...pol,...toPri]);
}

function templateStoragePaths(): string[] {
  const reg = read('packages/denali-domain/src/registry/denaliFieldRegistryData.ts');
  const sch = read('packages/types/src/denali/denaliCanonicalTemplateDataSchema.ts');
  const regPaths = [...reg.matchAll(/canonicalPath:\s*"([^"]+)"/g)].map(m=>m[1]);

  const top = extractObjectKeysBlock(sch, 'export const denaliCanonicalTemplateDataSchema = z\n  .object(');
  const p = extractObjectKeysBlock(sch, 'const denaliTemplateProgramSchema = z\n  .object(').map(k=>`program.${k}`);
  const t = extractObjectKeysBlock(sch, 'const denaliTemplateTransportSchema = z\n  .object(').map(k=>`transport.${k}`);
  const pr = extractObjectKeysBlock(sch, 'const denaliTemplatePricingSchema = z\n  .object(').map(k=>`pricing.${k}`);
  const pa = extractObjectKeysBlock(sch, 'const denaliTemplateParticipantsSchema = z\n  .object(').map(k=>`participants.${k}`);
  const po = extractObjectKeysBlock(sch, 'const denaliTemplatePoliciesSchema = z\n  .object(').map(k=>`policies.${k}`);
  const ov = extractObjectKeysBlock(sch, 'overview: z\n      .object(').map(k=>`overview.${k}`);
  const me = extractObjectKeysBlock(sch, 'metrics: z\n      .object(').map(k=>`metrics.${k}`);

  return uniq([...regPaths,...top,...p,...t,...pr,...pa,...po,...ov,...me]);
}

function extractPathLiterals(src: string): string[] {
  const out: string[] = [];
  const re = /["'`]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_\[\]]+)+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function orchestratePaths(): string[] {
  const src = read('apps/web/src/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate.ts');
  const literals = extractPathLiterals(src);
  const props = [...src.matchAll(/\b(template|result|data)\.([A-Za-z0-9_]+)/g)].map(m=>`${m[1]}.${m[2]}`);
  return uniq([...literals,...props]);
}

function denaliCanonicalFromFormPaths(): string[] {
  const src = read('packages/types/src/denali/denaliCanonicalFromForm.ts');
  const literals = extractPathLiterals(src);
  const formAccess = [...src.matchAll(/form\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g)].map(m=>m[1]);
  const returnKeys = [...src.matchAll(/^\s{4}([A-Za-z0-9_]+):/gm)].map(m=>m[1]);
  const nested = ['program.themeIds','program.shortDescription','program.longDescription','program.difficultyLevel','program.hikingHoursApprox','program.hikingGoHours','program.hikingReturnHours','program.itinerary','transport.mode','transport.transportCost','transport.allowPersonalCar','transport.dongAmount','transport.transportNotes','transport.adminCapacityApproval','pricing.requiresPayment','pricing.basePricePerPerson','pricing.paymentMode','pricing.includesTourInsurance','participants.minimumAge','participants.maximumAge','participants.fitnessLevel','participants.nationalIdRequired','participants.sportsInsuranceRequired','participants.minRequiredPeaks','participants.fitnessPrerequisiteText','participants.gearItems','policies.policiesText','policies.cancellationDeadlineHours','policies.cancellationPenaltyPercentage'];
  return uniq([...literals,...formAccess,...returnKeys,...nested]);
}

function cloneLogicPaths(): string[] {
  const src1 = read('apps/api/src/modules/tours/services/tours-clone.service.ts');
  const src2 = read('apps/api/src/scripts/audit-template-jsonb-clone-integrity.ts');
  const literals = [...extractPathLiterals(src1), ...extractPathLiterals(src2)];
  const propLike = [...src1.matchAll(/\b(source|projection|dto|template|orchestration|cloneResult)\.([A-Za-z0-9_]+)/g)].map(m=>`${m[1]}.${m[2]}`);
  return uniq([...literals,...propLike]);
}

const s1 = wizardSchemaPaths();
const wset = new Set(s1);

function formatSection(title: string, paths: string[]): string[] {
  const lines = [`## ${title}`, ''];
  for (const p of paths) {
    lines.push(`- ${p}${wset.has(p) ? '' : ' [STALE_PATH]'}`);
  }
  lines.push('');

  const notInWizard = paths.filter(p=>!wset.has(p));
  const wizardNotInSection = s1.filter(p=>!new Set(paths).has(p));
  lines.push('### Mismatched Field');
  if (notInWizard.length === 0 && wizardNotInSection.length === 0) {
    lines.push('- (none)');
  } else {
    for (const p of notInWizard) lines.push(`- ${p} [not in Wizard Schema Dump]`);
    for (const p of wizardNotInSection) lines.push(`- ${p} [missing from this section]`);
  }
  lines.push('');
  return lines;
}

const out: string[] = [];
out.push('');
out.push('---');
out.push('');
out.push(`# Structural Mapping Audit Dump (${new Date().toISOString()})`);
out.push('');
out.push(...formatSection('1) Wizard Schema Dump (DenaliCreateTourWizardForm RHF paths)', s1));
out.push(...formatSection('2) Template Storage Dump (DENALI_FIELD_DEFINITIONS + DenaliCanonicalTemplateData)', templateStoragePaths()));
out.push(...formatSection('3) Edit/Hydration Logic Paths (orchestrateDenaliWizardFromTemplate)', orchestratePaths()));
out.push(...formatSection('4) Draft/Save Logic Paths (denaliCanonicalFromForm)', denaliCanonicalFromFormPaths()));
out.push(...formatSection('5) Clone Logic Paths (template clone service/script)', cloneLogicPaths()));

const target = path.join(repo, 'unified-architecture-check.md');
const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\n+$/, '') : '';
fs.writeFileSync(target, `${existing}${out.join('\n')}\n`, 'utf8');
console.log(`Wrote ${target}`);

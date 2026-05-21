import fs from 'fs';

const RULE_MODEL_PATH = 'apps/web/src/features/tours/wizard/denali/rules/denaliRuleModel.ts';
const RULE_REQUIRED_PATH = 'apps/web/src/features/tours/wizard/denali/rules/denaliRuleRequired.ts';

function log(message: string) {
    console.log(`[Rules Gate] ${message}`);
    fs.appendFileSync('map.log', `[Rules Gate] ${message}\n`);
}

function extractCanonicalFieldPaths(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const paths = new Set<string>();

    const canonicalSetMatch = content.match(
        /export const DENALI_WIZARD_CANONICAL_FIELD_PATHS = new Set\(\[([\s\S]*?)\]\)/,
    );
    if (canonicalSetMatch) {
        canonicalSetMatch[1].split(',').forEach((p) => {
            const trimmed = p.trim().replace(/['"]/g, '');
            if (trimmed) paths.add(trimmed);
        });
    }

    return Array.from(paths);
}

function ruleModelDefinesPath(modelContent: string, path: string): boolean {
    return (
        modelContent.includes(`path: "${path}"`) ||
        modelContent.includes(`path: '${path}'`)
    );
}

function checkRules() {
    log('Starting Rules Gate check...');
    const paths = extractCanonicalFieldPaths(RULE_REQUIRED_PATH);
    const modelContent = fs.readFileSync(RULE_MODEL_PATH, 'utf-8');

    log(`Found ${paths.length} canonical field paths in DENALI_WIZARD_CANONICAL_FIELD_PATHS.`);

    if (!modelContent.includes('export const denaliRuleSet: DenaliRuleSet')) {
        log('Error: Could not find denaliRuleSet in denaliRuleModel.ts');
        return;
    }

    const uncoveredPaths: string[] = [];
    paths.forEach((path) => {
        if (!ruleModelDefinesPath(modelContent, path)) {
            uncoveredPaths.push(path);
        }
    });

    if (uncoveredPaths.length > 0) {
        log(`Warning: Canonical paths without rule field definition: ${uncoveredPaths.join(', ')}`);
    } else {
        log('All canonical paths have a matching path: "..." field definition in denaliRuleModel.');
    }

    // Step verification
    const stepMatches = Array.from(modelContent.matchAll(/step: ["'](.*?)["']/g)).map(m => m[1]);
    const uniqueSteps = Array.from(new Set(stepMatches));
    log(`Steps identified in rules: ${uniqueSteps.join(', ')}`);

    log('Rules Gate check completed.');
}

checkRules();

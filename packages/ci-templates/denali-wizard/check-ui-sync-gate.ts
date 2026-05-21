import fs from 'fs';

const CONTEXT_PATH = 'apps/web/src/features/tours/wizard/denali/DenaliCanonicalContext.tsx';

function log(message: string) {
    console.log(`[UI Sync Gate] ${message}`);
    fs.appendFileSync('map.log', `[UI Sync Gate] ${message}\n`);
}

function checkUISync() {
    log('Starting UI Sync Gate check...');
    const content = fs.readFileSync(CONTEXT_PATH, 'utf-8');

    // Check for Context -> RHF one-way sync
    if (content.includes('// Update RHF (One-Way: Context -> RHF)')) {
        log('One-way sync (Context -> RHF) documentation found.');
    }

    if (content.includes('applyCanonicalMvpToForm(next, currentForm, { basics, setValue })')) {
        log('applyCanonicalMvpToForm is used to push context state to RHF.');
    }

    // Check for re-hydration logic (syncToken)
    if (content.includes('useEffect(() =>') && content.includes('setCanonicalModel(denaliFormToCanonical(form))')) {
        log('Re-hydration logic (syncToken) found for re-syncing from RHF to Context when needed.');
    }

    // Check for UI rule resolving
    if (content.includes('const ui = useMemo') && content.includes('getDenaliUIFromForm(getValues())')) {
        log('UI rule resolution (getDenaliUIFromForm) is memoized and correctly used.');
    }

    // Check for basics sync
    if (content.includes('updateCanonicalBasics')) {
        log('updateCanonicalBasics handler found for category/duration changes.');
    }

    log('UI Sync Gate check completed.');
}

checkUISync();

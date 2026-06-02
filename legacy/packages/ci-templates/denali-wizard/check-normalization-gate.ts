import fs from 'fs';

const RULE_ACCESS_PATH = 'apps/web/src/features/tours/wizard/denali/validation/denaliRuleAccess.ts';
const _UI_ADAPTER_PATH = 'apps/web/src/features/tours/wizard/denali/rules/denaliUIAdapter.ts';

function log(message: string) {
    fs.appendFileSync('map.log', `[Normalization Gate] ${message}\n`);
}

function checkNormalization() {
    log('Starting Normalization Gate check...');
    const accessContent = fs.readFileSync(RULE_ACCESS_PATH, 'utf-8');
    
    // Check if normalizeDenaliWizardForm is present
    if (accessContent.includes('export function normalizeDenaliWizardForm')) {
        log('normalizeDenaliWizardForm function found.');
    } else {
        log('Error: normalizeDenaliWizardForm not found in denaliRuleAccess.ts');
        return;
    }

    // Check if it calls clearDenaliNonVisibleFormValues
    if (accessContent.includes('clearDenaliNonVisibleFormValues(input, model)')) {
        log('normalizeDenaliWizardForm correctly delegates to clearDenaliNonVisibleFormValues.');
    }

    // Check clearDenaliNonVisibleFormValues logic
    if (accessContent.includes('getHiddenFieldPathsFromModel(model)')) {
        log('Normalization uses getHiddenFieldPathsFromModel for ghost field clearance.');
    }

    // Verify conditional visibility is checked during normalization
    if (accessContent.includes('isDenaliFieldVisibleInModel(model, path, form)')) {
        log('Normalization respects conditional visibility (isDenaliFieldVisibleInModel).');
    }

    // Verify cleanup of paths from DENALI_WIZARD_FORM_FIELD_PATHS
    if (accessContent.includes('for (const path of DENALI_WIZARD_FORM_FIELD_PATHS)')) {
        log('Normalization iterates over all registered wizard form field paths.');
    }

    log('Normalization Gate check completed.');
}

checkNormalization();

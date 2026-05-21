import fs from 'fs';

const PROJECTION_PATH = 'apps/web/src/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection.ts';

function log(message: string) {
    console.log(`[Projection Gate] ${message}`);
    fs.appendFileSync('map.log', `[Projection Gate] ${message}\n`);
}

function checkProjection() {
    log('Starting Projection Gate check...');
    const content = fs.readFileSync(PROJECTION_PATH, 'utf-8');

    // Verify main function exists
    if (content.includes('export function buildDenaliCreateTourPayloadProjection')) {
        log('buildDenaliCreateTourPayloadProjection function found.');
    } else {
        log('Error: buildDenaliCreateTourPayloadProjection not found.');
        return;
    }

    // Verify canonical usage
    if (content.includes('const canonical = denaliFormToCanonical(form)')) {
        log('Projection correctly uses denaliFormToCanonical.');
    }

    // tripDetails is built as a nested object (overview:, itinerary:, …) not tripDetails.overview strings
    const tripDetailsBlock = content.match(/const tripDetails = \{([\s\S]*?)\} as unknown as TourTripDetails;/);
    if (!tripDetailsBlock) {
        log('Warning: Could not locate const tripDetails = { ... } block.');
    } else {
        const block = tripDetailsBlock[1];
        const mappingSections = ['overview', 'itinerary', 'participation', 'logistics', 'policies'] as const;
        mappingSections.forEach((section) => {
            if (new RegExp(`\\b${section}:\\s*\\{`).test(block)) {
                log(`Found tripDetails mapping section: ${section}`);
            } else {
                log(`Warning: tripDetails.${section} block might be missing.`);
            }
        });
    }

    // Check for negative test assertions (throw new Error)
    const errorAssertions = (content.match(/throw new Error/g) || []).length;
    log(`Found ${errorAssertions} explicit error assertions in projection logic.`);

    if (content.includes('capacityMax must be a positive integer')) {
        log('Capacity assertion verified.');
    }
    if (content.includes('basePricePerPerson required for paid tours')) {
        log('Pricing assertion verified.');
    }

    // Verify Enum mappings
    if (content.includes('function denaliWizardFitnessToApi')) {
        log('Fitness level enum mapping function found.');
    }

    log('Projection Gate check completed.');
}

checkProjection();

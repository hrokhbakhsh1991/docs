import fs from 'fs';
import path from 'path';

const CANONICAL_MODEL_PATH = 'packages/types/src/denali/denaliCanonicalTourModel.ts';
const FORM_ADAPTER_PATH = 'packages/types/src/denali/denaliCanonicalFromForm.ts';

function log(message: string) {
    console.log(`[Canonical Gate] ${message}`);
    fs.appendFileSync('map.log', `[Canonical Gate] ${message}\n`);
}

function extractFields(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fields: string[] = [];
    
    // Simple regex to find field names in the interface
    // This is a bit naive but should work for the current structure
    const interfaceMatch = content.match(/export interface DenaliCanonicalTourModel {([\s\S]*?)^}/m);
    if (interfaceMatch) {
        const lines = interfaceMatch[1].split('\n');
        lines.forEach(line => {
            const match = line.match(/^\s*(\w+)(\??):/);
            if (match) {
                fields.push(match[1]);
            }
        });
    }

    // Also look for nested fields in program, transport, pricing, participants, policies
    const nestedSections = ['program', 'transport', 'pricing', 'participants', 'policies'];
    nestedSections.forEach(section => {
        const regex = new RegExp(`${section}: {[\\s\\S]*?^  }`, 'm');
        const sectionMatch = content.match(regex);
        if (sectionMatch) {
            const lines = sectionMatch[0].split('\n');
            lines.forEach(line => {
                const match = line.match(/^\s*(\w+)(\??):/);
                if (match && match[1] !== section) {
                    fields.push(`${section}.${match[1]}`);
                }
            });
        }
    });

    return fields;
}

function checkAlignment() {
    log('Starting alignment check...');
    const canonicalFields = extractFields(CANONICAL_MODEL_PATH);
    const adapterContent = fs.readFileSync(FORM_ADAPTER_PATH, 'utf-8');

    log(`Found ${canonicalFields.length} fields in DenaliCanonicalTourModel.`);

    const missingInAdapter: string[] = [];
    canonicalFields.forEach(field => {
        if (!adapterContent.includes(field.includes('.') ? field.split('.')[1] : field)) {
             // Basic check: is the field name present in the adapter?
             // field.includes('.') ? field.split('.')[1] : field handles nested field names
             missingInAdapter.push(field);
        }
    });

    if (missingInAdapter.length > 0) {
        log(`Warning: Possible missing fields in adapter: ${missingInAdapter.join(', ')}`);
    } else {
        log('All canonical fields seem to be present in the adapter.');
    }

    // Check for RHF Sync (manual check of components might be needed, but we can look for usage)
    log('Alignment check completed.');
}

checkAlignment();

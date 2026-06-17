import fs from 'fs';
import path from 'path';

const localesDir = 'c:/Users/ADMIN/OneDrive/Desktop/Projects/Florist/src/i18n/locales';

function parseLocaleFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleaned = content
    .replace(/export\s+const\s+\w+\s*=\s*/, '')
    .trim()
    .replace(/;$/, '');
  
  try {
    return new Function(`return (${cleaned})`)();
  } catch (e) {
    console.error(`Failed to parse ${filePath}:`, e);
    throw e;
  }
}

const en = parseLocaleFile(path.join(localesDir, 'en-US.ts'));
const es = parseLocaleFile(path.join(localesDir, 'es-US.ts'));
const fr = parseLocaleFile(path.join(localesDir, 'fr-FR.ts'));
const nl = parseLocaleFile(path.join(localesDir, 'nl-NL.ts'));

function getFlatKeys(obj, prefix = '') {
  let keys = {};
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(keys, getFlatKeys(obj[key], fullKey));
    } else {
      keys[fullKey] = obj[key];
    }
  }
  return keys;
}

const enKeys = getFlatKeys(en);
const esKeys = getFlatKeys(es);
const frKeys = getFlatKeys(fr);
const nlKeys = getFlatKeys(nl);

const targets = [
  { name: 'es-US.ts', keys: esKeys },
  { name: 'fr-FR.ts', keys: frKeys },
  { name: 'nl-NL.ts', keys: nlKeys }
];

let report = '--- Missing Translation Keys Report ---\n';
for (const target of targets) {
  report += `\nChecking ${target.name}:\n`;
  let missing = 0;
  for (const key in enKeys) {
    if (!(key in target.keys)) {
      report += `  - Missing: ${key} (EN: "${enKeys[key]}")\n`;
      missing++;
    }
  }
  report += `Total missing in ${target.name}: ${missing}\n`;
}

fs.writeFileSync('C:/Users/ADMIN/.gemini/antigravity-ide/brain/8ee92904-c68f-4479-899d-ee406e920a1f/scratch/missing-keys-report.txt', report);
console.log('Report written to missing-keys-report.txt');

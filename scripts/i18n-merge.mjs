import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Import the existing locale objects
import { enUS } from '../src/i18n/locales/en-US.ts';
import { esUS } from '../src/i18n/locales/es-US.ts';
import { frFR } from '../src/i18n/locales/fr-FR.ts';
import { nlNL } from '../src/i18n/locales/nl-NL.ts';

// Read analysis
const analysisPath = path.join(PROJECT_ROOT, 'i18n-analysis.json');
if (!fs.existsSync(analysisPath)) {
  console.error('i18n-analysis.json not found. Run scripts/i18n-extract.mjs first.');
  process.exit(1);
}

const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
const newKeys = analysis.newKeysNeeded;

// Helper to set nested values
function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = parts[parts.length - 1];
  if (current[lastPart] === undefined) {
    current[lastPart] = value;
  }
}

// Add new keys to en-US
for (const [dotPath, englishValue] of Object.entries(newKeys)) {
  setNestedValue(enUS, dotPath, englishValue);
}

// Add new keys to other locales using English as fallback
for (const [dotPath, englishValue] of Object.entries(newKeys)) {
  setNestedValue(esUS, dotPath, englishValue);
  setNestedValue(frFR, dotPath, englishValue);
  setNestedValue(nlNL, dotPath, englishValue);
}

// Custom serializer for formatting
function serialize(obj, indent = 2) {
  const spaces = ' '.repeat(indent);
  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  if (Array.isArray(obj)) {
    return '[\n' + obj.map(item => spaces + '  ' + serialize(item, indent + 2)).join(',\n') + '\n' + spaces + ']';
  }
  const entries = Object.entries(obj).map(([key, val]) => {
    const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : JSON.stringify(key);
    return `${spaces}  ${safeKey}: ${serialize(val, indent + 2)}`;
  });
  return '{\n' + entries.join(',\n') + '\n' + spaces + '}';
}

function writeLocaleFile(fileName, varName, obj) {
  const filePath = path.join(PROJECT_ROOT, 'src', 'i18n', 'locales', fileName);
  const serialized = serialize(obj, 0);
  const content = `export const ${varName} = ${serialized};\n`;
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${fileName}`);
}

writeLocaleFile('en-US.ts', 'enUS', enUS);
writeLocaleFile('es-US.ts', 'esUS', esUS);
writeLocaleFile('fr-FR.ts', 'frFR', frFR);
writeLocaleFile('nl-NL.ts', 'nlNL', nlNL);

console.log('Successfully merged all new keys into locale files.');

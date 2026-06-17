import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Import the current en-US locale
import { enUS } from '../src/i18n/locales/en-US.ts';

// Flatten the locale object to dot-notation keys
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

const flatLocale = flattenObject(enUS);

// Reverse map: value -> key(s)
const valueToKeys = {};
for (const [key, val] of Object.entries(flatLocale)) {
  const normalizedVal = val.toLowerCase().trim();
  if (!valueToKeys[normalizedVal]) {
    valueToKeys[normalizedVal] = [];
  }
  valueToKeys[normalizedVal].push(key);
}

// Read the audit report
const reportPath = path.join(PROJECT_ROOT, 'full-audit-report.txt');
if (!fs.existsSync(reportPath)) {
  console.error('full-audit-report.txt not found. Run the audit script first.');
  process.exit(1);
}

const content = fs.readFileSync(reportPath, 'utf-8');
const lines = content.split('\n');

const violations = [];
let currentViolation = {};

for (const line of lines) {
  if (line.startsWith('- file path: ')) {
    currentViolation.file = line.replace('- file path: ', '').trim();
  } else if (line.startsWith('- line number: ')) {
    currentViolation.line = parseInt(line.replace('- line number: ', '').trim(), 10);
  } else if (line.startsWith('- hardcoded string: ')) {
    let str = line.replace('- hardcoded string: ', '').trim();
    // Strip surrounding quotes if present
    if (str.startsWith('"') && str.endsWith('"')) {
      str = str.substring(1, str.length - 1);
    }
    currentViolation.text = str;
  } else if (line.startsWith('- suggested action: ')) {
    violations.push(currentViolation);
    currentViolation = {};
  }
}

console.log(`Parsed ${violations.length} violations from report.`);

// Group and analyze
const filesWithViolations = {};
const newKeysNeeded = {};
const exactMatches = [];
const closeMatches = [];

for (const v of violations) {
  const text = v.text;
  const normText = text.toLowerCase().trim();
  const matchedKeys = valueToKeys[normText];

  if (matchedKeys) {
    v.matchedKeys = matchedKeys;
    exactMatches.push(v);
  } else {
    // Generate a new key suggestion
    const cleanText = text.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const camelCase = cleanText
      .split(/\s+/)
      .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
    
    // Group new keys by component/page prefix
    let namespace = 'common';
    const filename = path.basename(v.file, '.tsx');
    if (v.file.includes('pages/')) {
      namespace = filename.toLowerCase();
    } else if (v.file.includes('components/')) {
      // Find subdirectory
      const parts = v.file.split('/');
      const compDir = parts[parts.indexOf('components') + 1];
      namespace = compDir || 'common';
    }

    const suggestedKey = `${namespace}.${camelCase}`;
    v.suggestedKey = suggestedKey;
    newKeysNeeded[suggestedKey] = text;
  }

  if (!filesWithViolations[v.file]) {
    filesWithViolations[v.file] = [];
  }
  filesWithViolations[v.file].push(v);
}

// Output results to a JSON file for processing
const analysis = {
  exactMatchesCount: exactMatches.length,
  newKeysNeededCount: Object.keys(newKeysNeeded).length,
  newKeysNeeded,
  violationsByFile: filesWithViolations
};

fs.writeFileSync(
  path.join(PROJECT_ROOT, 'i18n-analysis.json'),
  JSON.stringify(analysis, null, 2),
  'utf-8'
);

console.log(`Analysis complete!`);
console.log(`Exact key matches found: ${exactMatches.length}`);
console.log(`New keys needed: ${Object.keys(newKeysNeeded).length}`);
console.log(`Saved analysis to i18n-analysis.json`);

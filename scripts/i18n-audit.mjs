#!/usr/bin/env node
/**
 * i18n Hardcoded String Audit Script
 * 
 * Scans all .tsx files for likely hardcoded English text that should use t().
 * Run: npm run i18n:audit
 * Exit code 1 if violations found (CI gate).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '..', 'src');

// ───────────────────────────────────────────────
// Configuration
// ───────────────────────────────────────────────

/** Directories and files to skip entirely */
const SKIP_PATHS = [
  'i18n/locales',       // Translation dictionary files
  'i18n/index.ts',      // Locale registry
  '__tests__',          // Test files
  '.test.',             // Test files
  '.spec.',             // Spec files
  '.module.css',        // CSS modules
  'data/products.ts',   // Static product data (proper nouns)
  'data/occasions.ts',  // Static occasion data
  'types/',             // Type definitions
  'firebase/config',    // Firebase config
];

/** Whitelisted strings that are NOT translatable */
const WHITELIST_PATTERNS = [
  // Proper nouns / brand names
  /^BloomPro/i,
  /^Firebase/,
  /^Firestore/,
  /^Google/,
  /^Microsoft/,
  /^Vite/,
  /^React/,
  
  // Currency and codes
  /^USD$/,
  /^EUR$/,
  /^\$\{/,           // Template literals starting with ${
  /^#[0-9A-Fa-f]+$/, // Hex colors
  
  // Technical route/enum strings
  /^\/admin/,
  /^\/shop/,
  /^\/product/,
  /^\/custom/,
  /^\/track/,
  /^\/occasions/,
  /^\/about/,
  /^\/contact/,
  /^\/faq/,
  /^\/terms/,
  /^\/privacy/,
  /^\/delivery/,
  
  // CSS/HTML technical
  /^[a-z]+[-_][a-z]+$/,  // kebab-case / snake_case identifiers
  /^var\(--/,             // CSS variables
  /^rgba?\(/,             // CSS colors
  /^hsla?\(/,             // CSS colors
  /^[0-9]+(%|px|rem|em|vh|vw|ms|s)$/,  // CSS units
  /^[0-9.]+$/,            // Pure numbers
  
  // Short technical tokens
  /^[A-Z]{1,4}$/,         // Short abbreviations (ID, SKU, AR, AP, GL, etc.)
  /^[a-z]{1,2}$/,         // Very short strings (a, of, or, etc.)
  /^https?:\/\//,         // URLs
  /^@/,                   // Social handles
  /^[A-Z]{2,3}-\d+$/,    // SKU patterns
  
  // Common non-translatable tokens
  /^❁$/,
  /^•$/,
  /^—$/,
  /^✓$/,
  /^→$/,
  /^\.\.\./,
  /^&copy;/,
  /^&amp;/,

  // Proper names and brand/unit constants
  /^(Julian V\.|Clara M\.|Marcus K\.|Marcus T\.|Julian V|Clara M|Marcus K|Marcus T)$/,
  /^(kg|cm|Excel|Stripe)$/,
  // Symbols and layout tokens
  /^[-/–#%+→•—✓❁&copy;&amp;]+$/,
];

/** Regex patterns that detect hardcoded English in JSX */
const DETECTION_PATTERNS = [
  // Text content between JSX tags: >Some Text<
  { 
    regex: />\s*([A-Z][a-z]+(?:\s+[a-zA-Z'&.,!?]+){1,})\s*</g,
    name: 'JSX text content'
  },
  // Hardcoded title attribute: title="Some Text"
  {
    regex: /title=["']([A-Z][a-z]+(?:\s+[a-zA-Z']+){1,})["']/g,
    name: 'title attribute'
  },
  // Hardcoded placeholder: placeholder="Some text..."
  {
    regex: /placeholder=["']([A-Z][a-z]+(?:\s+[a-zA-Z']+){1,})["']/g,
    name: 'placeholder attribute'
  },
  // Hardcoded label prop: label="Some Text"
  {
    regex: /label=["']([A-Z][a-z]+(?:\s+[a-zA-Z']+){1,})["']/g,
    name: 'label prop'
  },
  // Toast messages: addToast('Some text...'
  {
    regex: /addToast\(\s*['"`]([A-Z][a-z]+(?:\s+[a-zA-Z']+){1,})/g,
    name: 'toast message'
  },
  // Template literal toasts: addToast(`Some text ${
  {
    regex: /addToast\(\s*`([A-Z][a-z]+(?:\s+[a-zA-Z'${}]+){1,})/g,
    name: 'template toast'
  },
  // Hardcoded aria-label: aria-label="Some text"
  {
    regex: /aria-label=["']([A-Z][a-z]+(?:\s+[a-zA-Z']+){2,})["']/g,
    name: 'aria-label'
  },
];

// ───────────────────────────────────────────────
// File discovery
// ───────────────────────────────────────────────

function getAllTsxFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

function shouldSkip(filePath) {
  const rel = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
  return SKIP_PATHS.some(skip => rel.includes(skip));
}

function isWhitelisted(text) {
  const trimmed = text.trim();
  if (trimmed.length <= 2) return true;
  return WHITELIST_PATTERNS.some(pattern => pattern.test(trimmed));
}

// ───────────────────────────────────────────────
// Audit logic
// ───────────────────────────────────────────────

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];
  const rel = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');

  // Check if file already uses useI18n
  const usesI18n = content.includes('useI18n') || content.includes("from '../../i18n") || content.includes("from '../i18n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments and imports
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('import ')) continue;
    // Skip lines that already use t()
    if (line.includes('t(') && (line.includes("t('") || line.includes('t("') || line.includes('t(`'))) continue;

    for (const pattern of DETECTION_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(line)) !== null) {
        const text = match[1];
        if (!isWhitelisted(text)) {
          violations.push({
            file: rel,
            line: lineNum,
            type: pattern.name,
            text: text.substring(0, 80),
            usesI18n
          });
        }
      }
    }
  }

  return violations;
}

// ───────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────

console.log('🔍 i18n Hardcoded String Audit');
console.log('═'.repeat(60));

const files = getAllTsxFiles(SRC_DIR).filter(f => !shouldSkip(f));
console.log(`Scanning ${files.length} .tsx files...\n`);

let totalViolations = 0;
const violationsByFile = {};

for (const file of files) {
  const violations = auditFile(file);
  if (violations.length > 0) {
    totalViolations += violations.length;
    const rel = violations[0].file;
    violationsByFile[rel] = violations;
  }
}

// Print results
if (totalViolations === 0) {
  console.log('✅ No hardcoded English text detected!\n');
  console.log('All user-facing strings appear to use t() translation calls.');
  process.exit(0);
} else {
  const fileCount = Object.keys(violationsByFile).length;
  console.log(`i18n audit failed:`);
  console.log(`Found ${totalViolations} likely hardcoded strings across ${fileCount} files:\n`);

  for (const [file, violations] of Object.entries(violationsByFile)) {
    for (const v of violations) {
      console.log(`- file path: src/${file}`);
      console.log(`- line number: ${v.line}`);
      console.log(`- hardcoded string: "${v.text}"`);
      console.log(`- suggested action: Replace with t() translation call`);
      console.log();
    }
  }
  
  // Exit with failure for CI
  process.exit(1);
}

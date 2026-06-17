import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Read analysis
const analysisPath = path.join(PROJECT_ROOT, 'i18n-analysis.json');
if (!fs.existsSync(analysisPath)) {
  console.error('i18n-analysis.json not found. Run scripts/i18n-extract.mjs first.');
  process.exit(1);
}

const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
const violationsByFile = analysis.violationsByFile;

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const compRegexes = [
  /export\s+const\s+(\w+)\s*:\s*React\.FC(?:\<.*\>)?\s*=\s*(?:\([^)]*\)|_)?\s*=>\s*\{/,
  /export\s+default\s+function\s+(\w+)\s*\([^)]*\)\s*\{/,
  /export\s+const\s+(\w+)\s*=\s*(?:\([^)]*\)|_)?\s*=>\s*\{/,
  /const\s+(\w+)\s*:\s*React\.FC(?:\<.*\>)?\s*=\s*(?:\([^)]*\)|_)?\s*=>\s*\{/,
  /const\s+(\w+)\s*=\s*(?:\([^)]*\)|_)?\s*=>\s*\{/
];

for (const [relPath, fileViolations] of Object.entries(violationsByFile)) {
  const filePath = path.join(PROJECT_ROOT, 'src', relPath.replace('src/', ''));
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  console.log(`Processing ${relPath} with ${fileViolations.length} violations...`);
  let content = fs.readFileSync(filePath, 'utf-8');
  let lines = content.split('\n');

  // Sort violations by line number descending
  const sortedViolations = [...fileViolations].sort((a, b) => b.line - a.line);

  for (const v of sortedViolations) {
    const lineIndex = v.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    let line = lines[lineIndex];
    const text = v.text;
    const key = v.suggestedKey || (v.matchedKeys && v.matchedKeys[0]);

    if (!key) {
      console.warn(`Missing key for violation: "${text}" in ${relPath}`);
      continue;
    }

    const escapedText = escapeRegExp(text);

    // 1. Check if attribute
    const attrRegex = new RegExp('(label|title|placeholder|aria-label)=["\']' + escapedText + '["\']');
    if (attrRegex.test(line)) {
      line = line.replace(attrRegex, `$1={t('${key}')}`);
    }
    // 2. Check if toast message
    else if (new RegExp('addToast\\(\\s*["\']' + escapedText + '["\']').test(line)) {
      line = line.replace(new RegExp('addToast\\(\\s*["\']' + escapedText + '["\']'), `addToast(t('${key}')`);
    }
    // 3. JSX text content: look for >text< or > text <
    else if (line.includes(`>${text}<`)) {
      line = line.replace(`>${text}<`, `>{t('${key}')}<`);
    } else if (line.includes(`> ${text} <`)) {
      line = line.replace(`> ${text} <`, `> {t('${key}')} <`);
    } else if (line.includes(text)) {
      // General replacement
      line = line.replace(text, `{t('${key}')}`);
    }

    lines[lineIndex] = line;
  }

  // Handle imports and destructuring if the file did not originally use useI18n
  const originalContent = content;
  let fileModifiedContent = lines.join('\n');

  const usesI18n = originalContent.includes('useI18n') || originalContent.includes('I18nProvider');

  if (!usesI18n) {
    // 1. Calculate relative import path to I18nProvider
    // relPath is like "components/dashboard/ActionRequiredPanel.tsx" (without src/ prefix usually, wait, check if relPath starts with src/)
    // Our analysis output file path is: relPath (e.g. "components/dashboard/ActionRequiredPanel.tsx" or "App.tsx")
    const cleanRelPath = relPath.replace('src/', '');
    const depth = (cleanRelPath.match(/\//g) || []).length;
    let relImport = './i18n/I18nProvider';
    if (depth === 1) relImport = '../i18n/I18nProvider';
    else if (depth === 2) relImport = '../../i18n/I18nProvider';
    else if (depth === 3) relImport = '../../../i18n/I18nProvider';

    // Insert import statement at the top
    const fileLines = fileModifiedContent.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < fileLines.length; i++) {
      if (fileLines[i].startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    if (lastImportIndex !== -1) {
      fileLines.splice(lastImportIndex + 1, 0, `import { useI18n } from '${relImport}';`);
    } else {
      fileLines.unshift(`import { useI18n } from '${relImport}';`);
    }

    // Insert const { t } = useI18n(); inside component
    let inserted = false;
    for (let i = 0; i < fileLines.length; i++) {
      const line = fileLines[i];
      let isComponent = false;
      for (const rx of compRegexes) {
        if (rx.test(line)) {
          isComponent = true;
          break;
        }
      }
      if (isComponent && !inserted) {
        fileLines.splice(i + 1, 0, '  const { t } = useI18n();');
        inserted = true;
        break;
      }
    }
    fileModifiedContent = fileLines.join('\n');
  }

  fs.writeFileSync(filePath, fileModifiedContent, 'utf-8');
}

console.log('Finished applying translations to source files!');

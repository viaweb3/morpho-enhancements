// Builds a Chrome Web Store-ready ZIP from the current dist/. The archive's
// manifest.json sits at the root (Chrome rejects a ZIP where it's nested).
// Source maps are excluded because a production review doesn't need them
// and they bloat the upload.

import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'dist-zip');

if (!existsSync(DIST)) {
  console.error('dist/ not found. Run `pnpm build` first.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;
const outName = `morpho-enhancements-${version}.zip`;
const outPath = join(OUT_DIR, outName);

mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(outPath)) rmSync(outPath);

// `-j` would flatten directories — don't use it; we need injected/*.js to stay
// nested. We cd into dist so the archive contains manifest.json at the root.
// Exclude:
//   *.map         — source maps aren't shipped to users
//   .vite/*       — Vite's internal manifest, never read at runtime
execSync(`cd "${DIST}" && zip -r "${outPath}" . -x '*.map' -x '.vite/*'`, { stdio: 'inherit' });

const sizeKb = (readFileSync(outPath).length / 1024).toFixed(1);
console.log(`\n✓ ${outName}  (${sizeKb} KB)`);
console.log(`  ${outPath}`);
console.log('\nUpload this file at https://chrome.google.com/webstore/devconsole');

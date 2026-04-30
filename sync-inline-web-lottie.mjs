#!/usr/bin/env node
/**
 * Copy half-res Lottie (embedded data:image PNGs) into cult-connector-sync-web/.
 * Mirrors the same files into docs/ so GitHub Pages ("Deploy from branch" → /docs) works;
 * GitHub only offers / (root) or /docs — not arbitrary folder names.
 *
 * Removes stale img_*.png sidecars — avoids SVG <image> + external file failures in browsers.
 *
 * For detached PNGs + small JSON (e.g. WordPress), use: npm run build:web:external
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const halfPath = join(dir, 'cult-connector-sync-half.json');
const outDir = join(dir, 'cult-connector-sync-web');
const docsDir = join(dir, 'docs');
const outJson = join(outDir, 'animation.json');

if (!fs.existsSync(halfPath)) {
  console.error('Missing', halfPath, '- run halve-lottie-rasters first');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(halfPath, outJson);
for (const name of fs.readdirSync(outDir)) {
  if (name.startsWith('img_') && name.endsWith('.png')) {
    fs.unlinkSync(join(outDir, name));
  }
}
console.log(`Wrote ${outJson} (embedded assets, ${fs.statSync(outJson).size} bytes)`);

/** GitHub Pages branch deploy only serves /docs or repo root — mirror web preview there. */
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(join(docsDir, '.nojekyll'), '');
for (const name of fs.readdirSync(outDir)) {
  const src = join(outDir, name);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, join(docsDir, name));
}
console.log(`Mirrored ${outDir} → ${docsDir} (for GitHub Pages /docs)`);

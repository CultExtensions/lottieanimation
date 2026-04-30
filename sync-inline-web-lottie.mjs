#!/usr/bin/env node
/**
 * Copy full-res Lottie (embedded data:image PNGs) into cult-connector-sync-web/.
 * Mirrors the same files into docs/ so GitHub Pages ("Deploy from branch" → /docs) works.
 *
 * Smaller bundle (~half linear res): run halve-lottie-rasters then:
 *   node sync-inline-web-lottie.mjs --half
 *
 * For detached PNGs + small JSON (e.g. WordPress), use: npm run build:web:external
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const useHalf = process.argv.includes('--half');
const srcJsonPath = join(dir, useHalf ? 'cult-connector-sync-half.json' : 'cult-connector-sync.json');
const outDir = join(dir, 'cult-connector-sync-web');
const docsDir = join(dir, 'docs');
const outJson = join(outDir, 'animation.json');

if (!fs.existsSync(srcJsonPath)) {
  console.error('Missing', srcJsonPath, useHalf ? '- run halve-lottie-rasters first' : '- run build:lottie first');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(srcJsonPath, outJson);
for (const name of fs.readdirSync(outDir)) {
  if (name.startsWith('img_') && name.endsWith('.png')) {
    fs.unlinkSync(join(outDir, name));
  }
}
console.log(`Wrote ${outJson} (${useHalf ? 'half-res' : 'full-res'} embedded assets, ${fs.statSync(outJson).size} bytes)`);

/** GitHub Pages branch deploy only serves /docs or repo root — mirror web preview there. */
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(join(docsDir, '.nojekyll'), '');
for (const name of fs.readdirSync(outDir)) {
  const src = join(outDir, name);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, join(docsDir, name));
}

// Also publish the source SVGs for quick review on Pages.
for (const svgName of ['cult-connector-sync.svg', 'cult-connector-sync-light.svg']) {
  const src = join(dir, svgName);
  if (fs.existsSync(src) && fs.statSync(src).isFile()) {
    fs.copyFileSync(src, join(docsDir, svgName));
  }
}
console.log(`Mirrored ${outDir} → ${docsDir} (for GitHub Pages /docs)`);

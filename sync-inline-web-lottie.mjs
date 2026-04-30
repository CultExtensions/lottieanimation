#!/usr/bin/env node
/**
 * Copy half-res Lottie (embedded data:image PNGs) into cult-connector-sync-web/.
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

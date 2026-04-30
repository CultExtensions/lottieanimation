#!/usr/bin/env node
/**
 * Split embedded base64 PNGs out of a Lottie JSON into separate files.
 * WordPress / LottieFiles plugin often fails on huge inline data:image URLs — use this output instead.
 *
 * Usage:
 *   node externalize-lottie-assets.mjs [input.json] [out-dir] [BASE_URL]
 *
 * Example:
 *   node externalize-lottie-assets.mjs cult-connector-sync.json ./cult-lottie-web https://example.com/wp-content/uploads/cult-lottie/
 *
 * Upload the folder contents to BASE_URL on your server (FTP or file manager), keeping the same filenames.
 * In LottieFiles block, point to the uploaded JSON file URL (not the PNGs).
 *
 * BASE_URL must end with / when set (e.g. https://cdn.example.com/lottie/).
 * Default empty string: filenames resolve next to animation.json (lottie-web compatible).
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const inJson = process.argv[2] ?? join(__dirname, 'cult-connector-sync.json');
const outDir = process.argv[3] ?? join(__dirname, 'cult-lottie-web');
let baseUrl = process.argv[4] ?? '';
if (baseUrl && !baseUrl.endsWith('/')) baseUrl += '/';

const raw = fs.readFileSync(inJson, 'utf8');
const lottie = JSON.parse(raw);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const asset of lottie.assets) {
  const p = asset.p;
  if (typeof p !== 'string' || !p.startsWith('data:image/png;base64,')) continue;

  const safeId = String(asset.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fname = `${safeId}.png`;
  const buf = Buffer.from(p.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(join(outDir, fname), buf);

  asset.u = baseUrl;
  asset.p = fname;
  asset.e = 0;
}

const outJson = join(outDir, 'animation.json');
fs.writeFileSync(outJson, JSON.stringify(lottie));

console.log(`Wrote assets + ${outJson}`);
console.log(`Asset base URL (empty = same folder as JSON): ${JSON.stringify(baseUrl)}`);
console.log(`Upload everything in ${outDir} to your host; open index.html or pass animation.json URL to your player.`);

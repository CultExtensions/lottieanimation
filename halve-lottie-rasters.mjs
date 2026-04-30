#!/usr/bin/env node
/**
 * Duplicate a Lottie JSON: resize embedded PNG assets to 50% (half linear resolution /
 * ~quarter pixels), halve image anchors, double XY scale so layout matches the original comp.
 * Mask paths stay in raster pixel space — vertices are halved too so clips stay aligned.
 * AE label / glow rasters are skipped: 22px SVG text vanishes when shrunk 50%.
 *
 * Usage: node halve-lottie-rasters.mjs [input.json] [output.json]
 * Defaults: cult-connector-sync.json → cult-connector-sync-half.json
 *
 * Requires: sharp
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Install sharp: npm install sharp');
  process.exit(1);
}

const dir = __dirname;
const inPath = process.argv[2] ?? join(dir, 'cult-connector-sync.json');
const outPath = process.argv[3] ?? join(dir, 'cult-connector-sync-half.json');

/** Full-frame glyphs + glow — half-res Lanczos wipes thin text; keep masks in comp coords */
const SKIP_HALVE_ASSET_IDS = new Set(['img_fly_ae', 'img_fly_ae_cn', 'img_ae_glow']);

function dataUrlPng(buf) {
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/** Scale XY components of Lottie transform scale keyframes ×2 after raster halving */
function doubleScaleXY(prop) {
  if (!prop || prop.a !== 1) {
    const k = prop?.k;
    if (Array.isArray(k) && k.length >= 3) {
      return {
        ...prop,
        k: [k[0] * 2, k[1] * 2, k[2]],
      };
    }
    return prop;
  }
  const next = {
    ...prop,
    k: prop.k.map((kf) => {
      if (!kf.s || !Array.isArray(kf.s)) return kf;
      const { s, ...rest } = kf;
      return {
        ...rest,
        s: [s[0] * 2, s[1] * 2, s[2]],
      };
    }),
  };
  return next;
}

/** Halve anchor XY when asset pixels are halved */
function halveAnchor(prop) {
  if (!prop || prop.a !== 0 || !Array.isArray(prop.k)) return prop;
  const [x, y, z] = prop.k;
  return {
    ...prop,
    k: [x * 0.5, y * 0.5, z],
  };
}

/** Mask vertices are in layer/asset pixels; scale with the resized raster */
function halveMaskVertices(layer) {
  if (!layer.masksProperties?.length) return;
  for (const mask of layer.masksProperties) {
    const pt = mask.pt;
    if (!pt) continue;
    if (pt.a === 0 && pt.k?.v && Array.isArray(pt.k.v)) {
      pt.k.v = pt.k.v.map(([x, y]) => [x * 0.5, y * 0.5]);
      continue;
    }
    if (pt.a === 1 && Array.isArray(pt.k)) {
      for (const kf of pt.k) {
        const path = kf.s;
        if (path?.v && Array.isArray(path.v)) {
          path.v = path.v.map(([x, y]) => [x * 0.5, y * 0.5]);
        }
      }
    }
  }
}

const raw = fs.readFileSync(inPath, 'utf8');
const lottie = JSON.parse(raw);

for (const asset of lottie.assets) {
  const p = asset.p;
  if (typeof p !== 'string' || !p.startsWith('data:image/png;base64,')) continue;
  if (SKIP_HALVE_ASSET_IDS.has(asset.id)) continue;

  const buf = Buffer.from(p.replace(/^data:image\/png;base64,/, ''), 'base64');
  const nw = Math.max(1, Math.round(asset.w / 2));
  const nh = Math.max(1, Math.round(asset.h / 2));
  const outBuf = await sharp(buf)
    .resize(nw, nh, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();

  asset.w = nw;
  asset.h = nh;
  asset.p = dataUrlPng(outBuf);
}

for (const layer of lottie.layers) {
  if (layer.ty !== 2 || !layer.refId || !layer.ks) continue;
  if (SKIP_HALVE_ASSET_IDS.has(layer.refId)) continue;
  layer.ks.a = halveAnchor(layer.ks.a);
  layer.ks.s = doubleScaleXY(layer.ks.s);
  halveMaskVertices(layer);
}

fs.writeFileSync(outPath, JSON.stringify(lottie));
const before = Buffer.byteLength(raw, 'utf8');
const after = fs.statSync(outPath).size;
console.log(`Wrote ${outPath}`);
console.log(`Size ${before} → ${after} bytes (${((after / before) * 100).toFixed(1)}% of original)`);

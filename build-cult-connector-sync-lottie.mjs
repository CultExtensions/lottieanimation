#!/usr/bin/env node
/**
 * Builds cult-connector-sync.json from cult-connector-sync.svg:
 * - Base: AE label kept; Crowdin row1 muted; rows 2–5 stripped (overlay restores rows + strings)
 * - Row1: strings layer always visible; green stroke/dot layer pulses opacity only (subtle fade)
 * - Rows 2–5 overlay: visible entire timeline (no reveal fade)
 * - Crowdin row string overlays: full-comp rasters, same breath as Background (no duplicate fly layer)
 * - AE: Latin ↔ Chinese crossfade; label centered on purple selection box; matches Background breath
 * - Arrows: both oscillate horizontally between panels (eased), matching scale breath
 *
 * Layer stack (top → bottom): AE Latin → AE CN → AE glow pulse → rowsRest → row1 strings → row1 green → arrows → base
 *
 * Requires: sharp (`npm i sharp`)
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = __dirname;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Install sharp in this directory: npm install sharp');
  process.exit(1);
}

const W = 1380;
const H = 620;
const CX = W / 2;
const CY = H / 2;
const FR = 60;
const OP = 240;
/** AE viewport: Latin ↔ Chinese — long linear ramps so canvas shows a clear crossfade (~0.7s hand-off each way @ 60fps) */
/** Chinese reaches full slightly before Latin hits 0 so the line never looks empty */
const AE_LAT_FADE_START = 42;
const AE_LOREM_CN_START = 46;
const AE_CN_OPACITY_END = 80;
const AE_LOREM_CN_END = 86;
const AE_GLOW_ON_START = 40;
const AE_GLOW_PEAK = 60;
const AE_GLOW_OFF_END = 90;

/** Chinese → Latin (mirrored overlap) */
const AE_CN_LAT_START = 122;
const AE_CN_LAT_FADE_START = 132;
const AE_LAT_BACK_FULL = 146;
const AE_CN_OFF_END = 152;
const AE_REV_GLOW_ON_START = 118;
const AE_REV_GLOW_PEAK = 138;
const AE_REV_GLOW_OFF_END = 154;

const srcSvgPath = join(dir, 'cult-connector-sync.svg');
const outJsonPath = join(dir, 'cult-connector-sync.json');

/** Composition preview card — exact SVG rect x="274" y="124" w="282" h="248" */
const AE_PREVIEW = { l: 274, t: 124, r: 556, b: 372 };
const AE_MASK_V = [
  [AE_PREVIEW.l, AE_PREVIEW.t],
  [AE_PREVIEW.r, AE_PREVIEW.t],
  [AE_PREVIEW.r, AE_PREVIEW.b],
  [AE_PREVIEW.l, AE_PREVIEW.b],
];

const CR_MASK_V = [
  [998, 108],
  [1312, 108],
  [1312, 552],
  [998, 552],
];

/**
 * Purple AE selection box around comp line (cult-connector-sync.svg):
 * rect x="321" y="167" width="188" height="44"
 */
const AE_SELECTION = { l: 321, t: 167, w: 188, h: 44 };
const AE_LABEL_CX = AE_SELECTION.l + AE_SELECTION.w / 2;
const AE_LABEL_CY = AE_SELECTION.t + AE_SELECTION.h / 2;

/** Strip arrows, mute Crowdin row1, remove editor rows 2–5 (keep Context below). */
function stripForLottieBase(svg) {
  let s = svg;
  s = s.replace(/\s*<!-- Center sync arrows[\s\S]*?<\/g>\s*/, '\n');
  /** AE composition preview string is driven only by fly layers (Latin → Chinese crossfade). */
  s = s.replace(
    /<text x="415" y="(?:189|248)"[\s\S]*?>lorem ipsum<\/text>\s*/,
    '',
  );
  s = s.replace(
    /<rect x="1010" y="166" width="252" height="30" rx="8" fill="#132018" stroke="#2EA76F" stroke-width="2" \/>\s*\n?\s*<circle cx="1024" cy="182" r="4\.5" fill="#2EA76F" opacity="0\.95" \/>\s*\n?\s*<text x="1036" y="186"[^>]*>lorem ipsum<\/text>\s*\n?\s*<text x="1254" y="186"[^>]*>[\s\S]*?<\/text>/,
    `    <rect x="1010" y="166" width="252" height="30" rx="8" fill="#161821"/>`,
  );
  s = s.replace(
    /<rect x="1010" y="204" width="252" height="26" rx="8" fill="#161821" \/>\s*\n?\s*<circle cx="1024" cy="217" r="4\.5" fill="#E85D75" opacity="0\.95" \/>\s*\n?\s*<text x="1036" y="221"[^>]*>lorem ipsum<\/text>\s*\n?\s*<text x="1254" y="221"[^>]*>[\s\S]*?<\/text>\s*\n?\s*<rect x="1010" y="236" width="252" height="26" rx="8" fill="#161821" \/>\s*\n?\s*<circle cx="1024" cy="249" r="4\.5" fill="#E85D75" opacity="0\.95" \/>\s*\n?\s*<text x="1036" y="253"[^>]*>lorem ipsum<\/text>\s*\n?\s*<text x="1254" y="253"[^>]*>[\s\S]*?<\/text>\s*\n?\s*<rect x="1010" y="268" width="252" height="26" rx="8" fill="#161821" \/>\s*\n?\s*<circle cx="1024" cy="281" r="4\.5" fill="#E85D75" opacity="0\.95" \/>\s*\n?\s*<text x="1036" y="285"[^>]*>lorem ipsum<\/text>\s*\n?\s*<text x="1254" y="285"[^>]*>[\s\S]*?<\/text>\s*\n?\s*<rect x="1010" y="300" width="252" height="26" rx="8" fill="#161821" \/>\s*\n?\s*<circle cx="1024" cy="313" r="4\.5" fill="#E85D75" opacity="0\.95" \/>\s*\n?\s*<text x="1036" y="317"[^>]*>lorem ipsum<\/text>\s*\n?\s*<text x="1254" y="317"[^>]*>[\s\S]*?<\/text>/,
    '',
  );
  return s;
}

/** Row 1 strings only (green chrome lives on separate pulsing layer). */
const crowdinRow1StringsSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      .t-ui-sm{font:650 13px ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
    </style>
  </defs>
  <text x="1036" y="186" class="t-ui-sm" fill="#E6E7F0">lorem ipsum</text>
  <text x="1254" y="186" text-anchor="end" class="t-ui-sm" fill="#C9CBD7">&#32599;&#21202;&#22982;&#183;&#20234;&#26222;&#26862;</text>
</svg>`;

const crowdinRow1GreenSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="1010" y="166" width="252" height="30" rx="8" fill="none" stroke="#2EA76F" stroke-width="2"/>
  <circle cx="1024" cy="182" r="4.5" fill="#2EA76F" opacity="0.95"/>
</svg>`;

const crowdinRowsRestOverlaySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      .t-ui-sm{font:650 13px ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
    </style>
  </defs>
  <rect x="1010" y="204" width="252" height="26" rx="8" fill="#161821"/>
  <circle cx="1024" cy="217" r="4.5" fill="#E85D75" opacity="0.95"/>
  <text x="1036" y="221" class="t-ui-sm" fill="#B7B9C8">lorem ipsum</text>
  <text x="1254" y="221" text-anchor="end" class="t-ui-sm" fill="#B7B9C8">&#32599;&#21202;&#22982;&#183;&#20234;&#26222;&#26862;</text>
  <rect x="1010" y="236" width="252" height="26" rx="8" fill="#161821"/>
  <circle cx="1024" cy="249" r="4.5" fill="#E85D75" opacity="0.95"/>
  <text x="1036" y="253" class="t-ui-sm" fill="#B7B9C8">lorem ipsum</text>
  <text x="1254" y="253" text-anchor="end" class="t-ui-sm" fill="#B7B9C8">&#32599;&#21202;&#22982;&#183;&#20234;&#26222;&#26862;</text>
  <rect x="1010" y="268" width="252" height="26" rx="8" fill="#161821"/>
  <circle cx="1024" cy="281" r="4.5" fill="#E85D75" opacity="0.95"/>
  <text x="1036" y="285" class="t-ui-sm" fill="#B7B9C8">lorem ipsum</text>
  <text x="1254" y="285" text-anchor="end" class="t-ui-sm" fill="#B7B9C8">&#32599;&#21202;&#22982;&#183;&#20234;&#26222;&#26862;</text>
  <rect x="1010" y="300" width="252" height="26" rx="8" fill="#161821"/>
  <circle cx="1024" cy="313" r="4.5" fill="#E85D75" opacity="0.95"/>
  <text x="1036" y="317" class="t-ui-sm" fill="#B7B9C8">lorem ipsum</text>
  <text x="1254" y="317" text-anchor="end" class="t-ui-sm" fill="#B7B9C8">&#32599;&#21202;&#22982;&#183;&#20234;&#26222;&#26862;</text>
</svg>`;

const arrowsOnlySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="transparent"/>
  <g transform="translate(659 280)" opacity="0.95">
    <path d="M0 14 L48 14 L48 6 L62 16 L48 26 L48 18 L0 18 Z" fill="#8F81FF" opacity="0.95"/>
    <path d="M62 42 L14 42 L14 34 L0 44 L14 54 L14 46 L62 46 Z" fill="#8F81FF" opacity="0.82"/>
  </g>
</svg>`;

/** AE fly layers — full-frame PNGs; composition timeline drives opacity crossfade (see flyAe*Layer). */
const aeFlyTextFullSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="transparent"/>
  <text x="${AE_LABEL_CX}" y="${AE_LABEL_CY}" text-anchor="middle" dominant-baseline="central" fill="#F4F5FC"
        style="font:800 26px ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">lorem ipsum</text>
</svg>`;

const aeFlyTextCnFullSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="transparent"/>
  <text x="${AE_LABEL_CX}" y="${AE_LABEL_CY}" text-anchor="middle" dominant-baseline="central" fill="#F4F5FC"
        style="font:800 26px ui-sans-serif,system-ui,-apple-system,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif">&#x793A;&#x4F8B;&#x6E90;&#x5B57;&#x7B26;&#x4E32;</text>
</svg>`;

/** Violet halo — stronger footprint so the pulse reads clearly during Latin ↔ Chinese (masked in Lottie). */
const aeTransitionGlowSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="aeGlowBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="14"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="transparent"/>
  <ellipse cx="${AE_LABEL_CX}" cy="${AE_LABEL_CY}" rx="96" ry="24" fill="#9B8DFF" opacity="0.38" filter="url(#aeGlowBlur)"/>
  <ellipse cx="${AE_LABEL_CX}" cy="${AE_LABEL_CY}" rx="56" ry="14" fill="#C4B8FF" opacity="0.22" filter="url(#aeGlowBlur)"/>
</svg>`;

/** Fresh easing objects per keyframe — shared i/o refs confuse lottie-web’s keyframe easing cache. */
const bez = () => ({
  i: { x: [0.45], y: [1] },
  o: { x: [0.55], y: [0] },
});

/** Shared subtle position / scale drift with Background */
const breathP = {
  a: 1,
  ix: 2,
  k: [
    { t: 0, s: [CX + 0.35, CY - 0.45, 0], ...bez() },
    { t: 60, s: [CX - 0.35, CY + 0.45, 0], ...bez() },
    { t: 120, s: [CX + 0.35, CY - 0.45, 0], ...bez() },
    { t: 180, s: [CX - 0.35, CY + 0.45, 0], ...bez() },
    { t: 240, s: [CX + 0.35, CY - 0.45, 0] },
  ],
};
const breathA = { a: 0, ix: 1, k: [CX, CY, 0] };
/** ~±0.55% XY scale swing @ 60fps — readable “breath” on panels without cartoon bounce */
const breathS = {
  a: 1,
  ix: 6,
  k: [
    { t: 0, s: [100.55, 100.55, 100], ...bez() },
    { t: 60, s: [99.45, 99.45, 100], ...bez() },
    { t: 120, s: [100.55, 100.55, 100], ...bez() },
    { t: 180, s: [99.45, 99.45, 100], ...bez() },
    { t: 240, s: [100.55, 100.55, 100] },
  ],
};

function dataUrlPng(buf) {
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/** Higher DPI rasterisation then resize → sharper edges on UI mock text/strokes (lossless PNG). */
const SVG_RASTER_DENSITY = 144;
const pngLossless = { compressionLevel: 6, effort: 10 };

async function rasterSvgToComp(svgString) {
  return sharp(Buffer.from(svgString), { density: SVG_RASTER_DENSITY })
    .resize(W, H, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .png(pngLossless)
    .toBuffer();
}

function rectMask(nm, verts) {
  const z = verts.map(() => [0, 0]);
  return {
    inv: false,
    mode: 'a',
    nm,
    o: { a: 0, k: 100 },
    x: { a: 0, k: 0 },
    pt: {
      a: 0,
      k: {
        i: z,
        o: z,
        v: verts,
        c: true,
      },
    },
  };
}

/** Top → path @ translate(659 280), local bbox ~0–62 × 6–26 */
const ARROW_TOP_EXTRACT = { left: 652, top: 283, width: 76, height: 28 };
/** Bottom ← path, local ~0–62 × 34–54 */
const ARROW_BOT_EXTRACT = { left: 650, top: 309, width: 80, height: 30 };

const svgRaw = fs.readFileSync(srcSvgPath, 'utf8');
const baseSvg = stripForLottieBase(svgRaw);

if (!baseSvg.includes('y="354"') || baseSvg.includes('y="317"')) {
  console.error('stripForLottieBase: unexpected SVG structure (rows 2–5 strip failed?)');
  process.exit(1);
}

const basePng = await rasterSvgToComp(baseSvg);

const row1StringsPng = await rasterSvgToComp(crowdinRow1StringsSvg);
const row1GreenPng = await rasterSvgToComp(crowdinRow1GreenSvg);
const rowsRestPng = await rasterSvgToComp(crowdinRowsRestOverlaySvg);

const arrowsFull = await rasterSvgToComp(arrowsOnlySvg);

const arrowTopPng = await sharp(arrowsFull)
  .extract(ARROW_TOP_EXTRACT)
  .ensureAlpha()
  .png(pngLossless)
  .toBuffer();

const arrowBotPng = await sharp(arrowsFull)
  .extract(ARROW_BOT_EXTRACT)
  .ensureAlpha()
  .png(pngLossless)
  .toBuffer();

const tw = ARROW_TOP_EXTRACT.width;
const th = ARROW_TOP_EXTRACT.height;
const bw = ARROW_BOT_EXTRACT.width;
const bh = ARROW_BOT_EXTRACT.height;

const topCx = ARROW_TOP_EXTRACT.left + tw / 2;
const topCy = ARROW_TOP_EXTRACT.top + th / 2;
const botCx = ARROW_BOT_EXTRACT.left + bw / 2;
const botCy = ARROW_BOT_EXTRACT.top + bh / 2;

const aeFlyFullPng = await rasterSvgToComp(aeFlyTextFullSvg);
const aeFlyCnFullPng = await rasterSvgToComp(aeFlyTextCnFullSvg);
const aeGlowPng = await rasterSvgToComp(aeTransitionGlowSvg);

const assets = [
  { id: 'img_base', w: W, h: H, u: '', p: dataUrlPng(basePng), e: 1 },
  { id: 'img_row1_strings', w: W, h: H, u: '', p: dataUrlPng(row1StringsPng), e: 1 },
  { id: 'img_row1_green', w: W, h: H, u: '', p: dataUrlPng(row1GreenPng), e: 1 },
  { id: 'img_rows_rest', w: W, h: H, u: '', p: dataUrlPng(rowsRestPng), e: 1 },
  { id: 'img_arrow_top', w: tw, h: th, u: '', p: dataUrlPng(arrowTopPng), e: 1 },
  { id: 'img_arrow_bot', w: bw, h: bh, u: '', p: dataUrlPng(arrowBotPng), e: 1 },
  { id: 'img_fly_ae', w: W, h: H, u: '', p: dataUrlPng(aeFlyFullPng), e: 1 },
  { id: 'img_fly_ae_cn', w: W, h: H, u: '', p: dataUrlPng(aeFlyCnFullPng), e: 1 },
  { id: 'img_ae_glow', w: W, h: H, u: '', p: dataUrlPng(aeGlowPng), e: 1 },
];

const baseLayer = {
  ddd: 0,
  ind: 1,
  ty: 2,
  nm: 'Background',
  refId: 'img_base',
  sr: 1,
  ks: {
    o: { a: 0, ix: 11, k: 100 },
    r: { a: 0, ix: 10, k: 0 },
    p: breathP,
    a: breathA,
    s: breathS,
  },
  ao: 0,
  ip: 0,
  op: OP,
  st: 0,
  bm: 0,
};

/** Bottom ← arrow: horizontal drift opposite phase to top (↑ right while ↓ left) */
const arrowBotLayer = {
  ddd: 0,
  ind: 3,
  ty: 2,
  nm: 'Arrow Crowdin → AE',
  refId: 'img_arrow_bot',
  sr: 1,
  ks: {
    o: { a: 0, ix: 11, k: 88 },
    r: { a: 0, ix: 10, k: 0 },
    p: {
      a: 1,
      ix: 2,
      k: [
        { t: 0, s: [botCx - 4, botCy + 1.5, 0], ...bez() },
        { t: 60, s: [botCx + 4, botCy - 1.5, 0], ...bez() },
        { t: 120, s: [botCx - 4, botCy + 1.5, 0], ...bez() },
        { t: 180, s: [botCx + 4, botCy - 1.5, 0], ...bez() },
        { t: 240, s: [botCx - 4, botCy + 1.5, 0] },
      ],
    },
    a: { a: 0, ix: 1, k: [bw / 2, bh / 2, 0] },
    s: breathS,
  },
  ao: 0,
  ip: 0,
  op: OP,
  st: 0,
  bm: 0,
};

/** Top → arrow: eased horizontal drift (same feel as original Cult Connector Lottie) */
const arrowTopLayer = {
  ddd: 0,
  ind: 2,
  ty: 2,
  nm: 'Arrow AE → Crowdin',
  refId: 'img_arrow_top',
  sr: 1,
  ks: {
    o: {
      a: 1,
      ix: 11,
      k: [
        { t: 0, s: [88], ...bez() },
        { t: 45, s: [100], ...bez() },
        { t: 90, s: [88], ...bez() },
        { t: 135, s: [100], ...bez() },
        { t: 180, s: [88], ...bez() },
        { t: 225, s: [100], ...bez() },
        { t: 240, s: [88] },
      ],
    },
    r: { a: 0, ix: 10, k: 0 },
    p: {
      a: 1,
      ix: 2,
      k: [
        { t: 0, s: [topCx + 4, topCy - 1.5, 0], ...bez() },
        { t: 60, s: [topCx - 4, topCy + 1.5, 0], ...bez() },
        { t: 120, s: [topCx + 4, topCy - 1.5, 0], ...bez() },
        { t: 180, s: [topCx - 4, topCy + 1.5, 0], ...bez() },
        { t: 240, s: [topCx + 4, topCy - 1.5, 0] },
      ],
    },
    a: { a: 0, ix: 1, k: [tw / 2, th / 2, 0] },
    s: breathS,
  },
  ao: 0,
  ip: 0,
  op: OP,
  st: 0,
  bm: 0,
};

const flyAeLayer = {
  ddd: 0,
  ind: 4,
  ty: 2,
  nm: 'String (AE viewport Latin)',
  refId: 'img_fly_ae',
  sr: 1,
  /** No mask: lottie-web SVG + masked <image> often clips glyphs invisible; glyphs sit inside viewport only */
  ks: {
    o: {
      a: 1,
      ix: 11,
      /** Every segment needs i/o so canvas KeyframedValueProperty never hits undefined easing. */
      k: [
        { t: 0, s: [100], ...bez() },
        { t: AE_LAT_FADE_START, s: [100], ...bez() },
        { t: AE_LOREM_CN_END, s: [0], ...bez() },
        { t: AE_CN_LAT_START, s: [0], ...bez() },
        { t: AE_LAT_BACK_FULL, s: [100], ...bez() },
        { t: OP, s: [100], ...bez() },
      ],
    },
    r: { a: 0, ix: 10, k: 0 },
    p: breathP,
    a: breathA,
    s: breathS,
  },
  ao: 0,
  ip: 0,
  op: OP,
  st: 0,
  bm: 0,
};

const flyAeCnLayer = {
  ddd: 0,
  ind: 11,
  ty: 2,
  nm: 'String (AE viewport Chinese)',
  refId: 'img_fly_ae_cn',
  sr: 1,
  ks: {
    o: {
      a: 1,
      ix: 11,
      k: [
        { t: 0, s: [0], ...bez() },
        { t: AE_LOREM_CN_START, s: [0], ...bez() },
        { t: AE_CN_OPACITY_END, s: [100], ...bez() },
        { t: AE_CN_LAT_FADE_START, s: [100], ...bez() },
        { t: AE_CN_OFF_END, s: [0], ...bez() },
        { t: OP, s: [0], ...bez() },
      ],
    },
    r: { a: 0, ix: 10, k: 0 },
    p: breathP,
    a: breathA,
    s: breathS,
  },
  ao: 0,
  ip: 0,
  op: OP,
  st: 0,
  bm: 0,
};

/** Behind Latin/Chinese glyphs, masked to AE viewer — purple pulse during hand-off */
const flyAeGlowLayer = {
  ddd: 0,
  ind: 9,
  ty: 2,
  nm: 'AE label transition glow',
  refId: 'img_ae_glow',
  sr: 1,
  masksProperties: [rectMask('AE viewport', AE_MASK_V)],
  hasMask: true,
  ks: {
    o: {
      a: 1,
      ix: 11,
      k: [
        { t: 0, s: [0], ...bez() },
        { t: AE_GLOW_ON_START, s: [0], ...bez() },
        { t: AE_GLOW_PEAK, s: [42], ...bez() },
        { t: AE_GLOW_OFF_END, s: [0], ...bez() },
        { t: 108, s: [0], ...bez() },
        { t: AE_REV_GLOW_ON_START, s: [0], ...bez() },
        { t: AE_REV_GLOW_PEAK, s: [42], ...bez() },
        { t: AE_REV_GLOW_OFF_END, s: [0], ...bez() },
        { t: 198, s: [0], ...bez() },
        { t: OP, s: [0], ...bez() },
      ],
    },
    r: { a: 0, ix: 10, k: 0 },
    p: breathP,
    a: breathA,
    s: breathS,
  },
  ao: 0,
  ip: 0,
  op: OP,
  st: 0,
  /** Normal blend so halo fades to truly off; multiply read as “always tinted” on canvas */
  bm: 0,
};

const row1StringsLayer = {
  ddd: 0,
  ind: 6,
  ty: 2,
  nm: 'Crowdin row 1 strings',
  refId: 'img_row1_strings',
  sr: 1,
  ks: {
    o: { a: 0, ix: 11, k: 100 },
    r: { a: 0, ix: 10, k: 0 },
    p: breathP,
    a: breathA,
    s: breathS,
  },
  ao: 0,
  ip: 0,
  op: OP,
  st: 0,
  bm: 0,
};

/** Green chrome only — subtle opacity breathe so strings stay crisp */
const row1GreenPulseLayer = {
  ddd: 0,
  ind: 7,
  ty: 2,
  nm: 'Crowdin row 1 green highlight',
  refId: 'img_row1_green',
  sr: 1,
  ks: {
    o: {
      a: 1,
      ix: 11,
      k: [
        { t: 0, s: [52], ...bez() },
        { t: 60, s: [100], ...bez() },
        { t: 120, s: [52], ...bez() },
        { t: 180, s: [100], ...bez() },
        { t: 240, s: [52] },
      ],
    },
    r: { a: 0, ix: 10, k: 0 },
    p: breathP,
    a: breathA,
    s: breathS,
  },
  ao: 0,
  ip: 0,
  op: OP,
  st: 0,
  bm: 0,
};

/** Rows 2–5: fully visible entire timeline */
const rowsRestRevealLayer = {
  ddd: 0,
  ind: 8,
  ty: 2,
  nm: 'Crowdin rows 2–5 reveal',
  refId: 'img_rows_rest',
  sr: 1,
  ks: {
    o: { a: 0, ix: 11, k: 100 },
    r: { a: 0, ix: 10, k: 0 },
    p: breathP,
    a: breathA,
    s: breathS,
  },
  ao: 0,
  ip: 0,
  op: OP,
  st: 0,
  bm: 0,
};

const lottie = {
  v: '5.7.4',
  fr: FR,
  ip: 0,
  op: OP,
  w: W,
  h: H,
  nm: 'Cult Connector Sync',
  ddd: 0,
  assets,
  fonts: { list: [] },
  layers: [
    /** AE strings + glow first so Crowdin overlays never sit above the crossfade on canvas. Latin above Chinese. */
    flyAeLayer,
    flyAeCnLayer,
    flyAeGlowLayer,
    rowsRestRevealLayer,
    row1StringsLayer,
    row1GreenPulseLayer,
    arrowTopLayer,
    arrowBotLayer,
    baseLayer,
  ],
};

fs.writeFileSync(outJsonPath, JSON.stringify(lottie));
console.log(`Wrote ${outJsonPath} (${fs.statSync(outJsonPath).size} bytes)`);

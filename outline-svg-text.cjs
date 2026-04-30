#!/usr/bin/env node
/**
 * Rasterizers never match Chromium IDE SVG text. Outline → paths so resvg PNG
 * matches the outlined SVG (geometry only).
 */
const fs = require('fs');
const fontkit = require('fontkit');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const HEL = '/System/Library/Fonts/HelveticaNeue.ttc';
const HG = '/System/Library/Fonts/Hiragino Sans GB.ttc';
const AU_PATH = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';

const helColl = fontkit.openSync(HEL);
const hgColl = fontkit.openSync(HG);
let arialUnicode = null;
try {
  arialUnicode = fontkit.openSync(AU_PATH);
} catch {
  console.error('Warning: Arial Unicode.ttf not found; arrows may show as squares.');
}

/** Match CSS/Chromium: 800 does not pick Condensed — same Bold as 700 */
function helFace(weight) {
  if (weight >= 700) return helColl.fonts[1];
  if (weight >= 600) return helColl.fonts[10];
  return helColl.fonts[0];
}

function hgFace(weight) {
  return weight >= 600 ? hgColl.fonts[2] : hgColl.fonts[0];
}

function hasCjk(s) {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(s);
}

function parseCssClasses(styleText) {
  const map = {};
  const re = /\.([\w-]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(styleText))) map[m[1]] = m[2].trim();
  return map;
}

function parseFontFromDecl(decl) {
  const fontMatch = decl.match(/font:\s*(\d+)\s+([\d.]+)px\s+([^;]+)/);
  if (!fontMatch) return null;
  const opacityMatch = decl.match(/opacity:\s*([\d.]+)/);
  return {
    weight: +fontMatch[1],
    size: +fontMatch[2],
    opacity: opacityMatch ? opacityMatch[1] : undefined,
  };
}

function parseInlineFont(styleAttr) {
  const fontMatch = styleAttr.match(/font:\s*(\d+)\s+([\d.]+)px\s+/);
  if (!fontMatch) return null;
  return { weight: +fontMatch[1], size: +fontMatch[2] };
}

function resolveFont(textContent, classFont, inlineFont) {
  const spec = inlineFont || classFont;
  if (!spec) throw new Error('No font spec for text');
  const { weight, size } = spec;
  if (hasCjk(textContent)) return { font: hgFace(weight), size };
  return { font: helFace(weight), size };
}

function baselineTy(ty, fontSize, dominantBaseline) {
  const db = dominantBaseline || 'alphabetic';
  if (db === 'middle' || db === 'central') return ty + fontSize * 0.312;
  return ty;
}

function applyUppercase(textContent, mergedDecl, inlineStyle) {
  const u =
    /text-transform:\s*uppercase/i.test(mergedDecl || '') ||
    /text-transform:\s*uppercase/i.test(inlineStyle || '');
  return u ? textContent.toUpperCase() : textContent;
}

function parseLetterSpacingEm(mergedDecl, inlineStyle) {
  const pool = `${mergedDecl || ''} ${inlineStyle || ''}`;
  const m = pool.match(/letter-spacing:\s*([\d.]+)em/i);
  return m ? +m[1] : 0;
}

function outlineText(textEl, cssMap) {
  const doc = textEl.ownerDocument;
  let textContent = [...textEl.childNodes]
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent)
    .join('');

  const cls = textEl.getAttribute('class');
  let mergedDecl = '';
  if (cls) {
    for (const c of cls.trim().split(/\s+/)) {
      if (cssMap[c]) mergedDecl += cssMap[c];
    }
  }
  const classFont = mergedDecl ? parseFontFromDecl(mergedDecl) : null;
  const inlineStyle = textEl.getAttribute('style') || '';
  const inlineFont = inlineStyle ? parseInlineFont(inlineStyle) : null;

  textContent = applyUppercase(textContent, mergedDecl, inlineStyle);

  const { font, size } = resolveFont(textContent, classFont, inlineFont);

  /* Use element-local x/y only. Ancestor <g transform="..."> is applied by the SVG renderer;
     baking translate here would double-apply (e.g. pill text vanishes off-canvas). */
  const bx = +textEl.getAttribute('x');
  const by = +textEl.getAttribute('y');

  const anchor = textEl.getAttribute('text-anchor') || 'start';
  const dominantBaseline = textEl.getAttribute('dominant-baseline');
  const baselineY = baselineTy(by, size, dominantBaseline);

  const fill = textEl.getAttribute('fill') || '#000';
  let opacity = textEl.getAttribute('opacity');
  if (opacity == null && classFont?.opacity != null) opacity = classFont.opacity;

  const scale = size / font.unitsPerEm;
  const run = font.layout(textContent);
  const trackingPx = parseLetterSpacingEm(mergedDecl, inlineStyle) * size;

  let totalWidth = 0;
  for (let i = 0; i < run.glyphs.length; i++) {
    totalWidth += run.positions[i].xAdvance * scale;
    if (i < run.glyphs.length - 1) totalWidth += trackingPx;
  }

  let startX = bx;
  if (anchor === 'middle') startX = bx - totalWidth / 2;
  if (anchor === 'end') startX = bx - totalWidth;

  const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');

  let cx = startX;
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i];
    const pos = run.positions[i];
    const advance = pos.xAdvance * scale;

    let drawGlyph = glyph;
    let drawScale = scale;

    if (glyph.name === '.notdef') {
      if (arialUnicode && glyph.codePoints?.length) {
        const ag = arialUnicode.glyphForCodePoint(glyph.codePoints[0]);
        if (ag?.path?.commands?.length) {
          drawGlyph = ag;
          drawScale = size / arialUnicode.unitsPerEm;
        } else {
          cx += advance;
          if (i < run.glyphs.length - 1) cx += trackingPx;
          continue;
        }
      } else {
        cx += advance;
        if (i < run.glyphs.length - 1) cx += trackingPx;
        continue;
      }
    }

    if (!drawGlyph.path || drawGlyph.path.commands.length === 0) {
      cx += advance;
      if (i < run.glyphs.length - 1) cx += trackingPx;
      continue;
    }

    const gx = cx + pos.xOffset * scale;
    const gy = baselineY + pos.yOffset * scale;

    const pathEl = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = drawGlyph.path.scale(drawScale, -drawScale).translate(gx, gy).toSVG();
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('fill', fill);
    if (opacity != null) pathEl.setAttribute('opacity', String(opacity));
    g.appendChild(pathEl);

    cx += advance;
    if (i < run.glyphs.length - 1) cx += trackingPx;
  }

  return g;
}

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error('Usage: outline-svg-text.cjs input.svg output.svg');
  process.exit(1);
}

const svgText = fs.readFileSync(input, 'utf8');
const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');

const styleEls = [...doc.getElementsByTagName('style')];
let cssMap = {};
if (styleEls.length) cssMap = parseCssClasses(styleEls[0].textContent || '');

const texts = [...doc.getElementsByTagName('text')];
for (const t of texts) {
  const g = outlineText(t, cssMap);
  t.parentNode.replaceChild(g, t);
}

for (const s of styleEls) s.parentNode.removeChild(s);

fs.writeFileSync(output, new XMLSerializer().serializeToString(doc), 'utf8');
console.error('Outlined', texts.length, '→', output);

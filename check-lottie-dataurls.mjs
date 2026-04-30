#!/usr/bin/env node
/**
 * Verifies embedded PNG data URLs exist in a Lottie JSON file (detect WP/security truncation).
 * Usage: node check-lottie-dataurls.mjs [path/to/file.json]
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? join(__dirname, 'cult-connector-sync-half.json');
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
let ok = true;
for (const a of j.assets ?? []) {
  const p = a.p;
  const short = typeof p === 'string' ? p.slice(0, 80) : '';
  const valid = typeof p === 'string' && p.startsWith('data:image/png;base64,') && p.length > 200;
  console.log(`${valid ? '✓' : '✗'} ${a.id ?? '?'} (${a.w}×${a.h}) ${valid ? `base64 len ${p.length}` : short}`);
  if (!valid) ok = false;
}
process.exit(ok ? 0 : 1);

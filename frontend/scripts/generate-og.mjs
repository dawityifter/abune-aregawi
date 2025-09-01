#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const SVG_TEMPLATE = path.join(SCRIPTS_DIR, 'og-template.svg');
const OUT_JPG = path.join(PUBLIC_DIR, 'og-image.jpg');

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true }).catch(() => {});
}

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function generateWithSharp() {
  const svgBuf = await fsp.readFile(SVG_TEMPLATE);
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (e) {
    return false; // sharp not installed
  }
  const img = sharp(svgBuf, { density: 300 });
  await img.jpeg({ quality: 85 }).toFile(OUT_JPG);
  return true;
}

async function fallbackCopy() {
  // Prefer a meaningful image if present; otherwise create a plain JPEG placeholder
  const candidates = [
    path.join(PUBLIC_DIR, 'mezemiran.jpg'),
    path.join(PUBLIC_DIR, 'AbuneAregawiZelle.png'),
    path.join(PUBLIC_DIR, 'cross.png'),
  ];
  for (const c of candidates) {
    if (await exists(c)) {
      await fsp.copyFile(c, OUT_JPG);
      return true;
    }
  }
  // Create a minimal JPEG placeholder if nothing else is available
  // We'll write an empty file if JPEG creation is not feasible
  await fsp.writeFile(OUT_JPG, Buffer.alloc(0));
  return true;
}

(async () => {
  await ensureDir(PUBLIC_DIR);
  const hasTemplate = await exists(SVG_TEMPLATE);
  if (!hasTemplate) {
    console.warn(`[og] SVG template missing at ${SVG_TEMPLATE}; creating a simple placeholder OG image.`);
    await fallbackCopy();
    return;
  }
  const ok = await generateWithSharp();
  if (ok) {
    console.log(`[og] Generated ${path.relative(ROOT, OUT_JPG)} using sharp.`);
  } else {
    console.warn('[og] sharp not installed; copying a fallback image to og-image.jpg. To enable high-quality OG, run:');
    console.warn('     npm i -D sharp');
    await fallbackCopy();
  }
})();

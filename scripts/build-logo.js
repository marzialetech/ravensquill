#!/usr/bin/env node
/**
 * Trace logo PNG to black-on-transparent SVG via potrace.
 * Place source PNG in scripts/sources/ (e.g. logo-text.png), or it will look
 * in .cursor/.../assets/ for image-*.png.
 * Output: assets/logo.svg
 * Requires: ImageMagick (magick), potrace. Run: node build-logo.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const scriptDir = path.resolve(__dirname);
const repoRoot = path.join(scriptDir, '..');
const sourcesDir = path.join(scriptDir, 'sources');
const assetsDir = path.join(repoRoot, 'assets');

// Default source filename; override via first arg
const defaultSource = 'logo-text.png';
const sourceArg = process.argv[2] || defaultSource;

function findSource(filename) {
  const inSources = path.join(sourcesDir, filename);
  if (fs.existsSync(inSources)) return inSources;
  // Fallback: Cursor assets
  const projectSlug = repoRoot.split(path.sep).pop() || 'ravensquill';
  const cursorAssets = path.join(process.env.HOME || '', '.cursor', 'projects', projectSlug, 'assets');
  const inCursor = path.join(cursorAssets, filename);
  if (fs.existsSync(inCursor)) return inCursor;
  return null;
}

/**
 * Trace PNG to SVG. Dark shapes become the traced paths.
 * Output: black fill on transparent background (for dark academia header).
 */
function traceToBlackSvg(pngPath, svgPath) {
  const pbmPath = path.join(scriptDir, '_tmp.pbm');
  try {
    // Black shape on white background for potrace. Dark text on light bg → threshold 50%
    execSync(`magick "${pngPath}" -colorspace gray -threshold 50% "${pbmPath}"`, { stdio: 'inherit' });
    execSync(`potrace "${pbmPath}" -s -o "${svgPath}"`, { stdio: 'inherit' });
  } catch (e) {
    try {
      // If inverted (white text on dark), negate first
      execSync(`magick "${pngPath}" -colorspace gray -negate -threshold 50% "${pbmPath}"`, { stdio: 'inherit' });
      execSync(`potrace "${pbmPath}" -s -o "${svgPath}"`, { stdio: 'inherit' });
    } catch (e2) {
      console.error('Trace failed for', pngPath, e2.message);
      throw e2;
    }
  }
  if (fs.existsSync(pbmPath)) fs.unlinkSync(pbmPath);

  let svg = fs.readFileSync(svgPath, 'utf8');
  // Black fill for dark text on transparent (dark academia)
  svg = svg.replace(/fill="#?[^"]*"/gi, 'fill="#1a1510"');
  fs.writeFileSync(svgPath, svg, 'utf8');
}

if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true });
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const pngPath = findSource(sourceArg);
if (!pngPath) {
  console.error('Source not found. Place PNG in', sourcesDir, 'or pass filename.');
  process.exit(1);
}

const svgPath = path.join(assetsDir, 'logo.svg');
console.log('Tracing', pngPath, '...');
traceToBlackSvg(pngPath, svgPath);
console.log('  ->', svgPath);
console.log('Done.');

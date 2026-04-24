/**
 * Generates all PWA icon and splash screen PNGs from SVG templates.
 * Run: node scripts/generate-pwa-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'public');

// --- SVG design: minimal open-book on dark background using pure paths ---
// All app icons are full-bleed (no pre-baked rounded corners — OS applies its
// own mask shape). Content is scaled to 60% of canvas so the book logo sits
// entirely within the maskable safe zone (inner 80% circle) with ~20% padding
// on every side. Favicons use a tighter scale since they are never masked.
function iconSVG({ size = 512, favicon = false } = {}) {
  const r = 0;
  const scale = favicon ? 0.78 : 0.60;
  const cs = size * scale;        // content size
  const cx = (size - cs) / 2;    // content x offset
  const cy = (size - cs) / 2;    // content y offset
  const mid = size / 2;

  // Book proportions relative to cs
  const bw = cs * 0.88;   // book total width
  const bh = cs * 0.72;   // book height
  const bx = cx + (cs - bw) / 2;
  const by = cy + (cs - bh) / 2 + cs * 0.03;
  const spine = mid;      // spine x = center
  const pageW = bw / 2;

  // Corner radius for pages
  const pr = bh * 0.06;
  // Page colors
  const pageLeft  = '#1c1c2e';
  const pageRight = '#16162a';
  const green = '#10B981';
  const lineColor = '#10B981';
  const lineOpacity = '0.45';
  const spineColor = '#10B981';

  // Left page: top-left rounded, bottom-left rounded
  const lx1 = bx, ly1 = by;
  const lx2 = spine - 4, ly2 = by;
  const lx3 = spine - 4, ly3 = by + bh;
  const lx4 = bx, ly4 = by + bh;

  // Right page
  const rx1 = spine + 4, ry1 = by;
  const rx2 = bx + bw, ry2 = by;
  const rx3 = bx + bw, ry3 = by + bh;
  const rx4 = spine + 4, ry4 = by + bh;

  // Text lines on pages (3 lines each)
  const linesY = [0.28, 0.45, 0.62].map(t => by + bh * t);
  const lineInset = bw * 0.07;
  const lineLen = pageW * 0.72;

  const leftLines = linesY.map(y =>
    `<line x1="${lx1 + lineInset}" y1="${y}" x2="${lx1 + lineInset + lineLen}" y2="${y}"
      stroke="${lineColor}" stroke-width="${size * 0.012}" stroke-opacity="${lineOpacity}" stroke-linecap="round"/>`
  ).join('\n    ');

  const rightLines = linesY.map(y =>
    `<line x1="${rx1 + lineInset}" y1="${y}" x2="${rx1 + lineInset + lineLen}" y2="${y}"
      stroke="${lineColor}" stroke-width="${size * 0.012}" stroke-opacity="${lineOpacity}" stroke-linecap="round"/>`
  ).join('\n    ');

  // Bottom curve (open book bottom arc)
  const arcY = by + bh + bh * 0.07;
  const arcCY = by + bh + bh * 0.14;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#111113"/>
  <!-- left page -->
  <path d="M ${lx1 + pr},${ly1} Q ${lx1},${ly1} ${lx1},${ly1 + pr}
            L ${lx4},${ly4 - pr} Q ${lx4},${ly4} ${lx4 + pr},${ly4}
            L ${lx3 - pr},${ly3} Q ${lx3},${ly3} ${lx3},${ly3 - pr}
            L ${lx2},${ly2 + pr} Q ${lx2},${ly2} ${lx2 - pr},${ly2} Z"
        fill="${pageLeft}"/>
  <!-- right page -->
  <path d="M ${rx1 + pr},${ry1} Q ${rx1},${ry1} ${rx1},${ry1 + pr}
            L ${rx4},${ry4 - pr} Q ${rx4},${ry4} ${rx4 + pr},${ry4}
            L ${rx3 - pr},${ry3} Q ${rx3},${ry3} ${rx3},${ry3 - pr}
            L ${rx2},${ry2 + pr} Q ${rx2},${ry2} ${rx2 - pr},${ry2} Z"
        fill="${pageRight}"/>
  <!-- page lines left -->
  ${leftLines}
  <!-- page lines right -->
  ${rightLines}
  <!-- spine line -->
  <line x1="${spine}" y1="${by}" x2="${spine}" y2="${by + bh}"
        stroke="${spineColor}" stroke-width="${size * 0.016}" stroke-linecap="round"/>
  <!-- bottom open-book curve -->
  <path d="M ${bx},${by + bh} Q ${mid},${arcCY} ${bx + bw},${by + bh}"
        fill="none" stroke="${spineColor}" stroke-width="${size * 0.016}" stroke-linecap="round"/>
  <!-- green dot on spine top -->
  <circle cx="${spine}" cy="${by - size * 0.018}" r="${size * 0.022}" fill="${green}"/>
</svg>`;
}

// Splash screen SVG (centered logo on dark background)
function splashSVG(w, h) {
  const iconSize = Math.min(w, h) * 0.28;
  const ix = (w - iconSize) / 2;
  const iy = (h - iconSize) / 2 - h * 0.04;
  // Text below icon
  const textY = iy + iconSize + h * 0.06;
  const fontSize = Math.min(w, h) * 0.055;
  const subFontSize = fontSize * 0.52;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#0a0a0b"/>
  <!-- centered icon -->
  <image href="data:image/svg+xml;base64,${Buffer.from(iconSVG({ size: 512, rounded: true })).toString('base64')}"
         x="${ix}" y="${iy}" width="${iconSize}" height="${iconSize}"/>
  <!-- app name -->
  <text x="${w/2}" y="${textY}" text-anchor="middle"
        font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="${fontSize}" font-weight="700" fill="#f9fafb" letter-spacing="-0.5">StudyLog</text>
  <text x="${w/2}" y="${textY + fontSize * 1.35}" text-anchor="middle"
        font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="${subFontSize}" font-weight="400" fill="#10B981" letter-spacing="0.5">Track your learning</text>
</svg>`;
}

async function savePNG(svgString, outFile, size) {
  const buf = Buffer.from(svgString);
  await sharp(buf)
    .resize(size, size, { fit: 'fill' })
    .flatten({ background: '#111113' })
    .png({ compressionLevel: 9 })
    .toFile(outFile);
  console.log(`  ✓  ${path.basename(outFile)}`);
}

async function saveSplash(svgString, outFile, w, h) {
  const buf = Buffer.from(svgString);
  await sharp(buf)
    .resize(w, h, { fit: 'fill' })
    .flatten({ background: '#0a0a0b' })   // splashes stay pure black
    .png({ compressionLevel: 9 })
    .toFile(outFile);
  console.log(`  ✓  ${path.basename(outFile)}`);
}

async function main() {
  console.log('\n── Generating PWA icons ──');

  // App icons — full-bleed, 60% safe-zone scale, suitable for "any maskable"
  await savePNG(iconSVG({ size: 512 }),                path.join(OUT, 'apple-touch-icon.png'), 180);
  await savePNG(iconSVG({ size: 512 }),                path.join(OUT, 'icon-192x192.png'), 192);
  await savePNG(iconSVG({ size: 512 }),                path.join(OUT, 'icon-512x512.png'), 512);

  // Favicons — tighter scale (never masked, tiny sizes need more of the canvas)
  await savePNG(iconSVG({ size: 512, favicon: true }), path.join(OUT, 'favicon-32x32.png'), 32);
  await savePNG(iconSVG({ size: 512, favicon: true }), path.join(OUT, 'favicon-16x16.png'), 16);

  console.log('\n── Generating iOS splash screens ──');

  const splashes = [
    // iPhone SE (1st/2nd gen) / iPod Touch
    { w: 640,  h: 1136, name: 'splash-640x1136.png' },
    // iPhone 6/7/8
    { w: 750,  h: 1334, name: 'splash-750x1334.png' },
    // iPhone 6+/7+/8+
    { w: 1242, h: 2208, name: 'splash-1242x2208.png' },
    // iPhone X / XS / 11 Pro
    { w: 1125, h: 2436, name: 'splash-1125x2436.png' },
    // iPhone XR / 11
    { w: 828,  h: 1792, name: 'splash-828x1792.png' },
    // iPhone 12 / 13 / 14
    { w: 1170, h: 2532, name: 'splash-1170x2532.png' },
    // iPhone 12 Pro Max / 13 Pro Max / 14 Plus
    { w: 1284, h: 2778, name: 'splash-1284x2778.png' },
    // iPhone 14 Pro
    { w: 1179, h: 2556, name: 'splash-1179x2556.png' },
    // iPhone 14 Pro Max / 15 Pro Max
    { w: 1290, h: 2796, name: 'splash-1290x2796.png' },
    // iPad (9th gen / Air)
    { w: 1536, h: 2048, name: 'splash-1536x2048.png' },
    // iPad Pro 11"
    { w: 1668, h: 2388, name: 'splash-1668x2388.png' },
    // iPad Pro 12.9"
    { w: 2048, h: 2732, name: 'splash-2048x2732.png' },
  ];

  const splashDir = path.join(OUT, 'splash');
  if (!fs.existsSync(splashDir)) fs.mkdirSync(splashDir);

  for (const { w, h, name } of splashes) {
    await saveSplash(splashSVG(w, h), path.join(splashDir, name), w, h);
  }

  console.log('\nAll done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });

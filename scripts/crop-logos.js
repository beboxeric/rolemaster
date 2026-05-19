// Crop the four logo PNGs to the bounding box of their non-transparent
// pixels (with a tiny 8px padding around the artwork). This eliminates
// the ~25-30% surrounding whitespace each PNG was shipping, so CSS
// heights map directly to visible artwork — no clip-path workarounds.
// Run once after a designer drops fresh artwork in app/public/logos/.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'app', 'public', 'logos');
const FILES = ['rm-light-h.png', 'rm-light-v.png', 'rm-dark-v.png', 'rm-black-h.png'];
const PAD = 8;          // pixels of breathing room around the artwork
const ALPHA_MIN = 16;   // pixels with alpha <= this count as background

(async () => {
  for (const name of FILES) {
    const filePath = path.join(DIR, name);
    if (!fs.existsSync(filePath)) {
      console.log(`skip ${name} — not found`);
      continue;
    }
    const img = sharp(filePath);
    const meta = await img.metadata();
    const { width, height, channels } = meta;
    const buf = await img.raw().toBuffer();
    if (channels < 4) {
      console.log(`skip ${name} — no alpha channel (${channels} channels)`);
      continue;
    }
    // Walk pixels finding bounds of non-transparent area.
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = buf[(y * width + x) * channels + 3];
        if (a > ALPHA_MIN) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      console.log(`skip ${name} — fully transparent?`);
      continue;
    }
    // Apply padding, clamp to image bounds.
    const left = Math.max(0, minX - PAD);
    const top = Math.max(0, minY - PAD);
    const cropW = Math.min(width - left, maxX - minX + 1 + PAD * 2);
    const cropH = Math.min(height - top, maxY - minY + 1 + PAD * 2);
    const ratio = ((cropW * cropH) / (width * height) * 100).toFixed(1);
    console.log(`${name}: ${width}x${height} -> ${cropW}x${cropH} (${ratio}% of original area)`);
    await sharp(filePath).extract({ left, top, width: cropW, height: cropH }).toFile(filePath + '.tmp');
    fs.renameSync(filePath + '.tmp', filePath);
  }
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });

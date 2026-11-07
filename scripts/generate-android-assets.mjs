/**
 * Genererer launcher-ikoner og splash-logo til Android ud fra public/icon.svg.
 * Kør: node scripts/generate-android-assets.mjs
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android/app/src/main/res');
const brand = '#0b1220';

/** Kvitterings-symbolet uden baggrund (bruges til adaptive ikoner og splash). */
const glyphSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2dd4bf"/>
      <stop offset="0.55" stop-color="#0891b2"/>
      <stop offset="1" stop-color="#6366f1"/>
    </linearGradient>
  </defs>
  <path d="M150 96h196a40 40 0 0 1 40 40v244l-46-28-46 28-46-28-46 28-52-28V136a40 40 0 0 1 40-40z" fill="url(#g)"/>
  <path d="M186 186h132M186 240h132M186 294h74" stroke="#04211f" stroke-width="24" stroke-linecap="round" opacity="0.85"/>
</svg>`;

/** Ikon med mørk baggrund (legacy launcher-ikon). */
const iconSvg = (size, radius = 116) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2dd4bf"/>
      <stop offset="0.55" stop-color="#0891b2"/>
      <stop offset="1" stop-color="#6366f1"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="${brand}"/>
  <g transform="translate(64 64) scale(0.75)">
    <path d="M150 96h196a40 40 0 0 1 40 40v244l-46-28-46 28-46-28-46 28-52-28V136a40 40 0 0 1 40-40z" fill="url(#g)"/>
    <path d="M186 186h132M186 240h132M186 294h74" stroke="#04211f" stroke-width="24" stroke-linecap="round" opacity="0.85"/>
  </g>
</svg>`;

const DENSITIES = [
  { dir: 'mipmap-mdpi', icon: 48, foreground: 108 },
  { dir: 'mipmap-hdpi', icon: 72, foreground: 162 },
  { dir: 'mipmap-xhdpi', icon: 96, foreground: 216 },
  { dir: 'mipmap-xxhdpi', icon: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', icon: 192, foreground: 432 },
];

const circleMask = (size) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${
      size / 2
    }" r="${size / 2}" fill="#fff"/></svg>`,
  );

async function main() {
  for (const density of DENSITIES) {
    const dir = join(res, density.dir);
    mkdirSync(dir, { recursive: true });

    const square = await sharp(Buffer.from(iconSvg(density.icon))).png().toBuffer();
    writeFileSync(join(dir, 'ic_launcher.png'), square);

    const rounded = await sharp(square)
      .composite([{ input: circleMask(density.icon), blend: 'dest-in' }])
      .png()
      .toBuffer();
    writeFileSync(join(dir, 'ic_launcher_round.png'), rounded);

    // Adaptivt ikon: symbolet fylder ca. 66 % af fladen (sikker zone).
    const glyphSize = Math.round(density.foreground * 0.66);
    const glyph = await sharp(Buffer.from(glyphSvg(glyphSize))).png().toBuffer();
    writeFileSync(
      join(dir, 'ic_launcher_foreground.png'),
      await sharp({
        create: {
          width: density.foreground,
          height: density.foreground,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input: glyph, gravity: 'center' }])
        .png()
        .toBuffer(),
    );
  }

  // Splash: mørk baggrund med logo, centreret. Bruges som layer-list.
  const logo = await sharp(Buffer.from(glyphSvg(360))).png().toBuffer();
  mkdirSync(join(res, 'drawable-nodpi'), { recursive: true });
  writeFileSync(join(res, 'drawable-nodpi/splash_logo.png'), logo);

  writeFileSync(
    join(res, 'drawable/splash.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background" />
    <item android:gravity="center">
        <bitmap android:src="@drawable/splash_logo" android:gravity="center" />
    </item>
</layer-list>
`,
  );

  // Fjern Capacitors hvide splash-billeder, så vores layer-list bruges.
  const removeDir = (path) => existsSync(path) && rmSync(path, { recursive: true, force: true });
  for (const entry of readdirSync(res)) {
    if (!entry.startsWith('drawable-land') && !entry.startsWith('drawable-port')) continue;
    const folder = join(res, entry);
    if (!statSync(folder).isDirectory()) continue;
    const splash = join(folder, 'splash.png');
    removeDir(splash);
    if (readdirSync(folder).length === 0) removeDir(folder);
  }
  removeDir(join(res, 'drawable/splash.png'));

  writeFileSync(
    join(res, 'values/colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${brand}</color>
    <color name="splash_background">${brand}</color>
    <color name="colorPrimary">#0d9488</color>
    <color name="colorPrimaryDark">${brand}</color>
    <color name="colorAccent">#2dd4bf</color>
</resources>
`,
  );

  console.log('✓ Android-ikoner og splash genereret');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

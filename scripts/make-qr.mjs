/**
 * Genererer en QR-kode (docs/kroner-apk-qr.png) der peger på APK-downloadlinket.
 * Kør: node scripts/make-qr.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = 'https://github.com/Antoniscool123/Budget-app-/releases/download/apk/kroner.apk';

mkdirSync(join(root, 'docs'), { recursive: true });

await QRCode.toFile(join(root, 'docs/kroner-apk-qr.png'), url, {
  width: 560,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: '#0b1220', light: '#ffffff' },
});

writeFileSync(join(root, 'docs/kroner-apk-qr.txt'), `${url}\n`);
console.log(`✓ QR-kode genereret for ${url}`);

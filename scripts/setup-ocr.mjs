/**
 * Kopierer OCR-motoren (Tesseract worker, wasm-kerne og dansk sprogdata) fra
 * node_modules ind i public/, så appen selv kan servere filerne.
 *
 * Det gør scanningen fuldt offline-venlig og uafhængig af CDN'er — og holder
 * samtidig store binærfiler ude af git-historikken.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const tesseractDir = join(publicDir, 'tesseract');
const coreDir = join(tesseractDir, 'core');
const tessdataDir = join(publicDir, 'tessdata');

const files = [
  // Worker-script
  [join(root, 'node_modules/tesseract.js/dist/worker.min.js'), join(tesseractDir, 'worker.min.js')],
  // wasm-kerne: både SIMD- og standardvariant, så alle browsere understøttes
  [join(root, 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js'), join(coreDir, 'tesseract-core-simd-lstm.wasm.js')],
  [join(root, 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm'), join(coreDir, 'tesseract-core-simd-lstm.wasm')],
  [join(root, 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js'), join(coreDir, 'tesseract-core-lstm.wasm.js')],
  [join(root, 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm'), join(coreDir, 'tesseract-core-lstm.wasm')],
  // Dansk sprogmodel (best/int = bedst nøjagtighed pr. kB)
  [join(root, 'node_modules/@tesseract.js-data/dan/4.0.0_best_int/dan.traineddata.gz'), join(tessdataDir, 'dan.traineddata.gz')],
];

let copied = 0;
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.error(`\n✗ Mangler ${from}\n  Kør "npm install" først.\n`);
    process.exit(1);
  }
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied += 1;
}

console.log(copied === 0 ? '✓ OCR-filer er allerede på plads' : `✓ Kopierede ${copied} OCR-filer til public/`);

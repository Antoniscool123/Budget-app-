/**
 * Kopierer OCR-motoren (Tesseract worker, wasm-kerne og dansk sprogdata) fra
 * node_modules ind i public/, så appen selv kan servere filerne.
 *
 * Det gør scanningen fuldt offline-venlig og uafhængig af CDN'er — og holder
 * samtidig store binærfiler ude af git-historikken.
 */
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const tesseractDir = join(publicDir, 'tesseract');
const tessdataDir = join(publicDir, 'tessdata');

const files = [
  // Worker-script
  [join(root, 'node_modules/tesseract.js/dist/worker.min.js'), join(tesseractDir, 'worker.min.js')],
  // wasm-kerne: både SIMD- og standardvariant, så alle browsere understøttes.
  // Filerne SKAL ligge ved siden af worker.min.js, fordi Tesseract finder sin
  // .wasm-fil relativt til workerens placering (self.location).
  [join(root, 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js'), join(tesseractDir, 'tesseract-core-simd-lstm.wasm.js')],
  [join(root, 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm'), join(tesseractDir, 'tesseract-core-simd-lstm.wasm')],
  [join(root, 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js'), join(tesseractDir, 'tesseract-core-lstm.wasm.js')],
  [join(root, 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm'), join(tesseractDir, 'tesseract-core-lstm.wasm')],
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

// Sprogmodellen lægges udpakket i samme mappe som workeren — den mappe ved vi
// bliver leveret i APK'en. Den pakkede .gz-fil bliver liggende i tessdata som
// reserve, hvis en platform foretrækker den.
const gzPath = join(tessdataDir, 'dan.traineddata.gz');
const plainPath = join(tesseractDir, 'dan.traineddata');
// Samme fil under et .wasm-navn: Android-WebView'en leverer .wasm-filer med en
// kendt MIME-type, så vi altid har en vej til sprogmodellen.
const wasmAliasPath = join(tesseractDir, 'dan.traineddata.wasm');
if (existsSync(gzPath) && (!existsSync(plainPath) || statSync(plainPath).size < 100000)) {
  const model = gunzipSync(readFileSync(gzPath));
  writeFileSync(plainPath, model);
  writeFileSync(wasmAliasPath, model);
  copied += 1;
}

console.log(copied === 0 ? '✓ OCR-filer er allerede på plads' : `✓ Kopierede og udpakkede ${copied} OCR-filer til public/`);

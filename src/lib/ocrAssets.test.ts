import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regressionstest: Tesseract slår sin .wasm-fil op relativt til workerens
 * placering (self.location). Ligger kernefilerne i en undermappe, hænger
 * scanningen — så de SKAL ligge ved siden af worker.min.js.
 */
const base = join(process.cwd(), 'public');

describe('OCR-filer', () => {
  const files = [
    'tesseract/worker.min.js',
    'tesseract/dan.traineddata',
    'tesseract/dan.traineddata.wasm',
    'tesseract/tesseract-core-simd-lstm.wasm.js',
    'tesseract/tesseract-core-simd-lstm.wasm',
    'tesseract/tesseract-core-lstm.wasm.js',
    'tesseract/tesseract-core-lstm.wasm',
    'tessdata/dan.traineddata.gz',
  ];

  it.each(files)('%s findes og er ikke tom', (file) => {
    const path = join(base, file);
    expect(existsSync(path), `${file} mangler — kør scripts/setup-ocr.mjs`).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(1024);
  });
});

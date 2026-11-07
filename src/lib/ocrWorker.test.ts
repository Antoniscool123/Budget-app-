import { beforeEach, describe, expect, it, vi } from 'vitest';

const createWorkerMock = vi.fn(async () => ({
  recognize: vi.fn(async () => ({ data: { text: '', confidence: 0 } })),
  terminate: vi.fn(async () => undefined),
}));
const idbSetMock = vi.fn(async () => undefined);

vi.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => createWorkerMock(...(args as [])),
  PSM: { SINGLE_COLUMN: 4, SPARSE_TEXT: 11, SINGLE_BLOCK: 6 },
}));

vi.mock('idb-keyval', () => ({
  set: (...args: unknown[]) => idbSetMock(...(args as [])),
}));

/**
 * Regressionstest for et fundet fejlforløb: Tesseracts `initialize` udleder
 * sprognavnet af `lang.data`, når man sender sprogmodellen som bytes-objekt.
 * Det gjorde motoren ude af stand til at starte (den ledte efter en fil med
 * alle bytes i navnet). Sproget skal derfor sendes som navn — \"dan\" — mens
 * bytes lægges i Tesseracts egen cache.
 */
describe('OCR-motoren startes korrekt', () => {
  beforeEach(async () => {
    vi.resetModules();
    createWorkerMock.mockClear();
    idbSetMock.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        blob: async () => ({ size: 3_237_797 }),
        arrayBuffer: async () => new ArrayBuffer(3_237_797),
      })),
    );
  });

  it('giver sproget som navn, ikke som bytes, og lægger modellen i cachen', async () => {
    const { prewarmOcr, getOcrStatus } = await import('./ocr');
    prewarmOcr();

    await vi.waitFor(() => expect(createWorkerMock).toHaveBeenCalled(), { timeout: 3000 });

    expect(idbSetMock).toHaveBeenCalledWith('./dan.traineddata', expect.any(Uint8Array));
    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    const [lang, oem, options] = createWorkerMock.mock.calls[0] as unknown as [
      unknown,
      unknown,
      Record<string, unknown>,
    ];
    expect(lang).toBe('dan');
    expect(oem).toBe(1);
    expect(options.gzip).toBe(false);
    expect(options.langPath).toContain('tesseract');

    await vi.waitFor(() => expect(getOcrStatus()).toBe('ready'), { timeout: 3000 });
  });
});

import { createWorker, PSM, type Worker } from 'tesseract.js';

/**
 * OCR i browseren via Tesseract.js. Motoren, sproget (dansk) og wasm-filerne
 * serveres fra appen selv, så scanningen virker uden eksterne tjenester —
 * og uden at billedet nogensinde forlader enheden.
 */

export type OcrStage = 'prepare' | 'loading' | 'recognize' | 'parse' | 'done';

export interface OcrProgress {
  stage: OcrStage;
  /** 0–1 inden for hele scanningen. */
  progress: number;
  message: string;
}

type ProgressFn = (progress: OcrProgress) => void;

let worker: Worker | null = null;
let workerPromise: Promise<Worker> | null = null;
let currentProgress: ProgressFn = () => {};
let lastLoggedStage = '';
let warmStarted = false;

export type OcrStatus = 'idle' | 'warming' | 'ready' | 'error';

let status: OcrStatus = 'idle';
const statusListeners = new Set<(status: OcrStatus) => void>();

function setStatus(next: OcrStatus): void {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener(next));
}

/** Er motoren klar til at læse en kvittering? */
export function getOcrStatus(): OcrStatus {
  return status;
}

/** Abonnér på motorens tilstand — bruges til at vise "klargør scanner" i UI'et. */
export function subscribeOcrStatus(listener: (status: OcrStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}

const assetBase = (path: string) => `${import.meta.env.BASE_URL}${path}`.replace(/([^:]\/)\/+/g, '$1');

function createOcrWorker(): Promise<Worker> {
  return createWorker('dan', 1, {
    workerPath: assetBase('tesseract/worker.min.js'),
    corePath: assetBase('tesseract/core'),
    langPath: assetBase('tessdata'),
    workerBlobURL: false,
    gzip: true,
    cacheMethod: 'readwrite',
    logger: (message: { status?: string; progress?: number }) => {
      const status = message.status ?? '';
      const progress = typeof message.progress === 'number' ? message.progress : 0;
      if (status === lastLoggedStage && progress < 1) return;
      lastLoggedStage = status;

      if (status.includes('language') || status.includes('tesseract core') || status.includes('initializ')) {
        currentProgress({
          stage: 'loading',
          progress: 0.08 + progress * 0.3,
          message: 'Indlæser tekstmotoren (kun første gang)',
        });
      } else if (status === 'recognizing text') {
        currentProgress({
          stage: 'recognize',
          progress: 0.4 + progress * 0.52,
          message: 'Læser teksten på kvitteringen',
        });
      }
    },
  });
}

async function getWorker(): Promise<Worker> {
  if (worker) return worker;
  if (!workerPromise) {
    setStatus('warming');
    workerPromise = createOcrWorker()
      .then((created) => {
        worker = created;
        setStatus('ready');
        return created;
      })
      .catch((error) => {
        workerPromise = null;
        setStatus('error');
        throw error;
      });
  }
  return workerPromise;
}

export interface OcrResult {
  text: string;
  /** Tesseracts egen sikkerhed på ordniveau, 0–1. */
  confidence: number;
}

interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface RawWord {
  text?: string;
  confidence?: number;
  bbox?: Bbox;
}
interface RawPage {
  blocks?: Array<{ paragraphs?: Array<{ lines?: Array<{ words?: RawWord[] }> }> }>;
}

function collectWords(page: unknown): RawWord[] {
  const blocks = (page as RawPage | undefined)?.blocks ?? [];
  const words: RawWord[] = [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) words.push(word);
      }
    }
  }
  return words;
}

/**
 * Tesseract kan dele en kvittering op i "spalter", så alle varenavne kommer
 * før alle beløb. Ved at gruppere ordene efter deres lodrette placering
 * genskaber vi de visuelle linjer — og dermed "VARE 12,95" som én linje.
 */
export function rebuildLinesFromWords(page: unknown): string {
  const words = collectWords(page)
    .filter((word) => (word.text ?? '').trim().length > 0 && (word.confidence ?? 0) >= 25 && word.bbox)
    .map((word) => ({
      text: (word.text ?? '').trim(),
      x0: word.bbox!.x0,
      x1: word.bbox!.x1,
      y0: word.bbox!.y0,
      y1: word.bbox!.y1,
    }))
    .sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2 || a.x0 - b.x0);

  if (words.length === 0) return '';

  const heights = words.map((word) => word.y1 - word.y0).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 12;
  const tolerance = Math.max(6, medianHeight * 0.55);

  const rows: Array<{ center: number; words: typeof words }> = [];
  for (const word of words) {
    const center = (word.y0 + word.y1) / 2;
    const row = rows.find((candidate) => Math.abs(candidate.center - center) <= tolerance);
    if (row) {
      row.words.push(word);
      row.center = (row.center * (row.words.length - 1) + center) / row.words.length;
    } else {
      rows.push({ center, words: [word] });
    }
  }

  return rows
    .sort((a, b) => a.center - b.center)
    .map((row) =>
      row.words
        .sort((a, b) => a.x0 - b.x0)
        .map((word) => word.text)
        .join(' '),
    )
    .join('\n');
}

export type OcrMode = 'receipt' | 'sparse';

export async function runOcr(
  imageDataUrl: string,
  onProgress: ProgressFn = () => {},
  mode: OcrMode = 'receipt',
): Promise<OcrResult> {
  currentProgress = onProgress;
  onProgress({ stage: 'loading', progress: 0.05, message: 'Starter tekstgenkendelse' });

  const activeWorker = await getWorker();

  // Kvitteringer er én smal tekstkolonne med tal til højre. "Single column"
  // holder varenavn og beløb på samme linje, hvilket er afgørende for at
  // kunne læse både total og varelinjer. "Sparse text" bruges som fallback
  // på særligt rodede boner.
  await activeWorker.setParameters({
    tessedit_pageseg_mode: mode === 'sparse' ? PSM.SPARSE_TEXT : PSM.SINGLE_COLUMN,
    preserve_interword_spaces: '1',
  });

  const { data } = await activeWorker.recognize(imageDataUrl, {}, { text: true, blocks: true });

  onProgress({ stage: 'parse', progress: 0.94, message: 'Tolker beløb, dato og varer' });

  const rebuilt = rebuildLinesFromWords(data);
  const fallbackText = data.text ?? '';

  return {
    // Den positionsbaserede tekst er mere retvisende for kvitteringer, men
    // hvis den er tom, bruger vi Tesseracts egen tekst.
    text: rebuilt.trim().length > 0 ? rebuilt : fallbackText,
    confidence: (data.confidence ?? 0) / 100,
  };
}

export async function terminateOcr(): Promise<void> {
  const active = worker;
  worker = null;
  workerPromise = null;
  if (active) await active.terminate().catch(() => undefined);
}

/**
 * Den første scanning er dyr, fordi Tesseract skal hente worker + wasm-kerne,
 * indlæse den danske sprogmodel og varme WASM op. Det gør vi i baggrunden, så
 * snart appen er åbnet — så er motoren typisk klar, når brugeren vælger et billede.
 */
async function warmUpEngine(): Promise<void> {
  try {
    const activeWorker = await getWorker();
    // En lille genkendelse tvinger sprogmodellen ind i WASM-hukommelsen, så den
    // første rigtige scanning ikke skal betale for det.
    const canvas = document.createElement('canvas');
    canvas.width = 260;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.font = '26px sans-serif';
      ctx.fillText('TOTAL 0,00', 12, 56);
      await activeWorker.recognize(canvas.toDataURL('image/png'));
    }
    setStatus('ready');
  } catch {
    // Selve motoren kan godt være klar, selv om opvarmningen fejlede.
    setStatus(worker ? 'ready' : 'error');
  }
}

/** Varmer motoren op i baggrunden, så første scanning går hurtigere. */
export function prewarmOcr(): void {
  if (warmStarted) return;
  warmStarted = true;

  const start = () => {
    void warmUpEngine();
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
    .requestIdleCallback;

  // Første paint skal ikke vente på wasm — men vi venter kun ganske kort.
  window.setTimeout(() => {
    if (idle) idle(start, { timeout: 1500 });
    else start();
  }, 250);
}

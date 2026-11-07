import { createWorker, PSM, type Worker } from 'tesseract.js';
import { set as idbSet } from 'idb-keyval';

/**
 * OCR i browseren via Tesseract.js. Motoren, sproget (dansk) og wasm-filerne
 * serveres fra appen selv, så scanningen virker uden eksterne tjenester —
 * og uden at billedet nogensinde forlader enheden.
 *
 * Alt her er bygget til at fejle hurtigt og tydeligt: hellere en besked om
 * hvad der gik galt end en scanning, der hænger for evigt.
 */

export type OcrStage = 'prepare' | 'loading' | 'recognize' | 'parse' | 'done';

export interface OcrProgress {
  stage: OcrStage;
  /** 0–1 inden for hele scanningen. */
  progress: number;
  message: string;
}

type ProgressFn = (progress: OcrProgress) => void;

export type OcrStatus = 'idle' | 'checking' | 'warming' | 'ready' | 'error';

const WORKER_TIMEOUT_MS = 15_000;
const RECOGNIZE_TIMEOUT_MS = 60_000;

let worker: Worker | null = null;
let workerPromise: Promise<Worker> | null = null;
let currentProgress: ProgressFn = () => {};
let lastLoggedStage = '';
let warmStarted = false;
let errorMessage = '';

const assetBase = (path: string) => `${import.meta.env.BASE_URL}${path}`.replace(/([^:]\/)\/+/g, '$1');

const workerUrl = () => assetBase('tesseract/worker.min.js');
// Kernefilerne ligger bevidst i samme mappe som worker.min.js — Tesseract
// slår sin .wasm-fil op relativt til workerens placering.
const coreDir = () => assetBase('tesseract');
const workerDir = () => assetBase('tesseract');
const langDir = () => assetBase('tessdata');

/* ------------------------------------------------------------------ */
/* Status og diagnostik                                                */
/* ------------------------------------------------------------------ */

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

/** Seneste fejlbesked fra motoren (tom hvis ingen). */
export function getOcrError(): string {
  return errorMessage;
}

/** Abonnér på motorens tilstand — bruges til at vise "klargør scanner" i UI'et. */
export function subscribeOcrStatus(listener: (status: OcrStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}

export interface OcrLogEntry {
  at: number;
  text: string;
}

const logEntries: OcrLogEntry[] = [];

function addLog(text: string): void {
  logEntries.push({ at: Date.now(), text });
  if (logEntries.length > 80) logEntries.shift();
  if (import.meta.env.DEV) console.info('[ocr]', text);
}

/** Tidsstemplet log fra motoren — vises under "Vis detaljer". */
export function getOcrLog(): OcrLogEntry[] {
  return [...logEntries];
}

export interface OcrAssetCheck {
  name: string;
  url: string;
  ok: boolean;
  status?: number;
  bytes?: number;
}

/**
 * Tjekker at motorfilerne faktisk kan hentes. Det fanger fx en manglende
 * worker-fil i en APK, hvor Tesseract ellers bare ville vente for evigt.
 */
export interface LangData {
  code: string;
  data: Uint8Array;
  source: string;
}

/**
 * Henter sprogmodellen i hovedtråden og giver bytes til workeren.
 *
 * Tesseract henter ellers selv filen inde i workeren, men nogle Android-WebViews
 * svarer 404 på bestemte filtyper i appens assets. Ved at hente bytes her og
 * sende dem med i stedet, er vi helt fri af den slags.
 */
async function fetchLangData(): Promise<LangData> {
  const candidates = [
    `${workerDir()}/dan.traineddata`,
    `${langDir()}/dan.traineddata`,
    `${langDir()}/dan.traineddata.gz`,
  ];

  const problems: string[] = [];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) {
        problems.push(`${url} → ${response.status}`);
        continue;
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 100_000) {
        problems.push(`${url} → kun ${buffer.byteLength} B`);
        continue;
      }
      addLog(`Sprogmodel hentet: ${url} (${buffer.byteLength} B)`);
      return { code: 'dan', data: new Uint8Array(buffer), source: url };
    } catch (error) {
      problems.push(`${url} → ${error instanceof Error ? error.message : 'netværksfejl'}`);
    }
  }

  throw new Error(`Sprogmodellen kan ikke hentes: ${problems.join(', ')}`);
}

/**
 * Lægger sprogmodellen i Tesseracts egen IndexedDB-cache, så workeren finder
 * den dér og slet ikke behøver at hente noget over netværket.
 *
 * Nøglen er den Tesseract selv slår op: `${cachePath || '.'}/dan.traineddata`.
 */
async function primeLangCache(lang: LangData): Promise<boolean> {
  try {
    await idbSet(`./${lang.code}.traineddata`, lang.data);
    addLog('Sprogmodel lagt i Tesseracts cache');
    return true;
  } catch (error) {
    addLog(`Kunne ikke lægge sprogmodellen i cache: ${error instanceof Error ? error.message : 'ukendt fejl'}`);
    return false;
  }
}

export async function checkOcrAssets(scope: 'essential' | 'all' = 'all'): Promise<OcrAssetCheck[]> {
  const essential = [
    { name: 'worker.min.js', url: workerUrl() },
    { name: 'dan.traineddata', url: `${workerDir()}/dan.traineddata` },

  ];
  const targets =
    scope === 'essential'
      ? essential
      : [
          ...essential,
          { name: 'tesseract-core-simd-lstm.wasm', url: `${coreDir()}/tesseract-core-simd-lstm.wasm` },
          { name: 'tesseract-core-lstm.wasm', url: `${coreDir()}/tesseract-core-lstm.wasm` },
          { name: 'tesseract-core-simd-lstm.wasm.js', url: `${coreDir()}/tesseract-core-simd-lstm.wasm.js` },
          { name: 'tesseract-core-lstm.wasm.js', url: `${coreDir()}/tesseract-core-lstm.wasm.js` },
        ];

  const results: OcrAssetCheck[] = [];
  for (const target of targets) {
    try {
      const response = await fetch(target.url, { cache: 'force-cache' });
      const blob = response.ok ? await response.blob() : undefined;
      results.push({
        ...target,
        ok: response.ok && (blob?.size ?? 0) > 1024,
        status: response.status,
        bytes: blob?.size,
      });
    } catch {
      results.push({ ...target, ok: false });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Worker-håndtering                                                   */
/* ------------------------------------------------------------------ */

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} svarede ikke inden ${Math.round(ms / 1000)} sekunder`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

interface OcrAttempt {
  name: string;
  workerBlobURL: boolean;
  corePath: string;
}

/**
 * To måder at starte motoren på: den automatiske kerne (SIMD hvis enheden
 * understøtter det) og en eksplicit kerne uden SIMD til gamle WebViews.
 */
function attemptConfigs(): OcrAttempt[] {
  const autoCore = coreDir();
  const plainCore = `${coreDir()}/tesseract-core-lstm.wasm.js`;
  return [
    { name: 'standard', workerBlobURL: false, corePath: autoCore },
    { name: 'uden SIMD', workerBlobURL: false, corePath: plainCore },
  ];
}

/**
 * Sproget gives som navn ("dan"), ikke som bytes-objekt: Tesseracts
 * `initialize` udleder sproglisten af `lang.data` og fejler, hvis man sender
 * data med. I stedet ligger de rigtige bytes i cachen (se primeLangCache),
 * og `langPath` er kun en reserve, hvis cachen ikke kunne skrives.
 */
function createOcrWorker(attempt: OcrAttempt, lang: LangData): Promise<Worker> {
  return createWorker(lang.code, 1, {
    workerPath: workerUrl(),
    corePath: attempt.corePath,
    langPath: workerDir(),
    gzip: false,
    workerBlobURL: attempt.workerBlobURL,
    cacheMethod: 'write',
    logger: (message: { status?: string; progress?: number }) => {
      const stage = message.status ?? '';
      const progress = typeof message.progress === 'number' ? message.progress : 0;
      if (stage === lastLoggedStage && progress < 1) return;
      lastLoggedStage = stage;
      addLog(`${stage} ${Math.round(progress * 100)} %`);

      if (stage.includes('language') || stage.includes('tesseract core') || stage.includes('initializ')) {
        currentProgress({
          stage: 'loading',
          progress: 0.08 + progress * 0.3,
          message:
            stage.includes('language')
              ? 'Indlæser dansk sprogmodel'
              : stage.includes('core')
                ? 'Indlæser tekstmotoren'
                : 'Starter tekstgenkendelsen',
        });
      } else if (stage === 'recognizing text') {
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
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    setStatus('checking');
    addLog('Tjekker motorfiler');
    const assets = await checkOcrAssets('essential');
    addLog(
      assets
        .map((asset) => `${asset.name}: ${asset.ok ? `${asset.bytes} B` : `FEJL ${asset.status ?? ''}`}`)
        .join(' · '),
    );

    const workerAsset = assets.find((asset) => asset.name === 'worker.min.js');
    if (!workerAsset?.ok) {
      throw new Error(`Worker-filen kan ikke hentes (${workerAsset?.status ?? 'netværksfejl'})`);
    }
    const lang = await fetchLangData();
    addLog(`Sprogmodel klar (${lang.code}) fra ${lang.source}`);
    await primeLangCache(lang);

    setStatus('warming');

    const attempts = attemptConfigs();
    let lastError: unknown = null;

    for (const attempt of attempts) {
      addLog(`Opretter tekstmotor (${attempt.name})`);
      try {
        const created = await withTimeout(
          createOcrWorker(attempt, lang),
          WORKER_TIMEOUT_MS,
          `Klargøring af tekstmotoren (${attempt.name})`,
        );
        addLog(`Tekstmotoren er klar — ${attempt.name}`);
        worker = created;
        lastLoggedStage = '';
        setStatus('ready');
        return created;
      } catch (error) {
        lastError = error;
        addLog(`Forsøg «${attempt.name}» fejlede: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(
      lastError instanceof Error
        ? `Scanneren kunne ikke starte: ${lastError.message}`
        : 'Scanneren kunne ikke starte på denne enhed',
    );
  })().catch((error: unknown) => {
    workerPromise = null;
    errorMessage = error instanceof Error ? error.message : String(error);
    addLog(`FEJL: ${errorMessage}`);
    setStatus('error');
    throw error instanceof Error ? error : new Error(String(error));
  });

  return workerPromise;
}

/** Smider den nuværende motor væk, så næste scanning starter helt forfra. */
export async function resetOcrEngine(): Promise<void> {
  const active = worker;
  worker = null;
  workerPromise = null;
  warmStarted = false;
  errorMessage = '';
  lastLoggedStage = '';
  try {
    await active?.terminate();
  } catch {
    /* ignorér */
  }
  setStatus('idle');
  addLog('Motoren er nulstillet');
}

/* ------------------------------------------------------------------ */
/* Genkendelse                                                         */
/* ------------------------------------------------------------------ */

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
  await withTimeout(
    activeWorker.setParameters({
      tessedit_pageseg_mode: mode === 'sparse' ? PSM.SPARSE_TEXT : PSM.SINGLE_COLUMN,
      preserve_interword_spaces: '1',
    }),
    15_000,
    'Indstilling af læsetilstand',
  );

  let data;
  try {
    ({ data } = await withTimeout(
      activeWorker.recognize(imageDataUrl, {}, { text: true, blocks: true }),
      RECOGNIZE_TIMEOUT_MS,
      'Genkendelse af teksten',
    ));
  } catch (error) {
    // En fastlåst worker kan ikke bruges igen — smid den væk.
    await resetOcrEngine();
    throw error;
  }

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
  await resetOcrEngine();
}

/**
 * Klargører motoren i baggrunden, så den er varm når brugeren vælger et
 * billede. Der laves ingen test-genkendelse — kun selve initialiseringen,
 * som er den tunge del.
 */
export function prewarmOcr(): void {
  if (warmStarted || status === 'ready' || status === 'warming' || status === 'checking') return;
  warmStarted = true;

  const start = () => {
    void getWorker().catch(() => undefined);
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
    .requestIdleCallback;

  window.setTimeout(() => {
    if (idle) idle(start, { timeout: 1500 });
    else start();
  }, 250);
}

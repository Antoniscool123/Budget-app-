/**
 * Billedbehandling før OCR. Kvitteringer tages ofte i dårligt lys, skævt og
 * med lav kontrast — en let gråskala + kontraststrækning giver mærkbart
 * bedre genkendelse af tal.
 */

const MAX_OCR_WIDTH = 1600;
/** Lange boner må ikke blive enorme — genkendelsen skalerer med antal pixels. */
const MAX_OCR_HEIGHT = 2800;

async function loadBitmap(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(source, { imageOrientation: 'from-image' });
    } catch {
      /* falder tilbage til <img> */
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function drawToCanvas(source: ImageBitmap | HTMLImageElement, maxWidth: number, maxHeight = Infinity) {
  const width = 'width' in source ? source.width : 0;
  const height = 'height' in source ? source.height : 0;
  const scale = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas understøttes ikke i denne browser');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface PreparedImage {
  /** Gråskala/kontrast-forbedret billede til OCR. */
  ocrDataUrl: string;
  /** Lille farveversion til at vise i listen over kvitteringer. */
  thumbnailDataUrl: string;
  width: number;
  height: number;
}

export async function prepareImage(source: Blob): Promise<PreparedImage> {
  const bitmap = await loadBitmap(source);
  const canvas = drawToCanvas(bitmap, MAX_OCR_WIDTH, MAX_OCR_HEIGHT);
  const thumbCanvas = drawToCanvas(bitmap, 520, 900);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas understøttes ikke i denne browser');

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Gråskala + percentil-baseret kontraststrækning.
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    histogram[gray] += 1;
  }
  const totalPixels = width * height;
  let low = 0;
  let high = 255;
  let acc = 0;
  for (let v = 0; v < 256; v += 1) {
    acc += histogram[v];
    if (acc > totalPixels * 0.02) {
      low = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v -= 1) {
    acc += histogram[v];
    if (acc > totalPixels * 0.02) {
      high = v;
      break;
    }
  }
  const range = Math.max(1, high - low);

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    let stretched = ((gray - low) / range) * 255;
    stretched = 255 * Math.pow(Math.min(1, Math.max(0, stretched / 255)), 0.85);
    const value = Math.min(255, Math.max(0, stretched));
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);

  return {
    ocrDataUrl: canvas.toDataURL('image/jpeg', 0.94),
    thumbnailDataUrl: thumbCanvas.toDataURL('image/jpeg', 0.72),
    width,
    height,
  };
}

/** Roterer et billede (data-URL) — bruges når en bon er scannet på skrå. */
export async function rotateImage(dataUrl: string, degrees = 90): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  try {
    await image.decode();
  } catch {
    return dataUrl;
  }
  const radians = (degrees * Math.PI) / 180;
  const swapSides = Math.abs(degrees % 180) === 90;
  const canvas = document.createElement('canvas');
  canvas.width = swapSides ? image.height : image.width;
  canvas.height = swapSides ? image.width : image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  return canvas.toDataURL('image/jpeg', 0.94);
}

/** Beskærer en lodret del af billedet (0–1) — bruges til en hurtigere ekstra læsning. */
export async function cropImage(dataUrl: string, fromRatio: number, toRatio = 1): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  try {
    await image.decode();
  } catch {
    return dataUrl;
  }
  const top = Math.max(0, Math.floor(image.height * fromRatio));
  const bottom = Math.min(image.height, Math.ceil(image.height * toRatio));
  const height = Math.max(1, bottom - top);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, top, image.width, height, 0, 0, image.width, height);
  return canvas.toDataURL('image/jpeg', 0.94);
}

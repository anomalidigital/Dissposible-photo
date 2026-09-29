import { applyVintage, findFilter, FilterId, VINTAGE_FILTERS } from './vintage';

/** Every photo slot on the strip is 1055 × 700 (3:2 landscape). */
export const PHOTO_ASPECT = 1055 / 700;

/** The printed strip template and its two transparent photo windows, in template pixels. */
export const STRIP_TEMPLATE = {
  src: 'img/template-artworks.webp',
  width: 1200,
  height: 1800,
  holes: [
    { x: 83, y: 121, w: 1055, h: 700 },
    { x: 83, y: 866, w: 1055, h: 701 },
  ],
} as const;

const MAX_PHOTO_WIDTH = 1800;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image ${src.slice(0, 40)}`));
    img.src = src;
  });
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available');
  return [canvas, ctx];
}

/** Draws `img` into the rectangle the way CSS `object-fit: cover` would. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * Grabs exactly what sits inside `frame` (a screen rect) from a `<video>` shown
 * with `object-fit: cover`, so the saved photo matches the on-screen guide.
 * A mirrored (selfie) preview is captured mirrored, like the original app.
 */
export function captureFromVideo(video: HTMLVideoElement, frame: DOMRect, mirrored: boolean): string {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const box = video.getBoundingClientRect();
  const s = Math.max(box.width / vw, box.height / vh);
  const ox = box.left + (box.width - vw * s) / 2;
  const oy = box.top + (box.height - vh * s) / 2;
  // In a mirrored preview, screen-left maps to video-right.
  const left = mirrored ? box.left + box.right - frame.right : frame.left;

  let sx = (left - ox) / s;
  let sy = (frame.top - oy) / s;
  let sw = frame.width / s;
  let sh = frame.height / s;
  sx = Math.max(0, Math.min(sx, vw - 1));
  sy = Math.max(0, Math.min(sy, vh - 1));
  sw = Math.min(sw, vw - sx);
  sh = Math.min(sh, vh - sy);

  const outW = Math.max(1, Math.round(Math.min(MAX_PHOTO_WIDTH, sw)));
  const outH = Math.max(1, Math.round(outW / PHOTO_ASPECT));
  const [canvas, ctx] = makeCanvas(outW, outH);
  if (mirrored) {
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Centre-crops any picked image to the strip's 3:2 window. */
export async function cropToPhotoFrame(src: string): Promise<string> {
  const img = await loadImage(src);
  const maxW = Math.min(img.naturalWidth, img.naturalHeight * PHOTO_ASPECT, MAX_PHOTO_WIDTH);
  const w = Math.max(1, Math.round(maxW));
  const h = Math.max(1, Math.round(w / PHOTO_ASPECT));
  const [canvas, ctx] = makeCanvas(w, h);
  drawCover(ctx, img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Full-size copy of a photo with a vintage look baked in. */
export async function renderFiltered(src: string, id: FilterId): Promise<string> {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_PHOTO_WIDTH / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  applyVintage(pixels, findFilter(id));
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Small square previews of one photo under every look, for the filter picker. */
export async function renderThumbnails(src: string, size = 132): Promise<Record<FilterId, string>> {
  const img = await loadImage(src);
  const [canvas, ctx] = makeCanvas(size, size);
  drawCover(ctx, img, 0, 0, size, size);
  const base = ctx.getImageData(0, 0, size, size);
  const thumbs = {} as Record<FilterId, string>;
  for (const filter of VINTAGE_FILTERS) {
    const copy = new ImageData(new Uint8ClampedArray(base.data), size, size);
    applyVintage(copy, filter);
    ctx.putImageData(copy, 0, 0);
    thumbs[filter.id] = canvas.toDataURL('image/jpeg', 0.82);
  }
  return thumbs;
}

/** The finished strip: photos dropped into the template's windows, template on top. */
export async function composeStrip(photos: readonly string[]): Promise<Blob> {
  const t = STRIP_TEMPLATE;
  const [canvas, ctx] = makeCanvas(t.width, t.height);
  ctx.fillStyle = '#231f20';
  ctx.fillRect(0, 0, t.width, t.height);
  const [template, ...images] = await Promise.all([loadImage(t.src), ...photos.map(loadImage)]);
  images.forEach((img, i) => {
    const hole = t.holes[i];
    // 1px bleed so no seam shows under the template's window edge.
    if (hole) drawCover(ctx, img, hole.x - 1, hole.y - 1, hole.w + 2, hole.h + 2);
  });
  ctx.drawImage(template, 0, 0, t.width, t.height);
  return canvasToBlob(canvas, 'image/jpeg', 0.93);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality),
  );
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

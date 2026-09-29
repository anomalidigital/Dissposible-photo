/**
 * Vintage film looks, applied per pixel on a canvas.
 *
 * Pure JS on ImageData on purpose: CanvasRenderingContext2D.filter is not
 * available in every Safari, and the look must be identical in the on-screen
 * preview and in the saved files. Each look is saturation + tone curves
 * (monotone cubic, per channel) + vignette + mono grain.
 */

export type FilterId = 'original' | 'golden' | 'faded' | 'instant' | 'sepia' | 'noir' | 'rose';

type Curve = ReadonlyArray<readonly [number, number]>;

export interface VintageFilter {
  readonly id: FilterId;
  readonly name: string;
  /** Collapse to luminance before toning (black & white, sepia). */
  readonly mono?: boolean;
  /** Saturation multiplier; 1 leaves colour untouched. */
  readonly saturation?: number;
  /** [input, output] points on 0–255. `all` runs first, then the channel curve. */
  readonly curves?: { readonly all?: Curve; readonly r?: Curve; readonly g?: Curve; readonly b?: Curve };
  /** Corner darkening, 0–1. */
  readonly vignette?: number;
  /** Film grain amplitude, 0–1. */
  readonly grain?: number;
}

export const VINTAGE_FILTERS: readonly VintageFilter[] = [
  { id: 'original', name: 'Original' },
  {
    id: 'golden',
    name: 'Golden',
    saturation: 1.1,
    curves: {
      all: [[0, 14], [64, 72], [128, 138], [192, 202], [255, 248]],
      r: [[0, 8], [128, 140], [255, 255]],
      g: [[0, 4], [128, 130], [255, 246]],
      b: [[0, 0], [128, 110], [255, 218]],
    },
    vignette: 0.28,
    grain: 0.05,
  },
  {
    id: 'faded',
    name: 'Faded',
    saturation: 0.72,
    curves: {
      all: [[0, 40], [70, 84], [128, 132], [200, 196], [255, 230]],
      r: [[0, 4], [128, 134], [255, 252]],
      g: [[0, 4], [255, 250]],
      b: [[0, 18], [128, 126], [255, 232]],
    },
    vignette: 0.16,
    grain: 0.06,
  },
  {
    id: 'instant',
    name: 'Instant',
    saturation: 0.84,
    curves: {
      all: [[0, 36], [70, 94], [150, 174], [235, 238], [255, 244]],
      r: [[0, 0], [90, 90], [180, 196], [255, 255]],
      g: [[0, 14], [128, 134], [255, 246]],
      b: [[0, 32], [110, 112], [200, 184], [255, 212]],
    },
    vignette: 0.34,
    grain: 0.04,
  },
  {
    id: 'sepia',
    name: 'Sepia',
    mono: true,
    curves: {
      all: [[0, 10], [64, 58], [128, 132], [200, 212], [255, 244]],
      r: [[0, 30], [128, 156], [255, 252]],
      g: [[0, 20], [128, 128], [255, 236]],
      b: [[0, 10], [128, 96], [255, 200]],
    },
    vignette: 0.36,
    grain: 0.08,
  },
  {
    id: 'noir',
    name: 'Noir',
    mono: true,
    curves: { all: [[0, 4], [48, 26], [128, 128], [205, 226], [255, 252]] },
    vignette: 0.42,
    grain: 0.09,
  },
  {
    id: 'rose',
    name: 'Rose',
    saturation: 0.8,
    curves: {
      all: [[0, 26], [128, 138], [255, 246]],
      r: [[0, 22], [128, 152], [255, 255]],
      g: [[0, 0], [128, 110], [255, 230]],
      b: [[0, 24], [128, 134], [255, 238]],
    },
    vignette: 0.22,
    grain: 0.03,
  },
];

export function findFilter(id: FilterId): VintageFilter {
  return VINTAGE_FILTERS.find((f) => f.id === id) ?? VINTAGE_FILTERS[0];
}

/** Applies `filter` to `image` in place. */
export function applyVintage(image: ImageData, filter: VintageFilter, seed = 7): void {
  if (filter.id === 'original') return;

  const { data, width: w, height: h } = image;
  const [lr, lg, lb] = channelLuts(filter);
  const mono = !!filter.mono;
  const sat = filter.saturation ?? 1;
  const vignette = filter.vignette ?? 0;
  const grain = (filter.grain ?? 0) * 70;
  const random = mulberry32(seed);

  // Squared, normalised distances from the centre, per column and per row.
  const colD = new Float32Array(w);
  const rowD = new Float32Array(h);
  const cx = Math.max(1, (w - 1) / 2);
  const cy = Math.max(1, (h - 1) / 2);
  for (let x = 0; x < w; x++) colD[x] = ((x - cx) / cx) ** 2;
  for (let y = 0; y < h; y++) rowD[y] = ((y - cy) / cy) ** 2;

  for (let y = 0; y < h; y++) {
    const dy = rowD[y];
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (mono || sat !== 1) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        if (mono) {
          r = g = b = l;
        } else {
          r = l + (r - l) * sat;
          g = l + (g - l) * sat;
          b = l + (b - l) * sat;
        }
      }

      let rr = lr[toByte(r)];
      let gg = lg[toByte(g)];
      let bb = lb[toByte(b)];

      if (vignette) {
        let t = (Math.sqrt((colD[x] + dy) * 0.5) - 0.45) / 0.65;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const f = 1 - vignette * t * t * (3 - 2 * t);
        rr *= f;
        gg *= f;
        bb *= f;
      }

      if (grain) {
        const n = (random() - 0.5) * grain;
        rr += n;
        gg += n;
        bb += n;
      }

      // Uint8ClampedArray rounds and clamps on write.
      data[i] = rr;
      data[i + 1] = gg;
      data[i + 2] = bb;
    }
  }
}

function toByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0;
}

const IDENTITY = Uint8ClampedArray.from({ length: 256 }, (_, i) => i);

function channelLuts(filter: VintageFilter): [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray] {
  const curves = filter.curves ?? {};
  const base = curves.all ? curveLut(curves.all) : IDENTITY;
  const channel = (curve?: Curve) => {
    const lut = curve ? curveLut(curve) : IDENTITY;
    return Uint8ClampedArray.from(base, (v) => lut[v]);
  };
  return [channel(curves.r), channel(curves.g), channel(curves.b)];
}

/** 256-entry lookup through the points, monotone cubic (Fritsch–Carlson) so tones never fold over. */
function curveLut(points: Curve): Uint8ClampedArray {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    m.push((ys[i + 1] - ys[i]) / dx[i]);
  }
  const t = new Array<number>(n).fill(0);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }

  const lut = new Uint8ClampedArray(256);
  let seg = 0;
  for (let x = 0; x < 256; x++) {
    if (x <= xs[0]) { lut[x] = ys[0]; continue; }
    if (x >= xs[n - 1]) { lut[x] = ys[n - 1]; continue; }
    while (x > xs[seg + 1]) seg++;
    const h = dx[seg];
    const u = (x - xs[seg]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    lut[x] =
      (2 * u3 - 3 * u2 + 1) * ys[seg] +
      (u3 - 2 * u2 + u) * h * t[seg] +
      (-2 * u3 + 3 * u2) * ys[seg + 1] +
      (u3 - u2) * h * t[seg + 1];
  }
  return lut;
}

/** Small seeded PRNG so the grain is identical every time a photo is rendered. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

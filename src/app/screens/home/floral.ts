/**
 * Procedural corner bouquet for the wedding home, drawn as one SVG.
 *
 * Everything is generated from a seeded random so the arrangement looks hand
 * placed but renders identically every time. Each part carries a class + a
 * `--d` delay so CSS can grow it in: stems draw on, leaves unfurl from their
 * base, blooms open ring by ring (outer petals first), baby's breath last.
 * The bouquet is built for the top-left corner; the other corner reuses it
 * rotated 180° with a different variant.
 */

export type SprayVariant = 'a' | 'b';

type Stops = readonly [string, string, string];

const PALETTE = {
  blush: ['#b35e55', '#e3a090', '#f8d9cd'],
  blushDeep: ['#8f4640', '#d98f80', '#f0bfb1'],
  red: ['#8f1b17', '#e0332e', '#f68c82'],
  redDeep: ['#6d1210', '#c42622', '#ee6a60'],
  ivory: ['#c7b9a4', '#efe6d8', '#fffbf5'],
  coral: ['#c0624f', '#eb9c86', '#f9cdbd'],
  mauve: ['#7d4b57', '#bf8a95', '#e6bec5'],
  foliage: ['#132d22', '#234536', '#3a624e'],
  olive: ['#35523f', '#5c8069', '#95b39f'],
  euca: ['#566f69', '#8aa099', '#c3d0ca'],
  bud: ['#9f4f47', '#dd8f80', '#f4c3b6'],
} as const satisfies Record<string, Stops>;

type Tone = keyof typeof PALETTE;

const f = (n: number) => (Math.round(n * 10) / 10).toString();

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

// ---------------------------------------------------------------- shapes ----

/** Rounded petal, base at the origin, pointing up (-y). */
function petalPath(len: number, width: number, ruffled: boolean): string {
  const w = width / 2;
  const tip = ruffled
    ? `Q${f(-w * 0.34)},${f(-len * 1.05)} 0,${f(-len * 0.95)}Q${f(w * 0.34)},${f(-len * 1.05)} ${f(w * 0.62)},${f(-len * 0.9)}`
    : `Q0,${f(-len * 1.07)} ${f(w * 0.62)},${f(-len * 0.9)}`;
  return (
    `M0,0C${f(-w * 0.95)},${f(-len * 0.16)} ${f(-w * 1.12)},${f(-len * 0.6)} ${f(-w * 0.62)},${f(-len * 0.9)}` +
    `${tip}C${f(w * 1.12)},${f(-len * 0.6)} ${f(w * 0.95)},${f(-len * 0.16)} 0,0Z`
  );
}

/** Pointed leaf, base at the origin, pointing along +x. */
function leafPath(len: number, width: number): string {
  const w = width / 2;
  return `M0,0C${f(len * 0.22)},${f(-w * 1.25)} ${f(len * 0.7)},${f(-w)} ${f(len)},0C${f(len * 0.7)},${f(w)} ${f(len * 0.22)},${f(w * 1.25)} 0,0Z`;
}

// ------------------------------------------------------------- builders ----

class Spray {
  private out: string[] = [];
  private readonly rnd: () => number;

  constructor(
    private readonly id: string,
    seed: number,
    private readonly delayOffset: number,
  ) {
    this.rnd = mulberry32(seed);
  }

  private r(min: number, max: number): number {
    return min + (max - min) * this.rnd();
  }

  private grad(tone: Tone): string {
    return `url(#${this.id}-${tone})`;
  }

  private d(seconds: number): string {
    return `--d:${Math.round((seconds + this.delayOffset) * 100) / 100}s`;
  }

  defs(): string {
    const gradients = (Object.keys(PALETTE) as Tone[])
      .map((tone) => {
        const [a, b, c] = PALETTE[tone];
        return (
          `<linearGradient id="${this.id}-${tone}" x1="0" y1="1" x2="0" y2="0">` +
          `<stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`
        );
      })
      .join('');
    // Leaves point along +x, so their gradient runs base (left) → tip (right).
    const leafGradients = (['foliage', 'olive', 'euca'] as Tone[])
      .map((tone) => {
        const [a, b, c] = PALETTE[tone];
        return (
          `<linearGradient id="${this.id}-${tone}-x" x1="0" y1="0" x2="1" y2="0">` +
          `<stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`
        );
      })
      .join('');
    const shade =
      `<radialGradient id="${this.id}-shade"><stop offset=".55" stop-color="#020806" stop-opacity=".55"/>` +
      `<stop offset="1" stop-color="#020806" stop-opacity="0"/></radialGradient>`;
    return `<defs>${gradients}${leafGradients}${shade}</defs>`;
  }

  /** Big dark leaves fanning out of the corner: depth behind everything else. */
  foliageFan(angles: number[], delay: number): void {
    angles.forEach((a, i) => {
      const len = this.r(230, 340);
      const width = this.r(62, 92);
      this.out.push(
        `<g transform="translate(${f(this.r(6, 26))} ${f(this.r(6, 26))}) rotate(${f(a)})">` +
          `<path class="fl-leaf" style="${this.d(delay + i * 0.05)}" d="${leafPath(len, width)}" fill="url(#${this.id}-foliage-x)"/>` +
          `</g>`,
      );
    });
  }

  /** A curved stem that draws itself on, with leaves opening along it. */
  stem(
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    kind: 'olive' | 'euca',
    count: number,
    delay: number,
  ): void {
    const stroke = kind === 'olive' ? '#3f5c49' : '#5a7a72';
    this.out.push(
      `<path class="fl-stem" style="${this.d(delay)}" pathLength="1" d="M${f(p0[0])},${f(p0[1])}Q${f(p1[0])},${f(p1[1])} ${f(p2[0])},${f(p2[1])}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>`,
    );
    const at = (t: number): [number, number, number] => {
      const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
      const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
      const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
      const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      return [x, y, (Math.atan2(dy, dx) * 180) / Math.PI];
    };
    for (let i = 0; i < count; i++) {
      const t = 0.14 + (0.84 * i) / Math.max(1, count - 1);
      const [x, y, heading] = at(t);
      const side = i % 2 === 0 ? 1 : -1;
      const last = i === count - 1;
      const angle = last ? heading : heading + side * this.r(34, 52);
      const scale = 1 - t * 0.42;
      const leafDelay = delay + 0.12 + t * 0.55;
      if (kind === 'olive') {
        const len = this.r(40, 50) * scale;
        this.out.push(
          `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})">` +
            `<path class="fl-leaf" style="${this.d(leafDelay)}" d="${leafPath(len, len * 0.3)}" fill="url(#${this.id}-olive-x)"/></g>`,
        );
      } else {
        // Silver-dollar eucalyptus: round leaves in opposite pairs, hugging the stem.
        const rad = this.r(15, 21) * scale;
        for (const pair of last ? [0] : [-1, 1]) {
          const a = last ? heading : heading + pair * this.r(62, 84);
          this.out.push(
            `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">` +
              `<ellipse class="fl-leaf" style="${this.d(leafDelay + (pair > 0 ? 0.06 : 0))}" cx="${f(rad * 0.82)}" cy="0" rx="${f(rad)}" ry="${f(rad * 0.88)}" fill="url(#${this.id}-euca-x)" fill-opacity=".92" stroke="#2f4640" stroke-opacity=".3" stroke-width=".7"/></g>`,
          );
        }
      }
    }
  }

  private ring(count: number, len: number, width: number, tone: Tone, rotation: number, ruffled: boolean, delay: number): string {
    const stroke = tone === 'ivory' ? '#8d8070' : '#4a1512';
    let petals = '';
    for (let i = 0; i < count; i++) {
      const a = rotation + (360 / count) * i + this.r(-7, 7);
      petals += `<path d="${petalPath(len * this.r(0.93, 1.07), width * this.r(0.92, 1.08), ruffled)}" transform="rotate(${f(a)})" fill="${this.grad(tone)}" stroke="${stroke}" stroke-opacity=".22" stroke-width=".7"/>`;
    }
    return `<g class="fl-ring" style="${this.d(delay)}">${petals}</g>`;
  }

  private shade(radius: number): string {
    return `<circle r="${f(radius * 1.12)}" cx="${f(radius * 0.08)}" cy="${f(radius * 0.12)}" fill="url(#${this.id}-shade)"/>`;
  }

  peony(x: number, y: number, R: number, delay: number): void {
    const rot = this.r(0, 40);
    this.out.push(
      `<g transform="translate(${f(x)} ${f(y)})">${this.shade(R)}` +
        this.ring(10, R, R * 0.8, 'blush', rot, true, delay) +
        this.ring(9, R * 0.8, R * 0.72, 'blush', rot + 18, true, delay + 0.1) +
        this.ring(8, R * 0.6, R * 0.64, 'blushDeep', rot + 7, true, delay + 0.2) +
        this.ring(7, R * 0.4, R * 0.52, 'blushDeep', rot + 26, false, delay + 0.3) +
        `<g class="fl-ring" style="${this.d(delay + 0.4)}"><circle r="${f(R * 0.15)}" fill="#8a3f39"/>` +
        `<circle r="${f(R * 0.08)}" cx="${f(-R * 0.03)}" cy="${f(-R * 0.03)}" fill="#c9776a"/></g></g>`,
    );
  }

  rose(x: number, y: number, R: number, tone: 'red' | 'mauve', delay: number): void {
    const deep: Tone = tone === 'red' ? 'redDeep' : 'mauve';
    const rot = this.r(0, 60);
    const swirl = tone === 'red' ? '#5e0f0d' : '#5a3039';
    let spiral = '';
    for (let i = 0; i < 4; i++) {
      const rr = R * (0.34 - i * 0.07);
      const a = rot + i * 95;
      spiral += `<path d="M${f(rr)},0A${f(rr)},${f(rr)} 0 1 1 ${f(-rr * 0.2)},${f(-rr * 0.98)}" transform="rotate(${f(a)})" fill="none" stroke="${swirl}" stroke-opacity=".55" stroke-width="${f(Math.max(1, R * 0.035))}" stroke-linecap="round"/>`;
    }
    this.out.push(
      `<g transform="translate(${f(x)} ${f(y)})">${this.shade(R)}` +
        this.ring(6, R, R * 1.02, tone, rot, false, delay) +
        this.ring(5, R * 0.78, R * 0.92, tone, rot + 36, false, delay + 0.1) +
        this.ring(5, R * 0.56, R * 0.78, deep, rot + 12, false, delay + 0.2) +
        `<g class="fl-ring" style="${this.d(delay + 0.3)}"><circle r="${f(R * 0.36)}" fill="${this.grad(deep)}"/>${spiral}</g></g>`,
    );
  }

  anemone(x: number, y: number, R: number, delay: number): void {
    const rot = this.r(0, 60);
    let stamens = '';
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.r(-0.08, 0.08);
      const rr = R * this.r(0.33, 0.42);
      stamens += `<circle cx="${f(Math.cos(a) * rr)}" cy="${f(Math.sin(a) * rr)}" r="${f(this.r(1.3, 2.3) * (R / 45))}" fill="#2a2638"/>`;
    }
    this.out.push(
      `<g transform="translate(${f(x)} ${f(y)})">${this.shade(R)}` +
        this.ring(6, R, R * 1.08, 'ivory', rot, false, delay) +
        this.ring(6, R * 0.86, R * 0.92, 'ivory', rot + 30, false, delay + 0.1) +
        `<g class="fl-ring" style="${this.d(delay + 0.22)}">` +
        `<circle r="${f(R * 0.3)}" fill="#1b1a28"/>${stamens}<circle r="${f(R * 0.12)}" fill="#34304a"/></g></g>`,
    );
  }

  ranunculus(x: number, y: number, R: number, delay: number): void {
    const rot = this.r(0, 40);
    let rings = '';
    for (let k = 0; k < 4; k++) {
      rings += this.ring(9, R * (1 - k * 0.2), R * (0.62 - k * 0.07), k < 2 ? 'coral' : 'blushDeep', rot + k * 20, false, delay + k * 0.08);
    }
    this.out.push(
      `<g transform="translate(${f(x)} ${f(y)})">${this.shade(R)}${rings}` +
        `<g class="fl-ring" style="${this.d(delay + 0.34)}"><circle r="${f(R * 0.14)}" fill="#7e9a62"/></g></g>`,
    );
  }

  bud(x: number, y: number, size: number, angle: number, delay: number): void {
    const body = `M0,0C${f(-size * 0.62)},${f(-size * 0.2)} ${f(-size * 0.5)},${f(-size * 1.05)} 0,${f(-size * 1.5)}C${f(size * 0.5)},${f(-size * 1.05)} ${f(size * 0.62)},${f(-size * 0.2)} 0,0Z`;
    const sepal = (s: number) =>
      `<path d="M0,0Q${f(s * size * 0.55)},${f(-size * 0.25)} ${f(s * size * 0.2)},${f(-size * 0.85)}Q${f(s * size * 0.12)},${f(-size * 0.3)} 0,0Z" fill="${this.grad('olive')}"/>`;
    this.out.push(
      `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"><g class="fl-bud" style="${this.d(delay)}">` +
        `<path d="${body}" fill="${this.grad('bud')}" stroke="#5a1f1a" stroke-opacity=".25" stroke-width=".7"/>${sepal(-1)}${sepal(1)}</g></g>`,
    );
  }

  /** Baby's breath: hair-thin branches ending in tiny ivory florets. */
  babysBreath(x: number, y: number, spread: number, heading: number, delay: number): void {
    let s = '';
    const branches = 4 + Math.floor(this.r(0, 3));
    for (let i = 0; i < branches; i++) {
      const a = ((heading + this.r(-spread, spread)) * Math.PI) / 180;
      const len = this.r(18, 42);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len;
      s += `<path class="fl-stem" style="${this.d(delay + i * 0.04)}" pathLength="1" d="M${f(x)},${f(y)}L${f(ex)},${f(ey)}" stroke="#9db0a3" stroke-opacity=".7" stroke-width=".9" fill="none"/>`;
      const dots = 3 + Math.floor(this.r(0, 4));
      for (let k = 0; k < dots; k++) {
        const dx = ex + this.r(-6, 6);
        const dy = ey + this.r(-6, 6);
        s += `<circle class="fl-dot" style="${this.d(delay + 0.25 + i * 0.05 + k * 0.03)}" cx="${f(dx)}" cy="${f(dy)}" r="${f(this.r(1.5, 2.8))}" fill="#fff7ec" fill-opacity="${Math.round(this.r(0.75, 1) * 10) / 10}"/>`;
      }
    }
    this.out.push(s);
  }

  toString(): string {
    return this.out.join('');
  }
}

/** Full `<svg>` markup for one corner bouquet (drawn for the top-left corner). */
export function buildSpray(variant: SprayVariant): string {
  const id = `fl${variant}`;
  const spray = new Spray(id, variant === 'a' ? 1471 : 2903, variant === 'a' ? 0 : 0.25);

  if (variant === 'a') {
    spray.foliageFan([3, 15, 29, 44, 59, 73, 86], 0);
    spray.stem([10, 28], [210, 6], [480, 42], 'olive', 9, 0.08);
    spray.stem([28, 10], [16, 210], [48, 460], 'olive', 8, 0.12);
    spray.stem([36, 40], [250, 118], [430, 214], 'euca', 7, 0.16);
    spray.stem([40, 36], [124, 250], [222, 410], 'euca', 6, 0.2);
    spray.stem([20, 18], [320, 34], [586, 108], 'euca', 8, 0.24);
    spray.babysBreath(318, 246, 60, 30, 0.9);
    spray.babysBreath(236, 318, 60, 70, 0.95);
    spray.babysBreath(416, 150, 55, 10, 1.0);
    spray.babysBreath(128, 392, 50, 95, 1.05);
    spray.rose(40, 118, 38, 'mauve', 0.42);
    spray.ranunculus(270, 238, 30, 0.5);
    spray.anemone(362, 176, 34, 0.55);
    spray.anemone(92, 272, 50, 0.46);
    spray.rose(302, 94, 54, 'red', 0.38);
    spray.peony(168, 150, 84, 0.3);
    spray.bud(434, 72, 15, 70, 0.8);
    spray.bud(150, 348, 13, 170, 0.85);
    spray.bud(340, 288, 11, 125, 0.9);
  } else {
    spray.foliageFan([6, 19, 33, 47, 62, 76, 88], 0);
    spray.stem([12, 30], [230, 10], [470, 30], 'euca', 8, 0.08);
    spray.stem([30, 12], [12, 220], [40, 440], 'euca', 7, 0.12);
    spray.stem([38, 38], [240, 140], [410, 230], 'olive', 8, 0.16);
    spray.stem([36, 44], [140, 240], [236, 400], 'olive', 7, 0.2);
    spray.babysBreath(330, 236, 60, 25, 0.9);
    spray.babysBreath(222, 322, 60, 75, 0.95);
    spray.babysBreath(118, 380, 50, 95, 1.0);
    spray.anemone(40, 116, 30, 0.46);
    spray.rose(362, 172, 32, 'mauve', 0.5);
    spray.ranunculus(252, 236, 28, 0.55);
    spray.anemone(90, 262, 46, 0.42);
    spray.peony(298, 94, 58, 0.36);
    spray.rose(166, 146, 78, 'red', 0.3);
    spray.bud(424, 78, 14, 75, 0.8);
    spray.bud(142, 338, 12, 165, 0.85);
  }

  return (
    `<svg class="fl-svg" viewBox="0 0 640 560" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">` +
    `${spray.defs()}${spray.toString()}</svg>`
  );
}

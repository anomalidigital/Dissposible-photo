import { Injectable, computed, signal } from '@angular/core';
import { SHOTS_PER_STRIP } from '../event.config';
import { composeStrip, renderFiltered, renderThumbnails } from './imaging';
import { FilterId } from './vintage';

export interface Shot {
  readonly key: number;
  /** Unfiltered JPEG data URL, already cropped to the strip's 3:2 window. */
  readonly raw: string;
}

export interface Strip {
  readonly url: string;
  readonly blob: Blob;
}

/** One guest's run through the booth: the shots, the chosen look, the finished strip. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly total = SHOTS_PER_STRIP;

  readonly shots = signal<readonly Shot[]>([]);
  /** The shot on the preview screen, not yet kept. */
  readonly pending = signal<Shot | null>(null);

  /** The look picked in the UI — the picker highlights this immediately. */
  readonly filterId = signal<FilterId>('original');
  /** The look shown on the photos. It switches once every photo is re-rendered, so they change together. */
  readonly appliedFilter = signal<FilterId>('original');
  /** Filter-picker previews of the pending shot. */
  readonly thumbnails = signal<Partial<Record<FilterId, string>>>({});

  readonly strip = signal<Strip | null>(null);
  readonly finalPhotos = signal<readonly string[]>([]);

  readonly shotNumber = computed(() => Math.min(this.shots().length + 1, this.total));
  readonly isLastShot = computed(() => this.shots().length + 1 >= this.total);
  readonly shotLabel = computed(() => `${this.shotNumber()} of ${this.total}`);

  private readonly rendered = signal<ReadonlyMap<string, string>>(new Map());
  private readonly inflight = new Map<string, Promise<string>>();
  private nextKey = 1;
  private filterRequest = 0;
  private generation = 0;

  /** What to show for `shot` right now: its copy under the applied look, or the raw photo. */
  display(shot: Shot | null): string | null {
    if (!shot) return null;
    const filter = this.appliedFilter();
    if (filter === 'original') return shot.raw;
    return this.rendered().get(cacheKey(shot, filter)) ?? shot.raw;
  }

  /** Stages a new shot for the preview and prepares its filtered copy + picker previews. */
  async stage(raw: string): Promise<void> {
    const shot: Shot = { key: this.nextKey++, raw };
    this.pending.set(shot);
    this.thumbnails.set({});
    renderThumbnails(raw)
      .then((thumbs) => {
        if (this.pending() === shot) this.thumbnails.set(thumbs);
      })
      .catch(() => undefined);
    await this.render(shot, this.appliedFilter()).catch(() => undefined);
  }

  keepPending(): void {
    const shot = this.pending();
    if (!shot) return;
    this.shots.update((shots) => [...shots, shot]);
    this.pending.set(null);
  }

  dropPending(): void {
    this.pending.set(null);
  }

  async chooseFilter(id: FilterId): Promise<void> {
    this.filterId.set(id);
    const request = ++this.filterRequest;
    const pending = this.pending();
    const all = pending ? [...this.shots(), pending] : [...this.shots()];
    await Promise.all(all.map((shot) => this.render(shot, id))).catch(() => undefined);
    if (request === this.filterRequest) this.appliedFilter.set(id);
  }

  /** Renders every kept shot under the applied look and composes the printable strip. */
  async buildStrip(): Promise<void> {
    const generation = this.generation;
    const filter = this.appliedFilter();
    const photos = await Promise.all(this.shots().map((shot) => this.render(shot, filter)));
    const blob = await composeStrip(photos);
    if (generation !== this.generation) return;
    this.releaseStrip();
    this.finalPhotos.set(photos);
    this.strip.set({ url: URL.createObjectURL(blob), blob });
  }

  reset(): void {
    this.generation++;
    this.filterRequest++;
    this.shots.set([]);
    this.pending.set(null);
    this.filterId.set('original');
    this.appliedFilter.set('original');
    this.thumbnails.set({});
    this.rendered.set(new Map());
    this.inflight.clear();
    this.finalPhotos.set([]);
    this.releaseStrip();
  }

  private releaseStrip(): void {
    const strip = this.strip();
    if (strip) URL.revokeObjectURL(strip.url);
    this.strip.set(null);
  }

  private render(shot: Shot, filter: FilterId): Promise<string> {
    if (filter === 'original') return Promise.resolve(shot.raw);
    const key = cacheKey(shot, filter);
    const ready = this.rendered().get(key);
    if (ready) return Promise.resolve(ready);
    let job = this.inflight.get(key);
    if (!job) {
      const generation = this.generation;
      job = renderFiltered(shot.raw, filter).then(
        (url) => {
          this.inflight.delete(key);
          if (generation === this.generation) this.rendered.update((m) => new Map(m).set(key, url));
          return url;
        },
        (err: unknown) => {
          this.inflight.delete(key);
          throw err;
        },
      );
      this.inflight.set(key, job);
    }
    return job;
  }
}

const cacheKey = (shot: Shot, filter: FilterId) => `${shot.key}:${filter}`;

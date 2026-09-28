import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { EASE_OUT, Motion, play, wait } from '../../core/motion';
import { SessionService } from '../../core/session';
import { FilterId, VINTAGE_FILTERS } from '../../core/vintage';

/** Where the card rests in the hand, in the hand stage's own pixels. */
interface Pose {
  readonly tx: number;
  readonly ty: number;
  readonly s: number;
  /** Card centre inside the untransformed stage — the pivot for tilts. */
  readonly cx: number;
  readonly cy: number;
  readonly areaW: number;
  readonly areaH: number;
}

@Component({
  selector: 'app-confirm-screen',
  templateUrl: './confirm-screen.html',
  styleUrl: './confirm-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmScreen {
  readonly retake = output<void>();
  readonly accept = output<void>();

  protected readonly session = inject(SessionService);
  protected readonly filters = VINTAGE_FILTERS;

  /** One entry per window on the strip: a photo to show, or null for "up next". */
  protected readonly holes = computed(() => {
    const shots = this.session.shots();
    const pending = this.session.pending();
    return Array.from({ length: this.session.total }, (_, i) =>
      i < shots.length ? this.session.display(shots[i]) : i === shots.length ? this.session.display(pending) : null,
    );
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly backdrop = viewChild.required<ElementRef<HTMLElement>>('backdrop');
  private readonly area = viewChild.required<ElementRef<HTMLElement>>('area');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly slot = viewChild.required<ElementRef<HTMLElement>>('slot');
  private readonly top = viewChild.required<ElementRef<HTMLElement>>('top');
  private readonly picker = viewChild.required<ElementRef<HTMLElement>>('picker');
  private readonly actions = viewChild.required<ElementRef<HTMLElement>>('actions');

  private rest: Pose | null = null;
  private motions: Motion[] = [];
  private moving = false;

  protected choose(id: FilterId, chip: HTMLElement): void {
    chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    void this.session.chooseFilter(id);
  }

  /** The card rises into the hand while the dark body closes over the live view. */
  async enter(): Promise<void> {
    this.moving = true;
    this.clearMotions();
    await this.artReady();
    const pose = (this.rest = this.measure());
    const stage = this.stage().nativeElement;
    stage.style.transform = this.pose(pose);

    this.motions = [
      play(this.backdrop().nativeElement, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' }),
      play(
        stage,
        [
          { transform: this.pose(pose, 0, pose.areaH + 60, 6) },
          { transform: this.pose(pose, 0, -8, -0.8), offset: 0.78 },
          { transform: this.pose(pose) },
        ],
        { duration: 760, easing: EASE_OUT },
      ),
      ...this.chrome().map((el, i) =>
        play(el, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], {
          duration: 420,
          delay: 240 + i * 70,
          easing: EASE_OUT,
        }),
      ),
    ];
    await Promise.all(this.motions.map((m) => m.done));
    this.clearMotions();
    this.moving = false;
  }

  /**
   * Retake: the card lifts a touch, then drops out of the bottom.
   * Continue: a small wind-up, then the card glides off to the right.
   * Either way the dark body fades at the same time, so the live camera (or
   * the next screen) is already showing through — no empty beat in between.
   */
  async leave(direction: 'down' | 'right'): Promise<void> {
    this.moving = true;
    this.clearMotions();
    const pose = this.rest ?? this.measure();
    const stage = this.stage().nativeElement;

    const card =
      direction === 'down'
        ? play(
            stage,
            [
              { transform: this.pose(pose), easing: 'cubic-bezier(0.25, 0.6, 0.35, 1)' },
              { transform: this.pose(pose, 0, -16, 1.4), offset: 0.2, easing: 'cubic-bezier(0.5, 0.02, 0.72, 0.42)' },
              { transform: this.pose(pose, -14, pose.areaH * 1.18, -8) },
            ],
            { duration: 660, easing: 'linear' },
          )
        : play(
            stage,
            [
              { transform: this.pose(pose), easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
              { transform: this.pose(pose, -16, -6, -2.4), offset: 0.2, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
              { transform: this.pose(pose, pose.areaW * 1.2, -30, 10) },
            ],
            { duration: 780, easing: 'linear' },
          );

    const bodyDelay = direction === 'down' ? 150 : 210;
    this.motions = [
      card,
      ...this.chrome().map((el) => play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' })),
      play(this.backdrop().nativeElement, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 420,
        delay: bodyDelay,
        easing: 'ease-in-out',
      }),
    ];
    await card.done;
  }

  /** Clears exit styles once the screen is hidden, ready for the next shot. */
  reset(): void {
    this.clearMotions();
    this.rest = null;
    this.stage().nativeElement.style.transform = '';
    this.moving = false;
  }

  @HostListener('window:resize')
  protected relayout(): void {
    if (this.moving || !this.host.nativeElement.classList.contains('is-shown')) return;
    this.rest = this.measure();
    this.stage().nativeElement.style.transform = this.pose(this.rest);
  }

  private chrome(): HTMLElement[] {
    return [this.top(), this.picker(), this.actions()].map((r) => r.nativeElement);
  }

  private clearMotions(): void {
    this.motions.forEach((m) => m.animation.cancel());
    this.motions = [];
  }

  private pose(p: Pose, dx = 0, dy = 0, rotate = 0): string {
    return (
      `translate(${p.tx + dx}px, ${p.ty + dy}px) scale(${p.s}) ` +
      `translate(${p.cx}px, ${p.cy}px) rotate(${rotate}deg) translate(${-p.cx}px, ${-p.cy}px)`
    );
  }

  /** Fits the card inside the hand area (leaving room for the fingers below) and returns its pose. */
  private measure(): Pose {
    const stage = this.stage().nativeElement;
    const keep = stage.style.transform;
    stage.style.transform = 'none';
    const sr = stage.getBoundingClientRect();
    const er = this.slot().nativeElement.getBoundingClientRect();
    const ar = this.area().nativeElement.getBoundingClientRect();
    stage.style.transform = keep;

    const aspect = er.width / Math.max(1, er.height);
    const cardW = Math.max(40, Math.min(ar.width * 0.84, ar.height * 0.9 * aspect, 560));
    const cardH = cardW / aspect;
    const left = ar.left + (ar.width - cardW) / 2;
    const top = ar.top + Math.max(6, (ar.height - cardH) * 0.36);
    const s = cardW / Math.max(1, er.width);
    // Start fading the hand a little below the card, never across it.
    const fadeFrom = Math.min(ar.height - 8, top - ar.top + cardH + 18);
    this.area().nativeElement.style.setProperty('--fade-from', `${Math.round(fadeFrom)}px`);
    return {
      tx: left - sr.left - s * (er.left - sr.left),
      ty: top - sr.top - s * (er.top - sr.top),
      s,
      cx: er.left - sr.left + er.width / 2,
      cy: er.top - sr.top + er.height / 2,
      areaW: ar.width,
      areaH: ar.height,
    };
  }

  /** The hand and template art must be decoded before the card can be measured. */
  private async artReady(): Promise<void> {
    const images = Array.from(this.host.nativeElement.querySelectorAll<HTMLImageElement>('img.art'));
    const loaded = Promise.all(
      images.map((img) =>
        img.complete && img.naturalWidth
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }),
      ),
    );
    await Promise.race([loaded, wait(3000)]);
  }
}

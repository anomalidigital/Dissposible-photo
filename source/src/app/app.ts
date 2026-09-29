import { ApplicationRef, ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { CameraService } from './core/camera';
import { EASE_OUT, play, wait } from './core/motion';
import { SessionService } from './core/session';
import { EVENT } from './event.config';
import { CameraScreen } from './screens/camera/camera-screen';
import { ConfirmScreen } from './screens/confirm/confirm-screen';
import { DeliveryScreen } from './screens/delivery/delivery-screen';
import { Home } from './screens/home/home';
import { ProcessingScreen } from './screens/processing/processing-screen';

type Screen = 'home' | 'camera' | 'confirm' | 'processing' | 'delivery';

/**
 * The booth flow: home → camera → preview (×2) → processing → download.
 * All screens stay mounted as full-screen layers; a transition shows the
 * incoming layer next to the outgoing one, animates, then settles.
 */
@Component({
  selector: 'app-root',
  imports: [Home, CameraScreen, ConfirmScreen, ProcessingScreen, DeliveryScreen],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly session = inject(SessionService);
  private readonly camera = inject(CameraService);
  private readonly appRef = inject(ApplicationRef);

  protected readonly shown = signal<ReadonlySet<Screen>>(new Set<Screen>(['home']));
  protected readonly raised = signal<Screen | null>(null);
  /** True while a transition runs; a shield swallows taps so nothing fires twice. */
  protected readonly busy = signal(false);

  private readonly homeEl = viewChild.required(Home, { read: ElementRef });
  private readonly cameraEl = viewChild.required(CameraScreen, { read: ElementRef });
  private readonly deliveryEl = viewChild.required(DeliveryScreen, { read: ElementRef });
  private readonly cameraScreen = viewChild.required(CameraScreen);
  private readonly confirmScreen = viewChild.required(ConfirmScreen);
  private readonly processingScreen = viewChild.required(ProcessingScreen);
  private readonly deliveryScreen = viewChild.required(DeliveryScreen);

  constructor() {
    inject(Title).setTitle(`${EVENT.partnerOne} & ${EVENT.partnerTwo} wedding photobooth`);
  }

  protected isShown(screen: Screen): boolean {
    return this.shown().has(screen);
  }

  /** Home → camera: the camera opens as a circle growing from the button that was tapped. */
  protected onStart(origin: HTMLElement): void {
    this.run(async () => {
      this.session.reset();
      void this.camera.start();
      this.present(['home', 'camera'], 'camera');

      const cam = this.el(this.cameraEl);
      const box = cam.getBoundingClientRect();
      const o = origin.getBoundingClientRect();
      const x = o.left + o.width / 2 - box.left;
      const y = o.top + o.height / 2 - box.top;
      // Exactly large enough to reach the farthest corner — no wasted, invisible tail.
      const r = Math.ceil(Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y))) + 2;
      const from = `circle(0px at ${x}px ${y}px)`;
      const to = `circle(${r}px at ${x}px ${y}px)`;
      const timing = { duration: 700, easing: 'cubic-bezier(0.33, 0.08, 0.2, 1)' };

      const wipe = play(cam, [{ clipPath: from, webkitClipPath: from }, { clipPath: to, webkitClipPath: to }], timing);
      const recede = play(this.el(this.homeEl), [{ transform: 'scale(1)' }, { transform: 'scale(0.965)' }], timing);
      await wipe.done;
      this.present(['camera']);
      wipe.animation.cancel();
      recede.animation.cancel();
    });
  }

  /** Camera → preview. */
  protected onCaptured(photo: string): void {
    this.run(async () => {
      await this.session.stage(photo);
      this.present(['camera', 'confirm'], 'confirm');
      await this.confirmScreen().enter();
    });
  }

  /** Preview → camera: the card drops away over the live view. */
  protected onRetake(): void {
    this.run(async () => {
      this.camera.ensureLive();
      this.cameraScreen().reveal();
      await this.confirmScreen().leave('down');
      this.session.dropPending();
      this.present(['camera']);
      this.confirmScreen().reset();
    });
  }

  /** Preview → next shot, or → processing after the last one. */
  protected onAccept(): void {
    this.run(async () => {
      const last = this.session.isLastShot();
      // Commit once the preview's own labels have faded, so no counter visibly jumps.
      const keep = wait(220).then(() => this.session.keepPending());

      if (!last) {
        this.camera.ensureLive();
        this.cameraScreen().reveal();
        await this.confirmScreen().leave('right');
        await keep;
        this.present(['camera']);
        this.confirmScreen().reset();
        return;
      }

      this.camera.stop();
      this.present(['processing', 'confirm'], 'confirm');
      const leaving = this.confirmScreen().leave('right');
      await keep;
      const processing = this.processingScreen().run();
      await leaving;
      this.present(['processing']);
      this.confirmScreen().reset();
      await processing;

      this.deliveryScreen().load(this.session.strip(), this.session.finalPhotos());
      await this.fadeIn('delivery', ['processing']);
    });
  }

  /** Camera → home. */
  protected onBack(): void {
    this.run(async () => {
      this.camera.stop();
      this.session.reset();
      await this.fadeIn('home', ['camera']);
    });
  }

  /** Download → camera for a new strip: the camera slides up from below. */
  protected onAgain(): void {
    this.run(async () => {
      this.session.reset();
      void this.camera.start();
      this.present(['delivery', 'camera'], 'camera');
      const slide = play(this.el(this.cameraEl), [{ transform: 'translateY(100%)' }, { transform: 'none' }], {
        duration: 820,
        easing: EASE_OUT,
      });
      await slide.done;
      this.present(['camera']);
      slide.animation.cancel();
    });
  }

  /** Download → home, ready for the next guest. */
  protected onDone(): void {
    this.run(async () => {
      this.session.reset();
      await this.fadeIn('home', ['delivery']);
    });
  }

  private async fadeIn(target: 'home' | 'delivery', from: Screen[]): Promise<void> {
    this.present([...from, target], target);
    const el = this.el(target === 'home' ? this.homeEl : this.deliveryEl);
    const fade = play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease' });
    await fade.done;
    this.present([target]);
    fade.animation.cancel();
  }

  /** Shows exactly `screens` (and lifts `raised` above the rest), flushed to the DOM right away so it can be animated. */
  private present(screens: Screen[], raised: Screen | null = null): void {
    this.shown.set(new Set(screens));
    this.raised.set(raised);
    this.appRef.tick();
  }

  private run(task: () => Promise<void>): void {
    if (this.busy()) return;
    this.busy.set(true);
    task()
      .catch((err: unknown) => console.error(err))
      .finally(() => this.busy.set(false));
  }

  private el(ref: () => ElementRef): HTMLElement {
    return ref().nativeElement as HTMLElement;
  }
}

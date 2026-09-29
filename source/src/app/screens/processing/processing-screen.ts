import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { wait } from '../../core/motion';
import { SessionService } from '../../core/session';

const MIN_MS = 2200;
const RING = 2 * Math.PI * 24;

@Component({
  selector: 'app-processing-screen',
  templateUrl: './processing-screen.html',
  styleUrl: './processing-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessingScreen {
  protected readonly session = inject(SessionService);
  protected readonly progress = signal(0);
  protected readonly status = signal('Processing photos…');
  protected readonly ring = RING;
  protected readonly dashOffset = computed(() => RING * (1 - this.progress() / 100));

  /** Builds the strip, with a minimum on-screen time so the moment reads as intentional. */
  async run(): Promise<void> {
    this.progress.set(0);
    this.status.set('Processing photos…');
    let built = false;
    const build = this.session
      .buildStrip()
      .catch(() => undefined)
      .finally(() => (built = true));

    const started = performance.now();
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        const cap = built ? 100 : 94;
        const next = Math.min(cap, Math.round(((performance.now() - started) / MIN_MS) * 100));
        this.progress.set(next);
        if (next >= 100) {
          clearInterval(timer);
          resolve();
        }
      }, 30);
    });
    await build;
    this.status.set('All done!');
    await wait(420);
  }
}

import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { EVENT } from '../../event.config';
import { FloralSpray } from './floral-spray';

interface FallingPetal {
  readonly left: number;
  readonly size: number;
  readonly duration: number;
  readonly delay: number;
  readonly drift: number;
  readonly color: string;
}

/** A handful of petals drifting across the screen after the bouquet has bloomed. */
const PETALS: readonly FallingPetal[] = [
  { left: 14, size: 15, duration: 17, delay: 2.6, drift: 70, color: '#f3c4b6' },
  { left: 36, size: 12, duration: 21, delay: 7.5, drift: -40, color: '#fff4e8' },
  { left: 58, size: 17, duration: 19, delay: 4.2, drift: 55, color: '#ef6f66' },
  { left: 79, size: 13, duration: 23, delay: 10.5, drift: -60, color: '#f3c4b6' },
  { left: 91, size: 11, duration: 18, delay: 13.5, drift: 30, color: '#fff4e8' },
  { left: 24, size: 12, duration: 24, delay: 16, drift: 45, color: '#e6bec5' },
];

@Component({
  selector: 'app-home',
  imports: [FloralSpray],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-ready]': 'ready()' },
})
export class Home {
  /** Emits the button so the camera can open from the exact spot that was tapped. */
  readonly start = output<HTMLElement>();

  protected readonly event = EVENT;
  protected readonly petals = PETALS;
  protected readonly petalPath = 'M0,0C-7,-2 -8,-10 -4,-16Q0,-19 4,-16C8,-10 7,-2 0,0Z';

  /** Names stay hidden until the script face is loaded, so the ink reveal never shows a fallback font. */
  protected readonly ready = signal(false);

  constructor() {
    const fonts = document.fonts;
    const go = () => this.ready.set(true);
    if (!fonts?.load) {
      go();
      return;
    }
    const loaded = Promise.all([fonts.load('96px Ballet'), fonts.load('300 16px Jost'), fonts.load('italic 300 16px Jost')]);
    const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
    Promise.race([loaded, timeout]).then(go, go);
  }
}

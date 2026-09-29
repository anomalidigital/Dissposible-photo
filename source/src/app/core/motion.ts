export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface Motion {
  readonly animation: Animation;
  /** Resolves when the motion has played out. */
  readonly done: Promise<void>;
}

/**
 * Plays a Web Animation that holds its end state (cancel it once the final
 * styles are committed). Completion is timer-based on purpose: some mobile
 * browsers drop finish/transitionend events, which used to leave the old app
 * stuck mid-transition.
 */
export function play(
  el: Element,
  keyframes: Keyframe[],
  options: { duration: number; delay?: number; easing?: string },
): Motion {
  const calm = reducedMotion();
  const duration = calm ? 1 : options.duration;
  const delay = calm ? 0 : (options.delay ?? 0);
  const animation = el.animate(keyframes, { duration, delay, easing: options.easing ?? 'ease', fill: 'both' });
  return { animation, done: wait(duration + delay + 24) };
}

export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';

import { Injectable, signal } from '@angular/core';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable';
export type Facing = 'user' | 'environment';

/**
 * The device camera: one live stream, front/back switch and the torch.
 * The stream stays warm through the preview screen so Retake / Continue can
 * peel the card away and reveal the live view underneath.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  readonly stream = signal<MediaStream | null>(null);
  readonly status = signal<CameraStatus>('idle');
  readonly facing = signal<Facing>('user');
  /** Android Chrome exposes `torch` on the back camera; iOS Safari does not, so the button stays hidden there. */
  readonly torchAvailable = signal(false);
  readonly torchOn = signal(false);

  private request = 0;

  constructor() {
    // Coming back to the tab can leave a dead track (the OS reclaimed the camera).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.status() === 'live' && !this.isAlive()) void this.start();
    });
  }

  async start(): Promise<void> {
    const request = ++this.request;
    this.releaseTracks();
    this.status.set('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      this.status.set('unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facing(), width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      if (request !== this.request) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream.set(stream);
      this.status.set('live');
      this.detectTorch(stream);
    } catch (err) {
      if (request !== this.request) return;
      const name = err instanceof DOMException ? err.name : '';
      this.status.set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }

  /** Restarts the stream only if it is gone (e.g. after the gallery picker took the camera away). */
  ensureLive(): void {
    if (this.status() === 'starting') return;
    if (!this.isAlive()) void this.start();
  }

  flip(): void {
    if (this.torchOn()) this.setTorch(false);
    this.facing.update((f) => (f === 'user' ? 'environment' : 'user'));
    void this.start();
  }

  toggleTorch(): void {
    if (this.torchAvailable()) this.setTorch(!this.torchOn());
  }

  stop(): void {
    this.request++;
    // Some Androids latch the torch on unless it is switched off before the track stops.
    if (this.torchOn()) this.setTorch(false);
    this.releaseTracks();
    this.status.set('idle');
  }

  private isAlive(): boolean {
    const track = this.stream()?.getVideoTracks()[0];
    return !!track && track.readyState === 'live';
  }

  private releaseTracks(): void {
    this.stream()?.getTracks().forEach((t) => t.stop());
    this.stream.set(null);
    this.torchAvailable.set(false);
    this.torchOn.set(false);
  }

  private detectTorch(stream: MediaStream): void {
    const track = stream.getVideoTracks()[0];
    let supported = false;
    try {
      const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      supported = !!caps?.torch;
    } catch {
      supported = false;
    }
    this.torchAvailable.set(supported && this.facing() === 'environment');
  }

  private setTorch(on: boolean): void {
    this.torchOn.set(on);
    const track = this.stream()?.getVideoTracks()[0];
    track
      ?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      .catch(() => this.torchOn.set(false));
  }
}

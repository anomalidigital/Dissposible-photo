import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import { CameraService } from '../../core/camera';
import { captureFromVideo, cropToPhotoFrame } from '../../core/imaging';
import { EASE_OUT, play } from '../../core/motion';
import { SessionService } from '../../core/session';

@Component({
  selector: 'app-camera-screen',
  templateUrl: './camera-screen.html',
  styleUrl: './camera-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraScreen {
  readonly back = output<void>();
  /** A 3:2 JPEG data URL of exactly what sat inside the frame. */
  readonly captured = output<string>();

  protected readonly camera = inject(CameraService);
  protected readonly session = inject(SessionService);
  protected readonly shooting = signal(false);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');
  private readonly flash = viewChild<ElementRef<HTMLElement>>('flash');
  private readonly ui = viewChild<ElementRef<HTMLElement>>('ui');
  private readonly gallery = viewChild<ElementRef<HTMLInputElement>>('gallery');

  constructor() {
    effect(() => {
      const el = this.video()?.nativeElement;
      const stream = this.camera.stream();
      if (!el || el.srcObject === stream) return;
      el.srcObject = stream;
      if (stream) el.play().catch(() => undefined);
    });
  }

  protected shoot(): void {
    const video = this.video()?.nativeElement;
    const frame = this.frame()?.nativeElement;
    if (!video || !frame || this.shooting() || this.camera.status() !== 'live' || !video.videoWidth) return;
    this.shooting.set(true);
    const photo = captureFromVideo(video, frame.getBoundingClientRect(), this.camera.facing() === 'user');
    const flash = this.flash()?.nativeElement;
    if (flash) {
      const burst = play(flash, [{ opacity: 0.95 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
      void burst.done.then(() => burst.animation.cancel());
    }
    setTimeout(() => {
      this.shooting.set(false);
      this.captured.emit(photo);
    }, 300);
  }

  protected pickFromGallery(): void {
    this.gallery()?.nativeElement.click();
  }

  protected async onGalleryPick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      this.captured.emit(await cropToPhotoFrame(url));
    } catch {
      // Unreadable file (e.g. HEIC on a browser that cannot decode it): stay on the camera.
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Controls settle back in while the preview card leaves over the live view. */
  reveal(): void {
    const ui = this.ui()?.nativeElement;
    if (!ui) return;
    const settle = play(ui, [{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'none' }], {
      duration: 460,
      delay: 200,
      easing: EASE_OUT,
    });
    void settle.done.then(() => settle.animation.cancel());
  }
}

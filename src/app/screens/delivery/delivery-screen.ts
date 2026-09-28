import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { dataUrlToBlob, saveFile } from '../../core/imaging';
import { Strip } from '../../core/session';

interface Keepsake {
  readonly strip: Strip | null;
  readonly photos: readonly string[];
}

@Component({
  selector: 'app-delivery-screen',
  templateUrl: './delivery-screen.html',
  styleUrl: './delivery-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryScreen {
  readonly again = output<void>();
  readonly done = output<void>();

  /** A snapshot of the finished session, so the page stays intact while the next guest starts. */
  protected readonly keepsake = signal<Keepsake>({ strip: null, photos: [] });

  load(strip: Strip | null, photos: readonly string[]): void {
    this.keepsake.set({ strip, photos });
  }

  protected saveStrip(): void {
    const strip = this.keepsake().strip;
    if (strip) saveFile(strip.blob, 'photo-strip.jpg');
  }

  protected async savePhoto(index: number): Promise<void> {
    const photo = this.keepsake().photos[index];
    if (photo) saveFile(await dataUrlToBlob(photo), `photo-${index + 1}.jpg`);
  }
}

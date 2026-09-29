import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { buildSpray, SprayVariant } from './floral';

@Component({
  selector: 'app-floral-spray',
  template: `<div class="fl-wrap" [innerHTML]="markup()"></div>`,
  styleUrl: './floral-spray.scss',
  // The bouquet is injected markup, so its animation classes need global styles.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloralSpray {
  readonly variant = input<SprayVariant>('a');
  private readonly sanitizer = inject(DomSanitizer);

  // Generated entirely in-app from constants (no user input), so it is safe to trust.
  protected readonly markup = computed(() => this.sanitizer.bypassSecurityTrustHtml(buildSpray(this.variant())));
}

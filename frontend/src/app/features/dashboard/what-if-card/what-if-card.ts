import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SERVICE_LABEL_SINGULAR } from '../../../core/labels';
import { WhatIfStore } from '../what-if.store';

/** Floating amber card: before -> after for the current trial, the big delta, and save / discard. */
@Component({
  selector: 'app-what-if-card',
  imports: [DecimalPipe],
  templateUrl: './what-if-card.html',
  styleUrl: './what-if-card.scss',
})
export class WhatIfCard {
  protected readonly whatIf = inject(WhatIfStore);
  protected readonly serviceLabel = SERVICE_LABEL_SINGULAR;
  protected readonly note = signal('');

  protected save(): void {
    void this.whatIf.save(this.note().trim() || undefined);
    this.note.set('');
  }
}

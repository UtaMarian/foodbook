import { Injectable } from '@nestjs/common';
import { StorageService } from './storage.service';

export type ImageVariant = 'thumb' | 'feed' | 'full';

/** Latimile generate la upload. Inaltimea se calculeaza proportional. */
export const VARIANT_WIDTHS: Record<ImageVariant, number> = {
  thumb: 400,
  feed: 1080,
  full: 1600,
};

/**
 * In baza de date pastram doar object key-ul de baza (fara sufix si extensie).
 * URL-ul se construieste aici, deci putem schimba CDN-ul fara migratie.
 */
@Injectable()
export class MediaService {
  constructor(private readonly storage: StorageService) {}

  static variantKey(objectKey: string, variant: ImageVariant): string {
    return `${objectKey}_${variant}.jpg`;
  }

  url(objectKey: string | null | undefined, variant: ImageVariant = 'feed'): string | null {
    if (!objectKey) return null;
    return `${this.storage.publicBase}/${MediaService.variantKey(objectKey, variant)}`;
  }
}

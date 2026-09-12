import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { StorageService } from './storage.service';
import { MediaService, VARIANT_WIDTHS, type ImageVariant } from './media.service';

export interface StoredImage {
  objectKey: string;
  width: number;
  height: number;
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Validam continutul, nu extensia: un .jpg poate fi orice.
   * HEIC e respins explicit - sharp nu il decodeaza in build-urile prebuilt,
   * iar clientul trimite oricum JPEG dupa redimensionarea locala.
   */
  private assertSupported(buf: Buffer): void {
    const max = this.config.get<number>('MAX_IMAGE_BYTES', 8 * 1024 * 1024);
    if (buf.length > max) {
      throw new BadRequestException(`Imaginea depaseste ${Math.round(max / 1024 / 1024)} MB`);
    }
    const isJpeg = buf.subarray(0, 3).equals(JPEG);
    const isPng = buf.subarray(0, 4).equals(PNG);
    const isWebp =
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!isJpeg && !isPng && !isWebp) {
      throw new BadRequestException('Format neacceptat. Trimite JPEG, PNG sau WebP.');
    }
  }

  async store(
    buffer: Buffer,
    prefix: 'recipes' | 'avatars',
    variants: ImageVariant[] = ['thumb', 'feed', 'full'],
  ): Promise<StoredImage> {
    this.assertSupported(buffer);

    const id = randomUUID();
    // Doua niveluri de shard: evita directoare cu sute de mii de intrari.
    const objectKey = `${prefix}/${id.slice(0, 2)}/${id.slice(2, 4)}/${id}`;

    // rotate() aplica orientarea EXIF, apoi metadatele (inclusiv GPS) sunt eliminate.
    const base = sharp(buffer, { failOn: 'error' }).rotate();
    const meta = await base.metadata();
    if (!meta.width || !meta.height) {
      throw new BadRequestException('Imagine corupta');
    }

    // Dimensiunile raportate sunt ale celei mai mari variante STOCATE,
    // nu ale originalului: clientul calculeaza aspect ratio pe fisierul real.
    let largest = { width: 0, height: 0 };

    for (const variant of variants) {
      const width = Math.min(VARIANT_WIDTHS[variant], meta.width);
      const out = await sharp(buffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: variant === 'thumb' ? 72 : 80, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      await this.storage.put(
        MediaService.variantKey(objectKey, variant),
        out.data,
        'image/jpeg',
      );
      if (out.info.width >= largest.width) {
        largest = { width: out.info.width, height: out.info.height };
      }
    }

    this.logger.debug(`Stocat ${objectKey} (${variants.join(', ')})`);
    return { objectKey, width: largest.width, height: largest.height };
  }

  async remove(objectKey: string, variants: ImageVariant[] = ['thumb', 'feed', 'full']) {
    await Promise.all(
      variants.map((v) => this.storage.delete(MediaService.variantKey(objectKey, v))),
    );
  }
}

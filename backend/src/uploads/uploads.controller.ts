import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageService } from './image.service';
import { MediaService } from './media.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly images: ImageService,
    private readonly media: MediaService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Clientul redimensioneaza inainte de upload; aici regeneram variantele
   * ca sa nu depindem de ce trimite telefonul. Randul din uploaded_images
   * leaga cheia de utilizator si tine dimensiunile pana cand se creeaza reteta.
   */
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } }) // 20 upload-uri/ora/utilizator
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploadImage(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Niciun fisier primit');

    const stored = await this.images.store(file.buffer, 'recipes');
    await this.prisma.uploadedImage.create({
      data: {
        userId: user.id,
        objectKey: stored.objectKey,
        width: stored.width,
        height: stored.height,
      },
    });

    return {
      key: stored.objectKey,
      width: stored.width,
      height: stored.height,
      url: this.media.url(stored.objectKey, 'feed'),
      thumbUrl: this.media.url(stored.objectKey, 'thumb'),
    };
  }
}

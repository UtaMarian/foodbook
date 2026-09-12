import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { SupabaseStorage } from './supabase.storage';
import { LocalStorage } from './local.storage';
import { MediaService } from './media.service';
import { ImageService } from './image.service';
import { UploadsController } from './uploads.controller';
import { isSupabaseConfigured, type AppEnv } from '../common/config/configuration';

@Global()
@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = { ...process.env } as unknown as AppEnv;
        return isSupabaseConfigured(env) ? new SupabaseStorage(config) : new LocalStorage(config);
      },
    },
    MediaService,
    ImageService,
  ],
  exports: [StorageService, MediaService, ImageService],
})
export class UploadsModule {}

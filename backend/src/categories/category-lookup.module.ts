import { Module } from '@nestjs/common';
import { CategoryLookupService } from './category-lookup.service';

@Module({
  providers: [CategoryLookupService],
  exports: [CategoryLookupService],
})
export class CategoryLookupModule {}

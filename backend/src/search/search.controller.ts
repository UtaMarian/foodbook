import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { SearchService } from './search.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { cursorQuerySchema } from '@foodbook/shared';

const searchQuerySchema = cursorQuerySchema.extend({
  q: z.string().max(120).default(''),
});
type SearchQuery = z.infer<typeof searchQuerySchema>;

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('recipes')
  recipes(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ) {
    return this.search.recipes(query.q, user.id, query.cursor, query.limit);
  }

  @Get('users')
  users(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ) {
    return this.search.users(query.q, user.id, query.cursor, query.limit);
  }
}

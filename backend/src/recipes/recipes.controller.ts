import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RecipesService } from './recipes.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createRecipeSchema,
  cursorQuerySchema,
  updateRecipeSchema,
  type CreateRecipeInput,
  type CursorQuery,
  type UpdateRecipeInput,
} from '@foodbook/shared';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Throttle({ default: { limit: 10, ttl: 86_400_000 } }) // 10 retete/zi/utilizator
  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createRecipeSchema)) body: CreateRecipeInput,
  ) {
    return this.recipes.create(user.id, body);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.recipes.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateRecipeSchema)) body: UpdateRecipeInput,
  ) {
    return this.recipes.update(id, user.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    await this.recipes.remove(id, user.id);
  }
}

@Controller('users')
export class UserRecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get(':username/recipes')
  list(
    @Param('username') username: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery,
  ) {
    return this.recipes.listByUsername(username, user.id, query.cursor, query.limit);
  }
}

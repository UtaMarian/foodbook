import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  adminUsersQuerySchema,
  createCategorySchema,
  updateAppSettingsSchema,
  updateCategorySchema,
  type AdminUsersQuery,
  type CreateCategoryInput,
  type UpdateAppSettingsInput,
  type UpdateCategoryInput,
} from '@foodbook/shared';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('settings')
  getSettings() {
    return this.admin.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body(new ZodValidationPipe(updateAppSettingsSchema)) body: UpdateAppSettingsInput) {
    return this.admin.updateSettings(body);
  }

  @Get('users')
  listUsers(@Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery) {
    return this.admin.listUsers(query.status, query.cursor, query.limit);
  }

  @Post('users/:id/approve')
  approve(@Param('id') id: string) {
    return this.admin.approve(id);
  }

  @Post('users/:id/reject')
  reject(@Param('id') id: string) {
    return this.admin.reject(id);
  }

  @Get('categories')
  listCategories() {
    return this.admin.listCategories();
  }

  @Post('categories')
  createCategory(@Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput) {
    return this.admin.createCategory(body);
  }

  @Patch('categories/:slug')
  updateCategory(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ) {
    return this.admin.updateCategory(slug, body);
  }

  @Delete('categories/:slug')
  @HttpCode(204)
  deleteCategory(@Param('slug') slug: string) {
    return this.admin.deleteCategory(slug);
  }
}

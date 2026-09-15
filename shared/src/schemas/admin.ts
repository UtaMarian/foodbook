import { z } from 'zod';
import { cursorQuerySchema } from './common';

export const adminUserStatusFilterSchema = z.enum(['pending', 'approved', 'rejected', 'all']);
export type AdminUserStatusFilter = z.infer<typeof adminUserStatusFilterSchema>;

export const adminUsersQuerySchema = cursorQuerySchema.extend({
  status: adminUserStatusFilterSchema.default('all'),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const updateAppSettingsSchema = z.object({
  requireApproval: z.boolean(),
});
export type UpdateAppSettingsInput = z.infer<typeof updateAppSettingsSchema>;

export interface AppSettings {
  requireApproval: boolean;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: 'user' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Numele e obligatoriu').max(60),
  emoji: z.string().min(1, 'Emoji-ul e obligatoriu').max(8),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(60).optional(),
  emoji: z.string().min(1).max(8).optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

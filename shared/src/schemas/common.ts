import { z } from 'zod';

export const MAX_IMAGES_PER_RECIPE = 5;
export const MAX_INGREDIENTS = 60;
export const MAX_INSTRUCTIONS = 60;

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export const feedScopeSchema = z.enum(['all', 'following', 'discover']);
export type FeedScope = z.infer<typeof feedScopeSchema>;

export const feedQuerySchema = cursorQuerySchema.extend({
  scope: feedScopeSchema.default('all'),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

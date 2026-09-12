import { z } from 'zod';
import type { PublicUser } from './user';

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comentariul nu poate fi gol').max(2000),
  parentCommentId: z.string().uuid().nullable().optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export interface Comment {
  id: string;
  recipeId: string;
  parentCommentId: string | null;
  content: string;
  author: PublicUser;
  createdAt: string;
  /** true daca autorul cererii poate sterge acest comentariu. */
  canDelete: boolean;
}

export type NotificationType = 'like' | 'comment' | 'follow';

export interface NotificationActor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: NotificationActor;
  recipeId: string | null;
  recipeTitle: string | null;
  read: boolean;
  createdAt: string;
}

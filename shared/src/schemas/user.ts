import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(300).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  recipesCount: number;
  followersCount: number;
  followingCount: number;
  /** Fata de utilizatorul curent; absent cand profilul e al tau. */
  isFollowedByMe: boolean;
  createdAt: string;
}

export interface AuthUser extends PublicUser {
  email: string;
}

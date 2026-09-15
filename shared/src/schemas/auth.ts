import { z } from 'zod';
import type { AuthUser } from './user';

export const usernameSchema = z
  .string()
  .min(3, 'Minim 3 caractere')
  .max(24, 'Maxim 24 caractere')
  .regex(/^[a-z0-9_]+$/, 'Doar litere mici, cifre si _');

export const passwordSchema = z
  .string()
  .min(8, 'Parola trebuie sa aiba minim 8 caractere')
  .max(128);

export const registerSchema = z.object({
  username: usernameSchema,
  displayName: z.string().min(1).max(60),
  email: z.string().email('Email invalid').max(254),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });
export type RefreshInput = z.infer<typeof refreshSchema>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Inregistrarea poate crea direct un cont activ (tokens emisi) sau, cand
 * poarta de aprobare e activa, un cont in asteptare - fara autentificare
 * automata pana cand un admin il aproba.
 */
export type RegisterResult =
  | { pending: true }
  | { pending: false; user: AuthUser; tokens: AuthTokens };

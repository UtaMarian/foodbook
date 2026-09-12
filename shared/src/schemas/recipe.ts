import { z } from 'zod';
import { MAX_IMAGES_PER_RECIPE, MAX_INGREDIENTS, MAX_INSTRUCTIONS } from './common';

export const ingredientInputSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().positive().max(100000).nullable().optional(),
  unit: z.string().max(24).nullable().optional(),
});
export type IngredientInput = z.infer<typeof ingredientInputSchema>;

export const instructionInputSchema = z.object({
  text: z.string().min(1).max(2000),
});
export type InstructionInput = z.infer<typeof instructionInputSchema>;

const recipeBase = z.object({
  title: z.string().max(140).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  prepMinutes: z.number().int().min(1).max(6000).nullable().optional(),
  servings: z.number().int().min(1).max(100).nullable().optional(),
  categorySlug: z.string().max(40).nullable().optional(),
  imageKeys: z.array(z.string().min(1).max(300)).max(MAX_IMAGES_PER_RECIPE).default([]),
  ingredients: z.array(ingredientInputSchema).max(MAX_INGREDIENTS).default([]),
  instructions: z.array(instructionInputSchema).max(MAX_INSTRUCTIONS).default([]),
});

/**
 * Regula anti-postare-goala: toate campurile sunt optionale, dar o retea
 * trebuie sa aiba cel putin imagine, titlu sau descriere - altfel cardul
 * din feed nu are ce afisa.
 */
const notEmpty = (v: {
  title?: string | null;
  description?: string | null;
  imageKeys?: string[];
}) =>
  Boolean(v.title?.trim()) ||
  Boolean(v.description?.trim()) ||
  Boolean(v.imageKeys && v.imageKeys.length > 0);

const notEmptyMessage = {
  message: 'Adauga cel putin o imagine, un titlu sau o descriere',
  path: ['title'],
};

export const createRecipeSchema = recipeBase.refine(notEmpty, notEmptyMessage);
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = recipeBase.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Nicio modificare trimisa' },
);
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

export interface RecipeImage {
  id: string;
  /**
   * Object key-ul din storage. Nu e secret (se poate deriva oricum din url),
   * dar il expunem explicit ca formularul de editare sa poata retrimite
   * imaginile pastrate impreuna cu cele noi in acelasi `imageKeys`.
   */
  key: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  position: number;
}

export interface RecipeAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface RecipeCategory {
  slug: string;
  name: string;
  emoji: string;
}

export interface RecipeSummary {
  id: string;
  title: string | null;
  description: string | null;
  prepMinutes: number | null;
  servings: number | null;
  category: RecipeCategory | null;
  images: RecipeImage[];
  author: RecipeAuthor;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  /** Fata de utilizatorul curent care a cerut resursa; absent pentru vizitator anonim. */
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string;
}

export interface RecipeDetail extends RecipeSummary {
  ingredients: { id: string; name: string; quantity: number | null; unit: string | null }[];
  instructions: { id: string; stepNumber: number; text: string }[];
  updatedAt: string;
}

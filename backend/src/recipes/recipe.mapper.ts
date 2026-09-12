import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MediaService } from '../uploads/media.service';
import type { RecipeDetail, RecipeSummary } from '@foodbook/shared';

export const recipeSummaryInclude = {
  author: { select: { id: true, username: true, displayName: true, avatarKey: true } },
  category: { select: { slug: true, name: true, emoji: true } },
  images: { orderBy: { position: 'asc' } },
} satisfies Prisma.RecipeInclude;

export const recipeDetailInclude = {
  ...recipeSummaryInclude,
  ingredients: { orderBy: { position: 'asc' } },
  instructions: { orderBy: { stepNumber: 'asc' } },
} satisfies Prisma.RecipeInclude;

type SummaryRow = Prisma.RecipeGetPayload<{ include: typeof recipeSummaryInclude }>;
type DetailRow = Prisma.RecipeGetPayload<{ include: typeof recipeDetailInclude }>;

/**
 * "Am dat eu like / am salvat eu?" pentru pagina curenta. Se calculeaza cu UN
 * query in plus per pagina (id-uri IN listă), nu unul per rand - evita N+1
 * fara sa fie nevoie de un LEFT JOIN in Prisma.
 */
export interface ViewerFlags {
  likedIds: Set<string>;
  savedIds: Set<string>;
}

export const noViewerFlags: ViewerFlags = { likedIds: new Set(), savedIds: new Set() };

@Injectable()
export class RecipeMapper {
  constructor(private readonly media: MediaService) {}

  toSummary(row: SummaryRow, viewer: ViewerFlags = noViewerFlags): RecipeSummary {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      prepMinutes: row.prepMinutes,
      servings: row.servings,
      category: row.category
        ? { slug: row.category.slug, name: row.category.name, emoji: row.category.emoji }
        : null,
      images: row.images.map((img) => ({
        id: img.id,
        key: img.objectKey,
        url: this.media.url(img.objectKey, 'feed')!,
        thumbUrl: this.media.url(img.objectKey, 'thumb')!,
        width: img.width,
        height: img.height,
        position: img.position,
      })),
      author: {
        id: row.author.id,
        username: row.author.username,
        displayName: row.author.displayName,
        avatarUrl: this.media.url(row.author.avatarKey, 'thumb'),
      },
      likesCount: row.likesCount,
      commentsCount: row.commentsCount,
      savesCount: row.savesCount,
      isLiked: viewer.likedIds.has(row.id),
      isSaved: viewer.savedIds.has(row.id),
      createdAt: row.createdAt.toISOString(),
    };
  }

  toDetail(row: DetailRow, viewer: ViewerFlags = noViewerFlags): RecipeDetail {
    return {
      ...this.toSummary(row, viewer),
      ingredients: row.ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity === null ? null : Number(i.quantity),
        unit: i.unit,
      })),
      instructions: row.instructions.map((s) => ({
        id: s.id,
        stepNumber: s.stepNumber,
        text: s.text,
      })),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

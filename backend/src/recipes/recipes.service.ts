import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RecipeMapper, recipeDetailInclude, recipeSummaryInclude } from './recipe.mapper';
import { ViewerFlagsService } from './viewer-flags.service';
import { buildPage, cursorWhere, decodeCursor } from '../common/pagination';
import { ImageService } from '../uploads/image.service';
import { CategoryLookupService } from '../categories/category-lookup.service';
import type {
  CreateRecipeInput,
  Page,
  RecipeDetail,
  RecipeSummary,
  UpdateRecipeInput,
} from '@foodbook/shared';

const OBJECT_KEY_RE = /^recipes\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f-]{36}$/;

interface ResolvedImage {
  objectKey: string;
  width: number;
  height: number;
}

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: RecipeMapper,
    private readonly images: ImageService,
    private readonly categories: CategoryLookupService,
    private readonly viewerFlags: ViewerFlagsService,
  ) {}

  /**
   * O cheie e acceptata doar daca a fost urcata de acelasi utilizator si nu a
   * fost deja folosita - altfel oricine ar putea atasa imaginea altcuiva.
   * Cheile deja atasate acestei retete raman valide la editare.
   */
  private async resolveImages(
    tx: Prisma.TransactionClient,
    userId: string,
    keys: string[],
    recipeId?: string,
  ): Promise<ResolvedImage[]> {
    const bad = keys.find((k) => !OBJECT_KEY_RE.test(k));
    if (bad) throw new BadRequestException(`Cheie de imagine invalida: ${bad}`);
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Imagini duplicate');
    if (keys.length === 0) return [];

    const alreadyAttached = recipeId
      ? await tx.recipeImage.findMany({
          where: { recipeId, objectKey: { in: keys } },
          select: { objectKey: true, width: true, height: true },
        })
      : [];
    const attachedByKey = new Map(alreadyAttached.map((i) => [i.objectKey, i]));

    const missing = keys.filter((k) => !attachedByKey.has(k));
    const staged = missing.length
      ? await tx.uploadedImage.findMany({
          where: { objectKey: { in: missing }, userId, consumedAt: null },
          select: { objectKey: true, width: true, height: true },
        })
      : [];
    const stagedByKey = new Map(staged.map((i) => [i.objectKey, i]));

    const unknown = missing.filter((k) => !stagedByKey.has(k));
    if (unknown.length) {
      throw new BadRequestException(
        'Imagine necunoscuta sau deja folosita. Incarca imaginea din nou.',
      );
    }

    if (missing.length) {
      await tx.uploadedImage.updateMany({
        where: { objectKey: { in: missing }, userId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    }

    return keys.map((objectKey) => {
      const src = attachedByKey.get(objectKey) ?? stagedByKey.get(objectKey)!;
      return { objectKey, width: src.width, height: src.height };
    });
  }

  async create(userId: string, input: CreateRecipeInput): Promise<RecipeDetail> {
    // Rezolvat inainte de tranzactie: nu are sens sa deschidem o tranzactie
    // doar ca sa o rulback-uim pe un slug de categorie invalid.
    const categoryId = await this.categories.resolveId(input.categorySlug);

    const recipe = await this.prisma.$transaction(async (tx) => {
      const images = await this.resolveImages(tx, userId, input.imageKeys);

      const created = await tx.recipe.create({
        data: {
          userId,
          title: input.title?.trim() || null,
          description: input.description?.trim() || null,
          prepMinutes: input.prepMinutes ?? null,
          servings: input.servings ?? null,
          categoryId,
          images: { create: images.map((img, position) => ({ ...img, position })) },
          ingredients: {
            create: input.ingredients.map((ing, position) => ({
              name: ing.name.trim(),
              quantity: ing.quantity ?? null,
              unit: ing.unit?.trim() || null,
              position,
            })),
          },
          instructions: {
            create: input.instructions.map((step, idx) => ({
              stepNumber: idx + 1,
              text: step.text.trim(),
            })),
          },
        },
        include: recipeDetailInclude,
      });

      // Contorul denormalizat se misca in aceeasi tranzactie cu reteta.
      await tx.user.update({ where: { id: userId }, data: { recipesCount: { increment: 1 } } });

      return created;
    });

    return this.mapper.toDetail(recipe);
  }

  async findOne(id: string, viewerId: string): Promise<RecipeDetail> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, deletedAt: null },
      include: recipeDetailInclude,
    });
    if (!recipe) throw new NotFoundException('Reteta inexistenta');
    const viewer = await this.viewerFlags.forRecipe(viewerId, id);
    return this.mapper.toDetail(recipe, viewer);
  }

  async update(id: string, userId: string, input: UpdateRecipeInput): Promise<RecipeDetail> {
    const existing = await this.prisma.recipe.findFirst({
      where: { id, deletedAt: null },
      select: {
        userId: true,
        title: true,
        description: true,
        images: { select: { objectKey: true } },
      },
    });
    if (!existing) throw new NotFoundException('Reteta inexistenta');
    if (existing.userId !== userId) throw new ForbiddenException('Nu poti edita reteta altcuiva');

    // Regula anti-postare-goala se verifica pe starea finala, nu pe ce s-a trimis.
    const finalTitle = input.title !== undefined ? input.title : existing.title;
    const finalDescription =
      input.description !== undefined ? input.description : existing.description;
    const finalImageCount =
      input.imageKeys !== undefined ? input.imageKeys.length : existing.images.length;
    if (!finalTitle?.trim() && !finalDescription?.trim() && finalImageCount === 0) {
      throw new BadRequestException(
        'Reteta trebuie sa pastreze o imagine, un titlu sau o descriere',
      );
    }

    const categoryId =
      input.categorySlug !== undefined ? await this.categories.resolveId(input.categorySlug) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.imageKeys) {
        const images = await this.resolveImages(tx, userId, input.imageKeys, id);
        await tx.recipeImage.deleteMany({ where: { recipeId: id } });
        await tx.recipeImage.createMany({
          data: images.map((img, position) => ({ recipeId: id, ...img, position })),
        });
      }
      if (input.ingredients) {
        await tx.ingredient.deleteMany({ where: { recipeId: id } });
        await tx.ingredient.createMany({
          data: input.ingredients.map((ing, position) => ({
            recipeId: id,
            name: ing.name.trim(),
            quantity: ing.quantity ?? null,
            unit: ing.unit?.trim() || null,
            position,
          })),
        });
      }
      if (input.instructions) {
        await tx.instruction.deleteMany({ where: { recipeId: id } });
        await tx.instruction.createMany({
          data: input.instructions.map((step, idx) => ({
            recipeId: id,
            stepNumber: idx + 1,
            text: step.text.trim(),
          })),
        });
      }

      return tx.recipe.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.prepMinutes !== undefined ? { prepMinutes: input.prepMinutes } : {}),
          ...(input.servings !== undefined ? { servings: input.servings } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
        },
        include: recipeDetailInclude,
      });
    });

    // Imaginile scoase din reteta se sterg din storage dupa commit.
    if (input.imageKeys) {
      const kept = new Set(input.imageKeys);
      const dropped = existing.images.map((i) => i.objectKey).filter((k) => !kept.has(k));
      await Promise.all(dropped.map((k) => this.images.remove(k).catch(() => undefined)));
    }

    const viewer = await this.viewerFlags.forRecipe(userId, id);
    return this.mapper.toDetail(updated, viewer);
  }

  /** Soft delete: pastram randul pentru moderare si pentru un eventual undo. */
  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.recipe.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!existing) throw new NotFoundException('Reteta inexistenta');
    if (existing.userId !== userId) throw new ForbiddenException('Nu poti sterge reteta altcuiva');

    await this.prisma.$transaction([
      this.prisma.recipe.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { recipesCount: { decrement: 1 } } }),
    ]);
  }

  async listByUsername(
    username: string,
    viewerId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<RecipeSummary>> {
    const author = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!author) throw new NotFoundException('Utilizator inexistent');

    const rows = await this.prisma.recipe.findMany({
      where: { userId: author.id, deletedAt: null, ...cursorWhere(decodeCursor(rawCursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: recipeSummaryInclude,
    });

    const page = buildPage(rows, limit);
    const viewer = await this.viewerFlags.forRecipes(viewerId, page.items.map((r) => r.id));
    return {
      items: page.items.map((r) => this.mapper.toSummary(r, viewer)),
      nextCursor: page.nextCursor,
    };
  }
}

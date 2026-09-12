import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Extras separat de CategoriesService (care depinde de RecipesModule pentru
 * RecipeMapper) ca sa nu apara o dependinta circulara: RecipesModule are
 * nevoie sa rezolve categorySlug -> id la creare/editare de reteta.
 */
@Injectable()
export class CategoryLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveId(slug: string | null | undefined): Promise<number | null> {
    if (!slug) return null;
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category) throw new BadRequestException(`Categorie necunoscuta: ${slug}`);
    return category.id;
  }
}

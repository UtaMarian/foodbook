import { Link } from 'react-router';
import type { RecipeSummary } from '@foodbook/shared';

/** Grid de 3 coloane, ca pe profilurile din retelele vizuale. */
export function RecipeGridItem({ recipe }: { recipe: RecipeSummary }) {
  const thumb = recipe.images[0]?.thumbUrl;

  return (
    <Link to={`/recipe/${recipe.id}`} className="block aspect-square p-0.5">
      {thumb ? (
        <img src={thumb} alt="" className="size-full rounded-sm bg-surface-alt object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center rounded-sm bg-surface-alt p-2 text-center">
          <span className="line-clamp-4 text-[11px] leading-4 text-text-muted">
            {recipe.title || recipe.description || 'Rețetă'}
          </span>
        </div>
      )}
    </Link>
  );
}

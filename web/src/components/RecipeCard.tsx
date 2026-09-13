import { Link } from 'react-router';
import { Heart, MessageCircle, Bookmark } from 'lucide-react';
import type { RecipeSummary } from '@foodbook/shared';
import { Avatar } from '@/components/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToggleLike, useToggleSave } from '@/hooks/useRecipeSocial';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const image = recipe.images[0];
  const aspect = image && image.height > 0 ? image.width / image.height : 4 / 3;
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 transition-opacity hover:opacity-95"
    >
      <div className="flex items-center gap-3">
        <Avatar url={recipe.author.avatarUrl} name={recipe.author.displayName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-text">{recipe.author.displayName}</p>
          <p className="mt-px text-xs text-text-faint">{timeAgo(recipe.createdAt)}</p>
        </div>
      </div>

      {recipe.title ? (
        <p className="line-clamp-2 text-[19px] font-bold leading-6 text-text">{recipe.title}</p>
      ) : null}

      {image ? (
        <img
          src={image.url}
          alt=""
          className="w-full rounded-md bg-surface-alt object-cover"
          style={{ aspectRatio: aspect }}
        />
      ) : null}

      {recipe.description ? (
        <p className="line-clamp-3 text-sm leading-5 text-text-muted">{recipe.description}</p>
      ) : null}

      {recipe.category || recipe.prepMinutes || recipe.servings ? (
        <div className="flex flex-wrap gap-2">
          {recipe.category ? (
            <span className="rounded-full bg-surface-alt px-3 py-1.5 text-xs font-semibold text-text-muted">
              {recipe.category.emoji} {recipe.category.name}
            </span>
          ) : null}
          {recipe.prepMinutes ? (
            <span className="rounded-full bg-surface-alt px-3 py-1.5 text-xs font-semibold text-text-muted">
              ⏱ {recipe.prepMinutes} min
            </span>
          ) : null}
          {recipe.servings ? (
            <span className="rounded-full bg-surface-alt px-3 py-1.5 text-xs font-semibold text-text-muted">
              🍽 {recipe.servings} porții
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleLike.mutate({ id: recipe.id, liked: recipe.isLiked });
          }}
          className="flex items-center gap-1"
          aria-label={recipe.isLiked ? 'Anulează aprecierea' : 'Apreciază'}
        >
          <Heart
            size={22}
            className={cn(recipe.isLiked ? 'fill-primary text-primary' : 'text-text-muted')}
          />
          <span className="text-[13px] font-semibold text-text-muted">{recipe.likesCount}</span>
        </button>

        <div className="flex items-center gap-1">
          <MessageCircle size={20} className="text-text-muted" />
          <span className="text-[13px] font-semibold text-text-muted">{recipe.commentsCount}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleSave.mutate({ id: recipe.id, saved: recipe.isSaved });
          }}
          className="ml-auto flex items-center gap-1"
          aria-label={recipe.isSaved ? 'Elimină din salvate' : 'Salvează'}
        >
          <Bookmark size={20} className={cn(recipe.isSaved ? 'fill-primary text-primary' : 'text-text-muted')} />
        </button>
      </div>
    </Link>
  );
}

export function RecipeCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full bg-skeleton" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32 bg-skeleton" />
          <Skeleton className="h-2.5 w-16 bg-skeleton" />
        </div>
      </div>
      <Skeleton className="h-5 w-52 bg-skeleton" />
      <Skeleton className="h-52 rounded-md bg-skeleton" />
    </div>
  );
}

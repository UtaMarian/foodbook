import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Heart, MessageCircle, Bookmark } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToggleLike, useToggleSave } from '@/hooks/useRecipeSocial';
import { Avatar } from '@/components/Avatar';
import { FollowButton } from '@/components/FollowButton';
import { ImageViewer } from '@/components/ImageViewer';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function RecipeDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id = '' } = useParams<{ id: string }>();
  const currentUser = useAuth((s) => s.user);
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const query = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipe(id),
    enabled: !!id,
  });

  const recipe = query.data;
  const isOwn = currentUser?.id === recipe?.author.id;

  const authorProfile = useQuery({
    queryKey: ['user', recipe?.author.username],
    queryFn: () => api.user(recipe!.author.username),
    enabled: !!recipe && !isOwn,
  });

  const remove = useMutation({
    mutationFn: () => api.deleteRecipe(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['userRecipes'] });
      navigate(-1);
    },
  });

  const back = (
    <button
      type="button"
      onClick={() => navigate(-1)}
      aria-label="Înapoi"
      className="absolute left-4 top-4 z-10 flex size-9 items-center justify-center rounded-full border border-border bg-surface"
    >
      <ArrowLeft size={20} className="text-text" />
    </button>
  );

  if (query.isLoading) {
    return (
      <div className="relative">
        {back}
        <div className="flex flex-col gap-4 p-4 pt-16">
          <Skeleton className="h-60 rounded-lg bg-skeleton" />
          <Skeleton className="h-6 w-56 bg-skeleton" />
          <Skeleton className="h-3.5 bg-skeleton" />
          <Skeleton className="h-3.5 w-4/5 bg-skeleton" />
        </div>
      </div>
    );
  }

  if (query.isError || !recipe) {
    return (
      <div className="relative">
        {back}
        <div className="pt-16">
          <ErrorState
            message={query.error instanceof ApiError ? query.error.message : 'Rețeta nu a putut fi încărcată'}
            onRetry={() => void query.refetch()}
          />
        </div>
      </div>
    );
  }

  const cover = recipe.images[0];

  return (
    <div className="relative pb-12">
      {back}

      {cover ? (
        <button type="button" onClick={() => setViewerIndex(0)} className="block w-full">
          <img
            src={cover.url}
            alt=""
            className="w-full bg-surface-alt object-cover"
            style={{ aspectRatio: cover.height > 0 ? cover.width / cover.height : 4 / 3 }}
          />
        </button>
      ) : (
        <div className="h-16" />
      )}

      {recipe.images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto p-3">
          {recipe.images.slice(1).map((img, i) => (
            <button key={img.id} type="button" onClick={() => setViewerIndex(i + 1)}>
              <img src={img.url} alt="" className="size-28 rounded-md bg-surface-alt object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 p-4">
        {recipe.title ? <h1 className="text-[26px] font-extrabold leading-8 text-text">{recipe.title}</h1> : null}

        <div className="flex items-center justify-between">
          <Link to={`/user/${recipe.author.username}`} className="flex items-center gap-3">
            <Avatar url={recipe.author.avatarUrl} name={recipe.author.displayName} size={40} />
            <div>
              <p className="text-[15px] font-bold text-text">{recipe.author.displayName}</p>
              <p className="text-[13px] text-text-faint">@{recipe.author.username}</p>
            </div>
          </Link>
          {!isOwn && authorProfile.data ? (
            <FollowButton username={recipe.author.username} isFollowing={authorProfile.data.isFollowedByMe} size="compact" />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {recipe.category ? (
            <span className="rounded-full bg-surface-alt px-3 py-1.5 text-[13px] font-semibold text-text-muted">
              {recipe.category.emoji} {recipe.category.name}
            </span>
          ) : null}
          {recipe.prepMinutes ? (
            <span className="rounded-full bg-surface-alt px-3 py-1.5 text-[13px] font-semibold text-text-muted">
              ⏱ {recipe.prepMinutes} min
            </span>
          ) : null}
          {recipe.servings ? (
            <span className="rounded-full bg-surface-alt px-3 py-1.5 text-[13px] font-semibold text-text-muted">
              🍽 {recipe.servings} porții
            </span>
          ) : null}
        </div>

        {recipe.description ? <p className="text-[15px] leading-6 text-text-muted">{recipe.description}</p> : null}

        <div className="flex items-center gap-6 border-y border-border py-3">
          <button
            type="button"
            onClick={() => toggleLike.mutate({ id: recipe.id, liked: recipe.isLiked })}
            className="flex items-center gap-1"
            aria-label={recipe.isLiked ? 'Anulează aprecierea' : 'Apreciază'}
          >
            <Heart size={24} className={recipe.isLiked ? 'fill-primary text-primary' : 'text-text-muted'} />
            <span className="text-sm font-semibold text-text-muted">{recipe.likesCount}</span>
          </button>

          <Link to={`/recipe/${recipe.id}/comments`} className="flex items-center gap-1" aria-label="Comentarii">
            <MessageCircle size={22} className="text-text-muted" />
            <span className="text-sm font-semibold text-text-muted">{recipe.commentsCount}</span>
          </Link>

          <button
            type="button"
            onClick={() => toggleSave.mutate({ id: recipe.id, saved: recipe.isSaved })}
            className="ml-auto flex items-center gap-1"
            aria-label={recipe.isSaved ? 'Elimină din salvate' : 'Salvează'}
          >
            <Bookmark size={22} className={recipe.isSaved ? 'fill-primary text-primary' : 'text-text-muted'} />
          </button>
        </div>

        {recipe.ingredients.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            <h2 className="text-lg font-extrabold text-text">Ingrediente</h2>
            {recipe.ingredients.map((ing) => (
              <div key={ing.id} className="flex gap-2">
                <span className="font-extrabold text-primary">•</span>
                <span className="flex-1 text-[15px] leading-6 text-text">
                  {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {recipe.instructions.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            <h2 className="text-lg font-extrabold text-text">Mod de preparare</h2>
            {recipe.instructions.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-text">
                  {step.stepNumber}
                </span>
                <span className="flex-1 text-[15px] leading-6 text-text">{step.text}</span>
              </div>
            ))}
          </div>
        ) : null}

        {isOwn ? (
          <div className="mt-4 flex gap-3">
            <Link to={`/recipe/${recipe.id}/edit`} className="flex-1">
              <Button label="Editează" variant="secondary" className="w-full" />
            </Link>
            <Button
              label="Șterge"
              variant="danger"
              className="flex-1"
              onClick={() => setConfirmingDelete(true)}
              loading={remove.isPending}
            />
          </div>
        ) : null}
      </div>

      <ImageViewer
        images={recipe.images}
        initialIndex={viewerIndex ?? 0}
        open={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Ștergi rețeta?"
        description="Acțiunea nu poate fi anulată."
        confirmLabel="Șterge"
        confirming={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

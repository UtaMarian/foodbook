import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { RecipeCard, RecipeCardSkeleton } from '@/components/RecipeCard';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

export default function CategoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug = '' } = useParams<{ slug: string }>();
  const state = location.state as { name?: string; emoji?: string } | null;

  const query = useInfiniteQuery({
    queryKey: ['categoryRecipes', slug],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.categoryRecipes(slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!slug,
  });

  const recipes = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 pb-6 pt-6">
        <button type="button" onClick={() => navigate(-1)} aria-label="Înapoi">
          <ArrowLeft size={22} className="text-text" />
        </button>
        <h1 className="text-xl font-extrabold text-text">
          {state?.emoji ? `${state.emoji} ` : ''}
          {state?.name ?? 'Categorie'}
        </h1>
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-4">
          <RecipeCardSkeleton />
          <RecipeCardSkeleton />
        </div>
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : 'Nu am putut încărca'}
          onRetry={() => void query.refetch()}
        />
      ) : recipes.length === 0 ? (
        <EmptyState emoji="🍽️" title="Nimic aici încă" message="Nicio rețetă publicată în această categorie." />
      ) : (
        <div className="flex flex-col gap-4">
          {recipes.map((item) => (
            <RecipeCard key={item.id} recipe={item} />
          ))}
          <LoadMoreSentinel
            hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
          />
        </div>
      )}
    </div>
  );
}

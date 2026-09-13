import { useInfiniteQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { RecipeCard, RecipeCardSkeleton } from '@/components/RecipeCard';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

export default function Saved() {
  const query = useInfiniteQuery({
    queryKey: ['savedRecipes'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.savedRecipes(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const recipes = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="p-4 pt-6">
      <h1 className="mb-6 text-[22px] font-extrabold text-text">🔖 Rețete salvate</h1>

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
        <EmptyState
          emoji="🔖"
          title="Nimic salvat încă"
          message="Apasă pe pictograma de marcaj de la o rețetă ca s-o găsești mai târziu aici."
        />
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

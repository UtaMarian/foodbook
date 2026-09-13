import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { SearchIcon, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { RecipeCard, RecipeCardSkeleton } from '@/components/RecipeCard';
import { UserListScreen } from '@/components/UserList';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';
import { cn } from '@/lib/utils';

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type Tab = 'recipes' | 'users';

export default function Search() {
  const [text, setText] = useState('');
  const [tab, setTab] = useState<Tab>('recipes');
  const q = useDebounced(text.trim(), 350);

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: api.categories, enabled: !q });

  const recipesQuery = useInfiniteQuery({
    queryKey: ['searchRecipes', q],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.searchRecipes(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: tab === 'recipes' && !!q,
  });

  const usersQuery = useInfiniteQuery({
    queryKey: ['searchUsers', q],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.searchUsers(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: tab === 'users' && !!q,
  });

  const header = (
    <div className="flex flex-col gap-3 px-4 pt-6">
      <div className="flex items-center gap-2 rounded-full bg-surface-alt px-3 py-2.5">
        <SearchIcon size={18} className="text-text-faint" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Caută rețete sau utilizatori..."
          className="flex-1 bg-transparent text-[15px] text-text placeholder:text-text-faint outline-none"
        />
        {text ? (
          <button type="button" onClick={() => setText('')} aria-label="Șterge">
            <XCircle size={18} className="text-text-faint" />
          </button>
        ) : null}
      </div>

      {q ? (
        <div className="flex gap-6">
          {(['recipes', 'users'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn('relative pb-2 text-[15px] font-bold', tab === t ? 'text-primary' : 'text-text-muted')}
            >
              {t === 'recipes' ? 'Rețete' : 'Utilizatori'}
              {tab === t ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-primary" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  if (!q) {
    return (
      <div>
        {header}
        <p className="mb-2 mt-6 px-4 text-base font-extrabold text-text">Categorii</p>
        <div className="grid grid-cols-2 gap-3 px-4 pb-8">
          {(categoriesQuery.data ?? []).map((item) => (
            <Link
              key={item.slug}
              to={`/category/${item.slug}`}
              state={{ name: item.name, emoji: item.emoji }}
              className="rounded-lg border border-border bg-surface p-3"
            >
              <span className="text-3xl">{item.emoji}</span>
              <p className="mt-1 font-bold text-text">{item.name}</p>
              <p className="text-xs text-text-faint">{item.recipesCount} rețete</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (tab === 'users') {
    const users = usersQuery.data?.pages.flatMap((p) => p.items) ?? [];
    return (
      <div>
        {header}
        <UserListScreen
          users={users}
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          onRetry={() => void usersQuery.refetch()}
          hasNextPage={usersQuery.hasNextPage}
          isFetchingNextPage={usersQuery.isFetchingNextPage}
          onLoadMore={() => void usersQuery.fetchNextPage()}
          emptyTitle="Niciun utilizator găsit"
          emptyMessage={`Nimeni nu se potrivește cu „${q}”.`}
        />
      </div>
    );
  }

  const recipeResults = recipesQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      {header}
      <div className="flex flex-col gap-4 px-4 py-6">
        {recipesQuery.isLoading ? (
          <RecipeCardSkeleton />
        ) : recipesQuery.isError ? (
          <ErrorState
            message={recipesQuery.error instanceof ApiError ? recipesQuery.error.message : 'Căutarea a eșuat'}
            onRetry={() => void recipesQuery.refetch()}
          />
        ) : recipeResults.length === 0 ? (
          <EmptyState emoji="🔍" title="Niciun rezultat" message={`Nicio rețetă nu se potrivește cu „${q}”.`} />
        ) : (
          <>
            {recipeResults.map((item) => (
              <RecipeCard key={item.id} recipe={item} />
            ))}
            <LoadMoreSentinel
              hasNextPage={recipesQuery.hasNextPage}
              isFetchingNextPage={recipesQuery.isFetchingNextPage}
              onLoadMore={() => void recipesQuery.fetchNextPage()}
            />
          </>
        )}
      </div>
    </div>
  );
}

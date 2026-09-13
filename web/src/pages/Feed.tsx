import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { FeedScope } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { RecipeCard, RecipeCardSkeleton } from '@/components/RecipeCard';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { NotificationBell } from '@/components/ui/notification-bell';
import { cn } from '@/lib/utils';

const SCOPES: { value: FeedScope; label: string }[] = [
  { value: 'all', label: 'Toate' },
  { value: 'following', label: 'Urmăriți' },
  { value: 'discover', label: 'Descoperă' },
];

export default function Feed() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<FeedScope>('all');
  const unread = useUnreadNotifications();

  const query = useInfiniteQuery({
    queryKey: ['feed', scope],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.feed(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const recipes = query.data?.pages.flatMap((p) => p.items) ?? [];

  const header = (
    <div className="mb-4 flex flex-col gap-3 border-b border-border px-4 pb-4 pt-6">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[22px] font-extrabold text-text">
          <img src="/icon.png" alt="" className="size-7" />
          FoodBook
        </span>
        <NotificationBell
          size={40}
          count={unread.data?.count ?? 0}
          onClick={() => navigate('/notifications')}
          aria-label="Notificări"
        />
      </div>

      <div className="flex gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setScope(s.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-[13px] font-bold',
              scope === s.value ? 'bg-primary text-primary-text' : 'bg-surface-alt text-text-muted',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Button label="+ Publică o rețetă" onClick={() => navigate('/create')} />
    </div>
  );

  if (query.isLoading) {
    return (
      <div>
        {header}
        <div className="flex flex-col gap-4 px-4">
          <RecipeCardSkeleton />
          <RecipeCardSkeleton />
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div>
        {header}
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : 'Nu am putut încărca feed-ul'}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const emptyForScope =
    scope === 'following' ? (
      <EmptyState
        emoji="👥"
        title="Nu urmărești pe nimeni încă"
        message="Caută utilizatori și urmărește-i ca să le vezi rețetele aici."
        action={<Button label="Caută utilizatori" onClick={() => navigate('/search')} />}
      />
    ) : (
      <EmptyState
        emoji="🍽️"
        title="Încă nu e nimic în feed"
        message="Fii primul care publică o rețetă. Chiar și o poză cu ce ai gătit aseară e de ajuns."
        action={<Button label="Publică prima rețetă" onClick={() => navigate('/create')} />}
      />
    );

  return (
    <div>
      {header}
      <div className="flex flex-col gap-4 px-4 pb-8">
        {recipes.length === 0 ? (
          emptyForScope
        ) : (
          <>
            {recipes.map((item) => (
              <RecipeCard key={item.id} recipe={item} />
            ))}
            {query.isFetchingNextPage ? (
              <RecipeCardSkeleton />
            ) : query.hasNextPage ? (
              <Button
                label="Încarcă mai multe"
                variant="secondary"
                onClick={() => void query.fetchNextPage()}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

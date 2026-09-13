import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Link } from 'react-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import type { AppNotification } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';
import { timeAgoShort } from '@/lib/format';
import { cn } from '@/lib/utils';

function message(n: AppNotification): string {
  switch (n.type) {
    case 'like':
      return `a apreciat ${n.recipeTitle ? `„${n.recipeTitle}”` : 'rețeta ta'}`;
    case 'comment':
      return `a comentat la ${n.recipeTitle ? `„${n.recipeTitle}”` : 'rețeta ta'}`;
    case 'follow':
      return 'a început să te urmărească';
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.notifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const markRead = useMutation({
    mutationFn: api.markNotificationsRead,
    onSuccess: () => {
      queryClient.setQueryData(['unreadNotifications'], { count: 0 });
      queryClient.setQueryData<typeof query.data>(['notifications'], (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.map((n) => ({ ...n, read: true })) })) } : old,
      );
    },
  });

  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifications = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Înapoi">
          <ArrowLeft size={22} className="text-text" />
        </button>
        <span className="text-base font-bold text-text">Notificări</span>
        <span className="w-5.5" />
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-4 p-4">
          <Skeleton className="h-14 bg-skeleton" />
          <Skeleton className="h-14 bg-skeleton" />
        </div>
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : 'Notificările nu s-au putut încărca'}
          onRetry={() => void query.refetch()}
        />
      ) : notifications.length === 0 ? (
        <EmptyState emoji="🔔" title="Nimic încă" message="Aprecierile, comentariile și urmăririle apar aici." />
      ) : (
        <div className="flex flex-col gap-2 p-4">
          {notifications.map((item) => (
            <Link
              key={item.id}
              to={item.recipeId ? `/recipe/${item.recipeId}` : `/user/${item.actor.username}`}
              className={cn('flex items-center gap-3 rounded-md p-2', !item.read && 'bg-surface-alt')}
            >
              <Avatar url={item.actor.avatarUrl} name={item.actor.displayName} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-5 text-text">
                  <span className="font-bold">{item.actor.displayName}</span> {message(item)}
                </p>
                <p className="mt-0.5 text-xs text-text-faint">{timeAgoShort(item.createdAt)}</p>
              </div>
            </Link>
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

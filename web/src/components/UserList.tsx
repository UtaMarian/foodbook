import { Link } from 'react-router';
import type { PublicUser } from '@foodbook/shared';
import { useAuth } from '@/store/auth';
import { Avatar } from '@/components/Avatar';
import { FollowButton } from '@/components/FollowButton';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

export function UserListScreen({
  users,
  isLoading,
  isError,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  emptyTitle,
  emptyMessage,
}: {
  users: PublicUser[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore: () => void;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const currentUser = useAuth((s) => s.user);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-14 bg-skeleton" />
        <Skeleton className="h-14 bg-skeleton" />
        <Skeleton className="h-14 bg-skeleton" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Lista nu a putut fi încărcată" onRetry={onRetry} />;
  }

  if (users.length === 0) {
    return <EmptyState emoji="👥" title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {users.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <Link to={`/user/${item.username}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar url={item.avatarUrl} name={item.displayName} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-text">{item.displayName}</p>
              <p className="truncate text-[13px] text-text-faint">@{item.username}</p>
            </div>
          </Link>
          {currentUser?.username !== item.username ? (
            <FollowButton username={item.username} isFollowing={item.isFollowedByMe} size="compact" />
          ) : null}
        </div>
      ))}
      <LoadMoreSentinel
        hasNextPage={hasNextPage}
        isFetchingNextPage={!!isFetchingNextPage}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}

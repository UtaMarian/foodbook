import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import type { RecipeSummary } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Avatar } from '@/components/Avatar';
import { RecipeGridItem } from '@/components/RecipeGrid';
import { FollowButton } from '@/components/FollowButton';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

export default function UserProfile() {
  const navigate = useNavigate();
  const currentUser = useAuth((s) => s.user);
  const { username = '' } = useParams<{ username: string }>();

  const profile = useQuery({
    queryKey: ['user', username],
    queryFn: () => api.user(username),
    enabled: !!username,
  });

  const recipes = useInfiniteQuery({
    queryKey: ['userRecipes', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.userRecipes(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!username,
  });

  const items: RecipeSummary[] = recipes.data?.pages.flatMap((p) => p.items) ?? [];

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

  if (profile.isLoading) {
    return (
      <div className="relative">
        {back}
        <div className="flex flex-col items-center gap-3 pt-20">
          <Skeleton className="size-22 rounded-full bg-skeleton" />
          <Skeleton className="h-5 w-40 bg-skeleton" />
          <Skeleton className="h-3 w-24 bg-skeleton" />
        </div>
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="relative">
        {back}
        <div className="pt-16">
          <ErrorState
            message={profile.error instanceof ApiError ? profile.error.message : 'Profilul nu a putut fi încărcat'}
            onRetry={() => void profile.refetch()}
          />
        </div>
      </div>
    );
  }

  const user = profile.data;
  const isOwn = currentUser?.username === user.username;

  return (
    <div className="relative pb-8">
      {back}

      <div className="flex flex-col items-center gap-1 pb-6 pt-16">
        <Avatar url={user.avatarUrl} name={user.displayName} size={88} />
        <h1 className="mt-2 text-[22px] font-extrabold text-text">{user.displayName}</h1>
        <p className="text-sm text-text-faint">@{user.username}</p>
        {user.bio ? <p className="mt-2 max-w-sm px-6 text-center text-sm leading-5 text-text-muted">{user.bio}</p> : null}

        <div className="mt-3 flex gap-8">
          <div className="flex flex-col items-center">
            <AnimatedCounter value={user.recipesCount} className="text-lg font-extrabold text-text" />
            <span className="text-xs text-text-muted">rețete</span>
          </div>
          <Link to={`/user/${user.username}/followers`} className="flex flex-col items-center">
            <AnimatedCounter value={user.followersCount} className="text-lg font-extrabold text-text" />
            <span className="text-xs text-text-muted">urmăritori</span>
          </Link>
          <Link to={`/user/${user.username}/following`} className="flex flex-col items-center">
            <AnimatedCounter value={user.followingCount} className="text-lg font-extrabold text-text" />
            <span className="text-xs text-text-muted">urmărește</span>
          </Link>
        </div>

        {!isOwn ? (
          <div className="mt-3 w-full px-10">
            <FollowButton username={user.username} isFollowing={user.isFollowedByMe} />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-0.5 px-2">
        {items.map((item) => (
          <RecipeGridItem key={item.id} recipe={item} />
        ))}
      </div>

      {!recipes.isLoading && items.length === 0 ? (
        <EmptyState emoji="📖" title="Niciun preparat încă" message={`${user.displayName} nu a publicat nimic deocamdată.`} />
      ) : null}

      <div className="px-4">
        <LoadMoreSentinel
          hasNextPage={recipes.hasNextPage}
          isFetchingNextPage={recipes.isFetchingNextPage}
          onLoadMore={() => void recipes.fetchNextPage()}
        />
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Camera } from 'lucide-react';
import type { RecipeSummary } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { uploadAvatar } from '@/lib/image';
import { useAuth } from '@/store/auth';
import { Avatar } from '@/components/Avatar';
import { RecipeGridItem } from '@/components/RecipeGrid';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function Profile() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useInfiniteQuery({
    queryKey: ['userRecipes', user?.username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.userRecipes(user!.username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!user,
  });

  if (!user) return null;

  const recipes: RecipeSummary[] = query.data?.pages.flatMap((p) => p.items) ?? [];

  async function onAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      const updated = await uploadAvatar(file);
      setUser(updated);
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Încearcă din nou.');
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 pb-8 pt-6">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative mb-2"
        aria-label="Schimbă poza de profil"
      >
        {avatarBusy ? (
          <Skeleton className="size-22 rounded-full bg-skeleton" />
        ) : (
          <Avatar url={user.avatarUrl} name={user.displayName} size={88} />
        )}
        <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full bg-primary">
          <Camera size={14} className="text-primary-text" />
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarSelected} />
      {avatarError ? <p className="text-xs text-danger">{avatarError}</p> : null}

      <h1 className="text-[22px] font-extrabold text-text">{user.displayName}</h1>
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

      <div className="mt-4 flex w-full gap-3 px-4">
        <Link to="/profile/edit" className="flex-1">
          <Button label="Editează profilul" variant="secondary" className="w-full" />
        </Link>
        <Button label="Ieși" variant="danger" className="flex-1" onClick={() => setConfirmingSignOut(true)} />
      </div>

      <div className="mt-6 grid w-full grid-cols-3 gap-0.5 px-2">
        {recipes.map((item) => (
          <RecipeGridItem key={item.id} recipe={item} />
        ))}
      </div>

      {!query.isLoading && recipes.length === 0 ? (
        <EmptyState
          emoji="📖"
          title="Încă nu ai publicat nimic"
          message="Prima ta rețetă poate fi și doar o poză cu ce ai gătit azi."
          action={
            <Link to="/create">
              <Button label="Publică o rețetă" />
            </Link>
          }
        />
      ) : null}

      <div className="w-full px-4">
        <LoadMoreSentinel
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      </div>

      <ConfirmDialog
        open={confirmingSignOut}
        onOpenChange={setConfirmingSignOut}
        title="Ieși din cont?"
        description="Va trebui să te autentifici din nou."
        confirmLabel="Ieși"
        onConfirm={() => void signOut()}
      />
    </div>
  );
}

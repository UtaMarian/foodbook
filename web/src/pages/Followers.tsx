import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { UserListScreen } from '@/components/UserList';

export default function Followers() {
  const navigate = useNavigate();
  const { username = '' } = useParams<{ username: string }>();

  const query = useInfiniteQuery({
    queryKey: ['followers', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.followers(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!username,
  });

  const users = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 px-4 pt-6">
        <button type="button" onClick={() => navigate(-1)} aria-label="Înapoi">
          <ArrowLeft size={22} className="text-text" />
        </button>
        <h1 className="text-lg font-bold text-text">Urmăritori</h1>
      </div>
      <UserListScreen
        users={users}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
        emptyTitle="Niciun urmăritor încă"
        emptyMessage="Când cineva îl urmărește, va apărea aici."
      />
    </div>
  );
}

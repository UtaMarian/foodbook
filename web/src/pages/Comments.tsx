import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, X } from 'lucide-react';
import type { Comment } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteButton } from '@/components/ui/delete-button';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';
import { patchRecipeInCaches } from '@/lib/recipe-cache';
import { timeAgoShort } from '@/lib/format';

export default function Comments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id = '' } = useParams<{ id: string }>();

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ['comments', id],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.comments(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!id,
  });

  const comments = query.data?.pages.flatMap((p) => p.items) ?? [];

  const addComment = useMutation({
    mutationFn: (content: string) => api.addComment(id, { content, parentCommentId: replyTo?.id ?? null }),
    onSuccess: (created) => {
      queryClient.setQueryData<typeof query.data>(['comments', id], (old) => {
        if (!old) return old;
        const [first, ...rest] = old.pages;
        return { ...old, pages: [{ items: [created, ...first.items], nextCursor: first.nextCursor }, ...rest] };
      });
      patchRecipeInCaches(queryClient, id, (r) => ({ ...r, commentsCount: r.commentsCount + 1 }));
      setText('');
      setReplyTo(null);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Comentariul nu a fost trimis. Încearcă din nou.'),
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(commentId),
    onSuccess: (_data, commentId) => {
      queryClient.setQueryData<typeof query.data>(['comments', id], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({ ...page, items: page.items.filter((item) => item.id !== commentId) })),
        };
      });
      patchRecipeInCaches(queryClient, id, (r) => ({ ...r, commentsCount: Math.max(0, r.commentsCount - 1) }));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || addComment.isPending) return;
    addComment.mutate(trimmed);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Închide">
          <X size={24} className="text-text" />
        </button>
        <span className="text-base font-bold text-text">Comentarii</span>
        <span className="w-6" />
      </div>

      <div className="flex-1 p-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-11 bg-skeleton" />
            <Skeleton className="h-11 bg-skeleton" />
          </div>
        ) : query.isError ? (
          <ErrorState
            message={query.error instanceof ApiError ? query.error.message : 'Comentariile nu s-au putut încărca'}
            onRetry={() => void query.refetch()}
          />
        ) : comments.length === 0 ? (
          <EmptyState emoji="💬" title="Niciun comentariu încă" message="Fii primul care spune ceva." />
        ) : (
          <div className="flex flex-col gap-4">
            {comments.map((item) => (
              <div key={item.id} className={item.parentCommentId ? 'ml-6' : undefined}>
                {item.parentCommentId ? <p className="text-[11px] font-semibold text-text-faint">↳ răspuns</p> : null}
                <div className="flex gap-2">
                  <Avatar url={item.author.avatarUrl} name={item.author.displayName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-text">{item.author.displayName}</span>
                      <span className="text-xs text-text-faint">{timeAgoShort(item.createdAt)}</span>
                    </div>
                    <p className="text-sm leading-5 text-text">{item.content}</p>
                    <div className="mt-0.5 flex items-center gap-4">
                      {!item.parentCommentId ? (
                        <button
                          type="button"
                          onClick={() => setReplyTo(item)}
                          className="text-xs font-semibold text-text-muted"
                        >
                          Răspunde
                        </button>
                      ) : null}
                      {item.canDelete ? (
                        <DeleteButton
                          className="!h-8 scale-75 origin-left"
                          onConfirm={() => deleteComment.mutate(item.id)}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <LoadMoreSentinel
              hasNextPage={query.hasNextPage}
              isFetchingNextPage={query.isFetchingNextPage}
              onLoadMore={() => void query.fetchNextPage()}
            />
          </div>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-border p-3">
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="truncate text-xs text-text-muted">Răspunzi lui {replyTo.author.displayName}</span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Anulează răspunsul">
              <X size={16} className="text-text-muted" />
            </button>
          </div>
        ) : null}
        {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Scrie un comentariu..."
            rows={1}
            className="max-h-24 flex-1 resize-none rounded-lg bg-surface-alt px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || addComment.isPending}
            aria-label="Trimite comentariul"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary disabled:opacity-50"
          >
            <ArrowUp size={18} className="text-primary-text" />
          </button>
        </div>
      </form>
    </div>
  );
}

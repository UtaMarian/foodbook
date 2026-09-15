import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import type { AdminUserStatusFilter, Category } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

const STATUS_TABS: { value: AdminUserStatusFilter; label: string }[] = [
  { value: 'all', label: 'Toți' },
  { value: 'pending', label: 'În așteptare' },
  { value: 'approved', label: 'Aprobați' },
  { value: 'rejected', label: 'Respinși' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'În așteptare',
  approved: 'Aprobat',
  rejected: 'Respins',
};

const inputClasses =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-primary';

function ApprovalToggle() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['adminSettings'], queryFn: api.adminSettings });

  const toggle = useMutation({
    mutationFn: (requireApproval: boolean) => api.updateAdminSettings({ requireApproval }),
    onSuccess: (data) => queryClient.setQueryData(['adminSettings'], data),
  });

  const on = settingsQuery.data?.requireApproval ?? false;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="text-[15px] font-bold text-text">Necesită aprobare la înregistrare</p>
        <p className="text-sm text-text-muted">
          Cât timp e activ, conturile noi rămân în așteptare până le aprobi mai jos.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={settingsQuery.isLoading || toggle.isPending}
        onClick={() => toggle.mutate(!on)}
        className={cn(
          'relative inline-block h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50',
          on ? 'bg-primary' : 'bg-surface-alt',
        )}
      >
        <span
          className="absolute top-0.5 size-6 rounded-full bg-surface shadow transition-[left]"
          style={{ left: on ? 22 : 2 }}
        />
      </button>
    </div>
  );
}

function UsersPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AdminUserStatusFilter>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ['adminUsers', status],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.adminUsers(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const invalidateLists = () => void queryClient.invalidateQueries({ queryKey: ['adminUsers'] });

  const approve = useMutation({
    mutationFn: (id: string) => api.approveUser(id),
    onSuccess: invalidateLists,
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.rejectUser(id),
    onSuccess: () => {
      invalidateLists();
      setRejectingId(null);
    },
  });

  const users = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <ApprovalToggle />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold',
              status === tab.value ? 'bg-primary text-primary-text' : 'bg-surface-alt text-text-muted',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 bg-skeleton" />
          <Skeleton className="h-20 bg-skeleton" />
        </div>
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : 'Nu am putut încărca lista'}
          onRetry={() => void query.refetch()}
        />
      ) : users.length === 0 ? (
        <EmptyState emoji="🗂️" title="Nimic aici" message="Niciun utilizator în această categorie." />
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-text">{u.displayName}</p>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      u.status === 'approved' && 'bg-surface-alt text-text-muted',
                      u.status === 'pending' && 'bg-primary/15 text-primary',
                      u.status === 'rejected' && 'bg-danger/15 text-danger',
                    )}
                  >
                    {STATUS_LABEL[u.status]}
                  </span>
                  {u.role === 'admin' ? (
                    <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-semibold text-text-muted">
                      Admin
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-text-faint">
                  @{u.username} · {u.email}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                {u.status !== 'approved' ? (
                  <Button
                    label="Aprobă"
                    variant="secondary"
                    className="min-h-0 px-3.5 py-2 text-sm"
                    loading={approve.isPending && approve.variables === u.id}
                    onClick={() => approve.mutate(u.id)}
                  />
                ) : null}
                {u.status !== 'rejected' ? (
                  <Button
                    label="Respinge"
                    variant="danger"
                    className="min-h-0 px-3.5 py-2 text-sm"
                    onClick={() => setRejectingId(u.id)}
                  />
                ) : null}
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

      <ConfirmDialog
        open={rejectingId !== null}
        onOpenChange={(open) => !open && setRejectingId(null)}
        title="Respingi acest cont?"
        description="Utilizatorul nu va putea intra în cont, iar sesiunile active vor fi întrerupte."
        confirmLabel="Respinge"
        confirming={reject.isPending}
        onConfirm={() => rejectingId && reject.mutate(rejectingId)}
      />
    </div>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji);
  const [deleting, setDeleting] = useState(false);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['categories'] });

  const update = useMutation({
    mutationFn: () => api.updateCategory(category.slug, { name: name.trim(), emoji: emoji.trim() }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteCategory(category.slug),
    onSuccess: () => {
      setDeleting(false);
      invalidate();
    },
  });

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={cn(inputClasses, 'w-16 text-center')} />
        <input value={name} onChange={(e) => setName(e.target.value)} className={cn(inputClasses, 'flex-1')} />
        <Button
          label="Salvează"
          className="min-h-0 px-3 py-2 text-sm"
          loading={update.isPending}
          onClick={() => update.mutate()}
        />
        <Button
          label="Anulează"
          variant="ghost"
          className="min-h-0 px-3 py-2 text-sm"
          onClick={() => {
            setEditing(false);
            setName(category.name);
            setEmoji(category.emoji);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-2xl">{category.emoji}</span>
        <div className="min-w-0">
          <p className="truncate font-bold text-text">{category.name}</p>
          <p className="text-xs text-text-faint">
            /{category.slug} · {category.recipesCount} rețete
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editează"
          className="flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-alt"
        >
          <Pencil size={17} />
        </button>
        <button
          type="button"
          onClick={() => setDeleting(true)}
          aria-label="Șterge"
          className="flex size-9 items-center justify-center rounded-md text-danger hover:bg-surface-alt"
        >
          <Trash2 size={17} />
        </button>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Ștergi această categorie?"
        description="Rețetele care o folosesc rămân, dar fără categorie."
        confirmLabel="Șterge"
        confirming={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

function CategoriesPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createCategory({ name: name.trim(), emoji: emoji.trim() }),
    onSuccess: () => {
      setName('');
      setEmoji('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Nu am putut crea categoria'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !emoji.trim()) return;
    create.mutate();
  }

  const categories = query.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-surface p-4">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🍰"
          maxLength={8}
          className={cn(inputClasses, 'w-16 text-center text-lg')}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nume categorie"
          maxLength={60}
          className={cn(inputClasses, 'flex-1')}
        />
        <Button
          label="Adaugă"
          type="submit"
          loading={create.isPending}
          className="min-h-0 px-4 py-2 text-sm"
        />
      </form>
      {error ? <p className="-mt-4 text-sm text-danger">{error}</p> : null}

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 bg-skeleton" />
          <Skeleton className="h-16 bg-skeleton" />
        </div>
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : 'Nu am putut încărca categoriile'}
          onRetry={() => void query.refetch()}
        />
      ) : categories.length === 0 ? (
        <EmptyState emoji="🗂️" title="Nicio categorie" message="Adaugă prima categorie mai sus." />
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <CategoryRow key={c.slug} category={c} />
          ))}
        </div>
      )}
    </div>
  );
}

const SECTIONS = [
  { value: 'users', label: 'Utilizatori' },
  { value: 'categories', label: 'Categorii' },
] as const;
type Section = (typeof SECTIONS)[number]['value'];

export default function AdminDashboard() {
  const [section, setSection] = useState<Section>('users');

  return (
    <div className="flex flex-col gap-6 p-4 pt-6">
      <h1 className="text-2xl font-extrabold text-text">Panou admin</h1>

      <div className="flex gap-2 border-b border-border">
        {SECTIONS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSection(s.value)}
            className={cn(
              'relative px-1 pb-3 text-[15px] font-bold',
              section === s.value ? 'text-primary' : 'text-text-muted',
            )}
          >
            {s.label}
            {section === s.value ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-primary" />
            ) : null}
          </button>
        ))}
      </div>

      {section === 'users' ? <UsersPanel /> : <CategoriesPanel />}
    </div>
  );
}

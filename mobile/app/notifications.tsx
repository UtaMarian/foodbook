import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AppNotification } from '@foodbook/shared';
import { api, ApiError } from '../src/lib/api';
import { Avatar } from '../src/components/RecipeCard';
import { EmptyState, ErrorState, Screen, Skeleton } from '../src/components/ui';
import { spacing, useColors } from '../src/theme';

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'acum';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} z`;
}

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
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
        old
          ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.map((n) => ({ ...n, read: true })) })) }
          : old,
      );
    },
  });

  // Deschiderea ecranului marcheaza automat totul citit, ca pe orice retea sociala.
  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifications = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderColor: c.border }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Înapoi" hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>Notificări</Text>
        <View style={{ width: 22 }} />
      </View>

      {query.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : 'Notificările nu s-au putut încărca'}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, notifications.length === 0 && { flexGrow: 1 }]}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyState emoji="🔔" title="Nimic încă" message="Aprecierile, comentariile și urmăririle apar aici." />
          }
          renderItem={({ item }) => {
            const content = (
              <View style={[styles.row, !item.read && { backgroundColor: c.surfaceAlt }]}>
                <Avatar url={item.actor.avatarUrl} name={item.actor.displayName} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
                    <Text style={{ fontWeight: '700' }}>{item.actor.displayName}</Text> {message(item)}
                  </Text>
                  <Text style={{ color: c.textFaint, fontSize: 12, marginTop: 2 }}>{timeAgo(item.createdAt)}</Text>
                </View>
              </View>
            );
            return item.recipeId ? (
              <Link href={`/recipe/${item.recipeId}`} asChild>
                <Pressable>{content}</Pressable>
              </Link>
            ) : (
              <Link href={`/user/${item.actor.username}`} asChild>
                <Pressable>{content}</Pressable>
              </Link>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '700' },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 12,
  },
});

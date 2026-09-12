import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { FeedScope, RecipeSummary } from '@foodbook/shared';
import { api, ApiError } from '../../src/lib/api';
import { useUnreadNotifications } from '../../src/hooks/useUnreadNotifications';
import { RecipeCard, RecipeCardSkeleton } from '../../src/components/RecipeCard';
import { Button, EmptyState, ErrorState, Screen } from '../../src/components/ui';
import { radius, spacing, useColors } from '../../src/theme';

const SCOPES: { value: FeedScope; label: string }[] = [
  { value: 'all', label: 'Toate' },
  { value: 'following', label: 'Urmăriți' },
  { value: 'discover', label: 'Descoperă' },
];

export default function Feed() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [scope, setScope] = useState<FeedScope>('all');
  const unread = useUnreadNotifications();

  const query = useInfiniteQuery({
    queryKey: ['feed', scope],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.feed(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const recipes: RecipeSummary[] = query.data?.pages.flatMap((p) => p.items) ?? [];

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const header = (
    <View style={[styles.header, { borderBottomColor: c.border, paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topRow}>
        <Text style={[styles.brand, { color: c.text }]}>🍳 FoodBook</Text>
        <Link href="/notifications" asChild>
          <Pressable accessibilityLabel="Notificări" hitSlop={8} style={styles.bell}>
            <Ionicons name="notifications-outline" size={24} color={c.text} />
            {unread.data && unread.data.count > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.primary }]}>
                <Text style={styles.badgeText}>{unread.data.count > 9 ? '9+' : unread.data.count}</Text>
              </View>
            ) : null}
          </Pressable>
        </Link>
      </View>

      <View style={styles.scopeRow}>
        {SCOPES.map((s) => (
          <Pressable
            key={s.value}
            onPress={() => setScope(s.value)}
            style={[
              styles.scopeChip,
              { backgroundColor: scope === s.value ? c.primary : c.surfaceAlt },
            ]}
          >
            <Text style={{ color: scope === s.value ? c.primaryText : c.textMuted, fontWeight: '700', fontSize: 13 }}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button
        label="+ Publică o rețetă"
        onPress={() => router.push('/(tabs)/create')}
        style={{ marginTop: spacing.md }}
      />
    </View>
  );

  if (query.isLoading) {
    return (
      <Screen>
        {header}
        <View style={styles.list}>
          <RecipeCardSkeleton />
          <RecipeCardSkeleton />
        </View>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen>
        {header}
        <ErrorState
          message={
            query.error instanceof ApiError ? query.error.message : 'Nu am putut încărca feed-ul'
          }
          onRetry={() => void query.refetch()}
        />
      </Screen>
    );
  }

  const emptyForScope =
    scope === 'following' ? (
      <EmptyState
        emoji="👥"
        title="Nu urmărești pe nimeni încă"
        message="Caută utilizatori și urmărește-i ca să le vezi rețetele aici."
        action={<Button label="Caută utilizatori" onPress={() => router.push('/(tabs)/search')} />}
      />
    ) : (
      <EmptyState
        emoji="🍽️"
        title="Încă nu e nimic în feed"
        message="Fii primul care publică o rețetă. Chiar și o poză cu ce ai gătit aseară e de ajuns."
        action={<Button label="Publică prima rețetă" onPress={() => router.push('/(tabs)/create')} />}
      />
    );

  return (
    <Screen>
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.list, recipes.length === 0 && { flexGrow: 1 }]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={c.primary}
          />
        }
        ListEmptyComponent={emptyForScope}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={{ paddingTop: spacing.lg }}>
              <RecipeCardSkeleton />
            </View>
          ) : query.hasNextPage ? (
            <Button
              label="Încarcă mai multe"
              variant="secondary"
              onPress={loadMore}
              style={{ marginTop: spacing.lg }}
            />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
    gap: spacing.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 22, fontWeight: '800' },
  bell: { padding: spacing.xs },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  scopeRow: { flexDirection: 'row', gap: spacing.sm },
  scopeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2, borderRadius: radius.pill },
  list: { padding: spacing.lg, paddingTop: 0 },
});

import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/lib/api';
import { RecipeCard, RecipeCardSkeleton } from '../../src/components/RecipeCard';
import { UserListScreen } from '../../src/components/UserList';
import { EmptyState, ErrorState, Screen } from '../../src/components/ui';
import { radius, spacing, useColors } from '../../src/theme';

/** Asteapta o pauza in scris inainte sa interogam serverul. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type Tab = 'recipes' | 'users';

export default function Search() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [tab, setTab] = useState<Tab>('recipes');
  const q = useDebounced(text.trim(), 350);

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: api.categories, enabled: !q });

  const recipesQuery = useInfiniteQuery({
    queryKey: ['searchRecipes', q],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.searchRecipes(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: tab === 'recipes' && !!q,
  });

  const usersQuery = useInfiniteQuery({
    queryKey: ['searchUsers', q],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.searchUsers(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: tab === 'users' && !!q,
  });

  const header = (
    <View style={{ paddingTop: insets.top + spacing.md, gap: spacing.md }}>
      <View style={[styles.searchBox, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name="search" size={18} color={c.textFaint} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Caută rețete sau utilizatori..."
          placeholderTextColor={c.textFaint}
          style={[styles.searchInput, { color: c.text }]}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {text ? (
          <Pressable onPress={() => setText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={c.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {q ? (
        <View style={styles.tabs}>
          {(['recipes', 'users'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={styles.tabButton}>
              <Text style={{ color: tab === t ? c.primary : c.textMuted, fontWeight: '700' }}>
                {t === 'recipes' ? 'Rețete' : 'Utilizatori'}
              </Text>
              {tab === t ? <View style={[styles.tabIndicator, { backgroundColor: c.primary }]} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (!q) {
    return (
      <Screen>
        <FlatList
          key="categories-grid"
          data={categoriesQuery.data ?? []}
          keyExtractor={(item) => item.slug}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md }}>
              {header}
              <Text style={[styles.sectionTitle, { color: c.text, marginTop: spacing.lg }]}>Categorii</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/category/[slug]', params: { slug: item.slug, name: item.name, emoji: item.emoji } }} asChild>
              {/* Copilul direct al unui Link asChild trebuie sa primeasca un singur
                  obiect de stil, nu un array - altfel Slot-ul din expo-router pica
                  cu "passing an array of styles to a child of <Slot>". */}
              <Pressable
                style={StyleSheet.flatten([
                  styles.categoryCard,
                  { backgroundColor: c.surface, borderColor: c.border },
                ])}
              >
                <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                <Text style={{ color: c.text, fontWeight: '700', marginTop: spacing.xs }}>{item.name}</Text>
                <Text style={{ color: c.textFaint, fontSize: 12 }}>{item.recipesCount} rețete</Text>
              </Pressable>
            </Link>
          )}
        />
      </Screen>
    );
  }

  if (tab === 'users') {
    return (
      <Screen>
        <View style={{ paddingHorizontal: spacing.lg }}>{header}</View>
        <UserListScreen
          users={usersQuery.data?.pages.flatMap((p) => p.items) ?? []}
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          onRetry={() => void usersQuery.refetch()}
          onEndReached={() => {
            if (usersQuery.hasNextPage && !usersQuery.isFetchingNextPage) void usersQuery.fetchNextPage();
          }}
          emptyTitle="Niciun utilizator găsit"
          emptyMessage={`Nimeni nu se potrivește cu „${q}”.`}
        />
      </Screen>
    );
  }

  const recipeResults = recipesQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <FlatList
        key="recipe-results"
        data={recipeResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
        ListHeaderComponent={<View style={{ paddingHorizontal: spacing.lg }}>{header}</View>}
        contentContainerStyle={[
          { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
          recipeResults.length === 0 && { flexGrow: 1 },
        ]}
        onEndReached={() => {
          if (recipesQuery.hasNextPage && !recipesQuery.isFetchingNextPage) void recipesQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        ListEmptyComponent={
          recipesQuery.isLoading ? (
            <View style={{ gap: spacing.lg }}>
              <RecipeCardSkeleton />
            </View>
          ) : recipesQuery.isError ? (
            <ErrorState
              message={recipesQuery.error instanceof ApiError ? recipesQuery.error.message : 'Căutarea a eșuat'}
              onRetry={() => void recipesQuery.refetch()}
            />
          ) : (
            <EmptyState emoji="🔍" title="Niciun rezultat" message={`Nicio rețetă nu se potrivește cu „${q}”.`} />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  tabs: { flexDirection: 'row', gap: spacing.xl, marginHorizontal: spacing.lg },
  tabButton: { alignItems: 'center', paddingBottom: spacing.sm },
  tabIndicator: { height: 2, width: '100%', marginTop: spacing.xs, borderRadius: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  categoryCard: { flex: 1, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
});

import { FlatList, Pressable, Text, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/lib/api';
import { RecipeCard, RecipeCardSkeleton } from '../../src/components/RecipeCard';
import { EmptyState, ErrorState, Screen } from '../../src/components/ui';
import { spacing, useColors } from '../../src/theme';

export default function CategoryScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { slug, name, emoji } = useLocalSearchParams<{ slug: string; name?: string; emoji?: string }>();

  const query = useInfiniteQuery({
    queryKey: ['categoryRecipes', slug],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.categoryRecipes(slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!slug,
  });

  const recipes = query.data?.pages.flatMap((p) => p.items) ?? [];

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.lg }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Înapoi" hitSlop={12}>
        <Ionicons name="arrow-back" size={22} color={c.text} />
      </Pressable>
      <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>
        {emoji ? `${emoji} ` : ''}
        {name ?? 'Categorie'}
      </Text>
    </View>
  );

  if (query.isLoading) {
    return (
      <Screen>
        <View style={{ paddingHorizontal: spacing.lg }}>
          {header}
          <View style={{ gap: spacing.lg }}>
            <RecipeCardSkeleton />
            <RecipeCardSkeleton />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={[{ padding: spacing.lg, paddingTop: 0 }, recipes.length === 0 && { flexGrow: 1 }]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          query.isError ? (
            <ErrorState
              message={query.error instanceof ApiError ? query.error.message : 'Nu am putut încărca'}
              onRetry={() => void query.refetch()}
            />
          ) : (
            <EmptyState emoji="🍽️" title="Nimic aici încă" message="Nicio rețetă publicată în această categorie." />
          )
        }
      />
    </Screen>
  );
}

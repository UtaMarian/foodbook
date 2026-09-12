import { FlatList, Text, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/lib/api';
import { RecipeCard, RecipeCardSkeleton } from '../../src/components/RecipeCard';
import { EmptyState, ErrorState, Screen } from '../../src/components/ui';
import { spacing, useColors } from '../../src/theme';

export default function Saved() {
  const c = useColors();
  const insets = useSafeAreaInsets();

  const query = useInfiniteQuery({
    queryKey: ['savedRecipes'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.savedRecipes(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const recipes = query.data?.pages.flatMap((p) => p.items) ?? [];

  const header = (
    <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg }}>
      🔖 Rețete salvate
    </Text>
  );

  if (query.isLoading) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg }}>
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
        ListHeaderComponent={<View style={{ paddingHorizontal: spacing.lg }}>{header}</View>}
        contentContainerStyle={[{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }, recipes.length === 0 && { flexGrow: 1 }]}
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
            <EmptyState
              emoji="🔖"
              title="Nimic salvat încă"
              message="Apasă pe pictograma de marcaj de la o rețetă ca s-o găsești mai târziu aici."
            />
          )
        }
      />
    </Screen>
  );
}

import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RecipeSummary } from '@foodbook/shared';
import { api, ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/store/auth';
import { Avatar } from '../../../src/components/RecipeCard';
import { RecipeGridItem } from '../../../src/components/RecipeGrid';
import { FollowButton } from '../../../src/components/FollowButton';
import { EmptyState, ErrorState, Screen, Skeleton } from '../../../src/components/ui';
import { spacing, useColors } from '../../../src/theme';

export default function UserProfile() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentUser = useAuth((s) => s.user);
  const { username } = useLocalSearchParams<{ username: string }>();

  const profile = useQuery({
    queryKey: ['user', username],
    queryFn: () => api.user(username),
    enabled: !!username,
  });

  const recipes = useInfiniteQuery({
    queryKey: ['userRecipes', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.userRecipes(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!username,
  });

  const items: RecipeSummary[] = recipes.data?.pages.flatMap((p) => p.items) ?? [];

  const back = (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      style={[styles.backButton, { top: insets.top + spacing.sm, backgroundColor: c.surface, borderColor: c.border }]}
      accessibilityLabel="Înapoi"
    >
      <Ionicons name="arrow-back" size={20} color={c.text} />
    </Pressable>
  );

  if (profile.isLoading) {
    return (
      <Screen>
        {back}
        <View style={{ paddingTop: insets.top + 72, alignItems: 'center', gap: spacing.md }}>
          <Skeleton height={88} width={88} style={{ borderRadius: 44 }} />
          <Skeleton height={20} width={160} />
          <Skeleton height={12} width={100} />
        </View>
      </Screen>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Screen>
        {back}
        <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
          <ErrorState
            message={
              profile.error instanceof ApiError ? profile.error.message : 'Profilul nu a putut fi încărcat'
            }
            onRetry={() => void profile.refetch()}
          />
        </View>
      </Screen>
    );
  }

  const user = profile.data;
  const isOwn = currentUser?.username === user.username;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.xxl }]}>
      <Avatar url={user.avatarUrl} name={user.displayName} size={88} />
      <Text style={[styles.name, { color: c.text }]}>{user.displayName}</Text>
      <Text style={[styles.username, { color: c.textFaint }]}>@{user.username}</Text>
      {user.bio ? <Text style={[styles.bio, { color: c.textMuted }]}>{user.bio}</Text> : null}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: c.text }]}>{user.recipesCount}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>rețete</Text>
        </View>
        <Link href={`/user/${user.username}/followers`} asChild>
          <Pressable style={styles.stat}>
            <Text style={[styles.statValue, { color: c.text }]}>{user.followersCount}</Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>urmăritori</Text>
          </Pressable>
        </Link>
        <Link href={`/user/${user.username}/following`} asChild>
          <Pressable style={styles.stat}>
            <Text style={[styles.statValue, { color: c.text }]}>{user.followingCount}</Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>urmărește</Text>
          </Pressable>
        </Link>
      </View>

      {!isOwn ? (
        <View style={{ marginTop: spacing.md, alignSelf: 'stretch', paddingHorizontal: spacing.xxl }}>
          <FollowButton username={user.username} isFollowing={user.isFollowedByMe} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      {back}
      <FlatList
        data={items}
        key="grid-3"
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecipeGridItem recipe={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.list, items.length === 0 && { flexGrow: 1 }]}
        onEndReached={() => {
          if (recipes.hasNextPage && !recipes.isFetchingNextPage) void recipes.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          recipes.isLoading ? null : (
            <EmptyState
              emoji="📖"
              title="Niciun preparat încă"
              message={`${user.displayName} nu a publicat nimic deocamdată.`}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  header: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.lg },
  name: { fontSize: 22, fontWeight: '800', marginTop: spacing.sm },
  username: { fontSize: 14 },
  bio: { fontSize: 14, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12 },
});

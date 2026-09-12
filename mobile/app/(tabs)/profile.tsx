import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import type { RecipeSummary } from '@foodbook/shared';
import { api, ApiError } from '../../src/lib/api';
import { pickFromLibrary, uploadAvatar } from '../../src/lib/image';
import { useAuth } from '../../src/store/auth';
import { Avatar } from '../../src/components/RecipeCard';
import { RecipeGridItem } from '../../src/components/RecipeGrid';
import { Button, EmptyState, Screen, Skeleton } from '../../src/components/ui';
import { spacing, useColors } from '../../src/theme';

export default function Profile() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ['userRecipes', user?.username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.userRecipes(user!.username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!user,
  });

  if (!user) return <Screen />;

  const recipes: RecipeSummary[] = query.data?.pages.flatMap((p) => p.items) ?? [];

  async function changeAvatar() {
    try {
      const picked = await pickFromLibrary();
      if (!picked) return;
      setAvatarBusy(true);
      const updated = await uploadAvatar(picked);
      setUser(updated);
    } catch (err) {
      Alert.alert('Nu am putut schimba poza', err instanceof ApiError ? err.message : 'Încearcă din nou.');
    } finally {
      setAvatarBusy(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Ieși din cont?', 'Va trebui să te autentifici din nou.', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Ieși', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
      <Pressable onPress={changeAvatar} style={styles.avatarWrap} accessibilityLabel="Schimbă poza de profil">
        {avatarBusy ? (
          <Skeleton height={88} width={88} style={{ borderRadius: 44 }} />
        ) : (
          <Avatar url={user.avatarUrl} name={user.displayName} size={88} />
        )}
        <View style={[styles.avatarBadge, { backgroundColor: c.primary }]}>
          <Ionicons name="camera" size={14} color={c.primaryText} />
        </View>
      </Pressable>

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

      <View style={styles.actions}>
        <Button
          label="Editează profilul"
          variant="secondary"
          onPress={() => router.push('/profile/edit')}
          style={{ flex: 1 }}
        />
        <Button label="Ieși" variant="danger" onPress={confirmSignOut} style={{ flex: 1 }} />
      </View>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={recipes}
        key="grid-3"
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecipeGridItem recipe={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.list, recipes.length === 0 && { flexGrow: 1 }]}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListEmptyComponent={
          query.isLoading ? null : (
            <EmptyState
              emoji="📖"
              title="Încă nu ai publicat nimic"
              message="Prima ta rețetă poate fi și doar o poză cu ce ai gătit azi."
              action={<Button label="Publică o rețetă" onPress={() => router.push('/(tabs)/create')} />}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  header: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.lg },
  avatarWrap: { marginBottom: spacing.sm },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 22, fontWeight: '800' },
  username: { fontSize: 14 },
  bio: { fontSize: 14, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, alignSelf: 'stretch', paddingHorizontal: spacing.md },
});

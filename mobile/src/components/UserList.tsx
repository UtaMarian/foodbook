import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import type { PublicUser } from '@foodbook/shared';
import { useAuth } from '../store/auth';
import { Avatar } from './RecipeCard';
import { FollowButton } from './FollowButton';
import { EmptyState, ErrorState, Skeleton } from './ui';
import { spacing, useColors } from '../theme';

export function UserListScreen({
  users,
  isLoading,
  isError,
  onRetry,
  onEndReached,
  emptyTitle,
  emptyMessage,
}: {
  users: PublicUser[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEndReached: () => void;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const c = useColors();
  const currentUser = useAuth((s) => s.user);

  if (isLoading) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Skeleton height={56} />
        <Skeleton height={56} />
        <Skeleton height={56} />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Lista nu a putut fi încărcată" onRetry={onRetry} />;
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, users.length === 0 && { flexGrow: 1 }]}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={<EmptyState emoji="👥" title={emptyTitle} message={emptyMessage} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Link href={`/user/${item.username}`} asChild>
            <Pressable style={styles.rowMain}>
              <Avatar url={item.avatarUrl} name={item.displayName} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={[styles.username, { color: c.textFaint }]} numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>
            </Pressable>
          </Link>
          {currentUser?.username !== item.username ? (
            <FollowButton username={item.username} isFollowing={item.isFollowedByMe} size="compact" />
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontSize: 15, fontWeight: '700' },
  username: { fontSize: 13 },
});

import { Pressable, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';
import { UserListScreen } from '../../../src/components/UserList';
import { Screen } from '../../../src/components/ui';
import { spacing, useColors } from '../../../src/theme';

export default function Following() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  const query = useInfiniteQuery({
    queryKey: ['following', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.following(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!username,
  });

  const users = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Înapoi" hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
      </View>
      <UserListScreen
        users={users}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        emptyTitle="Nu urmărește pe nimeni încă"
        emptyMessage="Contactele urmărite vor apărea aici."
      />
    </Screen>
  );
}

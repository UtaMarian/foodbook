import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Comment } from '@foodbook/shared';
import { api, ApiError } from '../../../src/lib/api';
import { Avatar } from '../../../src/components/RecipeCard';
import { EmptyState, ErrorState, Screen, Skeleton } from '../../../src/components/ui';
import { patchRecipeInCaches } from '../../../src/lib/recipe-cache';
import { radius, spacing, useColors } from '../../../src/theme';

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'acum';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} z`;
}

export default function Comments() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const query = useInfiniteQuery({
    queryKey: ['comments', id],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.comments(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!id,
  });

  const comments = query.data?.pages.flatMap((p) => p.items) ?? [];

  const addComment = useMutation({
    mutationFn: (content: string) =>
      api.addComment(id, { content, parentCommentId: replyTo?.id ?? null }),
    onSuccess: (created) => {
      queryClient.setQueryData<typeof query.data>(['comments', id], (old) => {
        if (!old) return old;
        const [first, ...rest] = old.pages;
        return { ...old, pages: [{ items: [created, ...first.items], nextCursor: first.nextCursor }, ...rest] };
      });
      patchRecipeInCaches(queryClient, id, (r) => ({ ...r, commentsCount: r.commentsCount + 1 }));
      setText('');
      setReplyTo(null);
    },
    onError: (err) =>
      Alert.alert('Comentariul nu a fost trimis', err instanceof ApiError ? err.message : 'Încearcă din nou.'),
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(commentId),
    onSuccess: (_data, commentId) => {
      queryClient.setQueryData<typeof query.data>(['comments', id], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== commentId),
          })),
        };
      });
      patchRecipeInCaches(queryClient, id, (r) => ({ ...r, commentsCount: Math.max(0, r.commentsCount - 1) }));
    },
    onError: (err) =>
      Alert.alert('Ștergerea a eșuat', err instanceof ApiError ? err.message : 'Încearcă din nou.'),
  });

  function confirmDelete(comment: Comment) {
    Alert.alert('Ștergi comentariul?', undefined, [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => deleteComment.mutate(comment.id) },
    ]);
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || addComment.isPending) return;
    addComment.mutate(trimmed);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderColor: c.border }]}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Închide" hitSlop={12}>
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.text }]}>Comentarii</Text>
          <View style={{ width: 24 }} />
        </View>

        {query.isLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <Skeleton height={44} />
            <Skeleton height={44} />
          </View>
        ) : query.isError ? (
          <ErrorState
            message={query.error instanceof ApiError ? query.error.message : 'Comentariile nu s-au putut încărca'}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
            ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <EmptyState emoji="💬" title="Niciun comentariu încă" message="Fii primul care spune ceva." />
            }
            renderItem={({ item }) => (
              <View style={[styles.comment, item.parentCommentId ? styles.reply : null]}>
                {item.parentCommentId ? (
                  <Text style={[styles.replyTag, { color: c.textFaint }]}>↳ răspuns</Text>
                ) : null}
                <View style={styles.commentRow}>
                  <Avatar url={item.author.avatarUrl} name={item.author.displayName} size={32} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.commentHeader}>
                      <Text style={[styles.commentAuthor, { color: c.text }]}>{item.author.displayName}</Text>
                      <Text style={[styles.commentTime, { color: c.textFaint }]}>{timeAgo(item.createdAt)}</Text>
                    </View>
                    <Text style={[styles.commentText, { color: c.text }]}>{item.content}</Text>
                    <View style={styles.commentActions}>
                      {!item.parentCommentId ? (
                        <Pressable onPress={() => setReplyTo(item)}>
                          <Text style={[styles.replyAction, { color: c.textMuted }]}>Răspunde</Text>
                        </Pressable>
                      ) : null}
                      {item.canDelete ? (
                        <Pressable onPress={() => confirmDelete(item)}>
                          <Text style={[styles.replyAction, { color: c.danger }]}>Șterge</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            )}
          />
        )}

        <View style={[styles.composer, { borderColor: c.border, paddingBottom: insets.bottom + spacing.sm }]}>
          {replyTo ? (
            <View style={styles.replyBanner}>
              <Text style={{ color: c.textMuted, fontSize: 12 }} numberOfLines={1}>
                Răspunzi lui {replyTo.author.displayName}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <Ionicons name="close" size={16} color={c.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composerRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Scrie un comentariu..."
              placeholderTextColor={c.textFaint}
              multiline
              style={[styles.input, { backgroundColor: c.surfaceAlt, color: c.text }]}
            />
            <Pressable
              onPress={submit}
              disabled={!text.trim() || addComment.isPending}
              style={[styles.sendButton, { backgroundColor: c.primary, opacity: text.trim() ? 1 : 0.5 }]}
              accessibilityLabel="Trimite comentariul"
            >
              <Ionicons name="arrow-up" size={18} color={c.primaryText} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: { fontSize: 16, fontWeight: '700' },
  comment: { gap: spacing.xs },
  reply: { marginLeft: spacing.xl },
  replyTag: { fontSize: 11, fontWeight: '600' },
  commentRow: { flexDirection: 'row', gap: spacing.sm },
  commentHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  commentAuthor: { fontSize: 14, fontWeight: '700' },
  commentTime: { fontSize: 12 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  replyAction: { fontSize: 12, fontWeight: '600' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.xs },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

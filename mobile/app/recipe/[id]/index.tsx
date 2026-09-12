import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/store/auth';
import { useToggleLike, useToggleSave } from '../../../src/hooks/useRecipeSocial';
import { Avatar } from '../../../src/components/RecipeCard';
import { FollowButton } from '../../../src/components/FollowButton';
import { ImageViewer } from '../../../src/components/ImageViewer';
import { Button, ErrorState, Screen, Skeleton } from '../../../src/components/ui';
import { radius, spacing, useColors } from '../../../src/theme';

export default function RecipeDetail() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuth((s) => s.user);
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipe(id),
    enabled: !!id,
  });

  const recipe = query.data;
  const isOwn = currentUser?.id === recipe?.author.id;

  // Statusul de follow al autorului nu vine cu reteta (ar insemna un query
  // per autor pentru fiecare card din feed) - il cerem separat, o singura
  // data, doar pe ecranul de detaliu.
  const authorProfile = useQuery({
    queryKey: ['user', recipe?.author.username],
    queryFn: () => api.user(recipe!.author.username),
    enabled: !!recipe && !isOwn,
  });

  const remove = useMutation({
    mutationFn: () => api.deleteRecipe(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['userRecipes'] });
      router.back();
    },
    onError: (err) =>
      Alert.alert('Ștergerea a eșuat', err instanceof ApiError ? err.message : 'Încearcă din nou.'),
  });

  const back = (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      style={[styles.backButton, { top: insets.top + spacing.sm, backgroundColor: c.surface, borderColor: c.border }]}
      accessibilityLabel="Înapoi"
    >
      <Ionicons name="arrow-back" size={20} color={c.text} />
    </Pressable>
  );

  if (query.isLoading) {
    return (
      <Screen>
        {back}
        <View style={{ paddingTop: insets.top + 56, padding: spacing.lg, gap: spacing.lg }}>
          <Skeleton height={240} style={{ borderRadius: radius.lg }} />
          <Skeleton height={24} width={220} />
          <Skeleton height={14} />
          <Skeleton height={14} width="80%" />
        </View>
      </Screen>
    );
  }

  if (query.isError || !recipe) {
    return (
      <Screen>
        {back}
        <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
          <ErrorState
            message={
              query.error instanceof ApiError ? query.error.message : 'Rețeta nu a putut fi încărcată'
            }
            onRetry={() => void query.refetch()}
          />
        </View>
      </Screen>
    );
  }

  const cover = recipe.images[0];

  function confirmDelete() {
    Alert.alert('Ștergi rețeta?', 'Acțiunea nu poate fi anulată din aplicație.', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  return (
    <Screen>
      {back}
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {cover ? (
          <Pressable onPress={() => setViewerIndex(0)}>
            <Image
              source={{ uri: cover.url }}
              style={[
                styles.cover,
                { aspectRatio: cover.height > 0 ? cover.width / cover.height : 4 / 3, backgroundColor: c.surfaceAlt },
              ]}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        ) : (
          <View style={{ height: insets.top + 56 }} />
        )}

        {recipe.images.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {recipe.images.slice(1).map((img, i) => (
              <Pressable key={img.id} onPress={() => setViewerIndex(i + 1)}>
                <Image
                  source={{ uri: img.url }}
                  style={[styles.galleryItem, { backgroundColor: c.surfaceAlt }]}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.body}>
          {recipe.title ? (
            <Text style={[styles.title, { color: c.text }]}>{recipe.title}</Text>
          ) : null}

          <View style={styles.authorRow}>
            <Link href={`/user/${recipe.author.username}`} asChild>
              <Pressable style={styles.author}>
                <Avatar url={recipe.author.avatarUrl} name={recipe.author.displayName} size={40} />
                <View>
                  <Text style={[styles.authorName, { color: c.text }]}>{recipe.author.displayName}</Text>
                  <Text style={[styles.authorHandle, { color: c.textFaint }]}>
                    @{recipe.author.username}
                  </Text>
                </View>
              </Pressable>
            </Link>
            {!isOwn && authorProfile.data ? (
              <FollowButton
                username={recipe.author.username}
                isFollowing={authorProfile.data.isFollowedByMe}
                size="compact"
              />
            ) : null}
          </View>

          <View style={styles.chips}>
            {recipe.category ? (
              <Text style={[styles.chip, { color: c.textMuted, backgroundColor: c.surfaceAlt }]}>
                {recipe.category.emoji} {recipe.category.name}
              </Text>
            ) : null}
            {recipe.prepMinutes ? (
              <Text style={[styles.chip, { color: c.textMuted, backgroundColor: c.surfaceAlt }]}>
                ⏱ {recipe.prepMinutes} min
              </Text>
            ) : null}
            {recipe.servings ? (
              <Text style={[styles.chip, { color: c.textMuted, backgroundColor: c.surfaceAlt }]}>
                🍽 {recipe.servings} porții
              </Text>
            ) : null}
          </View>

          {recipe.description ? (
            <Text style={[styles.description, { color: c.textMuted }]}>{recipe.description}</Text>
          ) : null}

          <View style={[styles.actions, { borderColor: c.border }]}>
            <Pressable
              style={styles.actionButton}
              onPress={() => toggleLike.mutate({ id: recipe.id, liked: recipe.isLiked })}
              accessibilityLabel={recipe.isLiked ? 'Anulează aprecierea' : 'Apreciază'}
            >
              <Ionicons
                name={recipe.isLiked ? 'heart' : 'heart-outline'}
                size={24}
                color={recipe.isLiked ? c.primary : c.textMuted}
              />
              <Text style={[styles.actionCount, { color: c.textMuted }]}>{recipe.likesCount}</Text>
            </Pressable>

            <Link href={`/recipe/${recipe.id}/comments`} asChild>
              <Pressable style={styles.actionButton} accessibilityLabel="Comentarii">
                <Ionicons name="chatbubble-outline" size={22} color={c.textMuted} />
                <Text style={[styles.actionCount, { color: c.textMuted }]}>{recipe.commentsCount}</Text>
              </Pressable>
            </Link>

            <Pressable
              style={[styles.actionButton, { marginLeft: 'auto' }]}
              onPress={() => toggleSave.mutate({ id: recipe.id, saved: recipe.isSaved })}
              accessibilityLabel={recipe.isSaved ? 'Elimină din salvate' : 'Salvează'}
            >
              <Ionicons
                name={recipe.isSaved ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={recipe.isSaved ? c.primary : c.textMuted}
              />
            </Pressable>
          </View>

          {recipe.ingredients.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Ingrediente</Text>
              {recipe.ingredients.map((ing) => (
                <View key={ing.id} style={styles.ingredient}>
                  <Text style={[styles.bullet, { color: c.primary }]}>•</Text>
                  <Text style={[styles.ingredientText, { color: c.text }]}>
                    {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {recipe.instructions.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Mod de preparare</Text>
              {recipe.instructions.map((step) => (
                <View key={step.id} style={styles.step}>
                  <Text style={[styles.stepNumber, { color: c.primaryText, backgroundColor: c.primary }]}>
                    {step.stepNumber}
                  </Text>
                  <Text style={[styles.stepText, { color: c.text }]}>{step.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {isOwn ? (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <Button
                label="Editează"
                variant="secondary"
                onPress={() => router.push(`/recipe/${recipe.id}/edit`)}
                style={{ flex: 1 }}
              />
              <Button
                label="Șterge"
                variant="danger"
                onPress={confirmDelete}
                loading={remove.isPending}
                style={{ flex: 1 }}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ImageViewer
        images={recipe.images}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
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
  cover: { width: '100%' },
  gallery: { gap: spacing.sm, padding: spacing.md },
  galleryItem: { width: 110, height: 110, borderRadius: radius.md },
  body: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  authorName: { fontSize: 15, fontWeight: '700' },
  authorHandle: { fontSize: 13 },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  description: { fontSize: 15, lineHeight: 22 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionCount: { fontSize: 14, fontWeight: '600' },
  section: { gap: spacing.sm, marginTop: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  ingredient: { flexDirection: 'row', gap: spacing.sm },
  bullet: { fontSize: 16, fontWeight: '800' },
  ingredientText: { fontSize: 15, flex: 1, lineHeight: 22 },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
  },
  stepText: { fontSize: 15, flex: 1, lineHeight: 22 },
});

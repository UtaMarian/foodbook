import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RecipeSummary } from '@foodbook/shared';
import { useToggleLike, useToggleSave } from '../hooks/useRecipeSocial';
import { radius, spacing, useColors } from '../theme';
import { Skeleton } from './ui';

export function Avatar({
  url,
  name,
  size = 36,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const c = useColors();
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceAlt }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: c.textMuted, fontWeight: '700', fontSize: size * 0.42 }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'acum';
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `acum ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `acum ${days} z`;
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const c = useColors();
  const image = recipe.images[0];
  // Raportul vine din dimensiunile reale, deci cardul nu sare cand se incarca poza.
  const aspect = image && image.height > 0 ? image.width / image.height : 4 / 3;
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();

  return (
    <Link href={`/recipe/${recipe.id}`} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.95 : 1 },
        ]}
      >
        <View style={styles.header}>
          <Avatar url={recipe.author.avatarUrl} name={recipe.author.displayName} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.author, { color: c.text }]} numberOfLines={1}>
              {recipe.author.displayName}
            </Text>
            <Text style={[styles.meta, { color: c.textFaint }]}>{timeAgo(recipe.createdAt)}</Text>
          </View>
        </View>

        {recipe.title ? (
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {recipe.title}
          </Text>
        ) : null}

        {image ? (
          <Image
            source={{ uri: image.url }}
            style={[styles.image, { aspectRatio: aspect, backgroundColor: c.surfaceAlt }]}
            contentFit="cover"
            transition={180}
          />
        ) : null}

        {recipe.description ? (
          <Text style={[styles.description, { color: c.textMuted }]} numberOfLines={3}>
            {recipe.description}
          </Text>
        ) : null}

        {recipe.category || recipe.prepMinutes || recipe.servings ? (
          <View style={styles.footer}>
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
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => toggleLike.mutate({ id: recipe.id, liked: recipe.isLiked })}
            hitSlop={8}
            accessibilityLabel={recipe.isLiked ? 'Anulează aprecierea' : 'Apreciază'}
          >
            <Ionicons
              name={recipe.isLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={recipe.isLiked ? c.primary : c.textMuted}
            />
            <Text style={[styles.actionCount, { color: c.textMuted }]}>{recipe.likesCount}</Text>
          </Pressable>

          <View style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={20} color={c.textMuted} />
            <Text style={[styles.actionCount, { color: c.textMuted }]}>{recipe.commentsCount}</Text>
          </View>

          <Pressable
            style={[styles.actionButton, { marginLeft: 'auto' }]}
            onPress={() => toggleSave.mutate({ id: recipe.id, saved: recipe.isSaved })}
            hitSlop={8}
            accessibilityLabel={recipe.isSaved ? 'Elimină din salvate' : 'Salvează'}
          >
            <Ionicons
              name={recipe.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={recipe.isSaved ? c.primary : c.textMuted}
            />
          </Pressable>
        </View>
      </Pressable>
    </Link>
  );
}

export function RecipeCardSkeleton() {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.header}>
        <Skeleton height={36} width={36} style={{ borderRadius: 18 }} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Skeleton height={12} width={120} />
          <Skeleton height={10} width={70} />
        </View>
      </View>
      <Skeleton height={18} width={200} />
      <Skeleton height={200} style={{ borderRadius: radius.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  author: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 1 },
  title: { fontSize: 19, fontWeight: '700', lineHeight: 24 },
  image: { width: '100%', borderRadius: radius.md },
  description: { fontSize: 14, lineHeight: 20 },
  footer: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionCount: { fontSize: 13, fontWeight: '600' },
  chip: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});

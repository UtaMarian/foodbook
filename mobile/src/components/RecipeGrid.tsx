import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RecipeSummary } from '@foodbook/shared';
import { radius, spacing, useColors } from '../theme';

/** Grid de 3 coloane, ca pe profilurile din retelele vizuale. */
export function RecipeGridItem({ recipe }: { recipe: RecipeSummary }) {
  const c = useColors();
  const thumb = recipe.images[0]?.thumbUrl;

  return (
    <Link href={`/recipe/${recipe.id}`} asChild>
      <Pressable style={styles.item}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={[styles.image, { backgroundColor: c.surfaceAlt }]}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.image, styles.textOnly, { backgroundColor: c.surfaceAlt }]}>
            <Text style={[styles.textOnlyLabel, { color: c.textMuted }]} numberOfLines={4}>
              {recipe.title || recipe.description || 'Rețetă'}
            </Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1 / 3, aspectRatio: 1, padding: 2 },
  image: { flex: 1, borderRadius: radius.sm },
  textOnly: { alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  textOnlyLabel: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
});

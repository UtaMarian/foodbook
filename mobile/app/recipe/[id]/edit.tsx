import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CreateRecipeInput } from '@foodbook/shared';
import { api } from '../../../src/lib/api';
import { RecipeForm, type RecipeFormInitial } from '../../../src/components/RecipeForm';
import { ErrorState, Screen, Skeleton } from '../../../src/components/ui';
import { spacing, useColors } from '../../../src/theme';

export default function EditRecipe() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipe(id),
    enabled: !!id,
  });

  async function handleSubmit(payload: CreateRecipeInput) {
    await api.updateRecipe(id, payload);
    await queryClient.invalidateQueries({ queryKey: ['recipe', id] });
    await queryClient.invalidateQueries({ queryKey: ['feed'] });
    await queryClient.invalidateQueries({ queryKey: ['userRecipes'] });
    router.back();
  }

  if (query.isLoading) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.lg }}>
          <Skeleton height={28} width={200} />
          <Skeleton height={48} />
          <Skeleton height={96} />
        </ScrollView>
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen>
        <ErrorState message="Rețeta nu a putut fi încărcată" onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const recipe = query.data;
  const initial: RecipeFormInitial = {
    title: recipe.title,
    description: recipe.description,
    prepMinutes: recipe.prepMinutes,
    servings: recipe.servings,
    categorySlug: recipe.category?.slug ?? null,
    images: recipe.images.map((img) => ({ key: img.key, url: img.url })),
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: c.text, marginBottom: spacing.lg }}>
            Editează rețeta
          </Text>
          <RecipeForm initial={initial} submitLabel="Salvează modificările" onSubmit={handleSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

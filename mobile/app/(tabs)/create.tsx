import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CreateRecipeInput } from '@foodbook/shared';
import { api } from '../../src/lib/api';
import { RecipeForm } from '../../src/components/RecipeForm';
import { Screen } from '../../src/components/ui';
import { spacing, useColors } from '../../src/theme';

export default function CreateRecipe() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSubmit(payload: CreateRecipeInput) {
    const created = await api.createRecipe(payload);
    await queryClient.invalidateQueries({ queryKey: ['feed'] });
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    await queryClient.invalidateQueries({ queryKey: ['userRecipes'] });
    router.push(`/recipe/${created.id}`);
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: c.text, marginBottom: spacing.xs }}>
            Publică o rețetă
          </Text>
          <Text style={{ fontSize: 14, color: c.textMuted, marginBottom: spacing.lg }}>
            Totul e opțional. O poză și un titlu sunt de ajuns.
          </Text>
          <RecipeForm submitLabel="Publică rețeta" onSubmit={handleSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

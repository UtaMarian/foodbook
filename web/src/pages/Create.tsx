import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { CreateRecipeInput } from '@foodbook/shared';
import { api } from '@/lib/api';
import { RecipeForm } from '@/components/RecipeForm';

export default function Create() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSubmit(payload: CreateRecipeInput) {
    const created = await api.createRecipe(payload);
    await queryClient.invalidateQueries({ queryKey: ['feed'] });
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    await queryClient.invalidateQueries({ queryKey: ['userRecipes'] });
    navigate(`/recipe/${created.id}`);
  }

  return (
    <div className="p-4 pt-6">
      <h1 className="mb-1 text-2xl font-extrabold text-text">Publică o rețetă</h1>
      <p className="mb-6 text-sm text-text-muted">Totul e opțional. O poză și un titlu sunt de ajuns.</p>
      <RecipeForm submitLabel="Publică rețeta" onSubmit={handleSubmit} />
    </div>
  );
}

import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRecipeInput } from '@foodbook/shared';
import { api } from '@/lib/api';
import { RecipeForm, type RecipeFormInitial } from '@/components/RecipeForm';
import { ErrorState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecipeEdit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id = '' } = useParams<{ id: string }>();

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
    navigate(-1);
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 pt-6">
        <Skeleton className="h-7 w-52 bg-skeleton" />
        <Skeleton className="h-12 bg-skeleton" />
        <Skeleton className="h-24 bg-skeleton" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <ErrorState message="Rețeta nu a putut fi încărcată" onRetry={() => void query.refetch()} />;
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
    <div className="p-4 pt-6">
      <h1 className="mb-6 text-2xl font-extrabold text-text">Editează rețeta</h1>
      <RecipeForm initial={initial} submitLabel="Salvează modificările" onSubmit={handleSubmit} />
    </div>
  );
}

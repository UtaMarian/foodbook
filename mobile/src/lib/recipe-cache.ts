import type { QueryClient } from '@tanstack/react-query';
import type { Page, RecipeDetail, RecipeSummary } from '@foodbook/shared';

/**
 * O reteta apare in multe cache-uri deodata (feed, profilul autorului,
 * salvate, cautare, categorie, detaliu). Cand utilizatorul da like/salveaza,
 * actualizam toate locurile unde reteta e vizibila - fara asta, revii in
 * feed dupa ce ai dat like din detaliu si vezi starea veche.
 */
const LIST_QUERY_KEYS = ['feed', 'userRecipes', 'savedRecipes', 'categoryRecipes', 'searchRecipes'];

interface InfiniteRecipePages {
  pages: Page<RecipeSummary>[];
  pageParams: unknown[];
}

export function patchRecipeInCaches(
  queryClient: QueryClient,
  recipeId: string,
  patch: (recipe: RecipeSummary) => RecipeSummary,
): void {
  queryClient.setQueryData<RecipeDetail>(['recipe', recipeId], (old) =>
    old ? { ...old, ...patch(old) } : old,
  );

  queryClient.setQueriesData<InfiniteRecipePages>(
    { predicate: (q) => LIST_QUERY_KEYS.includes(q.queryKey[0] as string) },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => (item.id === recipeId ? patch(item) : item)),
        })),
      };
    },
  );
}

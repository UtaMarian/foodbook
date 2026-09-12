import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../lib/api';
import { patchRecipeInCaches } from '../lib/recipe-cache';

/**
 * Optimistic update: inima/iconul de salvare se schimba instant, iar daca
 * cererea esueaza revenim la starea dinainte. UI-ul nu asteapta raspunsul
 * serverului ca sa se simta imediat.
 */
export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, liked }: { id: string; liked: boolean }) =>
      liked ? api.unlike(id) : api.like(id),
    onMutate: async ({ id, liked }) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      patchRecipeInCaches(queryClient, id, (r) => ({
        ...r,
        isLiked: !liked,
        likesCount: r.likesCount + (liked ? -1 : 1),
      }));
    },
    onError: (_err, { id, liked }) => {
      patchRecipeInCaches(queryClient, id, (r) => ({
        ...r,
        isLiked: liked,
        likesCount: r.likesCount + (liked ? 1 : -1),
      }));
    },
  });
}

export function useToggleSave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) =>
      saved ? api.unsave(id) : api.save(id),
    onMutate: async ({ id, saved }) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      patchRecipeInCaches(queryClient, id, (r) => ({
        ...r,
        isSaved: !saved,
        savesCount: r.savesCount + (saved ? -1 : 1),
      }));
    },
    onSuccess: () => {
      // Lista "Salvate" isi schimba continutul (nu doar un contor) - o reincarcam.
      void queryClient.invalidateQueries({ queryKey: ['savedRecipes'] });
    },
    onError: (_err, { id, saved }) => {
      patchRecipeInCaches(queryClient, id, (r) => ({
        ...r,
        isSaved: saved,
        savesCount: r.savesCount + (saved ? 1 : -1),
      }));
    },
  });
}

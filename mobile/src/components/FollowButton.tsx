import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '@foodbook/shared';
import { api } from '../lib/api';
import { Button } from './ui';

/**
 * Stare locala optimista, nu doar cache-ul ['user', username]: acest buton
 * apare si in liste (followers/following/cautare) ale caror cache-uri nu le
 * atingem aici. Fara stare locala, apasarea in lista nu s-ar vedea pana la
 * urmatorul refetch, desi cererea a reusit.
 */
export function FollowButton({
  username,
  isFollowing,
  size = 'normal',
}: {
  username: string;
  isFollowing: boolean;
  size?: 'normal' | 'compact';
}) {
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(isFollowing);

  useEffect(() => setFollowing(isFollowing), [isFollowing]);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => (next ? api.follow(username) : api.unfollow(username)),
    onMutate: async (next) => {
      setFollowing(next);
      queryClient.setQueryData<PublicUser>(['user', username], (old) =>
        old
          ? { ...old, isFollowedByMe: next, followersCount: old.followersCount + (next ? 1 : -1) }
          : old,
      );
    },
    onError: (_err, next) => {
      setFollowing(!next);
      queryClient.setQueryData<PublicUser>(['user', username], (old) =>
        old
          ? { ...old, isFollowedByMe: !next, followersCount: old.followersCount + (next ? -1 : 1) }
          : old,
      );
    },
  });

  return (
    <Button
      label={following ? 'Urmărit' : 'Urmărește'}
      variant={following ? 'secondary' : 'primary'}
      onPress={() => mutation.mutate(!following)}
      loading={mutation.isPending}
      style={size === 'compact' ? { paddingVertical: 8, paddingHorizontal: 14, minHeight: 0 } : undefined}
    />
  );
}


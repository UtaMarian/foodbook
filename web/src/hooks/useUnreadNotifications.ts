import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Fara push notifications pe web, badge-ul se actualizeaza prin polling
 * usor la fiecare 30s cat timp aplicatia e deschisa (la fel ca pe mobil).
 */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: api.unreadNotificationsCount,
    refetchInterval: 30_000,
  });
}

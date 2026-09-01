/**
 * TanStack Query hook for platform capacity / allocation (Usage panel).
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getPlatformLoad, type PlatformLoad } from '@/lib/api/skaha';

export const platformLoadKeys = {
  all: ['platform-load'] as const,
  current: () => [...platformLoadKeys.all, 'current'] as const,
};

export function usePlatformLoad(
  isAuthenticated?: boolean,
  options?: Omit<UseQueryOptions<PlatformLoad>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: platformLoadKeys.current(),
    queryFn: getPlatformLoad,
    enabled: isAuthenticated !== false,
    staleTime: 60 * 1000,
    retry(failureCount, error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/\b401\b/.test(msg) || /\b503\b/.test(msg)) {
        return false;
      }
      return failureCount < 2;
    },
    ...options,
  });
}

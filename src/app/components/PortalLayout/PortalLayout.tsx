'use client';

import { useMemo } from 'react';
import { Box } from '@/app/components/Box/Box';
import { AppBarWithAuth } from '@/app/components/AppBarWithAuth/AppBarWithAuth';
import { ThemeToggle } from '@/app/components/ThemeToggle/ThemeToggle';
import { appBarWithUserMenu, CanfarLogo, SRCNetLogo } from '@/stories/shared/navigation';
import { BrandWordmark } from '@/app/components/BrandWordmark/BrandWordmark';
import { useAuthStatus } from '@/lib/hooks/useAuth';
import { usePublicRuntimeConfig } from '@/lib/providers/PublicRuntimeConfigProvider';
import { useLogoutReset } from '@/lib/hooks/useLogoutReset';
import { applyServiceNavUrlsToAppBarLinks } from '@/lib/config/apply-service-nav-urls';

interface PortalLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared portal chrome: app bar, auth-gated logout reset, page shell.
 * Mounted from root layout so all routes inherit the same client UI foundation.
 */
export function PortalLayout({ children }: PortalLayoutProps) {
  const { useCanfar, serviceUrls } = usePublicRuntimeConfig();
  const isOIDCMode = !useCanfar;

  const { data: authStatus } = useAuthStatus();
  const isAuthenticated = authStatus?.authenticated ?? false;

  useLogoutReset(isAuthenticated);

  const canfarAppBarLinks = useMemo(
    () => applyServiceNavUrlsToAppBarLinks(appBarWithUserMenu.links, serviceUrls),
    [serviceUrls],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      <AppBarWithAuth
        variant="surface"
        position="sticky"
        elevation={0}
        wordmark={isOIDCMode ? 'Science Portal' : <BrandWordmark />}
        logoHref="/"
        logo={isOIDCMode ? <SRCNetLogo /> : <CanfarLogo alt="" />}
        links={isOIDCMode ? [] : canfarAppBarLinks}
        accountButton={<ThemeToggle />}
        showLoginButton={true}
      />
      {children}
    </Box>
  );
}

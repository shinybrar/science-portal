'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { ActiveSessionsWidget } from '@/app/components/ActiveSessionsWidget/ActiveSessionsWidget';
import { UserStorageWidget } from '@/app/components/UserStorageWidget/UserStorageWidget';
import { LaunchFormWidget } from '@/app/components/LaunchFormWidget/LaunchFormWidget';
import { PlatformLoad } from '@/app/components/PlatformLoad/PlatformLoad';
import { Footer } from '@/app/components/Footer/Footer';
import { Box } from '@/app/components/Box/Box';
import { Button, Container, Typography } from '@mui/material';
import type { SessionCardProps } from '@/app/types/SessionCardProps';
import { useAuthStatus } from '@/lib/hooks/useAuth';
import { usePublicRuntimeConfig } from '@/lib/providers/PublicRuntimeConfigProvider';
import { useSessions, useLaunchSession } from '@/lib/hooks/useSessions';
import { useContainerImages, useImageRepositories, useContext } from '@/lib/hooks/useImages';
import { useUserStorageSummary } from '@/lib/hooks/useUserStorage';
import { STATIC_PLATFORM_LOAD_DATA } from '@/lib/config/static-platform-load';
import type { Session, SessionLaunchParams } from '@/lib/api/skaha';
import {
  DOCS_URL,
  ABOUT_URL,
  OPEN_SOURCE_URL,
  SUPPORT_EMAIL,
  DISCORD_URL,
  STATUS_PAGE_URL,
} from '@/lib/config/site-config';
import { useAuthModalActions, useOperatingSessionIds, useSessionUiActions } from '@/lib/stores';
import { SessionModalsHost } from '@/lib/features/sessions/SessionModalsHost';

export function SessionsDashboard() {
  const { useCanfar, serviceUrls } = usePublicRuntimeConfig();
  const isOIDCMode = !useCanfar;

  const { data: authStatus, isLoading: authLoading } = useAuthStatus();
  const isAuthenticated = authStatus?.authenticated ?? false;
  // Widgets render only for authenticated users; while the auth check is in
  // flight they stay mounted in their loading state to avoid a layout flash.
  const isLoggedOut = !authLoading && !isAuthenticated;

  const operatingSessionIds = useOperatingSessionIds();
  const { clearOperating } = useSessionUiActions();
  const { openLogin } = useAuthModalActions();

  const {
    data: sessions = [],
    isLoading: isLoadingSessionsQuery,
    isFetching: isFetchingSessions,
    refetch: refetchSessions,
  } = useSessions(isAuthenticated);

  const {
    data: imagesByType = {},
    isLoading: isLoadingImages,
    isFetching: isFetchingImages,
    refetch: refetchImages,
  } = useContainerImages(isAuthenticated);

  const {
    data: imageRepositories = [],
    isLoading: isLoadingRepositories,
    isFetching: isFetchingRepositories,
    refetch: refetchRepositories,
  } = useImageRepositories(isAuthenticated);

  const {
    data: context,
    isLoading: isLoadingContext,
    isFetching: isFetchingContext,
    refetch: refetchContext,
  } = useContext(isAuthenticated);

  const username = authStatus?.user?.username ?? '';
  const {
    data: storageSummary,
    isLoading: isLoadingStorageSummary,
    isFetching: isFetchingStorageSummary,
    error: storageError,
    refetch: refetchStorage,
  } = useUserStorageSummary(username, isAuthenticated);

  const { mutateAsync: launchSessionAsync } = useLaunchSession();

  const handleLaunchSession = useCallback(
    async (params: SessionLaunchParams): Promise<Session> => {
      return await launchSessionAsync(params);
    },
    [launchSessionAsync],
  );

  // isLoading = initial load, no data yet → widgets render skeletons.
  // isFetching = background refetch → widgets keep content, status bar animates.
  const isLoadingSessions = authLoading || (isAuthenticated && isLoadingSessionsQuery);

  const isLoadingLaunchForm =
    authLoading ||
    (isAuthenticated && (isLoadingImages || isLoadingRepositories || isLoadingContext));
  const isFetchingLaunchForm =
    isAuthenticated && (isFetchingImages || isFetchingRepositories || isFetchingContext);

  const isLoadingUserStorage = authLoading || (isAuthenticated && isLoadingStorageSummary);

  // A deleted session keeps its "Terminating" card state until the server
  // confirms it's gone, i.e. the session no longer appears in the refetched
  // list. (Renew marks are cleared by the mutation callbacks instead.)
  useEffect(() => {
    operatingSessionIds.forEach((operation, sessionId) => {
      if (operation === 'delete' && !sessions.some((s) => s.id === sessionId)) {
        clearOperating(sessionId);
      }
    });
  }, [sessions, operatingSessionIds, clearOperating]);

  const activeSessions: SessionCardProps[] = useMemo(() => {
    return sessions
      .filter(
        (session: Session) =>
          session.sessionType !== 'headless' && session.sessionType !== 'desktop-app',
      )
      .map((session: Session) => ({
        id: session.id,
        sessionType: session.sessionType,
        sessionName: session.sessionName,
        status: session.status,
        containerImage: session.containerImage,
        startedTime: session.startedTime,
        expiresTime: session.expiresTime,
        memoryUsage: session.memoryUsage,
        memoryAllocated: session.memoryAllocated,
        cpuUsage: session.cpuUsage,
        cpuAllocated: session.cpuAllocated,
        gpuAllocated: session.gpuAllocated,
        isFixedResources: session.isFixedResources,
        connectUrl: session.connectUrl,
      }));
  }, [sessions]);

  const handleSessionsRefresh = useCallback(() => {
    refetchSessions();
  }, [refetchSessions]);

  const handleStorageRefresh = useCallback(() => {
    void refetchStorage();
  }, [refetchStorage]);

  const handleLaunchFormRefresh = useCallback(() => {
    refetchImages();
    refetchRepositories();
    refetchContext();
  }, [refetchImages, refetchRepositories, refetchContext]);

  const footerSections = useMemo(
    () => [
      {
        title: 'Resources',
        links: [
          { label: 'Documentation', href: DOCS_URL, external: true },
          { label: 'About', href: ABOUT_URL, external: true },
          { label: 'Open Source', href: OPEN_SOURCE_URL, external: true },
        ],
      },
      {
        title: 'Services',
        links: [
          {
            label: 'Storage Management',
            href: serviceUrls.storageManagement,
            external: true,
          },
          {
            label: 'Group Management',
            href: serviceUrls.groupManagement,
            external: true,
          },
          {
            label: 'Data Publication',
            href: serviceUrls.dataPublication,
            external: true,
          },
          { label: 'Science Portal', href: serviceUrls.sciencePortal, external: true },
          { label: 'CADC Search', href: serviceUrls.cadcSearch, external: true },
          { label: 'OpenStack Cloud', href: serviceUrls.openstackCloud, external: true },
        ],
      },
      {
        title: 'Support',
        links: [
          { label: 'Help', href: SUPPORT_EMAIL, external: false },
          { label: 'Join us on Discord', href: DISCORD_URL, external: true },
          { label: 'Status Page', href: STATUS_PAGE_URL, external: true },
        ],
      },
    ],
    [serviceUrls],
  );

  return (
    <>
      <SessionModalsHost />
      <Box component="main" sx={{ flex: 1, pt: { xs: 3, md: 4 } }}>
        {isLoggedOut ? (
          <Container maxWidth="sm" sx={{ py: { xs: 10, md: 14 }, textAlign: 'center' }}>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                letterSpacing: '-0.025em',
                lineHeight: 1.12,
                mb: 1.5,
              }}
            >
              Sign in to continue
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mb: 4, lineHeight: 1.6, maxWidth: 420, mx: 'auto' }}
            >
              View your sessions, check storage, and launch notebooks, CARTA, and desktops on
              CANFAR.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => openLogin('manual')}
              aria-label="Sign in"
            >
              Sign in
            </Button>
          </Container>
        ) : (
          <>
            <Container maxWidth="xl" sx={{ mb: 4, px: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <ActiveSessionsWidget
                  sessions={activeSessions}
                  operatingSessionIds={operatingSessionIds}
                  isLoading={isLoadingSessions}
                  isFetching={isAuthenticated && isFetchingSessions}
                  onRefresh={handleSessionsRefresh}
                  headerActions={
                    <UserStorageWidget
                      data={storageSummary ?? null}
                      isLoading={isLoadingUserStorage}
                      isFetching={isAuthenticated && isFetchingStorageSummary}
                      errorMessage={storageError?.message}
                      onRefresh={handleStorageRefresh}
                    />
                  }
                />

                <Box
                  sx={{
                    display: 'grid',
                    gap: 3,
                    gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' },
                    alignItems: 'start',
                  }}
                >
                  <LaunchFormWidget
                    helpUrl="https://www.opencadc.org/canfar/latest/platform/sessions/"
                    imagesByType={imagesByType}
                    repositoryHosts={imageRepositories
                      .map((repo) => repo.host)
                      .filter((host): host is string => Boolean(host))}
                    isLoading={isLoadingLaunchForm}
                    isFetching={isFetchingLaunchForm}
                    onRefresh={handleLaunchFormRefresh}
                    activeSessions={sessions}
                    launchSessionFn={handleLaunchSession}
                    coreOptions={context?.cores.options}
                    memoryOptions={context?.memoryGB.options}
                    gpuOptions={context?.gpus.options}
                  />
                  <PlatformLoad
                    data={STATIC_PLATFORM_LOAD_DATA}
                    isLoading={false}
                    showDisabledOverlay
                  />
                </Box>
              </Box>
            </Container>
          </>
        )}
      </Box>

      {!isOIDCMode && <Footer sections={footerSections} copyright="© 2022-2026" />}
    </>
  );
}

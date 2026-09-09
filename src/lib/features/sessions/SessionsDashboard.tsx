'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { ActiveSessionsWidget } from '@/app/components/ActiveSessionsWidget/ActiveSessionsWidget';
import { UserStorageWidget } from '@/app/components/UserStorageWidget/UserStorageWidget';
import { LaunchFormWidget } from '@/app/components/LaunchFormWidget/LaunchFormWidget';
import { PlatformLoad } from '@/app/components/PlatformLoad/PlatformLoad';
import { Footer } from '@/app/components/Footer/Footer';
import { Box } from '@/app/components/Box/Box';
import { Container, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
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
import { useOperatingSessionIds, useSessionUiActions } from '@/lib/stores';
import { SessionModalsHost } from '@/lib/features/sessions/SessionModalsHost';
import { joinQueryErrors, queryErrorMessage } from '@/lib/query/query-result';

export function SessionsDashboard() {
  const theme = useTheme();
  const isDesktopTopRow = useMediaQuery(theme.breakpoints.up('lg'));
  const { useCanfar, serviceUrls } = usePublicRuntimeConfig();
  const isOIDCMode = !useCanfar;

  const { data: authStatus, isLoading: authLoading } = useAuthStatus();
  const isAuthenticated = authStatus?.authenticated ?? false;
  // Widgets render only for authenticated users; while the auth check is in
  // flight they stay mounted in their loading state to avoid a layout flash.
  const isLoggedOut = !authLoading && !isAuthenticated;

  const operatingSessionIds = useOperatingSessionIds();
  const { clearOperating } = useSessionUiActions();

  const {
    data: sessions = [],
    isLoading: isLoadingSessionsQuery,
    isFetching: isFetchingSessions,
    error: sessionsError,
    refetch: refetchSessions,
  } = useSessions(isAuthenticated);

  const {
    data: imagesByType = {},
    isLoading: isLoadingImages,
    isFetching: isFetchingImages,
    error: imagesError,
    refetch: refetchImages,
  } = useContainerImages(isAuthenticated);

  const {
    data: imageRepositories = [],
    isLoading: isLoadingRepositories,
    isFetching: isFetchingRepositories,
    error: repositoriesError,
    refetch: refetchRepositories,
  } = useImageRepositories(isAuthenticated);

  const {
    data: context,
    isLoading: isLoadingContext,
    isFetching: isFetchingContext,
    error: contextError,
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

  const sessionsErrorMessage = queryErrorMessage(sessionsError);
  const storageErrorMessage = queryErrorMessage(storageError);
  const launchFormErrorMessage = joinQueryErrors([imagesError, repositoriesError, contextError]);

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
      <Box component="main" sx={{ flex: 1, pt: 2 }}>
        {isLoggedOut ? (
          <Container maxWidth="sm" sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
            <Typography variant="h5" component="h1" gutterBottom>
              Sign in to access the Science Portal
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Use the Login button in the header to view your active sessions, check your storage,
              and launch new sessions.
            </Typography>
          </Container>
        ) : (
          <>
            <Container maxWidth="xl" sx={{ mb: 4, px: { xs: 2, sm: 3 } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', lg: 'row' },
                  gap: 3,
                  alignItems: { lg: isDesktopTopRow ? 'stretch' : 'flex-start' },
                }}
              >
                <Box
                  sx={{
                    flex: { xs: 1, lg: '0 0 80%' },
                    minWidth: 0,
                    display: { lg: isDesktopTopRow ? 'flex' : 'block' },
                    flexDirection: 'column',
                  }}
                >
                  <ActiveSessionsWidget
                    sessions={activeSessions}
                    operatingSessionIds={operatingSessionIds}
                    isLoading={isLoadingSessions}
                    isFetching={isAuthenticated && isFetchingSessions}
                    errorMessage={sessionsErrorMessage}
                    onRefresh={handleSessionsRefresh}
                    fillHeight={isDesktopTopRow}
                  />
                </Box>

                <Box
                  sx={{
                    flex: { xs: 1, lg: '0 0 20%' },
                    minWidth: 0,
                    px: { xs: 1, sm: 2 },
                    display: { lg: isDesktopTopRow ? 'flex' : 'block' },
                    flexDirection: 'column',
                  }}
                >
                  <UserStorageWidget
                    data={storageSummary ?? null}
                    isLoading={isLoadingUserStorage}
                    isFetching={isAuthenticated && isFetchingStorageSummary}
                    errorMessage={storageErrorMessage}
                    onRefresh={handleStorageRefresh}
                    fillHeight={isDesktopTopRow}
                  />
                </Box>
              </Box>
            </Container>

            <Container maxWidth="xl" sx={{ mb: 4, px: { xs: 2, sm: 3 } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', lg: 'row' },
                  gap: 3,
                }}
              >
                <Box
                  sx={{
                    flex: { xs: 1, lg: '0 0 60%' },
                    minWidth: 0,
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
                    errorMessage={launchFormErrorMessage}
                    onRefresh={handleLaunchFormRefresh}
                    activeSessions={sessions}
                    launchSessionFn={handleLaunchSession}
                    coreOptions={context?.cores.options}
                    memoryOptions={context?.memoryGB.options}
                    gpuOptions={context?.gpus.options}
                  />
                </Box>

                <Box
                  sx={{
                    flex: { xs: 1, lg: '0 0 40%' },
                    minWidth: 0,
                    px: { xs: 1, sm: 2 },
                  }}
                >
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

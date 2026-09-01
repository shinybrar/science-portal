'use client';

import React from 'react';
import { Typography, Box, Card, CardContent } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ActiveSessionsWidgetProps } from '@/app/types/ActiveSessionsWidgetProps';
import { DashboardWidget } from '@/app/components/DashboardWidget/DashboardWidget';
import { SessionCard } from '@/app/components/SessionCard/SessionCard';

const SESSION_CARD_MIN = 260;
const VISIBLE_DESKTOP_CARDS = 3;

const mobileGridSx = {
  display: 'grid',
  gap: 2,
  alignItems: 'stretch',
  gridTemplateColumns: `repeat(auto-fill, minmax(${SESSION_CARD_MIN}px, 1fr))`,
} as const;

const desktopRowSx = {
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 2,
  overflowX: 'auto',
  overflowY: 'hidden',
  flex: 1,
  minHeight: 0,
  alignItems: 'stretch',
  scrollbarWidth: 'thin',
  pb: 0.25,
} as const;

const desktopCardSx = {
  flex: '0 0 auto',
  width: `calc((100% - ${(VISIBLE_DESKTOP_CARDS - 1) * 16}px) / ${VISIBLE_DESKTOP_CARDS})`,
  minWidth: 240,
  height: '100%',
  alignSelf: 'stretch',
};

const mobileCardSx = {
  width: '100%',
};

// Hoisted so callers omitting `operatingSessionIds` get a stable Map reference;
// otherwise a fresh `new Map()` per render breaks downstream memoization.
const EMPTY_OPERATING_IDS: Map<string, 'delete' | 'renew'> = new Map();

export function ActiveSessionsWidgetImpl({
  sessions = [],
  operatingSessionIds = EMPTY_OPERATING_IDS,
  isLoading = false,
  isFetching = false,
  onRefresh,
  title = 'Active Sessions',
  showSessionCount = true,
  maxSessionsToShow,
  emptyMessage = 'No active sessions',
  headerActions,
  fillHeight = false,
}: ActiveSessionsWidgetProps) {
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const skeletonCount = isLgUp ? VISIBLE_DESKTOP_CARDS : 3;

  const displayTitle =
    showSessionCount && sessions.length > 0 ? `${title} (${sessions.length})` : title;

  const sessionsToDisplay = maxSessionsToShow ? sessions.slice(0, maxSessionsToShow) : sessions;

  const hasMoreSessions = maxSessionsToShow && sessions.length > maxSessionsToShow;

  const sessionsLayoutSx = isLgUp ? desktopRowSx : mobileGridSx;
  const sessionCardSx = isLgUp ? desktopCardSx : mobileCardSx;

  const renderSessionCard = (session: (typeof sessionsToDisplay)[number], index: number) => {
    const operation = session.id ? operatingSessionIds.get(session.id) : undefined;
    // A session is "terminating" from the moment the user confirms the delete
    // (client mark) until the server stops listing it; Skaha also reports the
    // Terminating status directly once the pod starts winding down.
    const isTerminating = operation === 'delete' || session.status === 'Terminating';
    return (
      <SessionCard
        key={session.id || session.sessionName || `session-${index}`}
        {...session}
        isOperating={!!operation || session.status === 'Pending'}
        isTerminating={isTerminating}
        sx={sessionCardSx}
      />
    );
  };

  return (
    <DashboardWidget
      title={displayTitle}
      isLoading={isLoading}
      isFetching={isFetching}
      onRefresh={onRefresh}
      headerActions={headerActions}
      fillHeight={fillHeight}
    >
      {/* Content - Session Cards */}
      {isLoading ? (
        <Box sx={sessionsLayoutSx}>
          {Array.from({ length: skeletonCount }, (_, index) => (
            <SessionCard
              key={`skeleton-${index}`}
              sessionType="notebook"
              sessionName=""
              status="Running"
              containerImage=""
              startedTime=""
              expiresTime=""
              memoryAllocated=""
              cpuAllocated=""
              loading={true}
              sx={sessionCardSx}
            />
          ))}
        </Box>
      ) : sessions.length === 0 ? (
        <Card
          elevation={0}
          variant="outlined"
          sx={{
            width: '100%',
            flex: fillHeight ? 1 : undefined,
            display: 'flex',
            flexDirection: 'column',
            minHeight: fillHeight ? 0 : 120,
            border: `1px solid ${theme.palette.divider}`,
            cursor: 'default',
          }}
        >
          <CardContent
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              py: 3,
              background:
                theme.palette.mode === 'dark'
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)',
              [theme.breakpoints.down('sm')]: {
                padding: theme.spacing(2),
                '&:last-child': {
                  paddingBottom: theme.spacing(2),
                },
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color:
                  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                fontWeight: 400,
              }}
            >
              {emptyMessage}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Box sx={sessionsLayoutSx}>
            {sessionsToDisplay.map((session, index) => renderSessionCard(session, index))}
          </Box>
          {hasMoreSessions && (
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ pt: 1, flexShrink: 0 }}
            >
              And {sessions.length - maxSessionsToShow} more...
            </Typography>
          )}
        </>
      )}
    </DashboardWidget>
  );
}

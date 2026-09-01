'use client';

import {
  Card as MuiCard,
  CardContent,
  CardActions,
  Box,
  Typography,
  IconButton,
  Chip,
  useTheme,
  Skeleton,
  Stack,
  Tooltip,
  CircularProgress,
  Backdrop,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Flag as FlagIcon,
  Description as LogsIcon,
  Schedule as ExtendIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { SessionCardProps, SessionType, SessionStatus } from '@/app/types/SessionCardProps';
import React from 'react';
import { alpha, type Theme } from '@mui/material/styles';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
import { usePublicRuntimeConfig } from '@/lib/providers/PublicRuntimeConfigProvider';
import Image from 'next/image';
import { useSessionModalsActions } from '@/lib/stores';
import { hasAssignedSessionId } from '@/lib/sessions/sessionQuota';

const ICON_SIZE = 22;

/** Explicit CSS size so global `img { height: auto }` doesn't fight next/image. */
const sessionIconStyle: React.CSSProperties = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  objectFit: 'contain',
};

const getSessionIcon = (basePath: string, type: SessionType): React.ReactNode => {
  switch (type) {
    case 'notebook':
    case 'contributednotebook':
      return (
        <Image
          src={`${basePath}/notebook_icon.jpg`}
          alt="Notebook"
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={sessionIconStyle}
        />
      );
    case 'desktop':
    case 'contributeddesktop':
      return (
        <Image
          src={`${basePath}/desktop_icon.png`}
          alt="Desktop"
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={sessionIconStyle}
        />
      );
    case 'carta':
      return (
        <Image
          src={`${basePath}/carta_icon.png`}
          alt="CARTA"
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={sessionIconStyle}
        />
      );
    case 'contributed':
      return (
        <Image
          src={`${basePath}/contributed_icon.png`}
          alt="Contributed"
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={sessionIconStyle}
        />
      );
    case 'firefly':
      return (
        <Image
          src={`${basePath}/firefly_icon.png`}
          alt="Firefly"
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={sessionIconStyle}
        />
      );
    default:
      return <CodeIcon />;
  }
};

const getStatusColor = (status: SessionStatus): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'Running':
      return 'success';
    case 'Pending':
    case 'Terminating':
      return 'warning';
    case 'Failed':
      return 'error';
    default:
      return 'default';
  }
};

/**
 * Skaha reports a session as `Failed` once its lifetime elapses; from the
 * user's perspective the session simply expired (it didn't crash). Surface
 * that distinction in the chip label.
 */
const getStatusLabel = (status: SessionStatus): string => {
  return status === 'Failed' ? 'Expired' : status;
};

const hasResourceModeBadge = (isFixedResources: boolean | undefined): isFixedResources is boolean =>
  isFixedResources === true || isFixedResources === false;

/**
 * Corner badge for the session's resource mode. Rendered inside CardContent
 * (without a z-index) so the busy overlay dims it with the rest of the content.
 */
const ResourceModeChip = ({ isFixedResources }: { isFixedResources: boolean }) => {
  const theme = useTheme();
  return (
    <Tooltip
      title={
        isFixedResources
          ? 'Fixed resources — the session gets exactly the CPU and RAM it requested'
          : 'Flexible resources — the session shares idle cluster capacity'
      }
    >
      <Chip
        label={isFixedResources ? 'FIXED' : 'FLEX'}
        size="small"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '20px',
          fontSize: '0.7rem',
          fontWeight: 700,
          borderRadius: '0 0 8px 0',
          backgroundColor: isFixedResources
            ? theme.palette.primary.dark
            : theme.palette.accent.main,
          color: isFixedResources
            ? theme.palette.primary.contrastText
            : theme.palette.accent.contrastText,
        }}
      />
    </Tooltip>
  );
};

/**
 * Split a full container image path into project and image name.
 * Example: "images.canfar.net/skaha/firefly:2025.2" -> { project: "skaha", image: "firefly:2025.2" }
 */
const parseImagePath = (fullImagePath: string): { project: string; image: string } => {
  if (!fullImagePath) return { project: 'N/A', image: 'N/A' };
  const parts = fullImagePath.split('/');
  if (parts.length >= 3) {
    return { project: parts[1], image: parts.slice(2).join('/') };
  }
  if (parts.length === 2) {
    return { project: parts[0], image: parts[1] };
  }
  return { project: 'N/A', image: parts[0] };
};

/**
 * Skaha returns memory either as bare GB numbers ("1.4", "16") or, occasionally,
 * with a unit suffix ("8G"). Render with a "GB" suffix. Falsy / "<none>" → "N/A".
 */
const formatMemoryUnit = (value: string | undefined): string => {
  if (!value || value === '<none>') return 'N/A';
  if (/[KMGT]$/.test(value)) return `${value}B`;
  if (/^\d+(\.\d+)?$/.test(value)) return `${value}GB`;
  return value;
};

/**
 * Strip any unit suffix; used for the usage side of "usage / allocated" so the
 * unit appears only once at the end (e.g. "1.4 / 16GB").
 */
const stripMemoryUnit = (value: string | undefined): string => {
  if (!value || value === '<none>') return 'N/A';
  return value.replace(/[KMGT]B?$/, '');
};

/** Format ISO timestamp as "YYYY-MM-DD HH:mm" in UTC. */
const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return 'Pending...';
  const d = dayjs.utc(timestamp);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : 'Pending...';
};

// --- Hoisted styles (static, or theme-derived via sx callbacks) ---

/**
 * Card busy overlay — MUI Backdrop + CircularProgress, scoped to the card.
 *
 * Use `color="inherit"` (same as our Button loading spinner) with an explicit
 * `color` on the Backdrop: the `primary` palette variant on CircularProgress
 * has been unreliable here, while inherit from the parent always paints.
 * `transitionDuration={0}` avoids Fade leaving the spinner at opacity 0 on
 * first paint when the overlay mounts already open.
 */
const BusyOverlay = () => (
  <Backdrop
    open
    aria-hidden={false}
    transitionDuration={0}
    sx={(theme) => ({
      position: 'absolute',
      inset: 0,
      zIndex: 2,
      color: theme.palette.primary.main,
      backgroundColor: alpha(theme.palette.background.paper, 0.48),
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    })}
  >
    <CircularProgress color="inherit" size={32} disableShrink />
  </Backdrop>
);

const actionButtonSx = (theme: Theme) => ({
  [theme.breakpoints.down('sm')]: {
    minWidth: '44px',
    minHeight: '44px',
  },
});

const detailLabelSx = { fontWeight: 600 } as const;

export const SessionCardImpl = React.forwardRef<HTMLDivElement, SessionCardProps>(
  (
    {
      // Consume `id` so it doesn't fall through to the DOM via {...cardProps}.
      id,
      sessionType,
      sessionName,
      status,
      containerImage,
      startedTime,
      expiresTime,
      memoryUsage,
      memoryAllocated,
      cpuUsage,
      cpuAllocated,
      gpuAllocated,
      isFixedResources,
      connectUrl,
      loading = false,
      isOperating = false,
      isTerminating = false,
      sx,
      ...cardProps
    },
    ref,
  ) => {
    const { basePath } = usePublicRuntimeConfig();
    const theme = useTheme();
    const { openSessionModal } = useSessionModalsActions();

    const openModal = (kind: 'events' | 'logs' | 'extend' | 'delete') => {
      if (!hasAssignedSessionId(id)) return;
      openSessionModal({ sessionId: id!, sessionName, kind });
    };

    // While terminating, the server may still report the pre-delete status
    // (Running/Pending) for a few polls — surface Terminating instead.
    const displayStatus: SessionStatus = isTerminating ? 'Terminating' : status;
    const isConnectable = status === 'Running' && !isTerminating && !!connectUrl;
    const sessionIdAssigned = hasAssignedSessionId(id);
    const actionsDisabled = isTerminating || !sessionIdAssigned;
    const awaitingIdTooltip = 'Session is still being created';
    const showContentBusyOverlay = isOperating && !isTerminating;

    const handleCardClick = () => {
      if (isConnectable) {
        window.open(connectUrl, '_blank');
      }
    };

    const handleCardKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick();
      }
    };

    const handleShowEvents = (e: React.MouseEvent) => {
      e.stopPropagation();
      openModal('events');
    };

    const handleShowLogs = (e: React.MouseEvent) => {
      e.stopPropagation();
      openModal('logs');
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      openModal('delete');
    };

    const handleExtendClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      openModal('extend');
    };

    if (loading) {
      return (
        <MuiCard
          ref={ref}
          {...cardProps}
          elevation={0}
          variant="outlined"
          sx={[
            { border: `1px solid ${theme.palette.divider}`, height: '100%' },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          ]}
        >
          {/* pt matches the loaded card (badge row reserved) so the layout
              doesn't shift when skeletons swap to real cards. */}
          <CardContent sx={{ px: 2, pb: 2, pt: 4.5, height: '100%', '&:last-child': { pb: 2 } }}>
            <Stack spacing={1.25}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={1}>
                  <Skeleton variant="circular" width={22} height={22} />
                  <Skeleton variant="text" width={140} height={22} />
                </Box>
                <Skeleton variant="rectangular" width={64} height={22} />
              </Box>
              <Skeleton variant="text" width="100%" height={18} />
              <Skeleton variant="text" width="100%" height={18} />
              <Skeleton variant="text" width="90%" height={18} />
              <Skeleton variant="text" width="75%" height={18} />
              <Box display="flex" gap={0.5} mt={0.5}>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="circular" width={32} height={32} />
                ))}
              </Box>
            </Stack>
          </CardContent>
        </MuiCard>
      );
    }

    const { project, image } = parseImagePath(containerImage);
    const memoryDisplay =
      isFixedResources === false
        ? formatMemoryUnit(memoryUsage)
        : `${stripMemoryUnit(memoryUsage)} / ${formatMemoryUnit(memoryAllocated)}`;
    const cpuDisplay =
      isFixedResources === false ? cpuUsage || 'N/A' : `${cpuUsage || 'N/A'} / ${cpuAllocated}`;
    const showGpu = !!(gpuAllocated && gpuAllocated !== '0');
    const showResourceMode = hasResourceModeBadge(isFixedResources);

    return (
        <MuiCard
          ref={ref}
          {...cardProps}
          onClick={handleCardClick}
          onKeyDown={isConnectable ? handleCardKeyDown : undefined}
          role={isConnectable ? 'link' : undefined}
          tabIndex={isConnectable ? 0 : undefined}
          aria-label={isConnectable ? `Open session ${sessionName}` : undefined}
          elevation={0}
          raised={false}
          variant="outlined"
          sx={[
            {
              cursor: isConnectable ? 'pointer' : 'default',
              border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              height: '100%',
              transition: theme.transitions.create(
                ['transform', 'border-color', 'box-shadow'],
                { duration: theme.transitions.duration.shorter },
              ),
              ...(isConnectable && {
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  boxShadow:
                    theme.palette.mode === 'dark'
                      ? '0 8px 24px rgba(0,0,0,0.35)'
                      : '0 8px 24px rgba(0,0,0,0.08)',
                },
                '&:active': {
                  transform: 'scale(0.985)',
                },
                '@media (prefers-reduced-motion: reduce)': {
                  '&:active': { transform: 'none' },
                },
              }),
            },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          ]}
        >
          <CardContent
            sx={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              px: 2,
              pb: 1.5,
              // Constant top padding reserves the corner-badge row even before
              // isFixedResources is known (e.g. a freshly launched session),
              // so the content doesn't jump down when the chip appears.
              pt: 4.5,
              '&:last-child': { pb: 1.5 },
            }}
          >
            {showResourceMode && <ResourceModeChip isFixedResources={isFixedResources} />}

            {/* Pending / renew: dim content only so footer actions (e.g. delete) stay usable. */}
            {showContentBusyOverlay && <BusyOverlay />}

            <Box display="flex" alignItems="center" gap={1} mb={1} minWidth={0}>
              <Box sx={{ color: theme.palette.primary.main, display: 'flex', flexShrink: 0 }}>
                {getSessionIcon(basePath, sessionType)}
              </Box>
              <Typography
                variant="subtitle1"
                component="div"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: 1,
                  fontWeight: theme.typography.fontWeightBold,
                  lineHeight: 1.2,
                }}
              >
                {sessionName}
              </Typography>
              <Chip
                label={getStatusLabel(displayStatus)}
                color={getStatusColor(displayStatus)}
                size="small"
                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, flexShrink: 0 }}
              />
            </Box>

            <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" color="text.secondary" noWrap title={project}>
                <Box component="span" sx={detailLabelSx}>
                  Project:{' '}
                </Box>
                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {project}
                </Box>
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap title={image}>
                <Box component="span" sx={detailLabelSx}>
                  Image:{' '}
                </Box>
                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {image}
                </Box>
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                <Box component="span" sx={detailLabelSx}>
                  Memory:{' '}
                </Box>
                {memoryDisplay}
                {' · '}
                <Box component="span" sx={detailLabelSx}>
                  CPU:{' '}
                </Box>
                {cpuDisplay}
                {showGpu && (
                  <>
                    {' · '}
                    <Box component="span" sx={detailLabelSx}>
                      GPU:{' '}
                    </Box>
                    {gpuAllocated}
                  </>
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                <Box component="span" sx={detailLabelSx}>
                  Started:{' '}
                </Box>
                {formatTimestamp(startedTime)} UTC
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                <Box component="span" sx={detailLabelSx}>
                  Expires:{' '}
                </Box>
                {formatTimestamp(expiresTime)} UTC
              </Typography>
            </Stack>
          </CardContent>

          <CardActions
            disableSpacing
            sx={{
              position: 'relative',
              borderTop: 'none',
              boxShadow: `inset 0 1px 0 ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              justifyContent: 'flex-end',
              gap: 0.25,
              px: 1.5,
              py: 0.5,
            }}
          >
            <Tooltip
              title={
                !sessionIdAssigned
                  ? awaitingIdTooltip
                  : status === 'Pending'
                    ? 'Cannot extend a pending session'
                    : 'Extend time'
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={handleExtendClick}
                  aria-label="Extend time"
                  disabled={actionsDisabled || status === 'Pending'}
                  sx={actionButtonSx(theme)}
                >
                  <ExtendIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={!sessionIdAssigned ? awaitingIdTooltip : 'View session logs'}>
              <span>
                <IconButton
                  size="small"
                  onClick={handleShowLogs}
                  aria-label="View logs"
                  disabled={actionsDisabled}
                  sx={actionButtonSx(theme)}
                >
                  <LogsIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={!sessionIdAssigned ? awaitingIdTooltip : 'View launch info'}>
              <span>
                <IconButton
                  size="small"
                  onClick={handleShowEvents}
                  aria-label="View events"
                  disabled={actionsDisabled}
                  sx={actionButtonSx(theme)}
                >
                  <FlagIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={!sessionIdAssigned ? awaitingIdTooltip : 'Delete session'}>
              <span>
                <IconButton
                  size="small"
                  onClick={handleDeleteClick}
                  aria-label="Delete session"
                  disabled={actionsDisabled}
                  sx={actionButtonSx(theme)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </CardActions>

          {/* Terminating: cover the whole card (content + actions) with one spinner. */}
          {isTerminating && <BusyOverlay />}
        </MuiCard>
    );
  },
);

SessionCardImpl.displayName = 'SessionCardImpl';

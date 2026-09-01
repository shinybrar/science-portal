'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography,
  Box,
  Skeleton,
  Tooltip,
  Popover,
  IconButton,
  ButtonBase,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  FolderOutlined as StorageIcon,
} from '@mui/icons-material';
import { useTheme, type Theme } from '@mui/material/styles';
import {
  UserStorageWidgetProps,
  StorageData,
} from '@/app/types/UserStorageWidgetProps';
import { tokens } from '@/app/design-system/tokens';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import updateLocale from 'dayjs/plugin/updateLocale';

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);
dayjs.updateLocale('en', {
  relativeTime: {
    future: 'in %s',
    past: '%s ago',
    s: 'a few seconds',
    m: 'a min',
    mm: '%d mins',
    h: 'an hr',
    hh: '%d hrs',
    d: 'a day',
    dd: '%d days',
    M: 'a month',
    MM: '%d months',
    y: 'a year',
    yy: '%d years',
  },
});

const RING_SIZE = 32;
const RING_STROKE = 5;
const RING_ICON_SIZE = 14;

const convertToFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let u = -1;
  let size = bytes;

  do {
    size /= thresh;
    ++u;
  } while (Math.abs(size) >= thresh && u < units.length - 1);

  return `${size.toFixed(size < 10 ? 2 : 1)} ${units[u]}`;
};

/**
 * Parse storage API `date` as a UTC instant (VOSpace node date for used size / totals).
 * Naive `YYYY-MM-DD …` values are treated as UTC wall time, not local.
 */
const parseStorageApiUtc = (raw: string): dayjs.Dayjs | null => {
  const s = raw.trim();
  if (!s) return null;

  const utcLiteral = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?\s*UTC$/i);
  if (utcLiteral) {
    const stamp = `${utcLiteral[1]} ${utcLiteral[2]}${utcLiteral[3] ?? ''}`;
    const fmt = utcLiteral[3] ? 'YYYY-MM-DD HH:mm:ss.SSS' : 'YYYY-MM-DD HH:mm:ss';
    const d = dayjs.utc(stamp, fmt);
    return d.isValid() ? d : null;
  }

  if (/[zZ]$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(s)) {
    const d = dayjs(s);
    return d.isValid() ? d.utc() : null;
  }

  const naive = s.match(/^(\d{4}-\d{2}-\d{2})([ T])(\d{2}:\d{2}:\d{2})(\.\d+)?$/);
  if (naive) {
    const stamp = `${naive[1]} ${naive[3]}${naive[4] ?? ''}`;
    const fmt = naive[4] ? 'YYYY-MM-DD HH:mm:ss.SSS' : 'YYYY-MM-DD HH:mm:ss';
    const d = dayjs.utc(stamp, fmt);
    return d.isValid() ? d : null;
  }

  const loose = dayjs.utc(s);
  if (loose.isValid()) return loose;

  const localFallback = dayjs(s);
  return localFallback.isValid() ? localFallback : null;
};

const formatStorageDateLocalDefault = (raw: string): string => {
  const instant = parseStorageApiUtc(raw);
  if (!instant) return 'Unknown';

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(instant.toDate());
};

const formatRelativeStorageModified = (raw: string, nowMs: number): string => {
  const instant = parseStorageApiUtc(raw);
  if (!instant) return 'Unknown';
  return instant.from(dayjs(nowMs));
};

const USAGE_WARN_PCT = 70;
const USAGE_CRITICAL_PCT = 90;

function usageFillColor(usage: number, theme: Theme) {
  if (usage > USAGE_CRITICAL_PCT) return theme.palette.error.main;
  if (usage >= USAGE_WARN_PCT) return theme.palette.warning.main;
  return theme.palette.success.light;
}

function StorageRing({
  usage,
  isLoading,
  usedColor,
  trackColor,
  size = RING_SIZE,
}: {
  usage: number;
  isLoading: boolean;
  usedColor: string;
  trackColor: string;
  size?: number;
}) {
  const clamped = Math.min(100, Math.max(0, usage));
  const radius = (size - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <Box
        component="svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        sx={{
          display: 'block',
          transform: 'rotate(-90deg)',
          ...(isLoading && {
            animation: 'spin 1s linear infinite',
            '@keyframes spin': {
              to: { transform: 'rotate(270deg)' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }),
        }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={usedColor}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={isLoading ? `${circumference * 0.25} ${circumference}` : `${dash} ${circumference}`}
        />
      </Box>
      <StorageIcon
        aria-hidden
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: RING_ICON_SIZE,
          height: RING_ICON_SIZE,
          marginTop: `${-RING_ICON_SIZE / 2}px`,
          marginLeft: `${-RING_ICON_SIZE / 2}px`,
          color: usedColor,
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}

export type StorageSummaryBodyProps = {
  isLoading?: boolean;
  data?: StorageData | null;
  emptyMessage?: string;
  warningThreshold?: number;
  dateFormatter?: (date: string) => string;
  fileSizeFormatter?: (bytes: number) => string;
  fillHeight?: boolean;
};

export function StorageDetailsPanel({
  isLoading = false,
  data = null,
  emptyMessage = 'No storage data available',
  dateFormatter = formatStorageDateLocalDefault,
  fileSizeFormatter = convertToFileSize,
  title,
  onClose,
  onRefresh,
  isFetching = false,
  errorMessage,
}: StorageSummaryBodyProps & {
  title?: string;
  onClose?: () => void;
  onRefresh?: () => void;
  isFetching?: boolean;
  errorMessage?: string;
}) {
  const theme = useTheme();
  const [relativeNowMs, setRelativeNowMs] = useState(() => Date.now());
  const displayData = isLoading ? null : data;
  const usage = displayData?.usage ?? 0;
  const usedColor = usageFillColor(usage, theme);
  const trackColor =
    theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300];
  const usedPct = Math.min(100, Math.max(0, usage));

  const sizeTotalsModifiedAbsolute = useMemo(() => {
    return displayData?.date ? dateFormatter(displayData.date) : null;
  }, [displayData?.date, dateFormatter]);

  const sizeTotalsModifiedRelative = useMemo(() => {
    return displayData?.date ? formatRelativeStorageModified(displayData.date, relativeNowMs) : null;
  }, [displayData?.date, relativeNowMs]);

  useEffect(() => {
    if (!displayData?.date) return;
    setRelativeNowMs(Date.now());
    const intervalId = window.setInterval(() => setRelativeNowMs(Date.now()), 60000);
    return () => window.clearInterval(intervalId);
  }, [displayData?.date]);

  return (
    <Box sx={{ width: '100%', maxWidth: 320, p: 2 }}>
      {(title || onClose || onRefresh) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
            gap: 1,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
            {title ?? 'Home Storage'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {onRefresh && (
              <Tooltip title="Refresh storage">
                <span>
                  <IconButton
                    size="small"
                    onClick={onRefresh}
                    disabled={isLoading || isFetching}
                    aria-label="refresh storage"
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {onClose && (
              <IconButton size="small" onClick={onClose} aria-label="close storage details">
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      )}

      {errorMessage && !displayData ? (
        <Typography variant="body2" color="error">
          {errorMessage}
        </Typography>
      ) : !displayData && !isLoading ? (
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 1,
              mb: 1.25,
            }}
          >
            {isLoading ? (
              <>
                <Skeleton width={88} height={24} />
                <Skeleton width={140} height={20} />
              </>
            ) : (
              <>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {usage.toFixed(usage < 10 ? 1 : 0)}% full
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontFamily: tokens.typography.fontFamily.mono }}
                >
                  {fileSizeFormatter(displayData?.size ?? 0)} / {fileSizeFormatter(displayData?.quota ?? 0)}
                </Typography>
              </>
            )}
          </Box>

          <Box
            aria-hidden
            sx={{
              height: 8,
              borderRadius: tokens.borderRadius.fullCSS,
              overflow: 'hidden',
              display: 'flex',
              backgroundColor: trackColor,
              mb: 1.25,
            }}
          >
            {isLoading ? (
              <Skeleton variant="rectangular" width="100%" height={8} />
            ) : (
              <Box
                sx={{
                  width: `${usedPct}%`,
                  minWidth: usedPct > 0 ? 4 : 0,
                  backgroundColor: usedColor,
                  borderRadius: tokens.borderRadius.fullCSS,
                }}
              />
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {[
              { key: 'used', label: 'Used', color: usedColor },
              { key: 'available', label: 'Available', color: trackColor },
            ].map((item) => (
              <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '2px',
                    backgroundColor: item.color,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {sizeTotalsModifiedRelative && sizeTotalsModifiedRelative !== 'Unknown' && !isLoading && (
            <Box sx={{ mt: 1.5, color: 'text.secondary' }}>
              <Tooltip
                title={sizeTotalsModifiedAbsolute ? `${sizeTotalsModifiedAbsolute}` : 'Unknown'}
              >
                <Typography variant="caption">
                  Modified{' '}
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 600,
                      fontFamily: tokens.typography.fontFamily.mono,
                      color: 'text.primary',
                    }}
                  >
                    {sizeTotalsModifiedRelative}
                  </Box>
                </Typography>
              </Tooltip>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

/** Inline details used by the combined Usage panel. */
export function StorageSummaryBody(props: StorageSummaryBodyProps) {
  return <StorageDetailsPanel {...props} />;
}

export const UserStorageWidgetImpl = React.forwardRef<HTMLDivElement, UserStorageWidgetProps>(
  (
    {
      title = 'Home Storage',
      isLoading = false,
      isFetching = false,
      data = null,
      errorMessage,
      onRefresh,
      showRefreshButton = true,
      emptyMessage = 'No storage data available',
      dateFormatter = formatStorageDateLocalDefault,
      fileSizeFormatter = convertToFileSize,
    },
    ref,
  ) => {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const usage = data?.usage ?? 0;
    const usedColor = usageFillColor(usage, theme);
    const trackColor =
      theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300];
    const usedLabel = fileSizeFormatter(data?.size ?? 0);
    const quotaLabel = fileSizeFormatter(data?.quota ?? 0);
    const pctLabel = `${usage.toFixed(usage < 10 ? 1 : 0)}%`;

    const ariaLabel = errorMessage
      ? `${title} unavailable. ${errorMessage}`
      : isLoading
        ? `${title}, loading`
        : `${title}, ${pctLabel} full, ${usedLabel} of ${quotaLabel}. Show details.`;

    const handleClose = useCallback(() => {
      setAnchorEl(null);
    }, []);

    const handleToggle = useCallback((event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl((current) => (current ? null : event.currentTarget));
    }, []);

    return (
      <Box ref={ref} sx={{ display: 'inline-flex' }}>
        <Tooltip title={open ? '' : `${title} — click for details`} disableHoverListener={open}>
          <ButtonBase
            onClick={handleToggle}
            aria-label={ariaLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
            sx={{
              display: 'inline-flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 0.75,
              minHeight: 40,
              px: 1,
              py: 0.5,
              borderRadius: tokens.borderRadius.mdCSS,
              color: 'text.primary',
              transition: `transform ${tokens.transitions.press.duration} ${tokens.transitions.easing.easeOut}, background-color ${tokens.transitions.duration.fastCSS} ${tokens.transitions.easing.emphasized}`,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
              '&:active': {
                transform: `scale(${tokens.transitions.press.scale})`,
              },
              '@media (prefers-reduced-motion: reduce)': {
                '&:active': { transform: 'none' },
              },
            }}
          >
            <StorageRing
              usage={errorMessage && !data ? 0 : usage}
              isLoading={isLoading}
              usedColor={errorMessage && !data ? theme.palette.error.main : usedColor}
              trackColor={trackColor}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                fontFamily: tokens.typography.fontFamily.mono,
                lineHeight: 1,
                color: errorMessage && !data ? 'error.main' : 'text.secondary',
              }}
            >
              {isLoading ? '…' : errorMessage && !data ? '—' : pctLabel}
            </Typography>
          </ButtonBase>
        </Tooltip>

        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: { overflow: 'visible', width: 320 },
            },
          }}
        >
          <StorageDetailsPanel
            title={title}
            isLoading={isLoading}
            isFetching={isFetching}
            data={data}
            emptyMessage={emptyMessage}
            dateFormatter={dateFormatter}
            fileSizeFormatter={fileSizeFormatter}
            errorMessage={errorMessage}
            onClose={handleClose}
            onRefresh={showRefreshButton ? onRefresh : undefined}
          />
        </Popover>
      </Box>
    );
  },
);

UserStorageWidgetImpl.displayName = 'UserStorageWidgetImpl';

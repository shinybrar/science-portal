'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Box, Grid, Skeleton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DashboardWidget } from '@/app/components/DashboardWidget/DashboardWidget';
import {
  UserStorageWidgetProps,
  StorageData,
  StorageCardData,
} from '@/app/types/UserStorageWidgetProps';
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

// Utility functions
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

/** Relative time since totals were last modified (API instant → browser “now”). */
const formatRelativeStorageModified = (raw: string, nowMs: number): string => {
  const instant = parseStorageApiUtc(raw);
  if (!instant) return 'Unknown';
  return instant.from(dayjs(nowMs));
};

// Storage Card Component
interface StorageCardProps {
  label: string;
  value: string;
  isLoading: boolean;
  isWarning?: boolean;
}

const StorageCard: React.FC<StorageCardProps> = ({ label, value, isLoading, isWarning }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        borderRadius: 2,
        backgroundColor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        p: 2,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {isLoading ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Skeleton variant="text" width="30%" height={20} />
          <Skeleton variant="text" width="40%" height={20} />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Typography variant="body1" fontWeight="bold" color="text.primary">
            {label}:
          </Typography>
          <Typography
            variant="body1"
            fontWeight="bold"
            color={isWarning ? 'error.main' : 'primary.main'}
          >
            {value}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export const UserStorageWidgetImpl = React.forwardRef<HTMLDivElement, UserStorageWidgetProps>(
  (
    {
      title = 'User Home Storage',
      isLoading = false,
      isFetching = false,
      data = null,
      errorMessage,
      onRefresh,
      showRefreshButton = true,
      helpUrl,
      helpContent,
      showProgressIndicator = true,
      progressPercentage = 0,
      warningThreshold = 90,
      emptyMessage = 'No storage data available',
      dateFormatter = formatStorageDateLocalDefault,
      fileSizeFormatter = convertToFileSize,
      fillHeight = false,
    },
    ref,
  ) => {
    const theme = useTheme();

    const [relativeNowMs, setRelativeNowMs] = useState(() => Date.now());

    const displayData = isLoading ? null : data;

    // Card configuration
    const cardConfigs = useMemo(
      () => [
        {
          key: 'size' as keyof StorageData,
          label: 'Used',
          formatter: fileSizeFormatter,
        },
        {
          key: 'quota' as keyof StorageData,
          label: 'Quota',
          formatter: fileSizeFormatter,
        },
        {
          key: 'usage' as keyof StorageData,
          label: 'Usage',
          formatter: (val: number) => `${(val || 0).toFixed(1)}%`,
        },
      ],
      [fileSizeFormatter],
    );

    // Memoized card data
    const cardData: StorageCardData[] = useMemo(() => {
      return cardConfigs.map((config) => ({
        label: config.label,
        value: config.formatter((displayData?.[config.key] as number) ?? 0),
        isWarning:
          config.key === 'usage' &&
          displayData?.usage !== undefined &&
          displayData.usage > warningThreshold,
      }));
    }, [displayData, cardConfigs, warningThreshold]);

    const sizeTotalsModifiedAbsolute = useMemo(() => {
      return displayData?.date ? dateFormatter(displayData.date) : null;
    }, [displayData?.date, dateFormatter]);

    const sizeTotalsModifiedRelative = useMemo(() => {
      return displayData?.date ? formatRelativeStorageModified(displayData.date, relativeNowMs) : null;
    }, [displayData?.date, relativeNowMs]);

    useEffect(() => {
      if (!displayData?.date) return;
      setRelativeNowMs(Date.now());

      const intervalId = window.setInterval(() => {
        setRelativeNowMs(Date.now());
      }, 60000);

      return () => {
        window.clearInterval(intervalId);
      };
    }, [displayData?.date]);

    return (
      <DashboardWidget
        ref={ref}
        title={title}
        isLoading={isLoading}
        isFetching={isFetching}
        error={errorMessage}
        onRefresh={showRefreshButton ? onRefresh : undefined}
        refreshAriaLabel="refresh storage"
        refreshTooltip="Refresh storage"
        help={helpUrl || helpContent ? { url: helpUrl, content: helpContent } : undefined}
        showStatusBar={showProgressIndicator}
        statusValue={progressPercentage > 0 ? progressPercentage : 100}
        fillHeight={fillHeight}
        maxWidth={600}
      >
        {/* Storage Cards or Empty State */}
        {!displayData && !isLoading && !errorMessage ? (
          <Box
            sx={{
              flex: fillHeight ? 1 : undefined,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              py: fillHeight ? 0 : 4,
              color: theme.palette.text.secondary,
            }}
          >
            <Typography variant="body2">{emptyMessage}</Typography>
          </Box>
        ) : (
          <Box sx={{ mb: 2 }}>
            <Grid container spacing={2} direction="column">
              {cardData.map((card) => (
                <Grid size={12} key={card.label}>
                  <StorageCard
                    label={card.label}
                    value={card.value}
                    isLoading={isLoading}
                    isWarning={card.isWarning}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* When used size / quota totals last changed (VOSpace node mtime), not “last polled” */}
        {sizeTotalsModifiedRelative &&
          sizeTotalsModifiedRelative !== 'Unknown' &&
          !isLoading && (
            <Box
              sx={{
                textAlign: 'center',
                mt: 'auto',
                pt: 2,
                color: theme.palette.text.secondary,
              }}
            >
              <Tooltip
                title={
                  sizeTotalsModifiedAbsolute
                    ? `${sizeTotalsModifiedAbsolute}`
                    : 'Unknown'
                }
                arrow
              >
                <Typography variant="caption" sx={{ fontSize: '10px' }}>
                  Modified{' '}
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: 'primary.500',
                    }}
                  >
                    {sizeTotalsModifiedRelative}
                  </Typography>
                  {'.'}
                </Typography>
              </Tooltip>
            </Box>
          )}

      </DashboardWidget>
    );
  },
);

UserStorageWidgetImpl.displayName = 'UserStorageWidgetImpl';

'use client';

import React, { useMemo } from 'react';
import { Typography, Box, Stack } from '@mui/material';
import { WarningAmber as WarningAmberIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { PlatformLoadProps, type PlatformLoadData } from '../types/PlatformLoadProps';
import { DashboardWidget } from '@/app/components/DashboardWidget/DashboardWidget';
import { MetricBlock } from '../components/MetricBlock/MetricBlock';
import { PLATFORM_LOAD_DISABLED_MESSAGE } from '@/lib/config/static-platform-load';
import { tokens } from '@/app/design-system/tokens';

export const PLATFORM_STATS_UNAVAILABLE = 'Platform statistics unavailable';

function formatPlatformTimestamp(lastUpdate: string | Date): string {
  const dateStr = typeof lastUpdate === 'string' ? lastUpdate : lastUpdate.toISOString();
  return dateStr.replace('T', ' ').slice(0, -5) + ' UTC';
}

export function PlatformMetricsSection({
  data,
  isLoading = false,
}: {
  data: PlatformLoadData | null;
  isLoading?: boolean;
}) {
  const formattedLastUpdate = useMemo(() => {
    if (!data?.lastUpdate) return null;
    return formatPlatformTimestamp(data.lastUpdate);
  }, [data?.lastUpdate]);

  if (!data && !isLoading) {
    return (
      <Typography variant="body1" color="text.secondary">
        {PLATFORM_STATS_UNAVAILABLE}
      </Typography>
    );
  }

  if (!data) {
    return (
      <Stack spacing={1}>
        <MetricBlock label="CPU" series={{ name: 'CPU', used: 0, free: 0 }} max={1} isLoading />
        <MetricBlock label="RAM" series={{ name: 'RAM', used: 0, free: 0 }} max={1} isLoading />
      </Stack>
    );
  }

  return (
    <>
      <Stack spacing={1}>
        <MetricBlock label="CPU" series={data.cpu} max={data.maxValues.cpu} isLoading={isLoading} />
        <MetricBlock label="RAM" series={data.ram} max={data.maxValues.ram} isLoading={isLoading} />
      </Stack>
      {formattedLastUpdate && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Last update:{' '}
            <Typography
              component="span"
              variant="caption"
              sx={{
                fontWeight: 600,
                fontFamily: tokens.typography.fontFamily.mono,
                color: 'primary.500',
              }}
            >
              {formattedLastUpdate}
            </Typography>
          </Typography>
        </Box>
      )}
    </>
  );
}

/**
 * PlatformLoad implementation component
 */
export const PlatformLoadImpl: React.FC<PlatformLoadProps> = ({
  data,
  isLoading = false,
  onRefresh,
  className,
  title = 'Platform Load',
  showDisabledOverlay = false,
}) => {
  const theme = useTheme();
  const effectiveLoading = showDisabledOverlay ? false : isLoading;

  const metricsContent = (
    <PlatformMetricsSection data={data} isLoading={effectiveLoading} />
  );

  return (
    <DashboardWidget
      className={className}
      title={title}
      isLoading={effectiveLoading}
      onRefresh={showDisabledOverlay ? undefined : onRefresh}
    >
      <Box sx={{ marginBottom: theme.spacing(2), position: 'relative' }}>
        {showDisabledOverlay ? (
          <>
            <Box
              sx={{
                opacity: 0.32,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {metricsContent}
            </Box>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                px: 2,
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(44, 44, 46, 0.82)'
                    : 'rgba(255, 255, 255, 0.82)',
                borderRadius: tokens.borderRadius.mdCSS,
                zIndex: 5,
              }}
            >
              <WarningAmberIcon
                sx={{
                  color: 'warning.main',
                  fontSize: 28,
                  mb: 1.25,
                }}
                aria-hidden
              />
              <Typography
                variant="body1"
                sx={{
                  lineHeight: 1.4,
                  color: 'text.primary',
                  fontWeight: 500,
                  maxWidth: '90%',
                }}
              >
                {PLATFORM_LOAD_DISABLED_MESSAGE}
              </Typography>
            </Box>
          </>
        ) : (
          metricsContent
        )}
      </Box>
    </DashboardWidget>
  );
};

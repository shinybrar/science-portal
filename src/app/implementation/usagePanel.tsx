'use client';

import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DashboardWidget } from '@/app/components/DashboardWidget/DashboardWidget';
import { StorageSummaryBody } from '@/app/implementation/userStorageWidget';
import {
  PlatformMetricsSection,
  PLATFORM_STATS_UNAVAILABLE,
} from '@/app/implementation/platformLoad';
import type { UsagePanelProps } from '@/app/types/UsagePanelProps';
import { tokens } from '@/app/design-system/tokens';

const USAGE_HELP = (
  <>
    Platform shows how full the cluster is (capacity versus allocated). Home storage is your
    VOSpace quota. Compute reservations from the Metrics service will appear in this same panel.
  </>
);

function UsageSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box component="section" sx={{ '&:not(:last-child)': { mb: 2.5 } }}>
      <Typography
        variant="overline"
        component="h3"
        sx={{ display: 'block', mb: 1, color: 'text.secondary' }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function UsagePanelImpl({
  platform,
  platformLoading = false,
  platformError,
  storage,
  storageLoading = false,
  storageError,
  isFetching = false,
  onRefresh,
  fillHeight = false,
  help,
}: UsagePanelProps) {
  const theme = useTheme();
  const isBusy = platformLoading || storageLoading;

  return (
    <DashboardWidget
      title="Usage"
      isLoading={isBusy}
      isFetching={isFetching}
      onRefresh={onRefresh}
      refreshAriaLabel="refresh usage"
      refreshTooltip="Refresh usage"
      help={help ?? { content: USAGE_HELP, title: 'Usage' }}
      fillHeight={fillHeight}
    >
      <UsageSection title="Platform">
        {platformError && !platform ? (
          <Typography variant="body1" color="text.secondary">
            {PLATFORM_STATS_UNAVAILABLE}
          </Typography>
        ) : (
          <PlatformMetricsSection data={platform} isLoading={platformLoading} />
        )}
      </UsageSection>

      <Box
        aria-hidden
        sx={{
          height: '1px',
          mb: 2.5,
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }}
      />

      <UsageSection title="Home Storage">
        {storageError && !storage ? (
          <Typography variant="body2" color="error">
            {storageError}
          </Typography>
        ) : (
          <StorageSummaryBody isLoading={storageLoading} data={storage} />
        )}
      </UsageSection>

      <Box
        aria-hidden
        sx={{
          height: '1px',
          mb: 2.5,
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }}
      />

      <UsageSection title="Compute">
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontSize: tokens.typography.fontSize.lg }}
        >
          Session compute reservations will appear here.
        </Typography>
      </UsageSection>
    </DashboardWidget>
  );
}

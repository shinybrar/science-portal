'use client';

import React, { useMemo } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { MetricBlockProps } from '../types/MetricBlockProps';
import { BarChartHorizontal } from '../components/BarChartHorizontal/BarChartHorizontal';

/**
 * MetricBlock implementation component
 */
// Memoized to prevent re-renders when parent re-renders
// MetricBlock only needs to re-render when its props change
export const MetricBlockImpl: React.FC<MetricBlockProps> = React.memo(
  ({ label, series, max, isLoading = false, className }) => {
    const theme = useTheme();

    // Memoized calculations to prevent recalculation on every render
    const displayTitle = useMemo(() => {
      // Format based on label type
      if (label === 'CPU') {
        return `Available CPUs: ${series.free} / ${max}`;
      } else {
        // RAM - Values are already in GB from the API
        return `Available RAM: ${series.free}GB / ${max}GB`;
      }
    }, [series.free, max, label]);

    // Define colors based on metric type
    const chartColors = useMemo(() => {
      const free =
        theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300];

      if (label === 'CPU') {
        return {
          used: theme.palette.primary.main,
          free,
        };
      }

      if (label === 'RAM') {
        return {
          used: theme.palette.warning.main,
          free,
        };
      }

      return {
        used: theme.palette.primary.dark,
        free: theme.palette.primary.main,
        headless: theme.palette.primary.light,
      };
    }, [label, theme]);

    // Define legend items based on metric type
    const legendItems = useMemo(() => {
      return [
        { key: 'used', label: 'used', color: chartColors.used },
        { key: 'free', label: 'free', color: chartColors.free },
      ];
    }, [chartColors]);

    // Define stack keys based on metric type
    const stackKeys = useMemo(() => {
      return ['used', 'free'];
    }, []);

    return (
      <Box className={className} sx={{ marginBottom: theme.spacing(2) }}>
        {isLoading ? (
          <Skeleton
            variant="rectangular"
            width="100%"
            height={60}
            sx={{
              borderRadius: 1,
            }}
          />
        ) : (
          <BarChartHorizontal
            title={displayTitle}
            data={[series]}
            total={max}
            height={60}
            barSize={25}
            colors={chartColors}
            legend={{
              show: true,
              position: 'top',
              items: legendItems,
            }}
            stackKeys={stackKeys}
            margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
          />
        )}
      </Box>
    );
  },
);

MetricBlockImpl.displayName = 'MetricBlockImpl';

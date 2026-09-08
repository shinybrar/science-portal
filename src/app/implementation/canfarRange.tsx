'use client';

import React from 'react';
import { Slider, Box, useTheme } from '@mui/material';
import { CanfarRangeProps } from '@/app/types/CanfarRangeProps';

export const CanfarRangeImpl = React.forwardRef<HTMLDivElement, CanfarRangeProps>(
  (
    { value, min, max, step = 1, marks, onChange, onChangeCommitted, disabled = false, label, valueText, valueMin, valueMax, valueNow },
    ref,
  ) => {
    const theme = useTheme();

    const [lo, hi] = min > max ? [max, min] : [min, max];
    const clamped = Math.min(Math.max(value, lo), hi);

    const handleChange = (_event: Event, newValue: number | number[]) => {
      const next = Array.isArray(newValue) ? newValue[0] : newValue;
      onChange(next);
    };

    const handleCommitted = (
      _event: Event | React.SyntheticEvent,
      newValue: number | number[],
    ) => {
      if (!onChangeCommitted) return;
      const next = Array.isArray(newValue) ? newValue[0] : newValue;
      onChangeCommitted(next);
    };

    return (
      <Box ref={ref} sx={{ width: '100%' }}>
        <Slider
          size="small"
          value={clamped}
          min={lo}
          max={hi}
          step={step}
          marks={marks}
          onChange={handleChange}
          onChangeCommitted={handleCommitted}
          disabled={disabled || lo === hi}
          aria-label={label}
          slotProps={{
            input: {
              'aria-valuemin': valueMin ?? lo,
              'aria-valuemax': valueMax ?? hi,
              'aria-valuenow': valueNow ?? clamped,
              'aria-valuetext': valueText ?? `${clamped} out of ${hi}`,
            },
          }}
          sx={{
            color: theme.palette.primary.main,
            height: 4,
            py: '10px',
            px: 0,
            '& .MuiSlider-track': { border: 'none', height: 4 },
            '& .MuiSlider-thumb': {
              height: 14,
              width: 14,
              backgroundColor: theme.palette.primary.main,
              border: `2px solid ${theme.palette.background.paper}`,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.18)',
              '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.22)',
              },
              '&:before': { display: 'none' },
            },
            '& .MuiSlider-rail': {
              color:
                theme.palette.mode === 'dark'
                  ? theme.palette.grey[700]
                  : theme.palette.grey[300],
              opacity: 1,
              height: 4,
            },
            '& .MuiSlider-mark': {
              width: 2,
              height: 4,
              borderRadius: 0.5,
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? theme.palette.grey[500]
                  : theme.palette.grey[400],
            },
            '& .MuiSlider-markActive': {
              backgroundColor: theme.palette.primary.contrastText,
              opacity: 0.72,
            },
          }}
        />
      </Box>
    );
  },
);

CanfarRangeImpl.displayName = 'CanfarRangeImpl';

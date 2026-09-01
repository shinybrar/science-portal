'use client';

import React from 'react';
import { LinearProgress as MuiLinearProgress } from '@mui/material';
import { LinearProgressProps } from '../types/LinearProgressProps';

/**
 * LinearProgress implementation component
 * Wraps Material-UI LinearProgress with sensible defaults for indeterminate progress
 */
export const LinearProgressImpl: React.FC<LinearProgressProps> = (props) => {
  const {
    variant = 'indeterminate',
    color = 'primary',
    value,
    valueBuffer,
    sx,
    ...otherProps
  } = props;

  return (
    <MuiLinearProgress
      variant={variant}
      color={color}
      value={value}
      valueBuffer={valueBuffer}
      sx={{
        height: 4,
        borderRadius: '9999px',
        '& .MuiLinearProgress-bar': {
          borderRadius: '9999px',
        },
        ...sx,
      }}
      {...otherProps}
    />
  );
};

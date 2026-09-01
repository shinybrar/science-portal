'use client';

import { Tooltip as MuiTooltip, useTheme } from '@mui/material';
import { TooltipProps } from '@/app/types/TooltipProps';
import React from 'react';
import type { Theme } from '@mui/material/styles';
import '@/app/theme/createTheme';

export const TooltipImpl: React.FC<TooltipProps> = ({
  onClick,
  clickable = false,
  children,
  placement = 'top',
  arrow = false,
  enterDelay = 100,
  leaveDelay = 0,
  ...props
}) => {
  const theme = useTheme() as Theme;

  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  const tooltipStyles = {
    maxWidth: 300,
  };

  const popperStyles = {
    zIndex: theme.zIndex.tooltip,
  };

  const tooltipComponent = (
    <MuiTooltip
      placement={placement}
      arrow={arrow}
      enterDelay={enterDelay}
      leaveDelay={leaveDelay}
      componentsProps={{
        tooltip: {
          sx: tooltipStyles,
        },
        popper: {
          sx: popperStyles,
        },
      }}
      TransitionProps={{
        timeout: {
          enter: 200,
          exit: 100,
        },
      }}
      {...props}
    >
      {children}
    </MuiTooltip>
  );

  if (clickable && React.isValidElement(children)) {
    const wrappedChild = (
      <span onClick={handleClick} style={{ cursor: 'pointer', display: 'inline-flex' }}>
        {children}
      </span>
    );

    return React.cloneElement(tooltipComponent, {
      children: wrappedChild,
    });
  }

  return tooltipComponent;
};

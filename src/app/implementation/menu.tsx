'use client';

import { Menu as MuiMenu, useTheme } from '@mui/material';
import { MenuProps } from '@/app/types/MenuProps';
import React from 'react';
import '@/app/theme/createTheme'; // Import for theme type augmentation

const useVariantStyles = (variant: 'default' | 'compact') => {
  const theme = useTheme();

  if (variant === 'compact') {
    return {
      '& .MuiMenuItem-root': {
        minHeight: 36,
        fontSize: theme.customTypography?.fontSize?.sm || theme.typography.fontSize,
      },
    };
  }

  return {};
};

export const MenuImpl: React.FC<MenuProps> = ({ variant = 'default', ...props }) => {
  const theme = useTheme();
  const styles = useVariantStyles(variant);

  return (
    <MuiMenu
      sx={{
        fontFamily: theme.typography.fontFamily,
        ...styles,
      }}
      {...props}
    />
  );
};

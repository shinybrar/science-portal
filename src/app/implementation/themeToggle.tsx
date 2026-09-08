'use client';

import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { ThemeToggleProps } from '@/app/types/ThemeToggleProps';
import { useSafeTheme, type ThemePreference } from '@/app/theme/ThemeContext';
import { Menu } from '@/app/components/Menu/Menu';
import { MenuItem } from '@/app/components/MenuItem/MenuItem';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof LightModeIcon }[] = [
  { value: 'light', label: 'Light', Icon: LightModeIcon },
  { value: 'dark', label: 'Dark', Icon: DarkModeIcon },
  { value: 'system', label: 'System', Icon: SettingsBrightnessIcon },
];

const BUTTON_SIZE = { sm: 'small', md: 'medium', lg: 'large' } as const;
const ICON_PX = { sm: '1rem', md: '1.25rem', lg: '1.5rem' };

export const ThemeToggleImpl: React.FC<ThemeToggleProps> = ({ size = 'md' }) => {
  const { preference, setTheme } = useSafeTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const Icon = OPTIONS.find((option) => option.value === preference)?.Icon ?? LightModeIcon;

  return (
    <>
      <Tooltip title="Theme">
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          size={BUTTON_SIZE[size]}
          aria-label="Theme"
          aria-haspopup="menu"
          aria-expanded={open ? 'true' : undefined}
          aria-controls={open ? 'theme-menu' : undefined}
        >
          <Icon sx={{ fontSize: ICON_PX[size] }} />
        </IconButton>
      </Tooltip>
      <Menu
        id="theme-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={preference === option.value}
            icon={<option.Icon fontSize="small" />}
            onClick={() => {
              setTheme(option.value);
              setAnchorEl(null);
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

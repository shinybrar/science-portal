'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { createTheme, ThemeMode } from './createTheme';
import type { Theme } from '@mui/material/styles';

export type ThemePreference = ThemeMode | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  preference: ThemePreference;
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function systemMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveMode(preference: ThemePreference): ThemeMode {
  return preference === 'system' ? systemMode() : preference;
}

export const useSafeTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      mode: 'light',
      preference: 'light',
      setTheme: () => {
        console.warn('ThemeProvider not found, theme change disabled');
      },
    };
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
  storageKey?: string;
  theme?: Theme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'light',
  storageKey = 'canfar-ui-theme',
  theme: customTheme,
}) => {
  const [preference, setPreference] = useState<ThemePreference>(defaultMode);
  const [mode, setMode] = useState<ThemeMode>(defaultMode);

  useEffect(() => {
    setPreference(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    if (storageKey.startsWith('storybook-')) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (isThemePreference(saved)) {
        setPreference(saved);
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
  }, [storageKey]);

  useEffect(() => {
    setMode(resolveMode(preference));
    if (preference !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setMode(systemMode());
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const persist = useCallback(
    (next: ThemePreference) => {
      if (storageKey.startsWith('storybook-')) return;
      try {
        localStorage.setItem(storageKey, next);
      } catch (error) {
        console.warn('Failed to save theme to localStorage:', error);
      }
    },
    [storageKey],
  );

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setPreference(next);
      persist(next);
    },
    [persist],
  );

  const theme = customTheme || createTheme(mode);

  return (
    <ThemeContext.Provider value={{ mode, preference, setTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

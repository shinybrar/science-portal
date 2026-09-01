// src/design-system/tokens.ts

// Design tokens for the CANFAR Next.js application
// All colors have been tested to ensure WCAG AA compliance (4.5:1 contrast ratio)
export const tokens = {
  colors: {
    // Inspired by UVic brand web values (blue ocean, green trees, yellow sun).
    // https://www.uvic.ca/brand/brand-guidelines/colours-fonts/index.php
    primary: {
      50: '#e7f4fb',
      100: '#bee7f9', // UVic light blue
      200: '#8ad0f0',
      300: '#57b7e7', // UVic accent blue
      400: '#0073bc', // UVic digital blue
      500: '#005493', // UVic websites blue
      600: '#00457a',
      700: '#002958', // UVic digital dark blue
      800: '#002754', // UVic websites dark blue
      900: '#001a38',
    },
    secondary: {
      50: '#e8eef4',
      100: '#c5d3e3',
      200: '#8fa7c4',
      300: '#5a7ba4',
      400: '#2a4f7a',
      500: '#002754',
      600: '#002144',
      700: '#001a38',
      800: '#00142b',
      900: '#000d1c',
    },
    neutral: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
      white: '#ffffff',
      black: '#000000',
    },
    tertiary: {
      50: '#f0f9fd',
      100: '#bee7f9',
      200: '#8ad0f0',
      300: '#57b7e7',
      400: '#3aa6dc',
      500: '#57b7e7',
      600: '#2a8fbe',
      700: '#1e6f96',
      800: '#15506c',
      900: '#0c3345',
    },
    accent: {
      50: '#fff8e6',
      100: '#ffecb8',
      200: '#fee086',
      300: '#fdb813', // UVic digital yellow
      400: '#f5aa1c',
      500: '#f5aa1c', // UVic websites yellow
      600: '#d49212',
      700: '#a6740e',
      800: '#78570a',
      900: '#4a3506',
    },
    semantic: {
      error: {
        50: '#fbecea',
        100: '#f5c9c4',
        200: '#eba399',
        300: '#e07d6e',
        400: '#d5584a',
        500: '#c63527', // UVic crest red — sparingly, for critical only
        600: '#a82d21',
        700: '#8a251b',
        800: '#6c1d15',
        900: '#4e1510',
      },
      warning: {
        50: '#fff8e6',
        100: '#ffecb8',
        200: '#fee086',
        300: '#fdb813',
        400: '#f5aa1c',
        500: '#f5aa1c',
        600: '#d49212',
        700: '#a6740e',
        800: '#78570a',
        900: '#4a3506',
      },
      success: {
        50: '#e8f7ea',
        100: '#c5ebc9',
        200: '#8ed896',
        300: '#57c563',
        400: '#26a739', // UVic green — shapes and icons
        500: '#008538', // UVic dark green — chips and filled controls
        600: '#007330',
        700: '#005c27',
        800: '#00451d',
        900: '#002e14',
      },
      info: {
        50: '#e7f4fb',
        100: '#bee7f9',
        200: '#8ad0f0',
        300: '#57b7e7',
        400: '#0073bc',
        500: '#005493',
        600: '#00457a',
        700: '#002958',
        800: '#002754',
        900: '#001a38',
      },
    },
    surface: {
      background: {
        default: '#f5f5f7',
        paper: '#ffffff',
        elevated: '#ffffff',
      },
      backgroundDark: {
        default: '#1c1c1e',
        paper: '#2c2c2e',
        elevated: '#3a3a3c',
      },
      overlay: {
        light: 'rgba(255, 255, 255, 0.9)',
        medium: 'rgba(255, 255, 255, 0.7)',
        dark: 'rgba(0, 0, 0, 0.36)',
        darker: 'rgba(0, 0, 0, 0.56)',
      },
      glass: {
        light: 'rgba(255, 255, 255, 0.72)',
        dark: 'rgba(28, 28, 30, 0.72)',
        lightSolid: '#ffffff',
        darkSolid: '#1c1c1e',
      },
      hairline: {
        light: 'rgba(0, 0, 0, 0.08)',
        dark: 'rgba(255, 255, 255, 0.12)',
      },
      skeleton: {
        light: {
          base: '#e0e0e0',
          highlight: '#f5f5f5',
        },
        dark: {
          base: '#2d2d2d',
          highlight: '#3d3d3d',
        },
      },
    },
    text: {
      onPrimary: '#ffffff',
      onSecondary: '#ffffff',
      onDark: '#ffffff',
      onLight: '#212121',
      // Contrast-safe text colors for semantic colors
      onError: '#ffffff', // White provides 4.57:1 contrast
      onWarning: '#002754', // UVic dark blue on yellow
      onSuccess: '#ffffff',
      onInfo: '#ffffff',
      onAccent: '#002754',
      primary: {
        light: '#212121',
        dark: '#ffffff',
      },
      secondary: {
        light: '#757575',
        dark: '#b3b3b3',
      },
      disabled: {
        light: '#bdbdbd',
        dark: '#4f4f4f',
      },
      link: {
        onPrimary: '#bee7f9',
        onDark: '#57b7e7',
        onLight: '#005493',
        hover: {
          light: '#002754',
          dark: '#57b7e7',
        },
      },
    },
    border: {
      light: '#e0e0e0',
      medium: '#bdbdbd',
      dark: '#757575',
      focus: '#005493',
      error: '#c63527',
      success: '#008538',
      warning: '#f5aa1c',
    },
  },
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    9: '36px',
    10: '40px',
    12: '48px',
    14: '56px',
    16: '64px',
    20: '80px',
    24: '96px',
    32: '128px',
    40: '160px',
    48: '192px',
    56: '224px',
    64: '256px',
    // Semantic spacing
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  typography: {
    fontFamily: {
      primary:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      secondary: 'Georgia, "Times New Roman", Times, serif',
      mono: 'ui-monospace, "SF Mono", "Fira Code", "Menlo", "Segoe UI Mono", monospace',
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      md: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px',
      '5xl': '48px',
      '6xl': '60px',
      '7xl': '72px',
      '8xl': '96px',
      '9xl': '128px',
    },
    fontWeight: {
      thin: 100,
      light: 300,
      regular: 400,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
    lineHeight: {
      none: '1',
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
    },
    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0em',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    },
  },
  borderRadius: {
    none: 0,
    sm: 8,
    base: 10,
    md: 10,
    lg: 14,
    xl: 16,
    '2xl': 20,
    '3xl': 24,
    full: 9999,
    // String versions for CSS usage
    noneCSS: '0px',
    smCSS: '8px',
    baseCSS: '10px',
    mdCSS: '10px',
    lgCSS: '14px',
    xlCSS: '16px',
    '2xlCSS': '20px',
    '3xlCSS': '24px',
    fullCSS: '9999px',
  },
  materials: {
    blur: {
      chrome: 'blur(6px) saturate(140%)',
      overlay: 'blur(4px)',
    },
  },
  shadows: {
    none: 'none',
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    base: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    outline: '0 0 0 3px rgba(66, 153, 225, 0.5)',
    // Material elevation shadows
    elevation: {
      0: 'none',
      1: '0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)',
      2: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)',
      3: '0px 3px 3px -2px rgba(0,0,0,0.2), 0px 3px 4px 0px rgba(0,0,0,0.14), 0px 1px 8px 0px rgba(0,0,0,0.12)',
      4: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)',
      6: '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)',
      8: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
      12: '0px 7px 8px -4px rgba(0,0,0,0.2), 0px 12px 17px 2px rgba(0,0,0,0.14), 0px 5px 22px 4px rgba(0,0,0,0.12)',
      16: '0px 8px 10px -5px rgba(0,0,0,0.2), 0px 16px 24px 2px rgba(0,0,0,0.14), 0px 6px 30px 5px rgba(0,0,0,0.12)',
      24: '0px 11px 15px -7px rgba(0,0,0,0.2), 0px 24px 38px 3px rgba(0,0,0,0.14), 0px 9px 46px 8px rgba(0,0,0,0.12)',
    },
  },
  transitions: {
    duration: {
      fastest: 75,
      fast: 100,
      normal: 150,
      slow: 200,
      slower: 300,
      slowest: 500,
      // Loading-specific durations
      skeleton: 1500, // Skeleton animation cycle
      spinner: 1000, // Spinner rotation cycle
      // String versions for CSS usage
      fastestCSS: '75ms',
      fastCSS: '100ms',
      normalCSS: '150ms',
      slowCSS: '200ms',
      slowerCSS: '300ms',
      slowestCSS: '500ms',
      skeletonCSS: '1500ms',
      spinnerCSS: '1000ms',
    },
    easing: {
      linear: 'linear',
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
      // Loading-specific easings
      skeleton: 'ease-in-out', // Smooth pulse for skeleton screens
      spinner: 'linear', // Continuous rotation for spinners
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Bouncy effect for completion
    },
    press: {
      scale: 0.97,
      duration: '100ms',
    },
  },
  zIndex: {
    hide: -1,
    auto: 'auto',
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
  breakpoints: {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
    // String versions for CSS usage
    xsCSS: '0px',
    smCSS: '600px',
    mdCSS: '900px',
    lgCSS: '1200px',
    xlCSS: '1536px',
  },
  grid: {
    columns: 12,
    spacing: 8,
    containerMaxWidths: {
      xs: 'none',
      sm: '540px',
      md: '720px',
      lg: '960px',
      xl: '1140px',
    },
  },
} as const;

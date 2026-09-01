import { Inter, JetBrains_Mono, Source_Serif_4 } from 'next/font/google';

/**
 * Dual type system: sans for UI chrome, serif for editorial body, mono for
 * technical snippets. Loaded as CSS variables so MUI tokens and Tailwind
 * can share the same families without changing the color palette.
 */
export const fontSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const fontSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['400', '600'],
});

export const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400'],
});

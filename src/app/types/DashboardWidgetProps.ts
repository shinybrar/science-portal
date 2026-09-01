import type { Ref, ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Help affordance for a dashboard widget header.
 *
 * - `url` renders an external-link icon next to the title.
 * - `content` (when no `url`) renders an icon button that opens a popover.
 */
export interface DashboardWidgetHelp {
  /** External documentation link; takes precedence over `content`. */
  url?: string;
  /** Popover body shown when no `url` is provided. */
  content?: ReactNode;
  /** Popover heading; defaults to the widget title. */
  title?: string;
}

/**
 * Props for the universal dashboard widget shell.
 *
 * The shell owns the chrome every portal widget shares: outlined Paper,
 * header (title + help + refresh), status bar, error alert, optional footer.
 * Everything domain-specific — data fetching hooks, store wiring, content,
 * empty states, and modals — is composed in by the caller as `children`.
 */
export interface DashboardWidgetProps {
  /** Widget heading, rendered as an `h2`. */
  title: ReactNode;
  /**
   * Initial load (React Query `isLoading`): no data yet. The caller should
   * render skeleton children; the shell shows the indeterminate status bar
   * and disables the refresh button.
   */
  isLoading?: boolean;
  /**
   * Background refetch (React Query `isFetching`): data is already shown.
   * Content stays as-is; the shell only animates the status bar and disables
   * the refresh button while the fetch is in flight.
   */
  isFetching?: boolean;
  /** Error message; renders an error alert above the header. */
  error?: ReactNode;
  /** Arbitrary alert/banner node rendered above the header (e.g. info alerts). */
  alert?: ReactNode;
  /** When provided, renders the refresh icon button in the header. */
  onRefresh?: () => void;
  /** Accessible name for the refresh button. @default 'refresh' */
  refreshAriaLabel?: string;
  /** Optional tooltip for the refresh button. */
  refreshTooltip?: string;
  /** Help link or popover next to the title. */
  help?: DashboardWidgetHelp;
  /** Extra controls on the header’s trailing edge, before refresh. */
  headerActions?: ReactNode;
  /** Show the linear status bar under the header. @default true */
  showStatusBar?: boolean;
  /**
   * Determinate status-bar value shown when not loading.
   * @default 100 (full success bar)
   */
  statusValue?: number;
  /** Caption row rendered below the content. */
  footer?: ReactNode;
  /** Stretch to fill the parent's height (flex column layout). */
  fillHeight?: boolean;
  /** Optional cap on the widget width (e.g. 600 for the storage widget). */
  maxWidth?: number | string;
  /** Extra styles merged onto the Paper root. */
  sx?: SxProps<Theme>;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  /** Widget body: content, empty states, and any attached modals. */
  children: ReactNode;
}

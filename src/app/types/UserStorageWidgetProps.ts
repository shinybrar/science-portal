export interface StorageData {
  /** Size in bytes of used storage */
  size: number;
  /** Quota in bytes for total storage */
  quota: number;
  /** Date string of last update */
  date: string;
  /** Usage percentage (0-100) */
  usage: number;
}

export interface StorageCardData {
  /** Display label for the storage metric */
  label: string;
  /** Formatted value to display */
  value: string;
  /** Whether this metric represents an over-quota warning */
  isWarning?: boolean;
}

/**
 * Presentational widget: data is fetched by the feature component (e.g.
 * `SessionsDashboard` via `useUserStorageSummary`) and passed in as props,
 * matching the other dashboard widgets.
 */
export interface UserStorageWidgetProps {
  /** Title for the widget */
  title?: string;
  /** Initial load — renders skeleton cards and animates the status bar. */
  isLoading?: boolean;
  /** Background refetch — keeps content, only animates the status bar. */
  isFetching?: boolean;
  /** Storage data to display */
  data?: StorageData | null;
  /** Fetch error; rendered by DashboardWidget. Distinct from the empty state. */
  errorMessage?: string;
  /** Callback for refresh button */
  onRefresh?: () => void;
  /** Show refresh button */
  showRefreshButton?: boolean;
  /** Help URL for additional information */
  helpUrl?: string;
  /** Custom help content */
  helpContent?: React.ReactNode;
  /** Show progress indicator */
  showProgressIndicator?: boolean;
  /** Progress percentage (0-100) when not loading */
  progressPercentage?: number;
  /** Usage threshold for warning (default: 90) */
  warningThreshold?: number;
  /** Custom empty message when no data */
  emptyMessage?: string;
  /** Custom date formatter */
  dateFormatter?: (date: string) => string;
  /** Custom file size formatter */
  fileSizeFormatter?: (bytes: number) => string;
  /** When true, stretch to match the Active Sessions panel height on desktop. */
  fillHeight?: boolean;
}

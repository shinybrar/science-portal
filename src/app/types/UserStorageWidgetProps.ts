export interface StorageData {
  /** Size in bytes of used storage */
  size: number;
  /** Quota in bytes for total storage */
  quota: number;
  /** Date string of last update */
  date: string;
  /** Usage percentage (0-100) */
  usage: number;
  /** Session mount path, e.g. `/arc/home/user/`. */
  path?: string;
}

export interface UserStorageWidgetProps {
  title?: string;
  isLoading?: boolean;
  isFetching?: boolean;
  data?: StorageData | null;
  /** Fetch error; shown in the storage popover / ring. Distinct from the empty state. */
  errorMessage?: string;
  onRefresh?: () => void;
  showRefreshButton?: boolean;
  emptyMessage?: string;
  dateFormatter?: (date: string) => string;
  fileSizeFormatter?: (bytes: number) => string;
}

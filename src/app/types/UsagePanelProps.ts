import type { UserStorageSummary } from '@/lib/api/storage';
import type { PlatformLoadData } from '@/app/types/PlatformLoadProps';
import type { DashboardWidgetHelp } from '@/app/types/DashboardWidgetProps';

export interface UsagePanelProps {
  platform: PlatformLoadData | null;
  platformLoading?: boolean;
  platformError?: string;
  storage: UserStorageSummary | null;
  storageLoading?: boolean;
  storageError?: string;
  isFetching?: boolean;
  onRefresh?: () => void;
  fillHeight?: boolean;
  help?: DashboardWidgetHelp;
}

import { SessionCardProps } from './SessionCardProps';

export interface ActiveSessionsWidgetProps {
  sessions: SessionCardProps[];
  /** Sessions with an in-flight mutation, keyed by session id. */
  operatingSessionIds?: Map<string, 'delete' | 'renew'>;
  /** Initial load — renders skeleton cards and animates the status bar. */
  isLoading?: boolean;
  /** Background refetch — keeps content, only animates the status bar. */
  isFetching?: boolean;
  /** Fetch error; rendered by DashboardWidget. Distinct from the empty list. */
  errorMessage?: string;
  onRefresh?: () => void;
  title?: string;
  showSessionCount?: boolean;
  maxSessionsToShow?: number;
  emptyMessage?: string;
  /** When true, stretch to match the User Home Storage panel height on desktop. */
  fillHeight?: boolean;
}

import type { ReactNode } from 'react';
import { SessionCardProps } from './SessionCardProps';

export interface ActiveSessionsWidgetProps {
  sessions: SessionCardProps[];
  /** Sessions with an in-flight mutation, keyed by session id. */
  operatingSessionIds?: Map<string, 'delete' | 'renew'>;
  /** Initial load — renders skeleton cards and animates the status bar. */
  isLoading?: boolean;
  /** Background refetch — keeps content, only animates the status bar. */
  isFetching?: boolean;
  onRefresh?: () => void;
  title?: string;
  showSessionCount?: boolean;
  maxSessionsToShow?: number;
  emptyMessage?: string;
  /** Extra header controls (e.g. home-storage ring). */
  headerActions?: ReactNode;
  /** When true, stretch to match a sibling panel height on desktop. */
  fillHeight?: boolean;
}

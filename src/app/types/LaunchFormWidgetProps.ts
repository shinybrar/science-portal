import { SessionLaunchFormProps } from './SessionLaunchFormProps';
import type { Session, SessionLaunchParams } from '@/lib/api/skaha';

export interface LaunchFormWidgetProps extends SessionLaunchFormProps {
  /** Initial load — renders the form skeleton and animates the status bar. */
  isLoading?: boolean;
  /** Background refetch — keeps the form, only animates the status bar. */
  isFetching?: boolean;
  /**
   * Catalog fetch error (images / repositories / context). Shown on the widget
   * shell — not the same as a launch-mutation error in SessionRequestModal.
   */
  errorMessage?: string | null;
  onRefresh?: () => void;
  title?: string;
  showProgressIndicator?: boolean;
  progressPercentage?: number;
  helpUrl?: string;
  /** When set (e.g. logged-out empty state), shows an info alert above the form. */
  signInAlertMessage?: string;
  // Optional custom launch function to override default API call
  launchSessionFn?: (params: SessionLaunchParams) => Promise<Session>;
}

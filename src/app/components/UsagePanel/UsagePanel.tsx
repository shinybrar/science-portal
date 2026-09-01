import { UsagePanelImpl } from '@/app/implementation/usagePanel';
import type { UsagePanelProps } from '@/app/types/UsagePanelProps';

/**
 * Singular dashboard surface for platform fullness and personal usage.
 * Home storage is live; compute reservations from Metrics will join this panel.
 */
export function UsagePanel(props: UsagePanelProps) {
  return <UsagePanelImpl {...props} />;
}

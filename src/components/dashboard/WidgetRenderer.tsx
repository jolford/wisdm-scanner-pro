import { ActivityFeedWidget } from './widgets/ActivityFeedWidget';
import { RecentBatchesWidget } from './widgets/RecentBatchesWidget';
import { MetricsOverviewWidget } from './widgets/MetricsOverviewWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';

interface WidgetRendererProps {
  type: string;
  config: Record<string, any>;
}

export function WidgetRenderer({ type, config }: WidgetRendererProps) {
  switch (type) {
    case 'activity_feed':
      return <ActivityFeedWidget config={config} />;
    case 'recent_batches':
      return <RecentBatchesWidget config={config} />;
    case 'metrics_overview':
      return <MetricsOverviewWidget config={config} />;
    case 'quick_actions':
      return <QuickActionsWidget />;
    default:
      return (
        <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
          Unknown widget type: {type}
        </div>
      );
  }
}

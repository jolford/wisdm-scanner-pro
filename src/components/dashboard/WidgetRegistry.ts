import { LucideIcon, Activity, FileText, TrendingUp, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: LucideIcon;
  defaultConfig: Record<string, any>;
  minWidth?: number;
  minHeight?: number;
  configurable?: boolean;
}

export const WIDGET_REGISTRY: Record<string, WidgetConfig> = {
  activity_feed: {
    id: 'activity_feed',
    type: 'activity_feed',
    title: 'Activity Feed',
    description: 'Recent batch completions and validation actions',
    icon: Activity,
    defaultConfig: {
      limit: 10,
      showBatches: true,
      showValidations: true,
    },
    configurable: true,
  },
  recent_batches: {
    id: 'recent_batches',
    type: 'recent_batches',
    title: 'Recent Batches',
    description: 'Your most recent batches with quick access',
    icon: FileText,
    defaultConfig: {
      limit: 5,
      showStatus: true,
    },
    configurable: true,
  },
  metrics_overview: {
    id: 'metrics_overview',
    type: 'metrics_overview',
    title: 'Metrics Overview',
    description: 'Key performance indicators and statistics',
    icon: TrendingUp,
    defaultConfig: {
      period: '7d',
    },
    configurable: true,
  },
  pending_tasks: {
    id: 'pending_tasks',
    type: 'pending_tasks',
    title: 'Pending Tasks',
    description: 'Documents awaiting validation or action',
    icon: Clock,
    defaultConfig: {
      limit: 10,
    },
    configurable: true,
  },
  exceptions_summary: {
    id: 'exceptions_summary',
    type: 'exceptions_summary',
    title: 'Exceptions Summary',
    description: 'Recent validation failures and issues',
    icon: AlertTriangle,
    defaultConfig: {
      limit: 5,
      severity: 'all',
    },
    configurable: true,
  },
  quick_actions: {
    id: 'quick_actions',
    type: 'quick_actions',
    title: 'Quick Actions',
    description: 'Frequently used actions and shortcuts',
    icon: CheckCircle,
    defaultConfig: {},
    configurable: false,
  },
};

export const DEFAULT_WIDGETS = [
  { type: 'metrics_overview', position: 0 },
  { type: 'recent_batches', position: 1 },
  { type: 'activity_feed', position: 2 },
  { type: 'quick_actions', position: 3 },
];

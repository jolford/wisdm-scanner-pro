import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  WifiOff, 
  CloudOff, 
  RefreshCw, 
  Upload,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOfflineMode } from '@/hooks/use-offline-mode';
import { formatDistanceToNow } from 'date-fns';

interface OfflineIndicatorProps {
  className?: string;
  variant?: 'minimal' | 'detailed';
}

export function OfflineIndicator({
  className,
  variant = 'minimal'
}: OfflineIndicatorProps) {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncAt,
    syncPendingActions,
    clearPendingActions
  } = useOfflineMode();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  if (variant === 'minimal') {
    return (
      <div
        className={cn(
          "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg",
          isOnline ? "bg-amber-500 text-white" : "bg-destructive text-destructive-foreground",
          className
        )}
      >
        {!isOnline && (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Offline</span>
          </>
        )}
        
        {isOnline && pendingCount > 0 && (
          <>
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <Alert
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 shadow-lg",
        isOnline ? "border-amber-500/30" : "border-destructive/30",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {isOnline ? (
          <CloudOff className="h-5 w-5 text-amber-500" />
        ) : (
          <WifiOff className="h-5 w-5 text-destructive" />
        )}
        
        <div className="flex-1 space-y-2">
          <AlertTitle className="text-sm">
            {isOnline ? 'Pending Changes' : 'You\'re Offline'}
          </AlertTitle>
          
          <AlertDescription className="text-xs text-muted-foreground">
            {isOnline
              ? `${pendingCount} changes waiting to sync`
              : 'Changes will sync when you\'re back online'}
          </AlertDescription>

          {pendingCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Badge variant="secondary">{pendingCount} pending</Badge>
                {lastSyncAt && (
                  <span className="text-muted-foreground">
                    Last sync {formatDistanceToNow(lastSyncAt)} ago
                  </span>
                )}
              </div>

              {isSyncing && (
                <div className="space-y-1">
                  <Progress value={undefined} className="h-1" />
                  <p className="text-xs text-muted-foreground text-center">
                    Syncing changes...
                  </p>
                </div>
              )}

              {isOnline && !isSyncing && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                    onClick={syncPendingActions}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Sync Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={clearPendingActions}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Discard
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
}

// Compact sync status for headers
export function SyncStatusBadge() {
  const { isOnline, pendingCount, isSyncing, syncPendingActions } = useOfflineMode();

  if (isOnline && pendingCount === 0) {
    return (
      <Badge variant="secondary" className="gap-1 text-green-600">
        <Check className="h-3 w-3" />
        Synced
      </Badge>
    );
  }

  if (!isOnline) {
    return (
      <Badge variant="destructive" className="gap-1">
        <WifiOff className="h-3 w-3" />
        Offline
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="gap-1 cursor-pointer hover:bg-secondary/80"
      onClick={syncPendingActions}
    >
      {isSyncing ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          Syncing
        </>
      ) : (
        <>
          <Upload className="h-3 w-3" />
          {pendingCount} pending
        </>
      )}
    </Badge>
  );
}

import { Lock, LockOpen } from 'lucide-react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface DocumentLockIndicatorProps {
  isLocked: boolean;
  lockedBy?: {
    user_id: string;
    email: string;
    full_name: string;
  } | null;
  hasLock: boolean;
}

export const DocumentLockIndicator = ({ isLocked, lockedBy, hasLock }: DocumentLockIndicatorProps) => {
  if (!isLocked) {
    return null;
  }

  if (hasLock) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="default" className="gap-1">
              <LockOpen className="h-3 w-3" />
              Editing
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>You are currently editing this document</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="destructive" className="gap-1">
            <Lock className="h-3 w-3" />
            Locked
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Currently being edited by {lockedBy?.full_name || 'another user'}</p>
          <p className="text-xs text-muted-foreground">{lockedBy?.email}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

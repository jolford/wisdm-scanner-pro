import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';

export interface UndoAction {
  label: string;
  action: () => void | Promise<void>;
}

export const showUndoToast = (message: string, undoAction: UndoAction, duration: number = 5000) => {
  toast(message, {
    action: {
      label: (
        <span className="flex items-center gap-1">
          <Undo2 className="h-3 w-3" />
          {undoAction.label}
        </span>
      ),
      onClick: async () => {
        try {
          await undoAction.action();
          toast.success('Action undone');
        } catch (error: any) {
          toast.error('Failed to undo: ' + error.message);
        }
      },
    },
    duration,
  });
};

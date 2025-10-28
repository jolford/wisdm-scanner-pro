import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, X, Download, FolderInput, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => Promise<void>;
  onBulkExport?: () => void;
  onBulkMove?: () => void;
  onBulkValidate?: () => Promise<void>;
  onBulkReject?: () => Promise<void>;
  mode?: 'validation' | 'batch';
}

export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkExport,
  onBulkMove,
  onBulkValidate,
  onBulkReject,
  mode = 'batch'
}: BulkActionsToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onBulkDelete();
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
        <div className="bg-primary text-primary-foreground rounded-full shadow-2xl px-6 py-3 flex items-center gap-4 border border-primary/20">
          <Badge variant="secondary" className="text-sm font-semibold">
            {selectedCount} selected
          </Badge>
          
          <div className="h-6 w-px bg-primary-foreground/20" />
          
          <div className="flex gap-2">
            {mode === 'validation' && onBulkValidate && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  setIsProcessing(true);
                  await onBulkValidate();
                  setIsProcessing(false);
                }}
                disabled={isProcessing}
                className="h-8 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Validate
              </Button>
            )}
            
            {mode === 'validation' && onBulkReject && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  setIsProcessing(true);
                  await onBulkReject();
                  setIsProcessing(false);
                }}
                disabled={isProcessing}
                className="h-8 border-red-300 text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            )}
            
            {onBulkMove && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onBulkMove}
                disabled={isProcessing}
                className="h-8"
              >
                <FolderInput className="h-4 w-4 mr-2" />
                Move
              </Button>
            )}
            
            {onBulkExport && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onBulkExport}
                disabled={isProcessing}
                className="h-8"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isProcessing}
              className="h-8"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
          
          <div className="h-6 w-px bg-primary-foreground/20" />
          
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="h-8 hover:bg-primary-foreground/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>Delete {selectedCount} Batches?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This action cannot be undone. All selected batches and their associated documents will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

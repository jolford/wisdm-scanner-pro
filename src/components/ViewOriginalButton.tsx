import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
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

interface ViewOriginalButtonProps {
  documentId: string;
  showingOriginal: boolean;
  onToggle: () => void;
}

export const ViewOriginalButton = ({
  documentId,
  showingOriginal,
  onToggle,
}: ViewOriginalButtonProps) => {
  const [showWarning, setShowWarning] = useState(false);
  const { user } = useAuth();

  const handleViewOriginal = async () => {
    if (showingOriginal) {
      // Switching back to redacted view - no warning needed
      onToggle();
      return;
    }

    // Show warning before viewing original with PII
    setShowWarning(true);
  };

  const confirmViewOriginal = async () => {
    setShowWarning(false);

    // Log the view access for audit trail
    try {
      await supabase.from('redaction_audit_log').insert({
        document_id: documentId,
        user_id: user?.id,
        ip_address: null, // Browser doesn't expose IP
        user_agent: navigator.userAgent,
        reason: 'User requested to view unredacted original'
      });
    } catch (error) {
      console.error('Failed to log redaction audit:', error);
    }

    onToggle();
  };

  return (
    <>
      <Button
        size="sm"
        variant={showingOriginal ? 'destructive' : 'outline'}
        onClick={handleViewOriginal}
        className="gap-2"
      >
        {showingOriginal ? (
          <>
            <EyeOff className="h-4 w-4" />
            Hide PII
          </>
        ) : (
          <>
            <Eye className="h-4 w-4" />
            View Original
          </>
        )}
      </Button>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              View Unredacted Document?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This document contains <strong>Personally Identifiable Information (PII)</strong> that
                is currently redacted for privacy protection.
              </p>
              <p>
                Viewing the unredacted original will expose sensitive data and will be logged in the
                system audit trail for compliance purposes.
              </p>
              <p className="text-destructive font-medium">
                ⚠️ Only proceed if you have a legitimate business need to access this information.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmViewOriginal} className="bg-destructive hover:bg-destructive/90">
              View Original (Logged)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

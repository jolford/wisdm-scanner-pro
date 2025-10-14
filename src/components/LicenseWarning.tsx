import { AlertCircle, Key } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useLicense } from '@/hooks/use-license';

export const LicenseWarning = () => {
  const { license, isLoading } = useLicense();

  if (isLoading || !license) return null;

  const usagePercent = Math.round((license.remaining_documents / license.total_documents) * 100);
  const isLowCapacity = usagePercent < 20;
  const isExpiringSoon = new Date(license.end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (!isLowCapacity && !isExpiringSoon) return null;

  return (
    <Alert className={`mb-6 ${isLowCapacity ? 'border-destructive' : 'border-orange-500'}`}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <Key className="h-4 w-4" />
        License Status
      </AlertTitle>
      <AlertDescription className="space-y-2">
        {isLowCapacity && (
          <p>
            <strong>Low document capacity:</strong> Only {license.remaining_documents.toLocaleString()} of {license.total_documents.toLocaleString()} documents remaining ({usagePercent}%)
          </p>
        )}
        {isExpiringSoon && (
          <p>
            <strong>License expiring soon:</strong> Valid until {new Date(license.end_date).toLocaleDateString()}
          </p>
        )}
        <Progress value={usagePercent} className="h-2" />
        <p className="text-xs text-muted-foreground">
          Please contact your administrator to renew or upgrade your license.
        </p>
      </AlertDescription>
    </Alert>
  );
};
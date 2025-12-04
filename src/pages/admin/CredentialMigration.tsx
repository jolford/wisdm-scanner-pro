import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { safeInvokeEdgeFunction } from '@/lib/edge-function-helper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function CredentialMigration() {
  const { isSystemAdmin, loading: authLoading } = useRequireAuth(false, true);
  const navigate = useNavigate();
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMigrate = async () => {
    if (!confirm('This will encrypt all plaintext credentials. Continue?')) {
      return;
    }

    setMigrating(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: migrationError } = await safeInvokeEdgeFunction('migrate-credentials');

      if (migrationError || !data) {
        throw new Error(migrationError?.message || 'Migration failed');
      }

      setResult(data);
      toast.success('Credential encryption completed successfully');
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to migrate credentials';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setMigrating(false);
    }
  };

  if (authLoading) {
    return (
      <AdminLayout title="Credential Migration" description="Encrypt existing credentials">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    navigate('/');
    return null;
  }

  return (
    <AdminLayout title="Credential Encryption Migration" description="Encrypt existing plaintext credentials for enhanced security">
      <div className="space-y-6 max-w-4xl">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> This migration encrypts webhook secrets and email passwords.
            Once encrypted, credentials can only be decrypted by edge functions with access to the
            ENCRYPTION_KEY. This operation is idempotent and safe to run multiple times.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Migration Status</CardTitle>
            <CardDescription>
              Encrypt plaintext credentials stored in the database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">What will be encrypted:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Email server passwords (email_import_configs table)</li>
                <li>Webhook secrets (webhook_configs table)</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">How it works:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Reads plaintext credentials from database</li>
                <li>Encrypts using AES-256-GCM with ENCRYPTION_KEY</li>
                <li>Stores encrypted values in new columns</li>
                <li>Edge functions automatically use encrypted values</li>
              </ol>
            </div>

            {result && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900 dark:text-green-100">
                  <strong>Success!</strong> Migrated {result.migrated?.email_configs || 0} email
                  configs and {result.migrated?.webhook_configs || 0} webhook configs.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleMigrate}
              disabled={migrating}
              className="w-full"
              size="lg"
            >
              {migrating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Encrypting credentials...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Run Encryption Migration
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Post-Migration Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li className="text-muted-foreground">
                Verify webhook and email integrations still function correctly
              </li>
              <li className="text-muted-foreground">
                Test webhook delivery with test.webhook event
              </li>
              <li className="text-muted-foreground">
                Monitor edge function logs for decryption errors
              </li>
              <li className="text-muted-foreground">
                (Optional) Remove old plaintext columns after verification
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

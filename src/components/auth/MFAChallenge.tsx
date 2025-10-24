import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Key } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MFAChallengeProps {
  factorId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MFAChallenge({ factorId, onSuccess, onCancel }: MFAChallengeProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const createdRef = useRef(false);

  // Create or recreate a challenge
  const ensureChallenge = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('no_session');
      }
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) throw error;
      setChallengeId(data.id);
      return true;
    } catch (error) {
      console.error('Challenge creation error:', error);
      setChallengeId(null);
      return false;
    }
  };

  // Create challenge when component mounts (only once)
  useEffect(() => {
    const init = async () => {
      if (createdRef.current) return;
      createdRef.current = true;
      const ok = await ensureChallenge();
      if (!ok) {
        toast({
          title: 'Authentication Error',
          description: 'Failed to create MFA challenge. Please try signing in again.',
          variant: 'destructive',
        });
      }
    };
    init();
  }, [factorId, toast]);

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    if (!challengeId) {
      const ok = await ensureChallenge();
      if (!ok) {
        toast({
          title: 'Authentication Error',
          description: 'Challenge not ready. Please try again.',
          variant: 'destructive',
        });
        return;
      }
    }
    // Ensure a valid session before verifying
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: 'Authentication Error',
        description: 'Your session expired. Please sign in again.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });

      if (error) throw error;

      toast({
        title: 'Verification Successful',
        description: 'You have been authenticated.',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      const msg = String(error?.message || '');
      toast({
        title: 'Verification Failed',
        description: msg.includes('sub') || msg.includes('bad_jwt')
          ? 'Your session is no longer valid. Please sign in again and retry.'
          : (msg || 'Invalid verification code'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryCode = async () => {
    if (!recoveryCode.trim()) {
      toast({
        title: 'Invalid Recovery Code',
        description: 'Please enter a recovery code',
        variant: 'destructive',
      });
      return;
    }

    if (!challengeId) {
      const ok = await ensureChallenge();
      if (!ok) {
        toast({
          title: 'Authentication Error',
          description: 'Challenge not ready. Please try again.',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: recoveryCode,
      });

      if (error) throw error;

      toast({
        title: 'Recovery Successful',
        description: 'You have been authenticated using a recovery code.',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: 'Recovery Failed',
        description: 'Invalid recovery code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (useRecovery) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-5 w-5 text-warning" />
            <CardTitle>Use Recovery Code</CardTitle>
          </div>
          <CardDescription>
            Enter one of your recovery codes to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Each recovery code can only be used once. Make sure to generate new codes after using one.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="recoveryCode">Recovery Code</Label>
            <Input
              id="recoveryCode"
              type="text"
              placeholder="XXXXXXXX"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              className="text-center font-mono tracking-wider"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setUseRecovery(false)}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              onClick={handleRecoveryCode}
              disabled={!recoveryCode.trim() || loading}
              className="flex-1"
            >
              {loading ? 'Verifying...' : 'Verify Recovery Code'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Two-Factor Authentication</CardTitle>
        </div>
        <CardDescription>
          Enter the 6-digit code from your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfaCode">Verification Code</Label>
          <Input
            id="mfaCode"
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="text-center text-2xl font-mono tracking-widest"
            autoFocus
          />
        </div>

          <Button
            onClick={handleVerifyCode}
            disabled={code.length !== 6 || loading || !challengeId}
            className="w-full"
          >
            {loading ? 'Verifying...' : !challengeId ? 'Preparing...' : 'Verify'}
          </Button>

          <Button
            variant="outline"
            onClick={ensureChallenge}
            disabled={loading}
            className="w-full"
          >
            Retry challenge
          </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => setUseRecovery(true)}
            disabled={loading}
            className="w-full"
          >
            <Key className="h-4 w-4 mr-2" />
            Use Recovery Code
          </Button>

          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={loading}
              className="w-full"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

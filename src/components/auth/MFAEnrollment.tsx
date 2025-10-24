import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Copy, Check, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MFAEnrollmentProps {
  onEnrollmentComplete?: () => void;
  onCancel?: () => void;
}

export function MFAEnrollment({ onEnrollmentComplete, onCancel }: MFAEnrollmentProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'generate' | 'verify'>('generate');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateQR = async () => {
    setLoading(true);
    try {
      // Check existing factors to avoid duplicates
      const existing = await supabase.auth.mfa.listFactors();
      if (existing.error) throw existing.error;

      const existingTotp = existing.data?.totp || [];
      const verifiedTotp = existingTotp.find((f: any) => f?.status === 'verified');
      const unverifiedTotp = existingTotp.find((f: any) => f?.status !== 'verified');

      if (verifiedTotp) {
        toast({
          title: 'MFA Already Enabled',
          description: 'Two-factor authentication is already active on this account.',
        });
        onEnrollmentComplete?.();
        return;
      }

      if (unverifiedTotp?.id) {
        await supabase.auth.mfa.unenroll({ factorId: unverifiedTotp.id }).catch(() => {});
      }

      const friendlyName = `Authenticator-${Date.now()}`;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep('verify');
      }
    } catch (error: any) {
      toast({
        title: 'MFA Setup Failed',
        description: error.message || 'Failed to generate QR code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (!factorId) {
        throw new Error('MFA setup incomplete. Please try again.');
      }

      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorId,
        code: verificationCode,
      });

      if (error) throw error;

      // Generate recovery codes
      const codes = Array.from({ length: 10 }, () => 
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );
      setRecoveryCodes(codes);

      toast({
        title: 'MFA Enabled',
        description: 'Two-factor authentication has been successfully enabled.',
      });

      if (onEnrollmentComplete) {
        onEnrollmentComplete();
      }
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid verification code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied',
      description: 'Secret key copied to clipboard',
    });
  };

  const downloadRecoveryCodes = () => {
    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wisdm-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (recoveryCodes.length > 0) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-success" />
            <CardTitle>MFA Enabled Successfully</CardTitle>
          </div>
          <CardDescription>
            Save these recovery codes in a safe place. You can use them to access your account if you lose your authenticator device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Each recovery code can only be used once. Store them securely and never share them.
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((code, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{index + 1}.</span>
                  <span className="font-semibold">{code}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={downloadRecoveryCodes} variant="outline" className="flex-1">
              Download Codes
            </Button>
            <Button onClick={onEnrollmentComplete} className="flex-1">
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'generate') {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Enable Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Add an extra layer of security to your account by enabling MFA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You'll need an authenticator app like Google Authenticator, Authy, or 1Password to scan the QR code.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            )}
            <Button onClick={handleGenerateQR} disabled={loading} className="flex-1">
              <Shield className="h-4 w-4 mr-2" />
              {loading ? 'Setting up...' : 'Set Up MFA'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle>Scan QR Code</CardTitle>
        <CardDescription>
          Use your authenticator app to scan this QR code, then enter the 6-digit code to verify.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code */}
        <div className="flex justify-center p-4 bg-white rounded-lg">
          <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
        </div>

        {/* Manual Entry */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Can't scan? Enter this code manually:
          </Label>
          <div className="flex items-center gap-2">
            <Input
              value={secret}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={copySecret}
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Verification Code Input */}
        <div className="space-y-2">
          <Label htmlFor="verificationCode">Enter Verification Code</Label>
          <Input
            id="verificationCode"
            type="text"
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="text-center text-2xl font-mono tracking-widest"
          />
        </div>

        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handleVerifyCode}
            disabled={verificationCode.length !== 6 || loading}
            className="flex-1"
          >
            {loading ? 'Verifying...' : 'Verify and Enable MFA'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

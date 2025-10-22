import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { MFAEnrollment } from '@/components/auth/MFAEnrollment';
import { ArrowLeft, Shield, ShieldOff, User, Mail } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import wisdmLogo from '@/assets/wisdm-logo.png';

const UserSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaEnrollment, setShowMfaEnrollment] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    checkMfaStatus();
  }, [authLoading, user, navigate]);

  const checkMfaStatus = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const hasMFA = data?.totp && data.totp.length > 0;
      setMfaEnabled(hasMFA || false);
    } catch (error) {
      console.error('Error checking MFA status:', error);
    }
  };

  const handleDisableMFA = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }

    setLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];

      if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: totpFactor.id,
        });

        if (error) throw error;

        setMfaEnabled(false);
        toast({
          title: 'MFA Disabled',
          description: 'Two-factor authentication has been disabled.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Failed to Disable MFA',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={wisdmLogo} alt="WISDM Logo" className="h-10 w-auto" />
              <div className="border-l border-border/50 pl-3">
                <h1>User Settings</h1>
                <p className="text-xs text-muted-foreground">Manage your account and security preferences</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">
                <User className="h-4 w-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Your account details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>Email Address</span>
                    </div>
                    <p className="text-lg font-medium">{user?.email}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>User ID</span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{user?.id}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mfaEnabled ? (
                    <>
                      <Alert className="bg-success-light border-success/20">
                        <Shield className="h-4 w-4 text-success" />
                        <AlertDescription className="text-success">
                          Two-factor authentication is currently enabled on your account.
                        </AlertDescription>
                      </Alert>

                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-success" />
                          <div>
                            <p className="font-medium">MFA Enabled</p>
                            <p className="text-sm text-muted-foreground">
                              Your account is protected with 2FA
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDisableMFA}
                          disabled={loading}
                        >
                          <ShieldOff className="h-4 w-4 mr-2" />
                          Disable
                        </Button>
                      </div>
                    </>
                  ) : showMfaEnrollment ? (
                    <MFAEnrollment
                      onEnrollmentComplete={() => {
                        setMfaEnabled(true);
                        setShowMfaEnrollment(false);
                      }}
                      onCancel={() => setShowMfaEnrollment(false)}
                    />
                  ) : (
                    <>
                      <Alert>
                        <AlertDescription>
                          Two-factor authentication adds an extra layer of security to your account. When enabled, you'll need to enter a code from your authenticator app in addition to your password.
                        </AlertDescription>
                      </Alert>

                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <ShieldOff className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">MFA Disabled</p>
                            <p className="text-sm text-muted-foreground">
                              Your account is not protected with 2FA
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => setShowMfaEnrollment(true)}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Enable MFA
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                    Manage your account password
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await supabase.auth.resetPasswordForEmail(user?.email || '', {
                          redirectTo: `${window.location.origin}/auth?type=recovery`,
                        });
                        toast({
                          title: 'Password Reset Email Sent',
                          description: 'Check your email for the password reset link.',
                        });
                      } catch (error: any) {
                        toast({
                          title: 'Failed',
                          description: error.message,
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    Change Password
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default UserSettings;

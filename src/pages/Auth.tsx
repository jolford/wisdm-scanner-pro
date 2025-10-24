import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Check, X } from 'lucide-react';
import { MFAChallenge } from '@/components/auth/MFAChallenge';
import wisdmLogo from '@/assets/wisdm-logo.png';

const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const AuthPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [currentTosVersion, setCurrentTosVersion] = useState<{ tos_version: string; privacy_policy_version: string } | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);

  // Password strength checks
  const passwordChecks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;
  const getStrengthColor = () => {
    if (passwordStrength <= 2) return 'bg-red-500';
    if (passwordStrength <= 3) return 'bg-orange-500';
    if (passwordStrength <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (passwordStrength <= 2) return 'Weak';
    if (passwordStrength <= 3) return 'Fair';
    if (passwordStrength <= 4) return 'Good';
    return 'Strong';
  };

  useEffect(() => {
    const locationHash = window.location.hash || '';
    const searchParams = new URLSearchParams(window.location.search);
    const hasAccessToken = locationHash.includes('access_token=');
    const hashType = locationHash.match(/type=([^&]+)/)?.[1];
    const searchType = searchParams.get('type');
    const codeFromSearch = searchParams.get('code');
    const isRecoveryParam = 
      hashType === 'recovery' || 
      searchType === 'recovery' ||
      locationHash.includes('recovery_token=') ||
      locationHash.includes('type=recovery') ||
      !!codeFromSearch;
    const blockRedirect = isRecoveryParam || hasAccessToken;

    // Surface any auth errors from the recovery link
    try {
      const hashParams = new URLSearchParams(locationHash.startsWith('#') ? locationHash.slice(1) : locationHash);
      const authError = hashParams.get('error_description') || hashParams.get('error');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const codeParam = searchParams.get('code') || hashParams.get('code');
      if (authError) {
        toast({ 
          title: 'Recovery Link Error', 
          description: decodeURIComponent(authError), 
          variant: 'destructive' 
        });
      }
      // Ensure a valid session exists when arriving from the reset link
      if (codeParam) {
        setTimeout(() => {
          supabase.auth
            .exchangeCodeForSession(codeParam)
            .catch((e) => console.error('Failed to exchange code for session', e));
        }, 0);
      } else if (accessToken && refreshToken) {
        setTimeout(() => {
          supabase.auth
            .setSession({ access_token: accessToken, refresh_token: refreshToken })
            .catch((e) => console.error('Failed to set session from recovery tokens', e));
        }, 0);
      }
    } catch {}

    // Listen for auth changes FIRST to catch PASSWORD_RECOVERY
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, 'Session:', !!session);
      
      if (event === 'PASSWORD_RECOVERY') {
        setIsUpdatingPassword(true);
        setIsResetPassword(false);
        return;
      }
      
      // Don't auto-redirect if we're showing MFA challenge
      if (session && !blockRedirect && !isUpdatingPassword && !showMfaChallenge) {
        navigate('/');
      }
    });

    // If the URL indicates recovery or contains an access token, enable update mode
    if (blockRedirect) {
      console.log('Recovery mode detected');
      setIsUpdatingPassword(true);
      setIsResetPassword(false);
    } else {
      // Otherwise, check for an existing session and redirect
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && !isUpdatingPassword) {
          navigate('/');
        }
      });
    }

    // Fetch current ToS version
    supabase
      .from('tos_versions')
      .select('tos_version, privacy_policy_version')
      .eq('is_current', true)
      .single()
      .then(({ data }) => {
        if (data) {
          setCurrentTosVersion(data);
        }
      });

    return () => subscription.unsubscribe();
  }, [navigate, isUpdatingPassword, showMfaChallenge]);

  const recordTosAcceptance = async (userId: string) => {
    if (!currentTosVersion) return;

    // Get IP and user agent for audit trail
    const userAgent = navigator.userAgent;
    
    try {
      await supabase.from('tos_acceptances').insert({
        user_id: userId,
        tos_version: currentTosVersion.tos_version,
        privacy_policy_version: currentTosVersion.privacy_policy_version,
        user_agent: userAgent,
      });
    } catch (error) {
      console.error('Failed to record ToS acceptance:', error);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (error: any) {
      toast({
        title: 'Validation Error',
        description: error.errors?.[0]?.message || 'Please check your inputs',
        variant: 'destructive',
      });
      return;
    }

    if (!tosAccepted) {
      toast({
        title: 'Terms Required',
        description: 'You must accept the Terms of Service and Privacy Policy to continue',
        variant: 'destructive',
      });
      return;
    }

    if (isSignUp && !fullName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter your full name',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Record ToS acceptance
        await recordTosAcceptance(data.user.id);

        toast({
          title: 'Account Created',
          description: 'Welcome! Your account has been created successfully.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Sign Up Failed',
        description: error.message || 'An error occurred during sign up',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    try {
      emailSchema.parse(email);
    } catch (error: any) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    if (!password) {
      toast({
        title: 'Validation Error',
        description: 'Please enter your password',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // After successful password auth, check for MFA requirement
      // Supabase will return an incomplete session if MFA is enabled
      const { data: { session } } = await supabase.auth.getSession();
      
      // List all factors to check for MFA
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) {
        console.error('Error checking MFA factors:', factorsError);
      }

      // Check if user has verified TOTP factors
      const verifiedFactor = factorsData?.totp?.find((factor: any) => factor.status === 'verified');

      if (verifiedFactor) {
        // MFA is enabled and verified - show challenge
        console.log('MFA detected, showing challenge for factor:', verifiedFactor.id);
        setMfaFactorId(verifiedFactor.id);
        setShowMfaChallenge(true);
        setLoading(false);
        return;
      }

      // No MFA or not verified - normal sign in
      toast({
        title: 'Welcome Back',
        description: 'You have successfully signed in.',
      });
    } catch (error: any) {
      toast({
        title: 'Sign In Failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    try {
      emailSchema.parse(email);
    } catch (error: any) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });

      if (error) throw error;

      toast({
        title: 'Reset Email Sent',
        description: 'Check your email for a password reset link. The link will be valid for 1 hour.',
      });
      
      setIsResetPassword(false);
      setEmail('');
    } catch (error: any) {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to send reset email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password
    try {
      passwordSchema.parse(password);
    } catch (error: any) {
      toast({
        title: 'Validation Error',
        description: error.errors?.[0]?.message || 'Please check your password',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully updated.',
      });

      setIsUpdatingPassword(false);
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Show MFA challenge if needed
  if (showMfaChallenge && mfaFactorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <img src={wisdmLogo} alt="WISDM Logo" className="h-12 w-auto mx-auto mb-4" />
          </div>
          <MFAChallenge
            factorId={mfaFactorId}
            onSuccess={() => {
              navigate('/');
            }}
            onCancel={() => {
              setShowMfaChallenge(false);
              setMfaFactorId(null);
              supabase.auth.signOut();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
        <div className="text-center mb-8">
          <img src={wisdmLogo} alt="WISDM Logo" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">WISDM Scanner Pro</h1>
          <p className="text-muted-foreground">
            {isUpdatingPassword 
              ? 'Enter your new password' 
              : isResetPassword 
              ? 'Reset your password' 
              : isSignUp 
              ? 'Create your account' 
              : 'Sign in to access your account'}
          </p>
        </div>

        <form onSubmit={isUpdatingPassword ? handleUpdatePassword : isResetPassword ? handleResetPassword : isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
          {isSignUp && !isUpdatingPassword && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          {!isUpdatingPassword && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          {!isResetPassword && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{isUpdatingPassword ? 'New Password' : 'Password'}</Label>
                {!isSignUp && !isUpdatingPassword && (
                  <button
                    type="button"
                    onClick={() => setIsResetPassword(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
              />
            {(isSignUp || isUpdatingPassword) && password && (
              <div className="space-y-3 mt-3 p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Password Strength:</span>
                  <span className={`text-xs font-bold ${
                    passwordStrength <= 2 ? 'text-red-600' :
                    passwordStrength <= 3 ? 'text-orange-600' :
                    passwordStrength <= 4 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {getStrengthText()}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= passwordStrength ? getStrengthColor() : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className={`flex items-center gap-2 ${passwordChecks.minLength ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-2 ${passwordChecks.hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    <span>One uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-2 ${passwordChecks.hasLowercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    <span>One lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-2 ${passwordChecks.hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    <span>One number</span>
                  </div>
                  <div className={`flex items-center gap-2 ${passwordChecks.hasSpecial ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    <span>One special character (!@#$%^&*)</span>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}

          {isSignUp && !isUpdatingPassword && (
            <div className="flex items-start space-x-2 pt-2">
              <Checkbox
                id="tos"
                checked={tosAccepted}
                onCheckedChange={(checked) => setTosAccepted(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="tos" className="text-sm font-normal leading-relaxed cursor-pointer">
                I agree to the{' '}
                <Link to="/terms-of-service" target="_blank" className="text-primary hover:underline">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link to="/privacy-policy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                {currentTosVersion && (
                  <span className="text-xs text-muted-foreground block mt-1">
                    Version {currentTosVersion.tos_version}
                  </span>
                )}
              </Label>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (isSignUp && !tosAccepted)}
          >
            {loading 
              ? 'Please wait...' 
              : isUpdatingPassword 
              ? 'Update Password' 
              : isResetPassword 
              ? 'Send Reset Link' 
              : isSignUp 
              ? 'Create Account' 
              : 'Sign In'}
          </Button>

          {!isUpdatingPassword && (
            <div className="text-center text-sm space-y-2">
              {isResetPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPassword(false);
                    setPassword('');
                  }}
                  className="text-primary hover:underline"
                >
                  Back to sign in
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setTosAccepted(false);
                    setIsResetPassword(false);
                  }}
                  className="text-primary hover:underline"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              )}
            </div>
          )}
        </form>

        {isSignUp && (
          <div className="mt-6 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Legal Compliance:</strong> By creating an account, you acknowledge that your acceptance
              will be recorded with timestamp and version information for regulatory compliance.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuthPage;

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Check, X, Sparkles, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { MFAChallenge } from '@/components/auth/MFAChallenge';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { checkPasswordSecurity } from '@/lib/password-security';
import { useAuthRateLimit } from '@/hooks/use-auth-rate-limit';

// Helper function to get user's preferred starting page
const getUserStartingPage = async (): Promise<string> => {
  try {
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) return '/';
    const {
      data
    } = await supabase.from('user_preferences').select('default_starting_page').eq('user_id', user.id).single();
    return data?.default_starting_page || '/';
  } catch {
    return '/';
  }
};
const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Password must contain at least one uppercase letter').regex(/[a-z]/, 'Password must contain at least one lowercase letter').regex(/[0-9]/, 'Password must contain at least one number').regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
const AuthPage = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [currentTosVersion, setCurrentTosVersion] = useState<{
    tos_version: string;
    privacy_policy_version: string;
  } | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [establishingSession, setEstablishingSession] = useState(false);
  const authFlowRef = useRef(false); // Prevent redirects during MFA flow
  
  // Rate limiting
  const { isBlocked, retryAfter, remainingAttempts, checkRateLimit, resetRateLimit, formatRetryTime } = useAuthRateLimit();

  // Password strength checks
  const passwordChecks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password)
  };
  
  // Check for compromised/common passwords
  const passwordSecurityCheck = password.length > 0 ? checkPasswordSecurity(password) : { isCompromised: false };
  
  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;
  const getStrengthColor = () => {
    if (passwordSecurityCheck.isCompromised) return 'bg-red-500';
    if (passwordStrength <= 2) return 'bg-red-500';
    if (passwordStrength <= 3) return 'bg-orange-500';
    if (passwordStrength <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  const getStrengthText = () => {
    if (passwordSecurityCheck.isCompromised) return 'Compromised';
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
    const isRecoveryParam = hashType === 'recovery' || searchType === 'recovery' || locationHash.includes('recovery_token=') || locationHash.includes('type=recovery') || !!codeFromSearch;
    const blockRedirect = isRecoveryParam || hasAccessToken;

    // Surface any auth errors from the recovery link
    const handleRecoverySession = async () => {
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
          return;
        }

        // Ensure a valid session exists when arriving from the reset link
        if (codeParam) {
          setEstablishingSession(true);
          console.log('Exchanging code for session...');
          const {
            data,
            error
          } = await supabase.auth.exchangeCodeForSession(codeParam);
          if (error) {
            console.error('Failed to exchange code:', error);
            toast({
              title: 'Session Error',
              description: 'Failed to establish recovery session. Please request a new reset link.',
              variant: 'destructive'
            });
          } else {
            console.log('Session established successfully');
            // Verify session is active
            const {
              data: {
                session
              }
            } = await supabase.auth.getSession();
            if (session) {
              console.log('Active session confirmed');
            }
          }
          setEstablishingSession(false);
        } else if (accessToken && refreshToken) {
          setEstablishingSession(true);
          console.log('Setting session from tokens...');
          const {
            data,
            error
          } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (error) {
            console.error('Failed to set session:', error);
            toast({
              title: 'Session Error',
              description: 'Failed to establish recovery session. Please request a new reset link.',
              variant: 'destructive'
            });
          } else {
            console.log('Session established successfully');
          }
          setEstablishingSession(false);
        }
      } catch (e) {
        console.error('Recovery session error:', e);
        setEstablishingSession(false);
      }
    };
    if (blockRedirect) {
      handleRecoverySession();
    }

    // Listen for auth changes FIRST to catch PASSWORD_RECOVERY
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, 'Session:', !!session);
      if (event === 'PASSWORD_RECOVERY') {
        setIsUpdatingPassword(true);
        setIsResetPassword(false);
        return;
      }

      // Don't auto-redirect during MFA/auth flow or when showing MFA
      if (session && !blockRedirect && !isUpdatingPassword && !showMfaChallenge && !authFlowRef.current) {
        getUserStartingPage().then(page => navigate(page));
      }
    });

    // If the URL indicates recovery or contains an access token, enable update mode
    if (blockRedirect) {
      console.log('Recovery mode detected');
      setIsUpdatingPassword(true);
      setIsResetPassword(false);
    } else {
      // Otherwise, check for an existing session and redirect
      supabase.auth.getSession().then(({
        data: {
          session
        }
      }) => {
        if (session && !isUpdatingPassword && !showMfaChallenge && !authFlowRef.current) {
          getUserStartingPage().then(page => navigate(page));
        }
      });
    }

    // Fetch current ToS version
    supabase.from('tos_versions').select('tos_version, privacy_policy_version').eq('is_current', true).single().then(({
      data
    }) => {
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
        user_agent: userAgent
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
        variant: 'destructive'
      });
      return;
    }
    
    // Check for compromised/common passwords
    const securityCheck = checkPasswordSecurity(password);
    if (securityCheck.isCompromised) {
      toast({
        title: 'Weak Password Detected',
        description: securityCheck.reason || 'Please choose a stronger, more unique password',
        variant: 'destructive'
      });
      return;
    }
    
    if (!tosAccepted) {
      toast({
        title: 'Terms Required',
        description: 'You must accept the Terms of Service and Privacy Policy to continue',
        variant: 'destructive'
      });
      return;
    }
    if (isSignUp && !fullName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter your full name',
        variant: 'destructive'
      });
      return;
    }
    
    // Check rate limit before attempting sign up
    const rateLimitResult = await checkRateLimit('sign_up', email);
    if (!rateLimitResult.allowed) {
      const retryTime = rateLimitResult.retry_after_seconds || 300;
      toast({
        title: 'Too Many Attempts',
        description: `Please wait ${formatRetryTime(retryTime)} before trying again.`,
        variant: 'destructive'
      });
      return;
    }
    
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName
          }
        }
      });
      if (error) throw error;
      if (data.user) {
        // Reset rate limit on successful signup
        await resetRateLimit('sign_up');
        // Record ToS acceptance
        await recordTosAcceptance(data.user.id);
        toast({
          title: 'Account Created',
          description: 'Welcome! Your account has been created successfully.'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Sign Up Failed',
        description: error.message || 'An error occurred during sign up',
        variant: 'destructive'
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
        variant: 'destructive'
      });
      return;
    }
    if (!password) {
      toast({
        title: 'Validation Error',
        description: 'Please enter your password',
        variant: 'destructive'
      });
      return;
    }
    
    // Check rate limit before attempting sign in
    const rateLimitResult = await checkRateLimit('sign_in', email);
    if (!rateLimitResult.allowed) {
      const retryTime = rateLimitResult.retry_after_seconds || 300;
      toast({
        title: 'Too Many Attempts',
        description: `Please wait ${formatRetryTime(retryTime)} before trying again.`,
        variant: 'destructive'
      });
      return;
    }
    
    setLoading(true);
    try {
      authFlowRef.current = true; // Start auth flow
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;

      // Reset rate limit on successful login
      await resetRateLimit('sign_in');

      // After successful password auth, check for MFA requirement
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();

      // List all factors to check for MFA
      const {
        data: factorsData,
        error: factorsError
      } = await supabase.auth.mfa.listFactors();
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
        // Keep authFlowRef.current = true to block redirects until challenge success
        return;
      }

      // No MFA or not verified - proceed to app
      authFlowRef.current = false;
      toast({
        title: 'Welcome Back',
        description: 'You have successfully signed in.'
      });
      const startingPage = await getUserStartingPage();
      navigate(startingPage);
    } catch (error: any) {
      toast({
        title: 'Sign In Failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive'
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
        variant: 'destructive'
      });
      return;
    }
    setLoading(true);
    try {
      const {
        error
      } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`
      });
      if (error) throw error;
      toast({
        title: 'Reset Email Sent',
        description: 'Check your email for a password reset link. The link will be valid for 1 hour.'
      });
      setIsResetPassword(false);
      setEmail('');
    } catch (error: any) {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to send reset email. Please try again.',
        variant: 'destructive'
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
        variant: 'destructive'
      });
      return;
    }
    setLoading(true);
    try {
      // First, try to refresh the session to ensure it's still valid
      const {
        data: {
          session: currentSession
        },
        error: refreshError
      } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('Session refresh failed:', refreshError);
        // If refresh fails, try to get the existing session one more time
        const {
          data: {
            session: existingSession
          },
          error: sessionError
        } = await supabase.auth.getSession();
        if (sessionError || !existingSession) {
          console.error('No active session after refresh attempt:', sessionError);
          toast({
            title: 'Recovery Link Expired',
            description: 'Your password recovery link has expired or is invalid. Please request a new one.',
            variant: 'destructive'
          });
          setIsUpdatingPassword(false);
          setIsResetPassword(true);
          return;
        }
      }
      console.log('Session is valid, updating password...');
      const {
        error: updateError
      } = await supabase.auth.updateUser({
        password: password
      });
      if (updateError) {
        console.error('Password update error:', updateError);

        // Handle specific error cases
        if (updateError.message?.toLowerCase().includes('invalid') || updateError.message?.toLowerCase().includes('expired') || updateError.message?.toLowerCase().includes('session')) {
          toast({
            title: 'Recovery Link Error',
            description: 'Your password recovery link has expired or is invalid. Please request a new password reset.',
            variant: 'destructive'
          });
          setIsUpdatingPassword(false);
          setIsResetPassword(true);
          return;
        }
        throw updateError;
      }
      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully updated. You can now sign in.'
      });
      setIsUpdatingPassword(false);
      setPassword('');

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      const startingPage = await getUserStartingPage();
      navigate(startingPage);
    } catch (error: any) {
      console.error('Update password failed:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Show MFA challenge if needed
  if (showMfaChallenge && mfaFactorId) {
    return <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4 animate-in fade-in duration-500">
        <div className="w-full max-w-md animate-in slide-in-from-bottom-4 duration-700">
          <div className="text-center mb-6">
            <img src={wisdmLogo} alt="WISDM Logo" className="h-14 w-auto mx-auto mb-4 animate-in zoom-in duration-500" />
          </div>
          <MFAChallenge factorId={mfaFactorId} onSuccess={async () => {
          const startingPage = await getUserStartingPage();
          navigate(startingPage);
        }} onCancel={() => {
          setShowMfaChallenge(false);
          setMfaFactorId(null);
          supabase.auth.signOut();
        }} />
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-500">
      <Card className="w-full max-w-md p-4 sm:p-8 bg-card/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-700 hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] transition-shadow border-2">
        <div className="text-center mb-6 sm:mb-8 animate-in zoom-in duration-500 demo-logo">
          <div className="relative inline-block mb-3 sm:mb-4">
            <img src={wisdmLogo} alt="WISDM Logo" className="h-12 sm:h-14 w-auto mx-auto transition-transform hover:scale-110 duration-300" />
            <div className="absolute -top-1 -right-1 animate-pulse">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            WISDM Capture Pro
          </h1>
          <p className="text-muted-foreground text-sm">
            {isUpdatingPassword
              ? 'Enter your new password to finish resetting your account.'
              : isResetPassword
              ? 'Request a reset link. You will set your new password on our secure reset page, then return here to sign in.'
              : isSignUp
              ? 'Create your account'
              : 'Sign in to access your account'}
          </p>
        </div>

        {/* Rate limit warning */}
        {isBlocked && retryAfter && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg animate-in slide-in-from-top-2 duration-300">
            <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Too many failed attempts</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                Please wait {formatRetryTime(retryAfter)} before trying again
              </p>
            </div>
          </div>
        )}

        <form onSubmit={isUpdatingPassword ? handleUpdatePassword : isResetPassword ? handleResetPassword : isSignUp ? handleSignUp : handleSignIn} className="space-y-4 sm:space-y-5">
          {isSignUp && !isUpdatingPassword && <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
              <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} className="transition-all focus:ring-2 focus:ring-primary/20" required disabled={isBlocked} />
            </div>}

          {!isUpdatingPassword && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="transition-all focus:ring-2 focus:ring-primary/20"
                required
                disabled={isBlocked}
              />
              {isResetPassword && (
                <p className="text-xs text-muted-foreground mt-1">
                  We&rsquo;ll email you a secure reset link. When you click it, you&rsquo;ll briefly see a
                  Lovable-branded reset page to choose a new password, then you&rsquo;ll be sent back here to sign in.
                </p>
              )}
            </div>
          )}

          {!isResetPassword && <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">{isUpdatingPassword ? 'New Password' : 'Password'}</Label>
                {!isSignUp && !isUpdatingPassword && <button type="button" onClick={() => setIsResetPassword(true)} className="text-xs text-primary hover:underline transition-colors hover:text-primary/80">
                    Forgot password?
                  </button>}
              </div>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)} className="transition-all focus:ring-2 focus:ring-primary/20" required disabled={isBlocked} />
            {(isSignUp || isUpdatingPassword) && password && <div className="space-y-3 mt-3 p-4 bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg border border-border/50 backdrop-blur-sm animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Password Strength:</span>
                  <span className={`text-xs font-bold ${passwordStrength <= 2 ? 'text-red-600' : passwordStrength <= 3 ? 'text-orange-600' : passwordStrength <= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {getStrengthText()}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= passwordStrength ? getStrengthColor() : 'bg-muted'}`} />)}
                </div>
                <div className="space-y-2 text-xs">
                  <div className={`flex items-center gap-2 transition-all duration-200 ${passwordChecks.minLength ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.minLength ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-2 transition-all duration-200 ${passwordChecks.hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.hasUppercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    <span>One uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-2 transition-all duration-200 ${passwordChecks.hasLowercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.hasLowercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    <span>One lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-2 transition-all duration-200 ${passwordChecks.hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.hasNumber ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    <span>One number</span>
                  </div>
                  <div className={`flex items-center gap-2 transition-all duration-200 ${passwordChecks.hasSpecial ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordChecks.hasSpecial ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    <span>One special character (!@#$%^&*)</span>
                  </div>
                  {passwordSecurityCheck.isCompromised && (
                    <div className="flex items-start gap-2 mt-2 p-2 bg-destructive/10 rounded border border-destructive/30 text-destructive">
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{passwordSecurityCheck.reason}</span>
                    </div>
                  )}
                </div>
              </div>}
            </div>}

          {isSignUp && !isUpdatingPassword && <div className="flex items-start space-x-3 pt-2 p-3 bg-muted/30 rounded-lg border border-border/50 animate-in slide-in-from-top-2 duration-300">
              <Checkbox id="tos" checked={tosAccepted} onCheckedChange={checked => setTosAccepted(checked === true)} className="mt-1 transition-all" />
              <Label htmlFor="tos" className="text-sm font-normal leading-relaxed cursor-pointer">
                I agree to the{' '}
                <Link to="/terms-of-service" target="_blank" className="text-primary hover:underline transition-colors hover:text-primary/80">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link to="/privacy-policy" target="_blank" className="text-primary hover:underline transition-colors hover:text-primary/80">
                  Privacy Policy
                </Link>
                {currentTosVersion && <span className="text-xs text-muted-foreground block mt-1">
                    Version {currentTosVersion.tos_version}
                  </span>}
              </Label>
            </div>}

          <Button type="submit" className="w-full mt-6 h-11 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" disabled={loading || establishingSession || isBlocked || (isSignUp && !tosAccepted)}>
            {loading || establishingSession ? establishingSession ? 'Establishing Session...' : 'Please wait...' : isBlocked ? 'Temporarily Locked' : isUpdatingPassword ? 'Update Password' : isResetPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>

          {!isUpdatingPassword && <div className="text-center text-sm space-y-2 pt-2">
              {isResetPassword ? <button type="button" onClick={() => {
            setIsResetPassword(false);
            setPassword('');
          }} className="text-primary hover:underline transition-all hover:text-primary/80 font-medium">
                  Back to sign in
                </button> : <button type="button" onClick={() => {
            setIsSignUp(!isSignUp);
            setTosAccepted(false);
            setIsResetPassword(false);
          }} className="text-primary hover:underline transition-all hover:text-primary/80 font-medium">
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>}
            </div>}
        </form>

        {isSignUp && <div className="mt-6 p-4 bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg border border-border/50 animate-in slide-in-from-bottom-2 duration-500">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Legal Compliance:</strong> By creating an account, you acknowledge that your acceptance
              will be recorded with timestamp and version information for regulatory compliance.
            </p>
          </div>}
      </Card>
    </div>;
};
export default AuthPage;
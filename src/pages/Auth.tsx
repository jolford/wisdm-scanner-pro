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
import wisdmLogo from '@/assets/wisdm-logo.png';

const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

const AuthPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [currentTosVersion, setCurrentTosVersion] = useState<{ tos_version: string; privacy_policy_version: string } | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });

    // Fetch current ToS version
    supabase
      .from('tos_versions')
      .select('tos_version, privacy_policy_version')
      .eq('is_current', true)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setCurrentTosVersion(data);
        }
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
      passwordSchema.parse(password);
    } catch (error: any) {
      toast({
        title: 'Validation Error',
        description: error.errors?.[0]?.message || 'Please check your inputs',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
        <div className="text-center mb-8">
          <img src={wisdmLogo} alt="WISDM Logo" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">WISDM Scanner Pro</h1>
          <p className="text-muted-foreground">
            {isSignUp ? 'Create your account' : 'Sign in to access your account'}
          </p>
        </div>

        <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
          {isSignUp && (
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

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {isSignUp && (
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            )}
          </div>

          {isSignUp && (
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
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>

          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setTosAccepted(false);
              }}
              className="text-primary hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
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

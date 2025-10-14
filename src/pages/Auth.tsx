import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import wisdmLogo from '@/assets/wisdm-logo.png';

const AuthPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
        <div className="text-center mb-8">
          <img src={wisdmLogo} alt="WISDM Logo" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">WISDM Scanner Pro</h1>
          <p className="text-muted-foreground">Sign in to access your account</p>
        </div>
        
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(214 95% 36%)',
                  brandAccent: 'hsl(195 100% 48%)',
                },
              },
            },
          }}
          providers={[]}
        />
      </Card>
    </div>
  );
};

export default AuthPage;

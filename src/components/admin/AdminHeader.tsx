import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, LogOut, Settings, HelpCircle, BookOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AdminHeader() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const displayName = authUser.user_metadata?.full_name || 
                           authUser.user_metadata?.name || 
                           authUser.email?.split('@')[0] || 
                           'User';
        
        setUser({
          email: authUser.email,
          full_name: displayName,
        });
      }
    };
    getUser();
  }, []);

  // Fetch notifications/alerts count
  const { data: alertCount } = useQuery({
    queryKey: ['admin-alerts-count'],
    queryFn: async () => {
      const [exceptionsResult, costAlertsResult] = await Promise.all([
        supabase
          .from('document_exceptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('cost_alerts')
          .select('*', { count: 'exact', head: true })
          .eq('acknowledged', false),
      ]);
      
      return (exceptionsResult.count || 0) + (costAlertsResult.count || 0);
    },
    refetchInterval: 60000,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const openCommandPalette = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search shortcut */}
      <Button
        variant="outline"
        size="sm"
        className="hidden md:flex items-center gap-2 text-muted-foreground h-9 px-3"
        onClick={openCommandPalette}
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Search...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <LanguageSelector variant="dropdown" />

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-4 w-4" />
            {alertCount && alertCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
              >
                {alertCount > 99 ? '99+' : alertCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            Notifications
            {alertCount && alertCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {alertCount} new
              </Badge>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {alertCount && alertCount > 0 ? (
            <>
              <DropdownMenuItem onClick={() => navigate('/admin/exceptions')}>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Pending Exceptions</span>
                  <span className="text-xs text-muted-foreground">Documents require attention</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/admin/cost-tracking')}>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Cost Alerts</span>
                  <span className="text-xs text-muted-foreground">Budget thresholds reached</span>
                </div>
              </DropdownMenuItem>
            </>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-sm">
              No new notifications
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/admin/exceptions')} className="justify-center text-primary">
            View all notifications
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* API Docs */}
      <Button 
        variant="ghost" 
        size="icon"
        onClick={() => navigate('/api-docs')}
        className="h-9 w-9"
        title="API Documentation"
      >
        <BookOpen className="h-4 w-4" />
      </Button>

      <ThemeToggle />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.full_name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/help')}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Help Center
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
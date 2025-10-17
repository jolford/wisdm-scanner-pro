import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Building2,
  Key,
  BarChart3,
  LogOut,
  Menu,
  FileText,
  AlertCircle,
  HelpCircle,
  DollarSign,
} from 'lucide-react';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const menuItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Projects', url: '/admin/projects', icon: FolderOpen },
  { title: 'Documents', url: '/admin/documents', icon: FileText },
  { title: 'Customers', url: '/admin/customers', icon: Building2 },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'Licenses', url: '/admin/licenses', icon: Key },
  { title: 'Cost Tracking', url: '/admin/cost-tracking', icon: DollarSign },
  { title: 'Analytics', url: '/admin/analytics', icon: BarChart3 },
  { title: 'Error Logs', url: '/admin/error-logs', icon: AlertCircle },
];

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-accent/5">
        <Sidebar className="border-r border-border/50">
          <SidebarContent>
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <img src={wisdmLogo} alt="WISDM Logo" className="h-8 w-auto" />
                <div>
                  <p className="text-sm font-bold">WISDM</p>
                  <p className="text-xs text-muted-foreground">Admin Portal</p>
                </div>
              </div>
            </div>

            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.url)}
                        className={
                          isActive(item.url)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <div className="mt-auto p-4 border-t border-border/50">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/help')}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Help Center
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start mt-2"
                onClick={() => navigate('/')}
              >
                Back to Scanner
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start mt-2 text-destructive hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <SidebarTrigger>
                    <Menu className="h-5 w-5" />
                  </SidebarTrigger>
                  <div>
                    <h1 className="text-xl font-bold">{title}</h1>
                    {description && (
                      <p className="text-sm text-muted-foreground">{description}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
          
        </div>
      </div>
    </SidebarProvider>
  );
}
